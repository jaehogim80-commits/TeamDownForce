-- 012 검증 — 마이그레이션 뒤에 붙여 한 번에 실행하고, 마지막 예외로 전부 롤백한다
do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid();
  r1 uuid; r2 uuid; r3 uuid; r4 uuid; rb uuid; t text; n int;
  today date := (now() at time zone 'Asia/Seoul')::date;
begin
  perform set_config('downforce.dev_signup', 'on', true);
  insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
  select '00000000-0000-0000-0000-000000000000', u, 'authenticated', 'authenticated', u::text || '@example.com', now(),
         '{"provider":"email","providers":["email"]}', '{}'::jsonb
    from (values (a), (b)) v(u);
  insert into public.routines (user_id, title, axis) values (a, '오늘까지 5일', 'work') returning id into r1;
  insert into public.routines (user_id, title, axis) values (a, '어제까지 3일', 'work') returning id into r2;
  insert into public.routines (user_id, title, axis) values (a, '그제에서 끊김', 'life') returning id into r3;
  insert into public.routines (user_id, title, axis) values (a, '중간에 빈 날', 'life') returning id into r4;
  insert into public.routines (user_id, title, axis) values (b, '남의 것', 'work') returning id into rb;

  insert into public.checkins (user_id, routine_id, local_date, axis, title_at_time)
  select a, r1, today - g, 'work', '-' from generate_series(0, 4) g;                 -- 오늘~4일 전
  insert into public.checkins (user_id, routine_id, local_date, axis, title_at_time)
  select a, r2, today - g, 'work', '-' from generate_series(1, 3) g;                 -- 어제~3일 전
  insert into public.checkins (user_id, routine_id, local_date, axis, title_at_time)
  select a, r3, today - g, 'life', '-' from generate_series(2, 6) g;                 -- 그제부터 과거 → 끊김
  insert into public.checkins (user_id, routine_id, local_date, axis, title_at_time)
  select a, r4, today - g, 'life', '-' from generate_series(0, 6) g where g <> 2;   -- 오늘·어제, (빈 날), 3~6일 전
  insert into public.checkins (user_id, routine_id, local_date, axis, title_at_time)
  select b, rb, today - g, 'work', '-' from generate_series(0, 9) g;

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);

  select streak || '/' || done_today into t from public.routine_streaks(today) where routine_id = r1;
  assert t = '5/true', '1 오늘까지 5일 ' || coalesce(t, 'null');
  select streak || '/' || done_today into t from public.routine_streaks(today) where routine_id = r2;
  assert t = '3/false', '2 어제까지 3일, 오늘 아직 ' || coalesce(t, 'null');
  assert not exists (select 1 from public.routine_streaks(today) where routine_id = r3), '3 그제에서 끊기면 없음';
  select streak into n from public.routine_streaks(today) where routine_id = r4;
  assert n = 2, '4 빈 날 이후만 센다 ' || coalesce(n::text, 'null');
  assert not exists (select 1 from public.routine_streaks(today) where routine_id = rb), '5 남의 항목은 안 보임';
  select count(*) into n from public.routine_streaks(today);
  assert n = 3, '6 내 항목 3개만 ' || n;
  -- 하루 경계로 '오늘'이 어제인 사람 (새벽 경계) — 날짜를 넘겨받은 대로 계산한다
  select streak || '/' || done_today into t from public.routine_streaks(today - 1) where routine_id = r1;
  assert t = '4/true', '7 기준일을 넘겨받은 대로 ' || coalesce(t, 'null');

  reset role;
  set local role anon;
  begin
    perform 1 from public.routine_streaks(today);
    raise exception 'FAIL 8 비로그인 호출';
  exception when insufficient_privilege then null;
  end;
  reset role;

  raise exception 'ALL_PASS (8 checks) — rolled back';
end $$;
