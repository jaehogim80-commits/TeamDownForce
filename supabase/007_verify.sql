-- 007 검증 — 마지막 예외로 전부 롤백
do $$
declare
  u uuid := gen_random_uuid(); t date; y date;
  w1 uuid; w2 uuid; w3 uuid; l1 uuid; n int; d record; s record;
begin
  insert into auth.users (instance_id, id, aud, role, raw_app_meta_data)
  values ('00000000-0000-0000-0000-000000000000', u, 'authenticated', 'authenticated', '{"provider":"kakao"}');
  t := public.user_today(u); y := t - 1;

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);

  insert into public.routines (user_id, title, axis) values (u, 'W1', 'work') returning id into w1;
  insert into public.routines (user_id, title, axis) values (u, 'W2', 'work') returning id into w2;
  insert into public.routines (user_id, title, axis) values (u, 'L1', 'life') returning id into l1;

  -- 어제: W1만 체크 (어제 기준 체크리스트 = 그날까지 체크된 적 있는 W1뿐)
  insert into public.checkins (user_id, routine_id, local_date, axis, title_at_time) values (u, w1, y, 'work', '-');
  select * into d from public.day_logs where user_id = u and local_date = y;
  assert d.work_required = 1 and d.work_done, '1 어제 ' || row_to_json(d)::text;

  -- 오늘: W1만 → 미완료
  insert into public.checkins (user_id, routine_id, local_date, axis, title_at_time) values (u, w1, t, 'work', '-');
  select * into d from public.day_logs where user_id = u and local_date = t;
  assert d.work_required = 2 and d.work_completed = 1 and not d.work_done, '2 ' || row_to_json(d)::text;
  select * into s from public.user_streaks where user_id = u;
  assert s.current_streak = 1, '3 어제만 완료 → 1 ' || row_to_json(s)::text;

  -- W2까지 → Work 완료, 스트릭 2
  insert into public.checkins (user_id, routine_id, local_date, axis, title_at_time) values (u, w2, t, 'work', '-');
  select * into d from public.day_logs where user_id = u and local_date = t;
  assert d.work_done and not d.life_done, '4';
  select * into s from public.user_streaks where user_id = u;
  assert s.current_streak = 2, '5 ' || row_to_json(s)::text;

  -- 새 Work 루틴 추가 → 오늘 미완료로
  insert into public.routines (user_id, title, axis) values (u, 'W3', 'work') returning id into w3;
  select * into d from public.day_logs where user_id = u and local_date = t;
  assert d.work_required = 3 and not d.work_done, '6 ' || row_to_json(d)::text;
  select * into s from public.user_streaks where user_id = u;
  assert s.current_streak = 1, '7 오늘 미완료 → 어제까지 1 ' || row_to_json(s)::text;

  -- W3 삭제(보관) → 다시 완료
  update public.routines set archived_at = now() where id = w3;
  select * into d from public.day_logs where user_id = u and local_date = t;
  assert d.work_required = 2 and d.work_done, '8';

  -- 어제 행은 그대로 (과거 불변)
  select * into d from public.day_logs where user_id = u and local_date = y;
  assert d.work_required = 1 and d.work_done, '9 어제 불변';

  -- Life 체크 → 둘 다 완료
  insert into public.checkins (user_id, routine_id, local_date, axis, title_at_time) values (u, l1, t, 'life', '-');
  select * into d from public.day_logs where user_id = u and local_date = t;
  assert d.work_done and d.life_done, '10';

  -- L1을 Work로 변경 → 오늘 체크 스냅샷도 work로, Work 3/3 · Life 0
  update public.routines set axis = 'work', title = 'L1→W' where id = l1;
  assert (select axis from public.checkins where routine_id = l1 and local_date = t) = 'work', '11 오늘 스냅샷 축';
  assert (select title_at_time from public.checkins where routine_id = l1 and local_date = t) = 'L1→W', '12 오늘 스냅샷 제목';
  select * into d from public.day_logs where user_id = u and local_date = t;
  assert d.work_required = 3 and d.work_completed = 3 and d.work_done and d.life_required = 0 and not d.life_done
       and d.work_count = 3 and d.life_count = 0, '13 ' || row_to_json(d)::text;

  -- 체크 취소 → 미완료, 스트릭 1
  delete from public.checkins where routine_id = w2 and local_date = t;
  select * into d from public.day_logs where user_id = u and local_date = t;
  assert not d.work_done, '14';
  select * into s from public.user_streaks where user_id = u;
  assert s.current_streak = 1, '15';

  -- 루틴 하드 삭제 불가 (정책 없음 → 0행)
  delete from public.routines where id = w1;
  get diagnostics n = row_count;
  assert n = 0, '16 하드 삭제됨';

  -- 보관된 루틴은 체크 불가 (기존 snapshot_checkin)
  begin
    insert into public.checkins (user_id, routine_id, local_date, axis, title_at_time) values (u, w3, t, 'work', '-');
    raise exception 'FAIL 17';
  exception when insufficient_privilege then null; end;

  -- 남의 루틴 수정 불가
  perform set_config('request.jwt.claims', '{"sub":"11111111-aaaa-4aaa-8aaa-111111111111","role":"authenticated"}', true);
  update public.routines set axis = 'life' where id = w1;
  get diagnostics n = row_count;
  assert n = 0, '18 남의 루틴 수정됨';
  reset role;

  -- 탈퇴 cascade가 여전히 된다
  delete from auth.users where id = u;
  assert not exists (select 1 from public.day_logs where user_id = u), '19';

  raise exception 'ALL_PASS (19 checks) — rolled back';
end $$;
