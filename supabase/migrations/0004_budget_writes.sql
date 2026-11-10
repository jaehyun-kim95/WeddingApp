-- Phase 1 비용(budget) 슬라이스 — 예산 저장소 + 비용 쓰기 RPC (ADR-0003 / ADR-0004).
-- 이전 슬라이스(0002·0003)는 '쓰기 RPC만' 추가했지만, 비용은 커플 스키마를 확장한다
-- (예산 저장소가 데이터 모델에 없었음) → 컬럼/테이블 추가 + 스냅샷 함수·트리거까지 함께 손댄다.
-- forward-only: 새(이미 0001~0003 적용된) 프로젝트의 SQL Editor에 전체를 1회 실행.

-- ===========================================================================
-- 1. 스키마 변경 (컬럼은 default/nullable → 기존 행 보존, 하위 호환)
-- ===========================================================================
alter table couple  add column if not exists total_budget bigint not null default 0;  -- 전체 예산
alter table payment add column if not exists payer payer;  -- 분담 정산 소스(nullable, ADR-0004)

create table if not exists area_budget (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  couple_id  uuid not null references couple(id) on delete cascade,
  area_id    uuid not null references area(id),
  amount     bigint not null default 0,
  constraint area_budget_unique unique (couple_id, area_id)  -- 영역당 예산 1행(upsert)
);
create index if not exists idx_area_budget_couple on area_budget(couple_id);
alter table area_budget enable row level security;  -- 정책 없음 = anon 직접 접근 차단(커플 테이블 관례)

-- Broadcast 트리거(area_budget만 신규 — 나머지 커플 테이블 트리거는 0001에 이미 있음)
drop trigger if exists trg_bc_area_budget on area_budget;
create trigger trg_bc_area_budget after insert or update or delete
  on area_budget for each row execute function broadcast_couple_change();

-- ===========================================================================
-- 2. 스냅샷 함수 재작성 — area_budgets 슬라이스 추가
--    (couple.total_budget·payment.payer는 to_jsonb(v)/to_jsonb(t)라 자동 포함)
-- ===========================================================================
create or replace function public.get_couple_snapshot(p_share_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v couple%rowtype;
begin
  select * into v from couple where share_code = p_share_code;
  if not found then
    raise exception 'invalid share code' using errcode = 'PT401';
  end if;

  return jsonb_build_object(
    'couple',          to_jsonb(v),
    'checklist_items', coalesce((select jsonb_agg(to_jsonb(t) order by t.sort_order) from checklist_item t where t.couple_id = v.id), '[]'::jsonb),
    'schedule_events', coalesce((select jsonb_agg(to_jsonb(t) order by t.event_date) from schedule_event t where t.couple_id = v.id), '[]'::jsonb),
    'vendors',         coalesce((select jsonb_agg(to_jsonb(t)) from vendor t         where t.couple_id = v.id), '[]'::jsonb),
    'expenses',        coalesce((select jsonb_agg(to_jsonb(t)) from expense t        where t.couple_id = v.id), '[]'::jsonb),
    'expense_options', coalesce((select jsonb_agg(to_jsonb(t)) from expense_option t where t.couple_id = v.id), '[]'::jsonb),
    'expense_splits',  coalesce((select jsonb_agg(to_jsonb(t)) from expense_split t  where t.couple_id = v.id), '[]'::jsonb),
    'payments',        coalesce((select jsonb_agg(to_jsonb(t)) from payment t        where t.couple_id = v.id), '[]'::jsonb),
    'area_budgets',    coalesce((select jsonb_agg(to_jsonb(t)) from area_budget t    where t.couple_id = v.id), '[]'::jsonb),
    'guests',          coalesce((select jsonb_agg(to_jsonb(t)) from guest t          where t.couple_id = v.id), '[]'::jsonb),
    'photos',          coalesce((select jsonb_agg(to_jsonb(t)) from photo t          where t.couple_id = v.id), '[]'::jsonb)
  );
end;
$$;

-- ===========================================================================
-- 3. 쓰기 RPC — 비용(ADR-0003: 커플 테이블은 security-definer로만, p_share_code로 couple 해소)
-- ===========================================================================

-- 지출 생성(원자적) — expense + 옵션들 + 납부들을 한 트랜잭션에 insert. 생성된 expense 행 반환.
-- p_options: [{name, amount}], p_payments: [{kind, amount, due_date?, payer?, is_paid?}]
-- vendor 미연결(직접 지출)이면 p_title 필수(expense_direct_has_title check가 강제).
create or replace function public.create_expense(
  p_share_code text, p_area_id uuid, p_vendor_id uuid, p_title text,
  p_base_amount bigint, p_options jsonb, p_payments jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_couple uuid; v_exp expense%rowtype; v_o jsonb; v_p jsonb; v_paid boolean;
begin
  select id into v_couple from couple where share_code = p_share_code;
  if not found then raise exception 'invalid share code' using errcode = 'PT401'; end if;

  insert into expense (couple_id, area_id, vendor_id, title, base_amount)
    values (v_couple, p_area_id, p_vendor_id, nullif(p_title, ''), coalesce(p_base_amount, 0))
    returning * into v_exp;

  for v_o in select * from jsonb_array_elements(coalesce(p_options, '[]'::jsonb)) loop
    insert into expense_option (couple_id, expense_id, name, amount)
      values (v_couple, v_exp.id, v_o->>'name', (v_o->>'amount')::bigint);
  end loop;

  for v_p in select * from jsonb_array_elements(coalesce(p_payments, '[]'::jsonb)) loop
    v_paid := coalesce((v_p->>'is_paid')::boolean, false);
    insert into payment (couple_id, expense_id, kind, amount, due_date, payer, is_paid, paid_at)
      values (v_couple, v_exp.id, (v_p->>'kind')::payment_kind, (v_p->>'amount')::bigint,
              nullif(v_p->>'due_date', '')::date, nullif(v_p->>'payer', '')::payer,
              v_paid, case when v_paid then now() else null end);
  end loop;

  return to_jsonb(v_exp);
end; $$;

-- 지출 수정 — 영역·업체는 생성 시 고정(체크리스트 관례), 기본 정보만.
create or replace function public.update_expense(
  p_share_code text, p_id uuid, p_title text, p_base_amount bigint
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_couple uuid; v_exp expense%rowtype;
begin
  select id into v_couple from couple where share_code = p_share_code;
  if not found then raise exception 'invalid share code' using errcode = 'PT401'; end if;
  update expense set title = nullif(p_title, ''), base_amount = coalesce(p_base_amount, 0)
    where id = p_id and couple_id = v_couple returning * into v_exp;
  if not found then raise exception 'expense not found' using errcode = 'PT404'; end if;
  return to_jsonb(v_exp);
end; $$;

-- 지출 삭제 — FK on delete cascade로 옵션·분담·납부 동반 삭제.
create or replace function public.delete_expense(
  p_share_code text, p_id uuid
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_couple uuid; v_deleted uuid;
begin
  select id into v_couple from couple where share_code = p_share_code;
  if not found then raise exception 'invalid share code' using errcode = 'PT401'; end if;
  delete from expense where id = p_id and couple_id = v_couple returning id into v_deleted;
  if v_deleted is null then raise exception 'expense not found' using errcode = 'PT404'; end if;
  return jsonb_build_object('id', v_deleted);
end; $$;

-- 업체 인라인 최소 생성 — 비용 화면에서 지출에 묶을 업체. status 기본 CONTRACTED(지출=계약), role null.
create or replace function public.create_vendor(
  p_share_code text, p_area_id uuid, p_name text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_couple uuid; v_row vendor%rowtype;
begin
  select id into v_couple from couple where share_code = p_share_code;
  if not found then raise exception 'invalid share code' using errcode = 'PT401'; end if;
  insert into vendor (couple_id, area_id, name, status)
    values (v_couple, p_area_id, p_name, 'CONTRACTED') returning * into v_row;
  return to_jsonb(v_row);
end; $$;

-- 옵션 추가/삭제 — 기존 지출에. 지출이 같은 커플 소속인지 확인(교차 접근 차단).
create or replace function public.add_expense_option(
  p_share_code text, p_expense_id uuid, p_name text, p_amount bigint
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_couple uuid; v_row expense_option%rowtype;
begin
  select id into v_couple from couple where share_code = p_share_code;
  if not found then raise exception 'invalid share code' using errcode = 'PT401'; end if;
  if not exists (select 1 from expense where id = p_expense_id and couple_id = v_couple) then
    raise exception 'expense not found' using errcode = 'PT404'; end if;
  insert into expense_option (couple_id, expense_id, name, amount)
    values (v_couple, p_expense_id, p_name, p_amount) returning * into v_row;
  return to_jsonb(v_row);
end; $$;

create or replace function public.delete_expense_option(
  p_share_code text, p_id uuid
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_couple uuid; v_deleted uuid;
begin
  select id into v_couple from couple where share_code = p_share_code;
  if not found then raise exception 'invalid share code' using errcode = 'PT401'; end if;
  delete from expense_option where id = p_id and couple_id = v_couple returning id into v_deleted;
  if v_deleted is null then raise exception 'option not found' using errcode = 'PT404'; end if;
  return jsonb_build_object('id', v_deleted);
end; $$;

-- 납부 추가/수정/삭제 + 완료 토글. is_paid ↔ paid_at 쌍 불변식(payment_paid_pair) 유지.
create or replace function public.add_payment(
  p_share_code text, p_expense_id uuid, p_kind payment_kind, p_amount bigint,
  p_due_date date, p_payer payer, p_is_paid boolean
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_couple uuid; v_row payment%rowtype; v_paid boolean;
begin
  select id into v_couple from couple where share_code = p_share_code;
  if not found then raise exception 'invalid share code' using errcode = 'PT401'; end if;
  if not exists (select 1 from expense where id = p_expense_id and couple_id = v_couple) then
    raise exception 'expense not found' using errcode = 'PT404'; end if;
  v_paid := coalesce(p_is_paid, false);
  insert into payment (couple_id, expense_id, kind, amount, due_date, payer, is_paid, paid_at)
    values (v_couple, p_expense_id, p_kind, p_amount, p_due_date, p_payer, v_paid,
            case when v_paid then now() else null end)
    returning * into v_row;
  return to_jsonb(v_row);
end; $$;

create or replace function public.update_payment(
  p_share_code text, p_id uuid, p_kind payment_kind, p_amount bigint,
  p_due_date date, p_payer payer, p_is_paid boolean
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_couple uuid; v_row payment%rowtype; v_paid boolean;
begin
  select id into v_couple from couple where share_code = p_share_code;
  if not found then raise exception 'invalid share code' using errcode = 'PT401'; end if;
  v_paid := coalesce(p_is_paid, false);
  update payment set kind = p_kind, amount = p_amount, due_date = p_due_date, payer = p_payer,
    is_paid = v_paid, paid_at = case when v_paid then now() else null end
    where id = p_id and couple_id = v_couple returning * into v_row;
  if not found then raise exception 'payment not found' using errcode = 'PT404'; end if;
  return to_jsonb(v_row);
end; $$;

create or replace function public.delete_payment(
  p_share_code text, p_id uuid
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_couple uuid; v_deleted uuid;
begin
  select id into v_couple from couple where share_code = p_share_code;
  if not found then raise exception 'invalid share code' using errcode = 'PT401'; end if;
  delete from payment where id = p_id and couple_id = v_couple returning id into v_deleted;
  if v_deleted is null then raise exception 'payment not found' using errcode = 'PT404'; end if;
  return jsonb_build_object('id', v_deleted);
end; $$;

create or replace function public.toggle_payment_paid(
  p_share_code text, p_id uuid, p_is_paid boolean
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_couple uuid; v_row payment%rowtype;
begin
  select id into v_couple from couple where share_code = p_share_code;
  if not found then raise exception 'invalid share code' using errcode = 'PT401'; end if;
  update payment set is_paid = p_is_paid, paid_at = case when p_is_paid then now() else null end
    where id = p_id and couple_id = v_couple returning * into v_row;
  if not found then raise exception 'payment not found' using errcode = 'PT404'; end if;
  return to_jsonb(v_row);
end; $$;

-- 영역 예산 upsert(영역당 1행) + 전체 예산 갱신.
create or replace function public.set_area_budget(
  p_share_code text, p_area_id uuid, p_amount bigint
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_couple uuid; v_row area_budget%rowtype;
begin
  select id into v_couple from couple where share_code = p_share_code;
  if not found then raise exception 'invalid share code' using errcode = 'PT401'; end if;
  insert into area_budget (couple_id, area_id, amount)
    values (v_couple, p_area_id, coalesce(p_amount, 0))
    on conflict (couple_id, area_id) do update set amount = excluded.amount
    returning * into v_row;
  return to_jsonb(v_row);
end; $$;

create or replace function public.update_total_budget(
  p_share_code text, p_amount bigint
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_couple uuid; v_amount bigint;
begin
  select id into v_couple from couple where share_code = p_share_code;
  if not found then raise exception 'invalid share code' using errcode = 'PT401'; end if;
  update couple set total_budget = coalesce(p_amount, 0) where id = v_couple
    returning total_budget into v_amount;
  return jsonb_build_object('total_budget', v_amount);
end; $$;

-- ===========================================================================
-- 4. 실행 권한 — anon이 호출 가능(share_code를 가진 커플만 자기 데이터 쓰기)
-- ===========================================================================
grant execute on function public.create_expense(text,uuid,uuid,text,bigint,jsonb,jsonb) to anon;
grant execute on function public.update_expense(text,uuid,text,bigint)                   to anon;
grant execute on function public.delete_expense(text,uuid)                               to anon;
grant execute on function public.create_vendor(text,uuid,text)                           to anon;
grant execute on function public.add_expense_option(text,uuid,text,bigint)               to anon;
grant execute on function public.delete_expense_option(text,uuid)                        to anon;
grant execute on function public.add_payment(text,uuid,payment_kind,bigint,date,payer,boolean) to anon;
grant execute on function public.update_payment(text,uuid,payment_kind,bigint,date,payer,boolean) to anon;
grant execute on function public.delete_payment(text,uuid)                               to anon;
grant execute on function public.toggle_payment_paid(text,uuid,boolean)                  to anon;
grant execute on function public.set_area_budget(text,uuid,bigint)                       to anon;
grant execute on function public.update_total_budget(text,bigint)                        to anon;
