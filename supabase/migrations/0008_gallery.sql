-- Phase 2 갤러리(gallery) 슬라이스 — 사진 쓰기 RPC + Storage 버킷/RLS(ADR-0007) + 용량 컬럼.
-- photo 테이블·get_couple_snapshot의 'photos' 슬라이스·trg_bc_photo 브로드캐스트는 0001에 이미
-- 있다 → 여기선 size_bytes 컬럼 추가 + Storage 설정 + 쓰기 RPC만 추가한다.
-- forward-only: 0001~0007이 적용된 프로젝트의 SQL Editor에 전체를 1회 실행.

-- ===========================================================================
-- 1. size_bytes 컬럼 — 용량 통계·80% 경고 계산용(기존 행 없음, 하위호환 이슈 없음)
-- ===========================================================================
alter table photo add column if not exists size_bytes bigint not null default 0;

-- ===========================================================================
-- 2. Storage 버킷 — public(서명 URL 없이 공개 URL로 바로 표시, ADR-0007)
-- ===========================================================================
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

-- ===========================================================================
-- 3. Storage RLS — 경로 첫 세그먼트({couple.id}/...)가 실제 존재하는 couple.id인가만 검사
--    (ADR-0007 — 이 앱은 Auth가 없어 서명 URL을 발급할 서버가 없다. share_code는 여기서 검사하지
--    않는다 — couple.id 자체가 share_code로 조회해야만 얻어지므로 동일 신뢰 수준이다)
--    couple은 RLS만 켜져 있고 anon 정책이 없어(0001) 정책 본문의 서브쿼리는 anon 권한으로 실행돼
--    항상 0행 → couple_exists를 security definer로 분리해 테이블 소유자 권한으로 조회한다(이 저장소의
--    모든 RPC가 couple을 읽는 동일한 패턴).
-- ===========================================================================
create or replace function public.couple_exists(p_id text)
returns boolean language sql security definer set search_path = public as $$
  select exists (select 1 from couple where id::text = p_id);
$$;

grant execute on function public.couple_exists(text) to anon;

drop policy if exists photos_insert on storage.objects;
create policy photos_insert on storage.objects for insert to anon
  with check (
    bucket_id = 'photos'
    and public.couple_exists((storage.foldername(name))[1])
  );

drop policy if exists photos_select on storage.objects;
create policy photos_select on storage.objects for select to anon
  using (
    bucket_id = 'photos'
    and public.couple_exists((storage.foldername(name))[1])
  );

drop policy if exists photos_delete on storage.objects;
create policy photos_delete on storage.objects for delete to anon
  using (
    bucket_id = 'photos'
    and public.couple_exists((storage.foldername(name))[1])
  );

-- ===========================================================================
-- 4. create_photo / delete_photo — photo 행 쓰기(ADR-0003 RPC 게이트웨이, Storage 오브젝트
--    자체는 클라이언트가 직접 접근 — ADR-0007)
-- ===========================================================================
create or replace function public.create_photo(
  p_share_code text, p_area_id uuid, p_storage_path text, p_size_bytes bigint,
  p_caption text default null, p_taken_at timestamptz default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_couple uuid; v_row photo%rowtype;
begin
  select id into v_couple from couple where share_code = p_share_code;
  if not found then raise exception 'invalid share code' using errcode = 'PT401'; end if;
  insert into photo (couple_id, area_id, storage_path, size_bytes, is_video, caption, taken_at)
    values (v_couple, p_area_id, p_storage_path, p_size_bytes, false, p_caption, p_taken_at)
    returning * into v_row;
  return to_jsonb(v_row);
end; $$;

create or replace function public.delete_photo(
  p_share_code text, p_id uuid
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_couple uuid; v_deleted uuid;
begin
  select id into v_couple from couple where share_code = p_share_code;
  if not found then raise exception 'invalid share code' using errcode = 'PT401'; end if;
  delete from photo where id = p_id and couple_id = v_couple returning id into v_deleted;
  if v_deleted is null then raise exception 'photo not found' using errcode = 'PT404'; end if;
  return jsonb_build_object('id', v_deleted);
end; $$;

-- ===========================================================================
-- 5. 실행 권한
-- ===========================================================================
grant execute on function public.create_photo(text,uuid,text,bigint,text,timestamptz) to anon;
grant execute on function public.delete_photo(text,uuid) to anon;
