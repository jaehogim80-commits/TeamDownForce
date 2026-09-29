-- 008 검증 — 마지막 예외로 전부 롤백
do $$
declare
  u uuid := gen_random_uuid(); t date; nowt time;
  r_in uuid; r_out uuid; r_none uuid; c_in uuid; c_out uuid; c_old uuid; n int; d record;
begin
  insert into auth.users (instance_id, id, aud, role, raw_app_meta_data)
  values ('00000000-0000-0000-0000-000000000000', u, 'authenticated', 'authenticated', '{"provider":"kakao"}');
  t := public.user_today(u);
  nowt := (now() at time zone 'Asia/Seoul')::time;

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);

  insert into public.routines (user_id, title, axis, hint, window_start, window_end)
  values (u, '시간 안', 'work', '설명 한 줄', (nowt - interval '1 hour')::time, (nowt + interval '1 hour')::time) returning id into r_in;
  insert into public.routines (user_id, title, axis, window_start, window_end)
  values (u, '시간 밖', 'work', (nowt + interval '2 hour')::time, (nowt + interval '3 hour')::time) returning id into r_out;
  insert into public.routines (user_id, title, axis) values (u, '시간 없음', 'life') returning id into r_none;

  -- 제약
  begin insert into public.routines (user_id, title, window_start) values (u, 'x', '06:00'); raise exception 'FAIL 1';
  exception when check_violation then null; end;
  begin insert into public.routines (user_id, title, window_start, window_end) values (u, 'x', '06:00', '06:00'); raise exception 'FAIL 2';
  exception when check_violation then null; end;
  begin insert into public.routines (user_id, title, hint) values (u, 'x', repeat('가', 101)); raise exception 'FAIL 3';
  exception when check_violation then null; end;

  -- 시간 외 스냅샷 (클라이언트가 off_window를 보내도 트리거가 덮어쓴다)
  insert into public.checkins (user_id, routine_id, local_date, axis, title_at_time, off_window, note)
  values (u, r_in, t, 'work', '-', true, '아침에 함') returning id into c_in;
  insert into public.checkins (user_id, routine_id, local_date, axis, title_at_time)
  values (u, r_out, t, 'work', '-') returning id into c_out;
  insert into public.checkins (user_id, routine_id, local_date, axis, title_at_time)
  values (u, r_none, t, 'life', '-');
  assert (select off_window from public.checkins where id = c_in) = false, '4 시간 안';
  assert (select off_window from public.checkins where id = c_out) = true, '5 시간 밖';
  assert (select off_window from public.checkins where routine_id = r_none) = false, '6 시간대 없음';
  assert (select note from public.checkins where id = c_in) = '아침에 함', '7 체크하며 코멘트';

  -- 시간 외여도 완료 판정에 그대로 들어간다
  select * into d from public.day_logs where user_id = u and local_date = t;
  assert d.work_done and d.life_done, '8 시간 외 체크도 완료 ' || row_to_json(d)::text;

  -- 코멘트 수정: note만 가능
  update public.checkins set note = '고친 코멘트' where id = c_out;
  get diagnostics n = row_count; assert n = 1, '9 코멘트 수정';
  begin update public.checkins set off_window = false where id = c_out; raise exception 'FAIL 10 시간외 표시 조작';
  exception when insufficient_privilege then null; end;
  begin update public.checkins set local_date = t - 5 where id = c_out; raise exception 'FAIL 11 날짜 조작';
  exception when insufficient_privilege then null; end;
  begin update public.checkins set axis = 'life' where id = c_out; raise exception 'FAIL 12 축 조작';
  exception when insufficient_privilege then null; end;
  reset role;

  -- 오래된 체크의 코멘트는 못 고친다
  insert into public.checkins (user_id, routine_id, local_date, axis, title_at_time)
  values (u, r_none, t - 5, 'life', '-') returning id into c_old;
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  update public.checkins set note = '과거 수정' where id = c_old;
  get diagnostics n = row_count; assert n = 0, '13 과거 코멘트 수정됨';

  -- 남의 체크 코멘트는 못 고친다
  perform set_config('request.jwt.claims', '{"sub":"11111111-aaaa-4aaa-8aaa-111111111111","role":"authenticated"}', true);
  update public.checkins set note = '남이 씀' where id = c_in;
  get diagnostics n = row_count; assert n = 0, '14 남의 코멘트 수정됨';
  reset role;

  -- 자정 넘는 시각대
  assert public.in_window('23:30', '22:00', '01:00') and public.in_window('00:30', '22:00', '01:00')
     and not public.in_window('02:00', '22:00', '01:00'), '15 자정 넘는 시각대';

  raise exception 'ALL_PASS (15 checks) — rolled back';
end $$;
