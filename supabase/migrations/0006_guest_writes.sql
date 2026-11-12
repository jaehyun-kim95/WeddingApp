-- Phase 2 하객(guests) 슬라이스 — 식대 단가 컬럼 + 하객 쓰기 RPC (ADR-0003).
-- guest 테이블·enum(guest_side/guest_relation/attend_status)·인덱스·RLS·broadcast 트리거(trg_bc_guest)와
-- get_couple_snapshot의 'guests' 슬라이스는 0001에 이미 있다 → 여기선 컬럼 1개 + 쓰기 RPC만 추가한다.
-- couple.meal_price는 스냅샷이 couple을 to_jsonb(v)로 빌드하므로 자동 포함(0004 total_budget 선례) —
-- 스냅샷 함수·트리거 재작성 불필요.
-- forward-only: 0001~0005가 적용된 프로젝트의 SQL Editor에 전체를 1회 실행.

-- ===========================================================================
-- 1. 스키마 변경 (default/not null → 기존 행 보존, 하위 호환)
-- ===========================================================================
alter table couple add column if not exists meal_price bigint not null default 0;  -- 1인 식대 단가(원)

-- ===========================================================================
-- 2. 하객 쓰기 RPC — 모두 security definer, p_share_code로 커플 해소(PT401), 행 없음 PT404
-- ===========================================================================
create or replace function public.create_guest(
  p_share_code text, p_name text, p_side guest_side, p_relation guest_relation,
  p_attend_status attend_status, p_is_host boolean, p_meal_count int,
  p_gift_amount bigint, p_memo text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_couple uuid; v_row guest%rowtype;
begin
  select id into v_couple from couple where share_code = p_share_code;
  if not found then raise exception 'invalid share code' using errcode = 'PT401'; end if;
  insert into guest (couple_id, name, side, relation, attend_status, is_host, meal_count, gift_amount, memo)
    values (v_couple, p_name, p_side, p_relation,
            coalesce(p_attend_status, 'MAYBE'), coalesce(p_is_host, false),
            coalesce(p_meal_count, 1), p_gift_amount, p_memo)
    returning * into v_row;
  return to_jsonb(v_row);
end; $$;

create or replace function public.update_guest(
  p_share_code text, p_id uuid, p_name text, p_side guest_side, p_relation guest_relation,
  p_attend_status attend_status, p_is_host boolean, p_meal_count int,
  p_gift_amount bigint, p_memo text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_couple uuid; v_row guest%rowtype;
begin
  select id into v_couple from couple where share_code = p_share_code;
  if not found then raise exception 'invalid share code' using errcode = 'PT401'; end if;
  update guest set
    name = p_name, side = p_side, relation = p_relation,
    attend_status = coalesce(p_attend_status, 'MAYBE'), is_host = coalesce(p_is_host, false),
    meal_count = coalesce(p_meal_count, 1), gift_amount = p_gift_amount, memo = p_memo
    where id = p_id and couple_id = v_couple returning * into v_row;
  if not found then raise exception 'guest not found' using errcode = 'PT404'; end if;
  return to_jsonb(v_row);
end; $$;

-- 행에서 참석/미정/불참 빠른 변경(toggle 패턴의 enum 변형)
create or replace function public.set_attend_status(
  p_share_code text, p_id uuid, p_status attend_status
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_couple uuid; v_row guest%rowtype;
begin
  select id into v_couple from couple where share_code = p_share_code;
  if not found then raise exception 'invalid share code' using errcode = 'PT401'; end if;
  update guest set attend_status = p_status
    where id = p_id and couple_id = v_couple returning * into v_row;
  if not found then raise exception 'guest not found' using errcode = 'PT404'; end if;
  return to_jsonb(v_row);
end; $$;

create or replace function public.delete_guest(
  p_share_code text, p_id uuid
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_couple uuid; v_deleted uuid;
begin
  select id into v_couple from couple where share_code = p_share_code;
  if not found then raise exception 'invalid share code' using errcode = 'PT401'; end if;
  delete from guest where id = p_id and couple_id = v_couple returning id into v_deleted;
  if v_deleted is null then raise exception 'guest not found' using errcode = 'PT404'; end if;
  return jsonb_build_object('id', v_deleted);
end; $$;

create or replace function public.update_meal_price(
  p_share_code text, p_amount bigint
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_couple uuid; v_amount bigint;
begin
  select id into v_couple from couple where share_code = p_share_code;
  if not found then raise exception 'invalid share code' using errcode = 'PT401'; end if;
  update couple set meal_price = coalesce(p_amount, 0) where id = v_couple
    returning meal_price into v_amount;
  return jsonb_build_object('meal_price', v_amount);
end; $$;

-- 엑셀 일괄 가져오기(원자적) — p_rows는 하객 객체의 jsonb 배열. 한 트랜잭션에 전체 insert(실패 시 전체 롤백).
-- append 방식: 기존 명단을 지우지 않고 추가한다(중복 이름 허용 — 동명이인 가능).
create or replace function public.import_guests(
  p_share_code text, p_rows jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_couple uuid; v_result jsonb;
begin
  select id into v_couple from couple where share_code = p_share_code;
  if not found then raise exception 'invalid share code' using errcode = 'PT401'; end if;
  with ins as (
    insert into guest (couple_id, name, side, relation, attend_status, is_host, meal_count, gift_amount, memo)
    select
      v_couple,
      r->>'name',
      (r->>'side')::guest_side,
      (r->>'relation')::guest_relation,
      coalesce((r->>'attend_status')::attend_status, 'MAYBE'),
      coalesce((r->>'is_host')::boolean, false),
      coalesce((r->>'meal_count')::int, 1),
      nullif(r->>'gift_amount', '')::bigint,
      nullif(r->>'memo', '')
    from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) as r
    returning *
  )
  select coalesce(jsonb_agg(to_jsonb(ins)), '[]'::jsonb) into v_result from ins;
  return v_result;
end; $$;

-- ===========================================================================
-- 3. 실행 권한 — anon이 호출 가능(share_code를 가진 커플만 자기 데이터 쓰기)
-- ===========================================================================
grant execute on function public.create_guest(text,text,guest_side,guest_relation,attend_status,boolean,int,bigint,text) to anon;
grant execute on function public.update_guest(text,uuid,text,guest_side,guest_relation,attend_status,boolean,int,bigint,text) to anon;
grant execute on function public.set_attend_status(text,uuid,attend_status)              to anon;
grant execute on function public.delete_guest(text,uuid)                                 to anon;
grant execute on function public.update_meal_price(text,bigint)                          to anon;
grant execute on function public.import_guests(text,jsonb)                               to anon;
