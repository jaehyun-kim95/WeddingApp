-- Phase 3 설정(settings) 슬라이스 — couple 테이블 쓰기 RPC 신설(ADR-0003).
-- couple 테이블·wedding_date_status enum·gen_share_code()·get_couple_snapshot·trg_bc_couple는
-- 0001에 이미 있다 → 여기선 쓰기 RPC 2개만 추가한다. couple은 이미 모든 UPDATE에 브로드캐스트
-- 트리거가 걸려 있어 신규 트리거는 필요 없다.
-- forward-only: 0001~0008이 적용된 프로젝트의 SQL Editor에 전체를 1회 실행.

-- ===========================================================================
-- 1. update_couple — 결혼 정보 전체 필드 + 표시 토글(납부일 알림) 갱신.
--    couple_fixed_has_date 체크 제약(0001)이 이미 FIXED일 때 wedding_date 필수를 강제한다 —
--    여기서 따로 검증하지 않고 위반 시 23514를 그대로 던진다(클라이언트 onError가 메시지 표시).
-- ===========================================================================
create or replace function public.update_couple(
  p_share_code text, p_groom_name text, p_bride_name text,
  p_wedding_date date, p_wedding_date_status wedding_date_status,
  p_wedding_time time, p_venue text, p_notify_payments boolean
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_row couple%rowtype;
begin
  update couple set
    groom_name = p_groom_name, bride_name = p_bride_name,
    wedding_date = p_wedding_date, wedding_date_status = p_wedding_date_status,
    wedding_time = p_wedding_time, venue = p_venue, notify_payments = p_notify_payments
    where share_code = p_share_code returning * into v_row;
  if not found then raise exception 'invalid share code' using errcode = 'PT401'; end if;
  return to_jsonb(v_row);
end; $$;

-- ===========================================================================
-- 2. regenerate_share_code — 기존 코드를 무효화하고 새 코드로 교체(재발급=교체, ADR-0008).
--    gen_share_code()(0001)를 재사용 — extensions.gen_random_bytes 검색경로는 그 함수 자체에
--    이미 고정돼 있어 여기서 따로 잡을 필요 없다.
-- ===========================================================================
create or replace function public.regenerate_share_code(
  p_share_code text
) returns text language plpgsql security definer set search_path = public as $$
declare v_new text;
begin
  if not exists (select 1 from couple where share_code = p_share_code) then
    raise exception 'invalid share code' using errcode = 'PT401';
  end if;
  v_new := gen_share_code();
  update couple set share_code = v_new where share_code = p_share_code;
  return v_new;
end; $$;

-- ===========================================================================
-- 3. 실행 권한 — anon이 호출 가능(share_code를 가진 커플만 자기 데이터 쓰기)
-- ===========================================================================
grant execute on function public.update_couple(text,text,text,date,wedding_date_status,time,text,boolean) to anon;
grant execute on function public.regenerate_share_code(text) to anon;
