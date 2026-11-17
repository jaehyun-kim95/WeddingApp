-- Phase 3 백업 복원 RPC — 현재 커플로의 전체 교체(destructive replace, ADR-0009).
--
-- 내보내기는 기존 get_couple_snapshot(0001·0004)을 그대로 쓰므로 새 함수가 없다. 가져오기(복원)만
-- 커플 범위 11개 테이블을 다시 쓰는 전용 RPC가 필요해 여기에 추가한다. 한 트랜잭션 안에서
--   ① couple 본체 덮어쓰기(id·share_code·created_at는 현재 값 유지 — 접속 비밀/격리 키는 백업이 못 바꾼다)
--   ② 현재 커플의 모든 자식 행을 FK 역순으로 삭제
--   ③ 백업 행을 FK 정순으로 재삽입(내부 UUID는 신뢰하지 않고 새로 발급, 상대 관계는 old→new 매핑으로
--      재연결, 전역 area는 area_code로 재해소)
-- 를 수행하고 갱신된 스냅샷을 반환한다. 실패 시 전체 롤백("반쯤 복원"이 없다), 같은 백업을 두 번
-- 복원해도 UUID만 다르고 최종 상태는 동일(멱등).
--
-- forward-only: 0001~0009가 적용된 프로젝트의 SQL Editor에 전체를 1회 실행한다(CLI 링크 없음).
-- 신규 함수라 오버로드 걱정 없음. get_couple_snapshot에 새 커플 테이블/컬럼이 추가되면 이 함수의
-- 삭제·재삽입 목록도 함께 갱신해야 한다(ADR-0009 — 스냅샷·write·broadcast·복원 4곳 동기화 규칙).

create or replace function public.restore_couple_backup(p_share_code text, p_bundle jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_couple uuid;
  v_d      jsonb := p_bundle;      -- BackupData 본체(couple + 10개 배열)
  v_c      jsonb := p_bundle->'couple';
  r        jsonb;                  -- 반복 중인 백업 행
  v_new_id uuid;                   -- 방금 삽입한 행의 새 UUID
begin
  select id into v_couple from couple where share_code = p_share_code;
  if not found then raise exception 'invalid share code' using errcode = 'PT401'; end if;

  -- ── 1) couple 본체 덮어쓰기 (id/share_code/created_at 유지) ──
  update couple set
    groom_name           = v_c->>'groom_name',
    bride_name           = v_c->>'bride_name',
    wedding_date         = nullif(v_c->>'wedding_date', '')::date,
    wedding_date_status  = (v_c->>'wedding_date_status')::wedding_date_status,
    wedding_time         = nullif(v_c->>'wedding_time', '')::time,
    venue                = nullif(v_c->>'venue', ''),
    show_auspicious_days = coalesce((v_c->>'show_auspicious_days')::boolean, true),
    notify_payments      = coalesce((v_c->>'notify_payments')::boolean, true),
    total_budget         = coalesce((v_c->>'total_budget')::bigint, 0),
    meal_price           = coalesce((v_c->>'meal_price')::bigint, 0)
  where id = v_couple;

  -- ── 2) 자식 전부 삭제 (FK 역순) ──
  delete from payment        where couple_id = v_couple;
  delete from expense_option where couple_id = v_couple;
  delete from expense_split  where couple_id = v_couple;
  delete from expense        where couple_id = v_couple;
  delete from area_budget    where couple_id = v_couple;
  delete from checklist_item where couple_id = v_couple;
  delete from schedule_event where couple_id = v_couple;
  delete from guest          where couple_id = v_couple;
  delete from photo          where couple_id = v_couple;
  delete from vendor         where couple_id = v_couple;

  -- ── 3) old→new UUID 매핑 테이블 (vendor·expense 2레벨만 필요) ──
  drop table if exists _vendor_map;
  drop table if exists _expense_map;
  create temporary table _vendor_map  (old_id uuid primary key, new_id uuid not null) on commit drop;
  create temporary table _expense_map (old_id uuid primary key, new_id uuid not null) on commit drop;

  -- ── 4) 재삽입 (FK 정순) ──

  -- vendor — area_code 재해소. old→new 매핑 적재.
  for r in select * from jsonb_array_elements(coalesce(v_d->'vendors', '[]'::jsonb)) loop
    insert into vendor (couple_id, area_id, name, status, role, location, contract_date, quoted_price, memo)
    values (
      v_couple,
      (select id from area where code = r->>'area_code'),
      r->>'name',
      (r->>'status')::vendor_status,
      nullif(r->>'role', '')::vendor_role,
      nullif(r->>'location', ''),
      nullif(r->>'contract_date', '')::date,
      nullif(r->>'quoted_price', '')::bigint,
      nullif(r->>'memo', '')
    ) returning id into v_new_id;
    insert into _vendor_map(old_id, new_id) values ((r->>'id')::uuid, v_new_id);
  end loop;

  -- expense — area_code 재해소 + vendor_id는 _vendor_map으로 재연결. old→new 매핑 적재.
  for r in select * from jsonb_array_elements(coalesce(v_d->'expenses', '[]'::jsonb)) loop
    insert into expense (couple_id, area_id, vendor_id, title, base_amount)
    values (
      v_couple,
      (select id from area where code = r->>'area_code'),
      (select new_id from _vendor_map where old_id = nullif(r->>'vendor_id', '')::uuid),
      nullif(r->>'title', ''),
      coalesce((r->>'base_amount')::bigint, 0)
    ) returning id into v_new_id;
    insert into _expense_map(old_id, new_id) values ((r->>'id')::uuid, v_new_id);
  end loop;

  -- expense_option / expense_split / payment — expense_id를 _expense_map으로 재연결(집합 삽입).
  insert into expense_option (couple_id, expense_id, name, amount)
  select v_couple, m.new_id, r->>'name', (r->>'amount')::bigint
  from jsonb_array_elements(coalesce(v_d->'expense_options', '[]'::jsonb)) r
  join _expense_map m on m.old_id = (r->>'expense_id')::uuid;

  insert into expense_split (couple_id, expense_id, payer, amount)
  select v_couple, m.new_id, (r->>'payer')::payer, (r->>'amount')::bigint
  from jsonb_array_elements(coalesce(v_d->'expense_splits', '[]'::jsonb)) r
  join _expense_map m on m.old_id = (r->>'expense_id')::uuid;

  insert into payment (couple_id, expense_id, kind, amount, due_date, payer, is_paid, paid_at)
  select v_couple, m.new_id, (r->>'kind')::payment_kind, (r->>'amount')::bigint,
         nullif(r->>'due_date', '')::date, nullif(r->>'payer', '')::payer,
         coalesce((r->>'is_paid')::boolean, false), nullif(r->>'paid_at', '')::timestamptz
  from jsonb_array_elements(coalesce(v_d->'payments', '[]'::jsonb)) r
  join _expense_map m on m.old_id = (r->>'expense_id')::uuid;

  -- checklist_item — area_code 재해소(area_id not null). 집합 삽입.
  insert into checklist_item (couple_id, area_id, title, assignee, is_done, done_at, due_date, memo, origin, sort_order)
  select v_couple, (select id from area where code = r->>'area_code'),
         r->>'title', (r->>'assignee')::assignee,
         coalesce((r->>'is_done')::boolean, false), nullif(r->>'done_at', '')::timestamptz,
         nullif(r->>'due_date', '')::date, nullif(r->>'memo', ''),
         coalesce((r->>'origin')::origin, 'USER'), coalesce((r->>'sort_order')::int, 0)
  from jsonb_array_elements(coalesce(v_d->'checklist_items', '[]'::jsonb)) r;

  -- schedule_event — area_code 재해소(area_code null → area_id null).
  insert into schedule_event (couple_id, area_id, title, event_date, event_time, location, assignee, category, reminder_at, origin)
  select v_couple, (select id from area where code = r->>'area_code'),
         r->>'title', nullif(r->>'event_date', '')::date, nullif(r->>'event_time', '')::time,
         nullif(r->>'location', ''), nullif(r->>'assignee', '')::assignee,
         (r->>'category')::event_category, nullif(r->>'reminder_at', '')::timestamptz,
         coalesce((r->>'origin')::origin, 'USER')
  from jsonb_array_elements(coalesce(v_d->'schedule_events', '[]'::jsonb)) r;

  -- guest — area 없음.
  insert into guest (couple_id, name, side, relation, attend_status, is_host, meal_count, gift_amount, memo)
  select v_couple, r->>'name', (r->>'side')::guest_side, (r->>'relation')::guest_relation,
         coalesce((r->>'attend_status')::attend_status, 'MAYBE'), coalesce((r->>'is_host')::boolean, false),
         coalesce((r->>'meal_count')::int, 1), nullif(r->>'gift_amount', '')::bigint, nullif(r->>'memo', '')
  from jsonb_array_elements(coalesce(v_d->'guests', '[]'::jsonb)) r;

  -- photo — area_code 재해소(area_code null → area_id null). 메타데이터만(Storage 바이너리 범위 밖, ADR-0007).
  insert into photo (couple_id, area_id, storage_path, external_url, is_video, caption, taken_at, size_bytes)
  select v_couple, (select id from area where code = r->>'area_code'),
         nullif(r->>'storage_path', ''), nullif(r->>'external_url', ''),
         coalesce((r->>'is_video')::boolean, false), nullif(r->>'caption', ''),
         nullif(r->>'taken_at', '')::timestamptz, coalesce((r->>'size_bytes')::bigint, 0)
  from jsonb_array_elements(coalesce(v_d->'photos', '[]'::jsonb)) r;

  -- area_budget — area_code 재해소(area_id not null, 영역당 1행).
  insert into area_budget (couple_id, area_id, amount)
  select v_couple, (select id from area where code = r->>'area_code'), coalesce((r->>'amount')::bigint, 0)
  from jsonb_array_elements(coalesce(v_d->'area_budgets', '[]'::jsonb)) r;

  -- ── 5) 갱신된 스냅샷 반환(클라 캐시 갱신) ──
  return get_couple_snapshot(p_share_code);
end;
$$;

-- anon 호출 가능(share_code를 가진 커플만 자기 데이터 복원)
grant execute on function public.restore_couple_backup(text, jsonb) to anon;
