-- ============================================================================
-- WeddingApp 스키마 v1 — 로그인 없는 공유코드 격리 (ADR-0002 / ADR-0003)
-- docs/db/ (table-definitions · code-definitions · access-control-rls) 기준.
--
-- 적용: 새(빈) Supabase 프로젝트의 SQL Editor에 전체를 붙여넣고 1회 실행한다(forward-only).
-- 커플 데이터는 anon 직접 접근을 막고 security-definer RPC로만 연다. Realtime은 트리거가
-- '변경 신호'만 Broadcast 한다(행 데이터 비노출).
-- ============================================================================

create extension if not exists pgcrypto;  -- gen_random_bytes / gen_random_uuid

-- ---------------------------------------------------------------------------
-- 1. Enum 타입 (code-definitions.md — 코드값은 영문 대문자)
-- ---------------------------------------------------------------------------
create type assignee            as enum ('ME','PARTNER','BOTH');
create type wedding_date_status as enum ('UNDECIDED','APPROX','FIXED');
create type vendor_status       as enum ('CANDIDATE','CONTRACTED');
create type vendor_role         as enum ('STUDIO','DRESS','MAKEUP');
create type event_category      as enum ('EVENT','IMPORTANT','MILESTONE');
create type payment_kind        as enum ('DEPOSIT','BALANCE','ETC');
create type payer               as enum ('ME','PARTNER','BOTH_FAMILY');
create type guest_side          as enum ('GROOM','BRIDE');
create type guest_relation      as enum ('FAMILY','FRIEND','WORK','ACQUAINTANCE');
create type attend_status       as enum ('ATTENDING','MAYBE','ABSENT');
create type origin              as enum ('SEED','USER');

-- ---------------------------------------------------------------------------
-- 2. 전역 참조 테이블 (couple_id 없음, anon 공개 읽기)
-- ---------------------------------------------------------------------------
create table area (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  code       text not null unique,          -- area_code: SDM/HALL/INV/GIFT/HOME/GUEST
  name_ko    text not null,
  sort_order int  not null
);

create table seed_checklist_item (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  area_code  text not null,
  title      text not null,
  sort_order int  not null
);

create table seed_roadmap_step (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  title         text not null,
  months_before int  not null,
  area_code     text
);

create table auspicious_day (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  day        date not null unique,
  note       text
);

-- ---------------------------------------------------------------------------
-- 3. 커플 범위 테이블 (couple_id 보유, anon 직접 접근 차단)
-- ---------------------------------------------------------------------------
create table couple (
  id                   uuid primary key default gen_random_uuid(),
  created_at           timestamptz not null default now(),
  share_code           text not null unique,
  groom_name           text not null,
  bride_name           text not null,
  wedding_date         date,
  wedding_date_status  wedding_date_status not null,
  wedding_time         time,
  venue                text,
  show_auspicious_days boolean not null default true,
  notify_payments      boolean not null default true,
  -- FIXED면 wedding_date 필수
  constraint couple_fixed_has_date check (wedding_date_status <> 'FIXED' or wedding_date is not null)
);

create table checklist_item (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  couple_id  uuid not null references couple(id) on delete cascade,
  area_id    uuid not null references area(id),
  title      text not null,
  assignee   assignee not null,
  is_done    boolean not null default false,
  done_at    timestamptz,
  due_date   date,
  memo       text,
  origin     origin not null default 'USER',
  sort_order int not null default 0,
  constraint checklist_done_pair check (is_done = (done_at is not null))
);
create index idx_checklist_couple_area on checklist_item(couple_id, area_id);

create table schedule_event (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  couple_id  uuid not null references couple(id) on delete cascade,
  area_id    uuid references area(id),
  title      text not null,
  event_date date,
  event_time time,
  location   text,
  assignee   assignee,
  category   event_category not null,
  reminder_at timestamptz,
  origin     origin not null default 'USER'
);
create index idx_schedule_couple_date on schedule_event(couple_id, event_date);

create table vendor (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  couple_id     uuid not null references couple(id) on delete cascade,
  area_id       uuid not null references area(id),
  name          text not null,
  status        vendor_status not null,
  role          vendor_role,
  location      text,
  contract_date date,
  quoted_price  bigint,       -- 참고 표시용 — 금액 소스 아님(ADR-0001)
  memo          text
);
create index idx_vendor_couple_area on vendor(couple_id, area_id);

create table expense (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  couple_id   uuid not null references couple(id) on delete cascade,
  area_id     uuid not null references area(id),
  vendor_id   uuid references vendor(id) on delete set null,
  title       text,
  base_amount bigint not null default 0,
  -- 업체 미연결(직접 지출)이면 title 필수
  constraint expense_direct_has_title check (vendor_id is not null or title is not null)
);
create index idx_expense_couple_area   on expense(couple_id, area_id);
create index idx_expense_couple_vendor on expense(couple_id, vendor_id);

create table expense_option (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  couple_id  uuid not null references couple(id) on delete cascade,
  expense_id uuid not null references expense(id) on delete cascade,
  name       text not null,
  amount     bigint not null check (amount > 0)  -- 옵션은 최종금액을 올리는 추가금
);
create index idx_option_expense on expense_option(expense_id);

create table expense_split (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  couple_id  uuid not null references couple(id) on delete cascade,
  expense_id uuid not null references expense(id) on delete cascade,
  payer      payer not null,
  amount     bigint not null,
  constraint split_payer_unique unique (expense_id, payer)  -- 같은 부담자 중복 금지
);
create index idx_split_expense on expense_split(expense_id);

create table payment (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  couple_id  uuid not null references couple(id) on delete cascade,
  expense_id uuid not null references expense(id) on delete cascade,
  kind       payment_kind not null,
  amount     bigint not null,
  due_date   date,
  is_paid    boolean not null default false,
  paid_at    timestamptz,
  constraint payment_paid_pair check (is_paid = (paid_at is not null))
);
create index idx_payment_couple_due on payment(couple_id, due_date);
create index idx_payment_expense    on payment(expense_id);

create table guest (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  couple_id     uuid not null references couple(id) on delete cascade,
  name          text not null,
  side          guest_side not null,
  relation      guest_relation not null,
  attend_status attend_status not null default 'MAYBE',
  is_host       boolean not null default false,
  meal_count    int not null default 1,
  gift_amount   bigint,   -- null=미접수(혼주는 보통 null)
  memo          text
);
create index idx_guest_couple_side     on guest(couple_id, side);
create index idx_guest_couple_relation on guest(couple_id, relation);

create table photo (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  couple_id    uuid not null references couple(id) on delete cascade,
  area_id      uuid references area(id),
  storage_path text,
  external_url text,
  is_video     boolean not null default false,
  caption      text,
  taken_at     timestamptz,
  -- 저장 위치는 둘 중 정확히 하나(ADR-0002 용량 정책)
  constraint photo_one_location check ((storage_path is not null) <> (external_url is not null))
);
create index idx_photo_couple_area on photo(couple_id, area_id);

-- ---------------------------------------------------------------------------
-- 4. RLS — 전역 참조는 공개 읽기, 커플 테이블은 정책 없음(= anon 전면 차단)
--    RPC는 security definer(소유자 postgres)라 RLS를 우회한다.
-- ---------------------------------------------------------------------------
alter table area                enable row level security;
alter table seed_checklist_item enable row level security;
alter table seed_roadmap_step   enable row level security;
alter table auspicious_day      enable row level security;

create policy area_public_read       on area                for select to anon using (true);
create policy seed_cl_public_read    on seed_checklist_item for select to anon using (true);
create policy seed_rm_public_read    on seed_roadmap_step   for select to anon using (true);
create policy auspicious_public_read on auspicious_day      for select to anon using (true);

alter table couple         enable row level security;  -- 정책 없음 → anon 접근 불가
alter table checklist_item enable row level security;
alter table schedule_event enable row level security;
alter table vendor         enable row level security;
alter table expense        enable row level security;
alter table expense_option enable row level security;
alter table expense_split  enable row level security;
alter table payment        enable row level security;
alter table guest          enable row level security;
alter table photo          enable row level security;

-- ---------------------------------------------------------------------------
-- 5. 공유코드 생성 (pgcrypto, 96bit hex 24자)
-- ---------------------------------------------------------------------------
-- 주의: Supabase는 pgcrypto를 extensions 스키마에 설치하므로 gen_random_bytes를 스키마 한정하고
-- search_path에도 extensions를 포함한다(public만 두면 'gen_random_bytes does not exist').
create or replace function public.gen_share_code()
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v text;
begin
  loop
    v := encode(extensions.gen_random_bytes(12), 'hex');  -- 12바이트=96bit → hex 24자 소문자
    exit when not exists (select 1 from couple where share_code = v);
  end loop;
  return v;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. RPC 게이트웨이 — Phase 0: 커플 생성 + 스냅샷 조회 (쓰기 RPC는 화면 Phase에서 추가)
-- ---------------------------------------------------------------------------
create or replace function public.create_couple(
  p_groom_name text,
  p_bride_name text,
  p_wedding_date date,
  p_wedding_date_status wedding_date_status,
  p_venue text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare v_code text;
begin
  v_code := gen_share_code();
  insert into couple (share_code, groom_name, bride_name, wedding_date, wedding_date_status, venue)
    values (v_code, p_groom_name, p_bride_name, p_wedding_date, p_wedding_date_status, p_venue);
  return v_code;
end;
$$;

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
    raise exception 'invalid share code' using errcode = 'PT401';  -- 클라이언트가 온보딩으로 분기
  end if;

  return jsonb_build_object(
    'couple',          to_jsonb(v),
    'checklist_items', coalesce((select jsonb_agg(to_jsonb(t) order by t.sort_order)   from checklist_item t where t.couple_id = v.id), '[]'::jsonb),
    'schedule_events', coalesce((select jsonb_agg(to_jsonb(t) order by t.event_date)   from schedule_event t where t.couple_id = v.id), '[]'::jsonb),
    'vendors',         coalesce((select jsonb_agg(to_jsonb(t))                         from vendor t         where t.couple_id = v.id), '[]'::jsonb),
    'expenses',        coalesce((select jsonb_agg(to_jsonb(t))                         from expense t        where t.couple_id = v.id), '[]'::jsonb),
    'expense_options', coalesce((select jsonb_agg(to_jsonb(t))                         from expense_option t where t.couple_id = v.id), '[]'::jsonb),
    'expense_splits',  coalesce((select jsonb_agg(to_jsonb(t))                         from expense_split t  where t.couple_id = v.id), '[]'::jsonb),
    'payments',        coalesce((select jsonb_agg(to_jsonb(t))                         from payment t        where t.couple_id = v.id), '[]'::jsonb),
    'guests',          coalesce((select jsonb_agg(to_jsonb(t))                         from guest t          where t.couple_id = v.id), '[]'::jsonb),
    'photos',          coalesce((select jsonb_agg(to_jsonb(t))                         from photo t          where t.couple_id = v.id), '[]'::jsonb)
  );
end;
$$;

-- anon은 이 두 함수만 실행 가능(gen_share_code는 내부 호출로만 동작)
grant execute on function public.create_couple(text,text,date,wedding_date_status,text) to anon;
grant execute on function public.get_couple_snapshot(text) to anon;

-- ---------------------------------------------------------------------------
-- 7. Realtime — 커플 테이블 변경 시 '신호'만 Broadcast (토픽=couple:<share_code>, public)
--    broadcast 실패(구독자 없음 등)가 쓰기를 깨지 않도록 예외를 삼킨다.
-- ---------------------------------------------------------------------------
create or replace function public.broadcast_couple_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_code text;
begin
  if tg_table_name = 'couple' then
    v_code := coalesce(new.share_code, old.share_code);
  else
    select share_code into v_code from couple where id = coalesce(new.couple_id, old.couple_id);
  end if;

  if v_code is not null then
    begin
      perform realtime.send(
        jsonb_build_object('table', tg_table_name, 'op', tg_op),
        'change',
        'couple:' || v_code,
        false  -- public 채널(로그인 없는 anon 구독 허용; 토픽명=공유코드가 비밀)
      );
    exception when others then
      null;  -- 신호 실패는 무시 — 데이터 쓰기는 항상 성공해야 한다
    end;
  end if;

  return coalesce(new, old);
end;
$$;

create trigger trg_bc_couple         after insert or update or delete on couple         for each row execute function broadcast_couple_change();
create trigger trg_bc_checklist      after insert or update or delete on checklist_item for each row execute function broadcast_couple_change();
create trigger trg_bc_schedule       after insert or update or delete on schedule_event for each row execute function broadcast_couple_change();
create trigger trg_bc_vendor         after insert or update or delete on vendor         for each row execute function broadcast_couple_change();
create trigger trg_bc_expense        after insert or update or delete on expense        for each row execute function broadcast_couple_change();
create trigger trg_bc_expense_option after insert or update or delete on expense_option for each row execute function broadcast_couple_change();
create trigger trg_bc_expense_split  after insert or update or delete on expense_split  for each row execute function broadcast_couple_change();
create trigger trg_bc_payment        after insert or update or delete on payment        for each row execute function broadcast_couple_change();
create trigger trg_bc_guest          after insert or update or delete on guest          for each row execute function broadcast_couple_change();
create trigger trg_bc_photo          after insert or update or delete on photo          for each row execute function broadcast_couple_change();

-- ---------------------------------------------------------------------------
-- 8. 시드 — 준비영역 마스터 6행 (FK 기준값)
-- ---------------------------------------------------------------------------
insert into area (code, name_ko, sort_order) values
  ('SDM',  '스드메',   1),
  ('HALL', '웨딩홀',   2),
  ('INV',  '청첩장',   3),
  ('GIFT', '예단예물', 4),
  ('HOME', '신혼집',   5),
  ('GUEST','하객',     6)
on conflict (code) do nothing;
