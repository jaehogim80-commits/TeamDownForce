-- ============================================================================
-- DownForce 013 · 최장 기록 갱신 + 퍼펙트 위크 집계 — 운영·개발 DB 공통 (2026-10-05)
--
-- streak_summary(p_today) 한 번으로 오늘 화면·기록 탭·마이페이지가 쓸 숫자 세 개를 돌려준다.
--   · current_streak  지금 이어지는 하루 전체 연속 (오늘 또는 어제로 끝나는 구간). recalc_streak과 같은 기준
--   · prev_best       **이미 끝난** 연속 중 가장 긴 것. 지금 연속은 넣지 않는다
--                     → user_streaks.longest_streak은 지금 연속까지 포함하므로 "넘을 대상"으로 쓸 수 없다
--   · perfect_weeks   7칸을 전부 채운 주(월~일)의 수 (제품설계 5-B)
-- 하루가 "채워졌다" = Work 또는 Life 체크리스트를 전부 끝낸 날 (007, 격자 칸·스트릭과 같은 기준)
-- 본인 기록만 센다 (security invoker — day_logs RLS가 그대로 적용된다)
-- 결정: 연속 장치 결정요약 5장 (지난 최고 7일 이상일 때만 화면에 켠다 — 판단은 화면이 한다)
-- ============================================================================
create or replace function public.streak_summary(p_today date)
returns table (current_streak int, prev_best int, perfect_weeks int)
language sql stable security invoker set search_path = '' as $$
  with filled as (
    select l.local_date
      from public.day_logs l
     where l.user_id = (select auth.uid())
       and (l.work_done or l.life_done)
       and l.local_date <= p_today
  ), d as (
    select f.local_date,
           f.local_date - (row_number() over (order by f.local_date))::int as grp
      from filled f
  ), runs as (
    select count(*)::int as len, max(d.local_date) as ended_on
      from d group by d.grp
  ), weeks as (
    select date_trunc('week', f.local_date::timestamp)::date as wk, count(*)::int as n
      from filled f group by 1
  )
  select coalesce((select max(r.len) from runs r where r.ended_on >= p_today - 1), 0)::int,
         coalesce((select max(r.len) from runs r where r.ended_on <  p_today - 1), 0)::int,
         (select count(*) from weeks w where w.n = 7)::int
$$;
revoke execute on function public.streak_summary(date) from public, anon;
grant execute on function public.streak_summary(date) to authenticated;
