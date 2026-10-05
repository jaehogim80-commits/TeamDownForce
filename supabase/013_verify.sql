-- 013 검증 — 마이그레이션 뒤에 붙여 한 번에 실행하고, 마지막 예외로 전부 롤백한다
do $$
declare
  a uuid := gen_random_uuid();  -- 끝난 10일 + 지금 5일
  b uuid := gen_random_uuid();  -- 처음 이어지는 8일 (끝난 연속 없음)
  c uuid := gen_random_uuid();  -- 퍼펙트 위크 1주 + 6일짜리 주
  ra uuid; rb uuid; rc uuid; rc2 uuid; t text; mon date;
  today date := (now() at time zone 'Asia/Seoul')::date;
begin
  perform set_config('downforce.dev_signup', 'on', true);
  insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
  select '00000000-0000-0000-0000-000000000000', u, 'authenticated', 'authenticated', u::text || '@example.com', now(),
         '{"provider":"email","providers":["email"]}', '{}'::jsonb
    from (values (a), (b), (c)) v(u);
  insert into public.routines (user_id, title, axis) values (a, '러닝', 'work') returning id into ra;
  insert into public.routines (user_id, title, axis) values (b, '독서', 'life') returning id into rb;
  insert into public.routines (user_id, title, axis) values (c, '공부', 'work') returning id into rc;
  insert into public.routines (user_id, title, axis) values (c, '산책', 'life') returning id into rc2;

  -- a: 29~20일 전 10일 (끝남) · 5~1일 전 5일 (어제까지, 오늘 아직)
  insert into public.checkins (user_id, routine_id, local_date, axis, title_at_time)
  select a, ra, today - g, 'work', '-' from generate_series(20, 29) g;
  insert into public.checkins (user_id, routine_id, local_date, axis, title_at_time)
  select a, ra, today - g, 'work', '-' from generate_series(1, 5) g;
  -- b: 7일 전~오늘 8일
  insert into public.checkins (user_id, routine_id, local_date, axis, title_at_time)
  select b, rb, today - g, 'life', '-' from generate_series(0, 7) g;
  -- c: 3주 전 월~일 7일 (Work와 Life 섞어서) + 그다음 주 월~토 6일
  mon := date_trunc('week', (today - 21)::timestamp)::date;
  insert into public.checkins (user_id, routine_id, local_date, axis, title_at_time)
  select c, case when g % 2 = 0 then rc else rc2 end, mon + g, 'work', '-' from generate_series(0, 12) g;

  set local role authenticated;

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  select current_streak || '/' || prev_best into t from public.streak_summary(today);
  assert t = '5/10', '1 지금 5일 · 지난 최고 10일 ' || t;
  reset role;
  insert into public.checkins (user_id, routine_id, local_date, axis, title_at_time) values (a, ra, today, 'work', '-');
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  select current_streak || '/' || prev_best into t from public.streak_summary(today);
  assert t = '6/10', '2 오늘 채우면 6일 · 지난 최고는 그대로 ' || t;

  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  select current_streak || '/' || prev_best into t from public.streak_summary(today);
  assert t = '8/0', '3 처음 연속은 넘을 대상이 없다 ' || t;

  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  select current_streak || '/' || prev_best || '/' || perfect_weeks into t from public.streak_summary(today);
  assert t = '0/13/1', '4 퍼펙트 위크 1주 (Work·Life 섞여도 칸) · 13일 연속은 끝남 ' || t;
  -- 기준일을 3주 전 일요일로 넘기면 그 주까지만 본다
  select current_streak || '/' || prev_best || '/' || perfect_weeks into t from public.streak_summary(mon + 6);
  assert t = '7/0/1', '5 기준일 이후 기록은 안 본다 ' || t;

  -- 남의 기록은 안 보인다: 기록이 없는 사람으로 보면 전부 0
  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
  select current_streak || '/' || prev_best || '/' || perfect_weeks into t from public.streak_summary(today);
  assert t = '0/0/0', '6 남의 기록이 섞이지 않는다 ' || t;

  reset role;
  set local role anon;
  begin
    perform 1 from public.streak_summary(today);
    raise exception 'FAIL 7 비로그인 호출';
  exception when insufficient_privilege then null;
  end;
  reset role;

  raise exception 'ALL_PASS (7 checks) — rolled back';
end $$;
