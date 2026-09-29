-- DownForce 1차 스키마 · 개인 파트 + 계측
-- 대상: Supabase (PostgreSQL 15+)

create extension if not exists pgcrypto;

create type axis_kind      as enum ('work','life');
create type routine_source as enum ('personal','crew');
create type share_kind     as enum ('daily_card','weekly_grid','monthly_grid','yearly_grid','crew_card');
create type share_action   as enum ('save_image','copy_text','share_sheet','open_sheet');

-- ── 1. profiles ──────────────────────────────────────────────
create table profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  handle       text unique not null check (handle ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null check (char_length(display_name) between 1 and 20),
  avatar_url   text,
  timezone     text not null default 'Asia/Seoul',
  created_at   timestamptz not null default now(),
  onboarded_at timestamptz,
  cohort_month date not null default date_trunc('month', now() at time zone 'Asia/Seoul')::date,
  signup_seq   bigint generated always as identity,   -- 가입 순번. 창립 멤버(첫 30명) 뱃지의 유일한 근거
  role         text not null default 'member'   -- member | staff | admin (어드민은 2차)
               check (role in ('member','staff','admin'))
);
create index on profiles (cohort_month);
create unique index on profiles (signup_seq);

-- ⚠️ signup_seq는 소급 불가 항목이다.
--    나중에 추가하면 이미 가입한 사람들의 순번을 사후에 부여하게 되고, 그건 만들어낸 숫자다.
--    identity는 갭이 생길 수 있으나(롤백·삭제) 순서는 절대 뒤집히지 않는다 — 뱃지에 필요한 건 순서지 연속성이 아니다.

-- ── 2. day_cutoff_settings ───────────────────────────────────
create table day_cutoff_settings (
  user_id      uuid not null references profiles(id) on delete cascade,
  effective_on date not null,
  hour         smallint not null check (hour between 0 and 6),
  set_at       timestamptz not null default now(),
  primary key (user_id, effective_on)
);

create or replace function current_cutoff(p_user uuid, p_today date)
returns smallint language sql stable as $$
  select coalesce((select hour from day_cutoff_settings
                   where user_id = p_user and effective_on <= p_today
                   order by effective_on desc limit 1), 0::smallint);
$$;

-- ── 3. routines ──────────────────────────────────────────────
create table routines (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 60),
  axis        axis_kind not null default 'work',
  category    text,                    -- 러닝 · 공부 · 글쓰기 … 문구에서 자동 추론 + 확인
  source      routine_source not null default 'personal',
  crew_id     uuid,
  schedule    jsonb,
  sort_order  smallint not null default 0,
  created_at  timestamptz not null default now(),
  archived_at timestamptz
);
create index on routines (user_id, sort_order) where archived_at is null;

-- ── 4. checkins ──────────────────────────────────────────────
create table checkins (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references profiles(id) on delete cascade,
  routine_id    uuid not null references routines(id) on delete cascade,
  local_date    date not null,
  axis          axis_kind not null,
  category      text,                  -- routines에서 복사 (스냅샷)
  crew_id       uuid,
  title_at_time text not null,
  note          text check (note is null or char_length(note) <= 500),
  created_at    timestamptz not null default now(),
  constraint one_per_day unique (user_id, routine_id, local_date)
);
create index on checkins (user_id, local_date desc);

-- 체크인의 축·카테고리·크루·제목은 클라이언트가 보낸 값이 아니라 루틴에서 복사한다 (2026-09-26)
-- 그대로 두면 회원이 ① 남의 루틴에 체크하거나 ② Life 루틴을 Work로 적어 보상 조건을 우회하거나
-- ③ 아무 crew_id나 적어 남의 크루 게이지를 채울 수 있다.
create or replace function snapshot_checkin() returns trigger
language plpgsql security definer set search_path = public as $$
declare r routines%rowtype;
begin
  select * into r from routines where id = new.routine_id;
  if r.id is null or r.user_id <> new.user_id then
    raise exception '본인 루틴이 아닙니다' using errcode = '42501';
  end if;
  if r.archived_at is not null then
    raise exception '보관된 루틴입니다' using errcode = '42501';
  end if;
  new.axis          := r.axis;
  new.category      := r.category;
  new.crew_id       := r.crew_id;
  new.title_at_time := r.title;
  return new;
end $$;
create trigger checkins_snapshot before insert on checkins
for each row execute function snapshot_checkin();
create index on checkins (user_id, category) where category is not null;  -- 다양성 뱃지 집계
create index on checkins (crew_id, local_date) where crew_id is not null;

-- ── 5. checkin_photos ────────────────────────────────────────
create table checkin_photos (
  id           uuid primary key default gen_random_uuid(),
  checkin_id   uuid not null references checkins(id) on delete cascade,
  user_id      uuid not null references profiles(id) on delete cascade,
  storage_path text not null,
  thumb_path   text,
  taken_at     timestamptz,           -- EXIF DateTimeOriginal. 나머지 EXIF는 업로드 전 제거
  width        smallint,
  height       smallint,
  bytes        integer,
  created_at   timestamptz not null default now(),
  constraint one_photo_per_checkin unique (checkin_id)
);
create index on checkin_photos (user_id, created_at desc);

-- ── 6. day_logs + 트리거 ─────────────────────────────────────
create table day_logs (
  user_id     uuid not null references profiles(id) on delete cascade,
  local_date  date not null,
  work_count  smallint not null default 0,
  life_count  smallint not null default 0,
  total_count smallint generated always as (work_count + life_count) stored,
  first_at    timestamptz,
  primary key (user_id, local_date)
);

create or replace function sync_day_log() returns trigger
language plpgsql security definer set search_path = public as $$
declare u uuid; d date;
begin
  u := coalesce(new.user_id, old.user_id);
  d := coalesce(new.local_date, old.local_date);
  -- 회원 탈퇴 cascade 중이면 프로필이 이미 없다. 여기서 day_logs를 다시 쓰면 FK 위반으로 탈퇴 자체가 실패한다.
  if not exists (select 1 from profiles where id = u) then return null; end if;
  insert into day_logs (user_id, local_date, work_count, life_count, first_at)
  select u, d,
         count(*) filter (where axis='work'),
         count(*) filter (where axis='life'),
         min(created_at)
  from checkins where user_id = u and local_date = d
  on conflict (user_id, local_date) do update
    set work_count = excluded.work_count,
        life_count = excluded.life_count,
        first_at   = excluded.first_at;
  delete from day_logs where user_id = u and local_date = d and work_count = 0 and life_count = 0;
  return null;
end $$;

create trigger checkins_sync_day_log
after insert or delete on checkins
for each row execute function sync_day_log();

-- ── 7. user_streaks + 재계산 ────────────────────────────────
create table user_streaks (
  user_id        uuid primary key references profiles(id) on delete cascade,
  current_streak integer not null default 0,
  longest_streak integer not null default 0,
  last_active_on date,
  updated_at     timestamptz not null default now()
);

create or replace function recalc_streak(p_user uuid, p_today date)
returns table (current_streak int, longest_streak int) language sql stable as $$
  with d as (
    select local_date,
           local_date - (row_number() over (order by local_date))::int as grp
    from day_logs where user_id = p_user and total_count > 0
  ), runs as (
    select grp, count(*)::int as len, max(local_date) as ended_on
    from d group by grp
  )
  select coalesce(max(len) filter (where ended_on >= p_today - 1), 0)::int,
         coalesce(max(len), 0)::int
  from runs;
$$;

create or replace function sync_streak() returns trigger
language plpgsql security definer set search_path = public as $$
declare u uuid; t date; c int; l int;
begin
  u := coalesce(new.user_id, old.user_id);
  if not exists (select 1 from profiles where id = u) then return null; end if;   -- 탈퇴 cascade 중
  t := (now() at time zone (select timezone from profiles where id = u))::date;
  select * into c, l from recalc_streak(u, t);
  insert into user_streaks (user_id, current_streak, longest_streak, last_active_on, updated_at)
  values (u, c, l,
          (select max(local_date) from day_logs where user_id = u and total_count > 0), now())
  on conflict (user_id) do update
    set current_streak = excluded.current_streak,
        longest_streak = excluded.longest_streak,   -- 단조 증가시키지 않는다: 체크를 취소하면 기록도 정정된다
        last_active_on = excluded.last_active_on,
        updated_at     = now();
  return null;
end $$;

create trigger day_logs_sync_streak
after insert or update or delete on day_logs
for each row execute function sync_streak();

-- ── 7-a. app_opens : 앱을 연 날 (DAU · D30의 근거) ──────────
-- day_logs는 "기록한 날"만 생긴다. 열기만 한 날은 어디에도 안 남는다.
-- 이 테이블이 없으면 리그 가동 조건(DAU 200)도 M12 게이트(D30 30%)도 잴 수 없다.
create table app_opens (
  user_id    uuid not null references profiles(id) on delete cascade,
  local_date date not null,
  primary key (user_id, local_date)
);
create index on app_opens (local_date);

-- ── 8. 계측 ──────────────────────────────────────────────────
create table share_events (
  id          bigserial primary key,
  user_id     uuid not null references profiles(id) on delete cascade,
  kind        share_kind not null,
  action      share_action not null,
  ratio       text,
  target_date date,
  created_at  timestamptz not null default now()
);
create index on share_events (created_at);

create table card_dismissals (
  user_id      uuid not null references profiles(id) on delete cascade,
  card_key     text not null,
  dismissed_at timestamptz not null default now(),
  mute_until   date,
  primary key (user_id, card_key)
);

-- ── 9. 가입 시 프로필 자동 생성 → 003_auth_trigger.sql
-- (초판의 handle_new_user는 핸들이 33자라 형식 검사에 걸려 모든 가입을 막았다. 트리거가 연결되지
--  않아 로컬 검증에서 드러나지 않았다. 2026-09-26 제거하고 003으로 옮김)
