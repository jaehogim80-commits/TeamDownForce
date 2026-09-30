-- 010 검증 — 마이그레이션 뒤에 붙여 한 번에 실행하고, 마지막 예외로 전부 롤백한다
do $$
declare
  u1 uuid := gen_random_uuid();  -- 이메일 가입, 인증 전
  u2 uuid := gen_random_uuid();  -- 이메일 가입, 가입 즉시 인증됨 (인증 메일 끈 환경 · 개발용 가입)
  u3 uuid := gen_random_uuid();  -- 카카오 가입 (이메일 없음)
  u4 uuid := gen_random_uuid();  -- 이메일 가입, 테스터로 지정된 주소
  n1 int; n2 int;
begin
  perform set_config('downforce.dev_signup', 'on', true);  -- 개발 DB의 이메일 가입 차단(dev_101)을 이 검증에서만 연다. 운영엔 영향 없음
  insert into public.account_designations (email, account_type, note) values ('t010@example.com', 'tester', 'verify');

  insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data) values
    ('00000000-0000-0000-0000-000000000000', u1, 'authenticated', 'authenticated', 'a010@example.com', null,
     '{"provider":"email","providers":["email"]}', '{"nickname":"인증전"}'),
    ('00000000-0000-0000-0000-000000000000', u2, 'authenticated', 'authenticated', 'b010@example.com', now(),
     '{"provider":"email","providers":["email"]}', '{"nickname":"즉시"}'),
    ('00000000-0000-0000-0000-000000000000', u3, 'authenticated', 'authenticated', null, null,
     '{"provider":"kakao","providers":["kakao"]}', '{"provider_id":"8888888888","nickname":"카카오"}'),
    ('00000000-0000-0000-0000-000000000000', u4, 'authenticated', 'authenticated', 't010@example.com', null,
     '{"provider":"email","providers":["email"]}', '{}');

  assert (select display_name from public.profiles where id = u1) = '인증전', '1 인증 전에도 프로필은 만들어진다';
  assert not exists (select 1 from public.member_ledger where user_id = u1), '2 인증 전 이메일 가입자는 번호 없음';
  assert exists (select 1 from public.member_ledger where user_id = u2), '3 가입 즉시 인증된 이메일은 바로 번호';
  assert exists (select 1 from public.member_ledger where user_id = u3), '4 카카오는 이메일 없이도 바로 번호';

  select member_no into n2 from public.member_ledger where user_id = u3;
  update auth.users set email_confirmed_at = now() where id = u1;
  assert exists (select 1 from public.member_ledger where user_id = u1 and not excluded), '5 인증 순간 번호 발급';
  select member_no into n1 from public.member_ledger where user_id = u1;
  assert n1 > n2, '6 번호는 인증 순서 — 먼저 가입했어도 늦게 인증하면 뒷번호';

  update auth.users set email_confirmed_at = now() + interval '1 minute' where id = u1;
  assert (select count(*) from public.member_ledger where user_id = u1) = 1, '7 다시 갱신해도 번호는 하나';

  update auth.users set email_confirmed_at = now() where id = u4;
  assert (select account_type from public.profiles where id = u4) = 'tester', '8 테스터 지정 유지';
  assert not exists (select 1 from public.member_ledger where user_id = u4), '9 테스터는 인증해도 번호 없음';

  -- 로그인 사용자는 트리거 함수를 직접 부를 수 없다
  set local role authenticated;
  begin
    perform public.handle_email_confirmed();
    raise exception 'FAIL 10 트리거 함수 직접 호출됨';
  exception when insufficient_privilege or feature_not_supported or undefined_function then null;
  end;
  reset role;

  raise exception 'ALL_PASS (10 checks) — rolled back';
end $$;
