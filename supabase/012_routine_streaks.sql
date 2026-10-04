-- ============================================================================
-- DownForce 012 · 항목별 연속 일수 — 운영·개발 DB 공통 (2026-10-04)
--
-- 체크리스트 항목마다 "며칠째 이어지고 있는가"를 돌려준다.
--   · 오늘 체크했으면 오늘까지, 아직이면 어제까지 이어진 날 수 (어제도 안 했으면 행이 없다 = 0일)
--   · done_today = 오늘 체크했는가. 화면은 오늘 안 했으면 숫자를 흐리게 보여준다 ("끊김 처벌 알림 금지" 9장)
--   · 본인 체크만 센다 (security invoker — checkins RLS가 그대로 적용된다)
--   · 400일 전까지만 본다. 그 이상 이어진 항목은 400으로 표시된다
-- 행이 많아도 PostgREST 1000행 제한에 걸리지 않게 계산을 DB에서 끝낸다.
-- ============================================================================
create or replace function public.routine_streaks(p_today date)
returns table (routine_id uuid, streak int, done_today boolean)
language sql stable security invoker set search_path = '' as $$
  with d as (
    select c.routine_id, c.local_date,
           c.local_date - (row_number() over (partition by c.routine_id order by c.local_date))::int as grp
      from public.checkins c
     where c.user_id = (select auth.uid())
       and c.local_date <= p_today
       and c.local_date >  p_today - 400
  ), runs as (
    select d.routine_id, count(*)::int as len, max(d.local_date) as ended_on
      from d group by d.routine_id, d.grp
  )
  select r.routine_id, r.len, r.ended_on = p_today
    from runs r
   where r.ended_on >= p_today - 1
$$;
revoke execute on function public.routine_streaks(date) from public, anon;
grant execute on function public.routine_streaks(date) to authenticated;
