-- Phase 1 체크리스트 쓰기 RPC (ADR-0003). 커플 테이블은 RLS 정책이 없어 security-definer로만 접근.
-- 클라이언트는 couple_id를 모르므로 p_share_code로 서버가 해소한다(가진 코드의 커플만 쓰기 가능).
-- Broadcast 트리거·get_couple_snapshot은 이미 checklist_item을 포함(0001) → 여기선 쓰기 RPC만 추가.

create or replace function public.create_checklist_item(
  p_share_code text, p_area_id uuid, p_title text, p_assignee assignee,
  p_due_date date, p_memo text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_couple uuid; v_sort int; v_row checklist_item%rowtype;
begin
  select id into v_couple from couple where share_code = p_share_code;
  if not found then raise exception 'invalid share code' using errcode = 'PT401'; end if;
  select coalesce(max(sort_order), 0) + 1 into v_sort
    from checklist_item where couple_id = v_couple and area_id = p_area_id;
  insert into checklist_item (couple_id, area_id, title, assignee, due_date, memo, sort_order)
    values (v_couple, p_area_id, p_title, p_assignee, p_due_date, p_memo, v_sort)
    returning * into v_row;
  return to_jsonb(v_row);
end; $$;

create or replace function public.update_checklist_item(
  p_share_code text, p_id uuid, p_title text, p_assignee assignee,
  p_due_date date, p_memo text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_couple uuid; v_row checklist_item%rowtype;
begin
  select id into v_couple from couple where share_code = p_share_code;
  if not found then raise exception 'invalid share code' using errcode = 'PT401'; end if;
  update checklist_item set title = p_title, assignee = p_assignee, due_date = p_due_date, memo = p_memo
    where id = p_id and couple_id = v_couple returning * into v_row;
  if not found then raise exception 'item not found' using errcode = 'PT404'; end if;
  return to_jsonb(v_row);
end; $$;

create or replace function public.toggle_checklist_item(
  p_share_code text, p_id uuid, p_is_done boolean
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_couple uuid; v_row checklist_item%rowtype;
begin
  select id into v_couple from couple where share_code = p_share_code;
  if not found then raise exception 'invalid share code' using errcode = 'PT401'; end if;
  update checklist_item
    set is_done = p_is_done, done_at = case when p_is_done then now() else null end
    where id = p_id and couple_id = v_couple returning * into v_row;
  if not found then raise exception 'item not found' using errcode = 'PT404'; end if;
  return to_jsonb(v_row);
end; $$;

create or replace function public.delete_checklist_item(
  p_share_code text, p_id uuid
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_couple uuid; v_deleted uuid;
begin
  select id into v_couple from couple where share_code = p_share_code;
  if not found then raise exception 'invalid share code' using errcode = 'PT401'; end if;
  delete from checklist_item where id = p_id and couple_id = v_couple returning id into v_deleted;
  if v_deleted is null then raise exception 'item not found' using errcode = 'PT404'; end if;
  return jsonb_build_object('id', v_deleted);
end; $$;

grant execute on function public.create_checklist_item(text,uuid,text,assignee,date,text) to anon;
grant execute on function public.update_checklist_item(text,uuid,text,assignee,date,text) to anon;
grant execute on function public.toggle_checklist_item(text,uuid,boolean) to anon;
grant execute on function public.delete_checklist_item(text,uuid) to anon;
