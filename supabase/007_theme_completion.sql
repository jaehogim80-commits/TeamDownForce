-- ============================================================================
-- DownForce 007 · 테마 완료 기준 — 운영·개발 DB 공통 (2026-09-28)
--
-- 바뀐 규칙
--   이전: Work 루틴을 하나라도 체크하면 그날은 Work, Life도 마찬가지. 스트릭 = 뭐라도 체크한 날.
--   이후: 그날의 Work 체크리스트를 "전부" 끝내야 Work 완료, Life도 전부 끝내야 Life 완료.
--         스트릭 = Work 완료 또는 Life 완료인 날 (Life만 완료해도 스트릭 유지 — 기존 원칙 그대로).
--
-- 그날의 체크리스트 = 그날 기준 보관되지 않은 루틴 중, 그날 이전에 만들어졌거나 그날까지 체크된 적이 있는 것.
-- day_logs에 required(해야 할 개수) · completed(그중 끝낸 개수)를 스냅샷으로 저장한다.
--   → 루틴을 나중에 추가·삭제·변경해도 "오늘" 행만 다시 계산되고, 지난날은 그대로다 (과거 불변 원칙).
--
-- 함께 고친 것
--   routines 하드 삭제 정책 제거 — 삭제하면 cascade로 지난 체크 기록까지 사라진다. 앱은 보관(archived_at)만 쓴다.
-- ============================================================================

-- 1) day_logs 스냅샷 컬럼 -----------------------------------------------------
alter table public.day_logs
  add column work_required  smallint not null default 0,
  add column work_completed smallint not null default 0,
  add column life_required  smallint not null default 0,
  add column life_completed smallint not null default 0;
alter table public.day_logs
  add column work_done boolean generated always as (work_required > 0 and work_completed >= work_required) stored,
  add column life_done boolean generated always as (life_required > 0 and life_completed >= life_required) stored;

-- 2) 사용자의 "오늘" — lib/session.ts와 같은 계산 (타임존 + 하루의 경계) --------
create or replace function public.user_today(p_user uuid)
returns date language plpgsql stable set search_path = public as $$
declare tz text; base date; h int;
begin
  select timezone into tz from profiles where id = p_user;
  if tz is null then return null; end if;
  base := (now() at time zone tz)::date;
  h := current_cutoff(p_user, base);
  return ((now() at time zone tz) - make_interval(hours => h))::date;
end $$;

-- 3) 그날의 테마 진행 --------------------------------------------------------
create or replace function public.theme_progress(p_user uuid, p_date date)
returns table (work_required int, work_completed int, life_required int, life_completed int)
language sql stable set search_path = public as $$
  with tz as (select timezone from profiles where id = p_user),
  req as (
    select r.id, r.axis
      from routines r, tz
     where r.user_id = p_user
       and (r.archived_at is null or (r.archived_at at time zone tz.timezone)::date > p_date)
       and ((r.created_at at time zone tz.timezone)::date <= p_date
            or exists (select 1 from checkins c0 where c0.routine_id = r.id and c0.local_date <= p_date))
  ),
  done as (select distinct c.routine_id from checkins c where c.user_id = p_user and c.local_date = p_date)
  select (count(*) filter (where req.axis = 'work'))::int,
         (count(*) filter (where req.axis = 'work' and req.id in (select routine_id from done)))::int,
         (count(*) filter (where req.axis = 'life'))::int,
         (count(*) filter (where req.axis = 'life' and req.id in (select routine_id from done)))::int
    from req
$$;

-- 4) 체크/취소 → 그날 집계 ---------------------------------------------------
create or replace function public.sync_day_log() returns trigger
language plpgsql security definer set search_path = public as $$
declare u uuid; d date; p record;
begin
  u := coalesce(new.user_id, old.user_id);
  d := coalesce(new.local_date, old.local_date);
  if not exists (select 1 from profiles where id = u) then return null; end if;   -- 탈퇴 cascade 중
  select * into p from theme_progress(u, d);
  insert into day_logs (user_id, local_date, work_count, life_count, first_at,
                        work_required, work_completed, life_required, life_completed)
  select u, d,
         count(*) filter (where axis = 'work'),
         count(*) filter (where axis = 'life'),
         min(created_at),
         p.work_required, p.work_completed, p.life_required, p.life_completed
    from checkins where user_id = u and local_date = d
  on conflict (user_id, local_date) do update
    set work_count     = excluded.work_count,
        life_count     = excluded.life_count,
        first_at       = excluded.first_at,
        work_required  = excluded.work_required,
        work_completed = excluded.work_completed,
        life_required  = excluded.life_required,
        life_completed = excluded.life_completed;
  delete from day_logs where user_id = u and local_date = d and work_count = 0 and life_count = 0;
  return null;
end $$;

-- 5) 루틴 추가·변경·보관 → "오늘" 행만 다시 ----------------------------------
create or replace function public.sync_routine_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare t date; p record;
begin
  if not exists (select 1 from profiles where id = new.user_id) then return null; end if;
  t := user_today(new.user_id);

  -- 오늘 체크한 기록만 루틴의 새 축·이름을 따른다. 지난 기록의 스냅샷은 건드리지 않는다
  if tg_op = 'UPDATE' and (new.axis is distinct from old.axis
                           or new.title is distinct from old.title
                           or new.category is distinct from old.category) then
    update checkins set axis = new.axis, title_at_time = new.title, category = new.category
     where routine_id = new.id and local_date = t;
  end if;

  if exists (select 1 from day_logs where user_id = new.user_id and local_date = t) then
    select * into p from theme_progress(new.user_id, t);
    update day_logs
       set work_count     = (select count(*) from checkins where user_id = new.user_id and local_date = t and axis = 'work'),
           life_count     = (select count(*) from checkins where user_id = new.user_id and local_date = t and axis = 'life'),
           work_required  = p.work_required,
           work_completed = p.work_completed,
           life_required  = p.life_required,
           life_completed = p.life_completed
     where user_id = new.user_id and local_date = t;
  end if;
  return null;
end $$;

create trigger routines_sync_today
after insert or update on public.routines
for each row execute function public.sync_routine_change();

-- 6) 스트릭 = Work 완료 또는 Life 완료인 날 ----------------------------------
create or replace function public.recalc_streak(p_user uuid, p_today date)
returns table (current_streak int, longest_streak int) language sql stable set search_path = public as $$
  with d as (
    select local_date,
           local_date - (row_number() over (order by local_date))::int as grp
    from day_logs where user_id = p_user and (work_done or life_done)
  ), runs as (
    select grp, count(*)::int as len, max(local_date) as ended_on
    from d group by grp
  )
  select coalesce(max(len) filter (where ended_on >= p_today - 1), 0)::int,
         coalesce(max(len), 0)::int
  from runs;
$$;

create or replace function public.sync_streak() returns trigger
language plpgsql security definer set search_path = public as $$
declare u uuid; t date; c int; l int;
begin
  u := coalesce(new.user_id, old.user_id);
  if not exists (select 1 from profiles where id = u) then return null; end if;   -- 탈퇴 cascade 중
  t := user_today(u);
  select * into c, l from recalc_streak(u, t);
  insert into user_streaks (user_id, current_streak, longest_streak, last_active_on, updated_at)
  values (u, c, l,
          (select max(local_date) from day_logs where user_id = u and (work_done or life_done)), now())
  on conflict (user_id) do update
    set current_streak = excluded.current_streak,
        longest_streak = excluded.longest_streak,
        last_active_on = excluded.last_active_on,
        updated_at     = now();
  return null;
end $$;

-- 7) 루틴 하드 삭제 경로 제거 -------------------------------------------------
drop policy if exists routines_delete_personal on public.routines;

-- 8) 기존 기록 채우기 (운영 DB는 0행) -----------------------------------------
update public.day_logs dl
   set work_required  = x.work_required,
       work_completed = x.work_completed,
       life_required  = x.life_required,
       life_completed = x.life_completed
  from (select d.user_id, d.local_date, p.*
          from public.day_logs d
          cross join lateral public.theme_progress(d.user_id, d.local_date) p) x
 where x.user_id = dl.user_id and x.local_date = dl.local_date;

-- 9) 권한 — 트리거·내부 계산 전용 --------------------------------------------
revoke execute on function public.user_today(uuid)              from public, anon, authenticated;
revoke execute on function public.theme_progress(uuid, date)    from public, anon, authenticated;
revoke execute on function public.sync_day_log()                from public, anon, authenticated;
revoke execute on function public.sync_routine_change()         from public, anon, authenticated;
revoke execute on function public.sync_streak()                 from public, anon, authenticated;
revoke execute on function public.recalc_streak(uuid, date)     from public, anon;
