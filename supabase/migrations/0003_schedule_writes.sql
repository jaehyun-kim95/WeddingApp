-- Phase 1 일정 쓰기 RPC (ADR-0003). 체크리스트 쓰기 RPC(0002)와 동일 패턴 — couple 테이블은
-- security-definer로만 접근, p_share_code로 couple_id를 서버에서 해소한다.
-- Broadcast 트리거(trg_bc_schedule)·get_couple_snapshot은 이미 schedule_event를 포함(0001)
-- → 여기선 쓰기 RPC만 추가한다. 일정엔 완료 개념이 없어 체크리스트의 toggle류는 없다.
-- area_id는 생성 시에만 지정(체크리스트와 동일 관례 — 수정 RPC는 영역을 바꾸지 않는다).

create or replace function public.create_schedule_event(
  p_share_code text, p_area_id uuid, p_title text, p_event_date date,
  p_event_time time, p_location text, p_assignee assignee, p_category event_category
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_couple uuid; v_row schedule_event%rowtype;
begin
  select id into v_couple from couple where share_code = p_share_code;
  if not found then raise exception 'invalid share code' using errcode = 'PT401'; end if;
  insert into schedule_event (couple_id, area_id, title, event_date, event_time, location, assignee, category)
    values (v_couple, p_area_id, p_title, p_event_date, p_event_time, p_location, p_assignee, p_category)
    returning * into v_row;
  return to_jsonb(v_row);
end; $$;

create or replace function public.update_schedule_event(
  p_share_code text, p_id uuid, p_title text, p_event_date date,
  p_event_time time, p_location text, p_assignee assignee, p_category event_category
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_couple uuid; v_row schedule_event%rowtype;
begin
  select id into v_couple from couple where share_code = p_share_code;
  if not found then raise exception 'invalid share code' using errcode = 'PT401'; end if;
  update schedule_event set
    title = p_title, event_date = p_event_date, event_time = p_event_time,
    location = p_location, assignee = p_assignee, category = p_category
    where id = p_id and couple_id = v_couple returning * into v_row;
  if not found then raise exception 'event not found' using errcode = 'PT404'; end if;
  return to_jsonb(v_row);
end; $$;

create or replace function public.delete_schedule_event(
  p_share_code text, p_id uuid
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_couple uuid; v_deleted uuid;
begin
  select id into v_couple from couple where share_code = p_share_code;
  if not found then raise exception 'invalid share code' using errcode = 'PT401'; end if;
  delete from schedule_event where id = p_id and couple_id = v_couple returning id into v_deleted;
  if v_deleted is null then raise exception 'event not found' using errcode = 'PT404'; end if;
  return jsonb_build_object('id', v_deleted);
end; $$;

grant execute on function public.create_schedule_event(text,uuid,text,date,time,text,assignee,event_category) to anon;
grant execute on function public.update_schedule_event(text,uuid,text,date,time,text,assignee,event_category) to anon;
grant execute on function public.delete_schedule_event(text,uuid) to anon;
