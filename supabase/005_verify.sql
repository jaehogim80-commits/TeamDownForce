-- 005·006(+dev 102) 검증 — 개발 DB에서 실행. 마지막 예외로 전부 롤백
do $$
declare
  v_f uuid; a uuid; b uuid; c uuid; t uuid; d uuid; x uuid; r text; n int; m record; i int;
  p text := 'v' || substr(md5(random()::text), 1, 6);
  function_ok boolean;
begin
  -- 기존 상태
  select id into v_f from auth.users where email = 'jaehogim80@gmail.com';
  select * into m from public.membership(v_f);
  assert m.account_type = 'founder' and m.member_number is null and not m.founding_member, '1 창립자 ' || m::text;
  assert (select role from public.profiles where id = v_f) = 'admin', '2 창립자 role';
  assert (select account_type from public.profiles p join auth.users u on u.id = p.id where u.email = 'demo@downforce.dev') = 'tester', '3';
  assert public.member_number('11111111-aaaa-4aaa-8aaa-111111111111') is null, '4 테스터 번호 없음';

  -- 카카오 가입 3명 (이메일 없음 = 일반 회원)
  a := gen_random_uuid(); b := gen_random_uuid(); c := gen_random_uuid();
  insert into auth.users (instance_id, id, aud, role, raw_app_meta_data, raw_user_meta_data)
  values ('00000000-0000-0000-0000-000000000000', a, 'authenticated', 'authenticated', '{"provider":"kakao"}', '{"nickname":"A"}'),
         ('00000000-0000-0000-0000-000000000000', b, 'authenticated', 'authenticated', '{"provider":"kakao"}', '{"nickname":"B"}'),
         ('00000000-0000-0000-0000-000000000000', c, 'authenticated', 'authenticated', '{"provider":"kakao"}', '{"nickname":"C"}');
  n := (select count(*) from public.member_ledger where not excluded and user_id not in (a, b, c));  -- 기존 일반 회원 수
  assert public.member_number(a) = n + 1 and public.member_number(b) = n + 2 and public.member_number(c) = n + 3, '5 번호 ' || n;
  assert (select founding_member from public.membership(a)), '6 창립 멤버';

  -- 가입 전 테스터 지정 → 번호 안 받음
  insert into public.account_designations (email, account_type) values (p || '@tester.test', 'tester');
  t := gen_random_uuid();
  insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data)
  values ('00000000-0000-0000-0000-000000000000', t, 'authenticated', 'authenticated', p || '@TESTER.test', '{"provider":"kakao"}');
  assert (select account_type from public.profiles where id = t) = 'tester', '7';
  assert not exists (select 1 from public.member_ledger where user_id = t), '8 테스터 장부 없음';

  -- ── 권한: 일반 회원 ──
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  begin update public.profiles set account_type = 'founder' where id = a; raise exception 'FAIL 9 본인 유형 변경됨';
  exception when insufficient_privilege then null; end;
  begin perform public.admin_set_account_type(b, 'tester'); raise exception 'FAIL 10 회원이 관리 함수 호출';
  exception when insufficient_privilege then null; end;
  begin perform * from public.admin_list_accounts(); raise exception 'FAIL 11';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.member_ledger; raise exception 'FAIL 12 장부 직접 조회';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.account_designations; raise exception 'FAIL 13 지정 목록 조회';
  exception when insufficient_privilege then null; end;
  assert (select founding_member from public.membership(a)), '14 회원이 membership 조회';

  -- 캘린더 메모
  insert into public.calendar_notes (user_id, note_date, time_of_day, body) values (a, '2026-10-01', '09:30', '치과');
  begin insert into public.calendar_notes (user_id, note_date, body) values (b, '2026-10-01', '남의 메모');
    raise exception 'FAIL 15 남의 이름으로 메모';
  exception when insufficient_privilege then null; end;
  begin insert into public.calendar_notes (user_id, note_date, body) values (a, '2026-10-01', '   ');
    raise exception 'FAIL 16 빈 메모';
  exception when check_violation then null; end;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  assert (select count(*) from public.calendar_notes) = 0, '17 남의 메모 보임';
  delete from public.calendar_notes where user_id = a;
  get diagnostics i = row_count; assert i = 0, '18 남의 메모 삭제됨';
  reset role;
  set local role anon;
  begin perform 1 from public.calendar_notes; raise exception 'FAIL 19 anon 메모';
  exception when insufficient_privilege then null; end;
  reset role;
  assert (select count(*) from public.calendar_notes where user_id = a) = 1, '20';

  -- ── 창립자 ──
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_f, 'role', 'authenticated')::text, true);
  assert public.is_founder(), '21';
  assert (select count(*) from public.admin_list_accounts() l where l.id in (a, b, c, t)) = 4, '22 목록';
  r := public.admin_set_account_type(v_f, 'member');    assert r = 'self', '23 ' || r;
  r := public.admin_set_account_type(a, 'founder');     assert r = 'invalid', '24 ' || r;
  r := public.admin_set_account_type(b, 'tester');      assert r = 'ok', '25 ' || r;
  assert public.member_number(b) is null and public.member_number(c) = n + 2, '26 재분류 후 당겨짐';
  r := public.admin_set_account_type(b, 'member');      assert r = 'ok', '27 ' || r;
  assert public.member_number(b) = n + 2 and public.member_number(c) = n + 3, '28 원래 자리 복귀';
  r := public.admin_set_account_type(t, 'member');      assert r = 'ok', '29 ' || r;
  assert public.member_number(t) = n + 4, '30 새 번호';
  reset role;

  -- 탈퇴해도 승계 없음
  delete from auth.users where id = a;
  assert public.member_number(b) = n + 2, '31 탈퇴 후 번호 유지';
  assert exists (select 1 from public.member_ledger where user_id is null), '32 장부 행 보존';
  assert not exists (select 1 from public.calendar_notes where user_id = a), '33 탈퇴 시 메모 삭제';

  -- 창립 멤버 30명 경계
  for i in 1..40 loop
    x := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, raw_app_meta_data)
    values ('00000000-0000-0000-0000-000000000000', x, 'authenticated', 'authenticated', '{"provider":"kakao"}');
    if public.member_number(x) = 30 then d := x; end if;
  end loop;
  assert (select founding_member from public.membership(d)), '34 30번은 창립 멤버';
  assert not (select founding_member from public.membership(x)), '35 마지막은 아님';
  assert (select count(*) from public.profiles p, public.membership(p.id) ms where ms.founding_member) = 29, '36 창립 멤버 30자리 중 1자리는 탈퇴자(a)가 유지 → 현존 29명';

  -- 개발 가입 승인 → developer, 번호 없음
  set local role anon;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  r := public.dev_signup(p || '@dev.test', 'password1', '개발자'); assert r = 'requested', '37 ' || r;
  reset role;
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_f, 'role', 'authenticated')::text, true);
  r := public.dev_decide_signup(p || '@dev.test', true); assert r = 'approved', '38 ' || r;
  reset role;
  select id into x from auth.users where email = p || '@dev.test';
  assert (select account_type from public.profiles where id = x) = 'developer', '39 개발자 유형';
  assert public.member_number(x) is null, '40 개발자 번호 없음';

  raise exception 'ALL_PASS (40 checks) — rolled back';
end $$;
