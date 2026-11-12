-- Phase 2 업체(vendors) 슬라이스 — 업체 쓰기 RPC 확장(ADR-0003 / ADR-0001).
-- vendor 테이블·enum(vendor_status/vendor_role)·인덱스·RLS·broadcast 트리거(trg_bc_vendor)와
-- get_couple_snapshot의 'vendors' 슬라이스는 0001에 이미 있다 → 여기선 쓰기 RPC만 추가/확장한다.
-- create_vendor는 0004(비용 화면 인라인 생성, 3-인자)가 이미 있다. 코드 리뷰로 발견: Postgres는
-- 인자 "타입 목록"이 다르면 CREATE OR REPLACE도 같은 함수를 치환하는 게 아니라 별도 오버로드를
-- 새로 만든다 — 3-인자 버전을 지우지 않고 9-인자(default) 버전만 추가하면 두 함수가 동시에
-- 존재해, 3개 인자만 넘기는 기존 호출(비용 화면)이 어느 쪽을 써야 할지 몰라 "function is not
-- unique" 모호성 에러로 깨진다. 그래서 먼저 3-인자 버전을 DROP하고, 그 이름 자리를 9-인자
-- (나머지 default) 버전 하나로 대체한다 — 기존 3-인자 호출은 defaults로 그대로 동작한다.
-- forward-only: 0001~0006이 적용된 프로젝트의 SQL Editor에 전체를 1회 실행.

-- ===========================================================================
-- 1. create_vendor 확장 — status/role/location/contract_date/quoted_price/memo를 선택 인자로 추가
--    (기존 3-인자 오버로드를 먼저 지워 모호성을 없앤다 — 위 주석 참고)
-- ===========================================================================
drop function if exists public.create_vendor(text, uuid, text);

create or replace function public.create_vendor(
  p_share_code text, p_area_id uuid, p_name text,
  p_status vendor_status default 'CONTRACTED', p_role vendor_role default null,
  p_location text default null, p_contract_date date default null,
  p_quoted_price bigint default null, p_memo text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_couple uuid; v_row vendor%rowtype;
begin
  select id into v_couple from couple where share_code = p_share_code;
  if not found then raise exception 'invalid share code' using errcode = 'PT401'; end if;
  insert into vendor (couple_id, area_id, name, status, role, location, contract_date, quoted_price, memo)
    values (v_couple, p_area_id, p_name, p_status, p_role, p_location, p_contract_date, p_quoted_price, p_memo)
    returning * into v_row;
  return to_jsonb(v_row);
end; $$;

-- ===========================================================================
-- 2. update_vendor — 전체 필드 갱신(상태 전환 CANDIDATE↔CONTRACTED도 이 함수 하나로)
-- ===========================================================================
create or replace function public.update_vendor(
  p_share_code text, p_id uuid, p_name text, p_status vendor_status,
  p_role vendor_role, p_location text, p_contract_date date, p_quoted_price bigint, p_memo text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_couple uuid; v_row vendor%rowtype;
begin
  select id into v_couple from couple where share_code = p_share_code;
  if not found then raise exception 'invalid share code' using errcode = 'PT401'; end if;
  update vendor set
    name = p_name, status = p_status, role = p_role, location = p_location,
    contract_date = p_contract_date, quoted_price = p_quoted_price, memo = p_memo
    where id = p_id and couple_id = v_couple returning * into v_row;
  if not found then raise exception 'vendor not found' using errcode = 'PT404'; end if;
  return to_jsonb(v_row);
end; $$;

-- ===========================================================================
-- 3. delete_vendor — expense.vendor_id가 참조 중이면 거부(PT409). on delete set null로 그냥
--    지우면 title 없는 연결 지출이 expense_direct_has_title 체크 제약을 위반할 수 있어, 먼저
--    명확한 에러로 "연결된 지출이 있다"를 알린다.
-- ===========================================================================
create or replace function public.delete_vendor(
  p_share_code text, p_id uuid
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_couple uuid; v_deleted uuid;
begin
  select id into v_couple from couple where share_code = p_share_code;
  if not found then raise exception 'invalid share code' using errcode = 'PT401'; end if;
  if exists (select 1 from expense where vendor_id = p_id and couple_id = v_couple) then
    raise exception '연결된 지출이 있어 삭제할 수 없습니다. 비용에서 먼저 지출을 정리하세요.' using errcode = 'PT409';
  end if;
  delete from vendor where id = p_id and couple_id = v_couple returning id into v_deleted;
  if v_deleted is null then raise exception 'vendor not found' using errcode = 'PT404'; end if;
  return jsonb_build_object('id', v_deleted);
end; $$;

-- ===========================================================================
-- 4. 실행 권한 — anon이 호출 가능(share_code를 가진 커플만 자기 데이터 쓰기)
-- ===========================================================================
grant execute on function public.create_vendor(text,uuid,text,vendor_status,vendor_role,text,date,bigint,text) to anon;
grant execute on function public.update_vendor(text,uuid,text,vendor_status,vendor_role,text,date,bigint,text) to anon;
grant execute on function public.delete_vendor(text,uuid) to anon;
