-- 009 검증 — 마이그레이션 뒤에 붙여 한 번에 실행하고, 마지막 예외로 전부 롤백한다
do $$
declare
  u1 uuid := gen_random_uuid();  -- 지정된 카카오 회원번호
  u2 uuid := gen_random_uuid();  -- 지정 안 된 카카오 회원번호
  u3 uuid := gen_random_uuid();  -- 창립자 이메일 (기존 방식)
  u4 uuid := gen_random_uuid();  -- 이메일로 테스터 지정 (기존 방식)
  u5 uuid := gen_random_uuid();  -- 카카오인데 다른 제공자 이름으로 같은 번호 (섞이면 안 됨)
  r record; n int;
begin
  perform set_config('downforce.dev_signup', 'on', true);  -- 개발 DB의 이메일 가입 차단(dev_101)을 이 검증에서만 연다. 운영엔 영향 없음
  insert into public.account_designations (email, account_type, note) values ('t009@example.com', 'tester', 'verify');

  insert into auth.users (instance_id, id, aud, role, raw_app_meta_data, raw_user_meta_data) values
    ('00000000-0000-0000-0000-000000000000', u1, 'authenticated', 'authenticated',
     '{"provider":"kakao","providers":["kakao"]}', '{"provider_id":"5113279931","sub":"5113279931","nickname":"창립자"}'),
    ('00000000-0000-0000-0000-000000000000', u2, 'authenticated', 'authenticated',
     '{"provider":"kakao","providers":["kakao"]}', '{"provider_id":"9999999999","nickname":"일반"}'),
    ('00000000-0000-0000-0000-000000000000', u5, 'authenticated', 'authenticated',
     '{"provider":"email","providers":["email"]}', '{"provider_id":"5113279931"}');
  insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data) values
    ('00000000-0000-0000-0000-000000000000', u3, 'authenticated', 'authenticated', 'JaehoGim80@gmail.com', '{"provider":"email"}'),
    ('00000000-0000-0000-0000-000000000000', u4, 'authenticated', 'authenticated', 't009@example.com', '{"provider":"email"}');

  select account_type, role into r from public.profiles where id = u1;
  assert r.account_type = 'founder' and r.role = 'admin', '1 카카오 회원번호 → 창립자 ' || row_to_json(r)::text;
  assert not exists (select 1 from public.member_ledger where user_id = u1), '2 창립자는 장부에 없다';

  assert (select account_type from public.profiles where id = u2) = 'member', '3 지정 안 된 카카오 → 일반';
  assert exists (select 1 from public.member_ledger where user_id = u2 and not excluded), '4 일반은 번호 발급';

  assert (select account_type from public.profiles where id = u5) = 'member', '5 제공자가 다르면 같은 번호라도 지정 안 됨';
  assert (select account_type from public.profiles where id = u3) = 'founder', '6 창립자 이메일 방식 유지';
  assert (select account_type from public.profiles where id = u4) = 'tester', '7 이메일 지정 방식 유지';

  -- 이미 가입한 계정 정리: 지정된 카카오 회원번호 계정이 남아 있으면 창립자여야 하고 장부에서 빠져야 한다
  select count(*) into n
    from public.profiles p join auth.identities i on i.user_id = p.id
   where i.provider = 'kakao' and i.provider_id = '5113279931' and p.account_type <> 'founder';
  assert n = 0, '8 기존 카카오 계정 정리 누락 ' || n;
  select count(*) into n
    from public.member_ledger l join public.profiles p on p.id = l.user_id
   where p.account_type <> 'member' and not l.excluded;
  assert n = 0, '9 일반 회원이 아닌데 번호가 살아 있음 ' || n;

  -- 로그인 사용자는 지정 목록을 못 본다
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true);
  begin
    perform 1 from public.provider_designations;
    raise exception 'FAIL 10 지정 목록 조회됨';
  exception when insufficient_privilege then null;
  end;
  reset role;

  raise exception 'ALL_PASS (10 checks) — rolled back';
end $$;
