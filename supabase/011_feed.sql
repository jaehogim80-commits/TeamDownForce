-- ============================================================================
-- DownForce 011 · 피드 — 운영·개발 DB 공통 (2026-09-30)
-- 결정: claude/DownForce_피드_결정요약.md
--
--   feed_posts      체크한 항목 하나를 본인이 골라 올린다. 내용은 체크·루틴에서 복사한다 (클라이언트 값 불신)
--   feed_reactions  정해진 이모지 3개 중 하나. 한 글에 한 사람 한 반응 (Strava kudos처럼 한 번 누르기)
--   feed_imports    남의 항목을 내 체크리스트로 가져온 기록. 쓰기는 feed_import() 함수로만
--   feed_mutes      이 사람 글 안 보기 (전체 공개 피드의 모르는 사람 과다 대비 — 듀오링고 사례)
--   feed_reports    신고. 서로 다른 3명이 신고하면 자동으로 숨긴다
--
-- 원칙
--   · 자동 공개 없음. 올리는 건 본인이 누를 때만
--   · 체크를 취소하면 그 글도 사라진다 (올린 것 = 한 일)
--   · 가져간 수는 올린 사람에게만 보인다. 누가 가져갔는지는 아무에게도 안 보인다
--   · 메모(hint)·코멘트 원문은 복사하지 않는다. 글에 들어가는 코멘트는 올릴 때 본인이 넣은 것만
-- ============================================================================

-- 1) 글 ----------------------------------------------------------------------
create table public.feed_posts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  checkin_id   uuid not null unique references public.checkins(id) on delete cascade,
  title        text not null,                       -- 체크의 제목 스냅샷
  axis         public.axis_kind not null,
  window_start time,                                -- 루틴의 시각대 스냅샷 (가져오기에 쓰인다)
  window_end   time,
  caption      text check (caption is null or char_length(caption) between 1 and 200),
  local_date   date not null,
  created_at   timestamptz not null default now(),
  hidden_at    timestamptz                          -- 신고 누적·운영자 숨김
);
create index feed_posts_recent on public.feed_posts (created_at desc) where hidden_at is null;
create index on public.feed_posts (user_id, created_at desc);

-- 내용은 체크와 루틴에서 가져온다. 본인 체크, 오늘·어제 것만 올릴 수 있다
create or replace function public.snapshot_feed_post() returns trigger
language plpgsql security definer set search_path = '' as $$
declare c public.checkins%rowtype; r public.routines%rowtype; tz text;
begin
  select * into c from public.checkins where id = new.checkin_id;
  if c.id is null or c.user_id <> new.user_id then
    raise exception '본인 체크만 올릴 수 있습니다' using errcode = '42501';
  end if;
  select timezone into tz from public.profiles where id = new.user_id;
  if c.local_date < (now() at time zone coalesce(tz, 'Asia/Seoul'))::date - 1 then
    raise exception '오늘·어제 체크만 올릴 수 있습니다' using errcode = '42501';
  end if;
  select * into r from public.routines where id = c.routine_id;
  new.title        := c.title_at_time;
  new.axis         := c.axis;
  new.local_date   := c.local_date;
  new.window_start := r.window_start;
  new.window_end   := r.window_end;
  new.caption      := nullif(btrim(coalesce(new.caption, '')), '');
  new.created_at   := now();
  new.hidden_at    := null;
  return new;
end $$;
revoke execute on function public.snapshot_feed_post() from public, anon, authenticated;
create trigger feed_posts_snapshot before insert on public.feed_posts
  for each row execute function public.snapshot_feed_post();

-- 2) 반응 --------------------------------------------------------------------
create table public.feed_reactions (
  post_id    uuid not null references public.feed_posts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  emoji      text not null check (emoji in ('fire', 'clap', 'muscle')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index on public.feed_reactions (user_id);

-- 3) 가져오기 ------------------------------------------------------------------
create table public.feed_imports (
  post_id    uuid not null references public.feed_posts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  routine_id uuid references public.routines(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index on public.feed_imports (user_id);

-- 4) 숨기기·신고 ----------------------------------------------------------------
create table public.feed_mutes (
  user_id       uuid not null references public.profiles(id) on delete cascade,
  muted_user_id uuid not null references public.profiles(id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (user_id, muted_user_id),
  check (user_id <> muted_user_id)
);

create table public.feed_reports (
  post_id     uuid not null references public.feed_posts(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason      text not null check (reason in ('spam', 'abuse', 'private', 'other')),
  created_at  timestamptz not null default now(),
  primary key (post_id, reporter_id)
);

-- 서로 다른 3명이 신고하면 숨긴다. 운영자가 확인 후 되살릴 수 있다 (hidden_at = null)
create or replace function public.feed_auto_hide() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.feed_reports where post_id = new.post_id) >= 3 then
    update public.feed_posts set hidden_at = now() where id = new.post_id and hidden_at is null;
  end if;
  return null;
end $$;
revoke execute on function public.feed_auto_hide() from public, anon, authenticated;
create trigger feed_reports_hide after insert on public.feed_reports
  for each row execute function public.feed_auto_hide();

-- 5) RLS ---------------------------------------------------------------------
alter table public.feed_posts     enable row level security;
alter table public.feed_reactions enable row level security;
alter table public.feed_imports   enable row level security;
alter table public.feed_mutes     enable row level security;
alter table public.feed_reports   enable row level security;
-- 권한은 필요한 것만 명시한다 (기본 권한에 기대지 않는다). 고치기(update)는 반응에만 있다
revoke all on public.feed_posts, public.feed_reactions, public.feed_imports, public.feed_mutes, public.feed_reports from anon, authenticated;
grant select, insert, delete         on public.feed_posts     to authenticated;
grant select, insert, update, delete on public.feed_reactions to authenticated;
grant select                         on public.feed_imports   to authenticated;
grant select, insert, delete         on public.feed_mutes     to authenticated;
grant insert                         on public.feed_reports   to authenticated;

-- 글: 읽기는 숨겨지지 않은 글 + 내 글. 올리기·지우기는 본인. 고치기 경로는 없다
create policy feed_posts_read on public.feed_posts for select to authenticated
  using (hidden_at is null or user_id = (select auth.uid()));
create policy feed_posts_insert on public.feed_posts for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy feed_posts_delete on public.feed_posts for delete to authenticated
  using (user_id = (select auth.uid()));

-- 반응: 누가 어떤 반응을 남겼는지는 보인다 (Strava kudos 목록과 같다). 내 글·숨겨진 글에는 못 남긴다
create policy feed_reactions_read on public.feed_reactions for select to authenticated using (true);
create policy feed_reactions_insert on public.feed_reactions for insert to authenticated
  with check (user_id = (select auth.uid())
              and exists (select 1 from public.feed_posts p
                           where p.id = post_id and p.user_id <> (select auth.uid()) and p.hidden_at is null));
create policy feed_reactions_update on public.feed_reactions for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy feed_reactions_delete on public.feed_reactions for delete to authenticated
  using (user_id = (select auth.uid()));

-- 가져오기: 내 기록만 본다. 쓰기는 feed_import()로만 (정책 없음 = 직접 쓰기 불가)
create policy feed_imports_read on public.feed_imports for select to authenticated
  using (user_id = (select auth.uid()));

-- 숨기기: 본인 것만
create policy feed_mutes_all on public.feed_mutes for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- 신고: 넣기만. 회원은 아무도 신고 목록을 못 본다. 내 글은 신고할 수 없다
create policy feed_reports_insert on public.feed_reports for insert to authenticated
  with check (reporter_id = (select auth.uid())
              and exists (select 1 from public.feed_posts p
                           where p.id = post_id and p.user_id <> (select auth.uid())));

-- 6) 가져오기 함수 -------------------------------------------------------------
-- 반환: imported | exists(같은 Work/Life에 같은 이름이 이미 있음) | already | own | gone
create or replace function public.feed_import(p_post uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  p  public.feed_posts%rowtype;
  v_routine uuid;
begin
  if me is null then return 'gone'; end if;
  select * into p from public.feed_posts where id = p_post and hidden_at is null;
  if p.id is null then return 'gone'; end if;
  if p.user_id = me then return 'own'; end if;
  if exists (select 1 from public.feed_imports where post_id = p.id and user_id = me) then return 'already'; end if;
  if exists (select 1 from public.routines
              where user_id = me and archived_at is null and source = 'personal'
                and axis = p.axis and btrim(title) = btrim(p.title)) then
    return 'exists';
  end if;

  insert into public.routines (user_id, title, axis, window_start, window_end, source, sort_order)
  values (me, p.title, p.axis, p.window_start, p.window_end, 'personal',
          coalesce((select max(sort_order) from public.routines where user_id = me), 0) + 1)
  returning id into v_routine;
  insert into public.feed_imports (post_id, user_id, routine_id) values (p.id, me, v_routine);
  return 'imported';
end $$;
revoke execute on function public.feed_import(uuid) from public, anon;
grant execute on function public.feed_import(uuid) to authenticated;

-- 7) 피드 한 페이지 -----------------------------------------------------------
-- 숫자(반응 수·가져간 수)를 한 번에 모은다. 가져간 수는 내 글일 때만 채운다
create or replace function public.feed_page(p_before timestamptz default null, p_limit int default 20)
returns table (
  id uuid, user_id uuid, handle text, display_name text, avatar_url text,
  title text, axis public.axis_kind, window_start time, window_end time, caption text,
  local_date date, created_at timestamptz, hidden boolean,
  streak int, fire int, clap int, muscle int, my_reaction text,
  import_count int, imported_by_me boolean, is_mine boolean
) language sql stable security definer set search_path = '' as $$
  with me as (select auth.uid() as uid)
  select p.id, p.user_id, pr.handle, pr.display_name, pr.avatar_url,
         p.title, p.axis, p.window_start, p.window_end, p.caption,
         p.local_date, p.created_at, p.hidden_at is not null,
         case when s.last_active_on >= (now() at time zone pr.timezone)::date - 1 then s.current_streak else 0 end,
         (select count(*) from public.feed_reactions r where r.post_id = p.id and r.emoji = 'fire')::int,
         (select count(*) from public.feed_reactions r where r.post_id = p.id and r.emoji = 'clap')::int,
         (select count(*) from public.feed_reactions r where r.post_id = p.id and r.emoji = 'muscle')::int,
         (select r.emoji from public.feed_reactions r, me where r.post_id = p.id and r.user_id = me.uid),
         case when p.user_id = (select uid from me)
              then (select count(*) from public.feed_imports i where i.post_id = p.id)::int end,
         exists (select 1 from public.feed_imports i, me where i.post_id = p.id and i.user_id = me.uid),
         p.user_id = (select uid from me)
    from public.feed_posts p
    join public.profiles pr on pr.id = p.user_id
    left join public.user_streaks s on s.user_id = p.user_id
   where (select uid from me) is not null
     and (p.hidden_at is null or p.user_id = (select uid from me))
     and not exists (select 1 from public.feed_mutes m where m.user_id = (select uid from me) and m.muted_user_id = p.user_id)
     and (p_before is null or p.created_at < p_before)
   order by p.created_at desc
   limit least(greatest(coalesce(p_limit, 20), 1), 50)
$$;
revoke execute on function public.feed_page(timestamptz, int) from public, anon;
grant execute on function public.feed_page(timestamptz, int) to authenticated;
