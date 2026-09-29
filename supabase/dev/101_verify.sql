-- 101 검증 — 개발 DB에서 실행. 마지막에 예외를 던져 전부 롤백한다 (행이 남지 않는다)
do $$
declare
  r text; n int; v_owner uuid; v_new uuid; ok boolean;
  t text := 'x9_' || substr(md5(random()::text), 1, 6);   -- 이번 실행 전용 접두사
  e_req text := t || '@req.test'; e_rej text := t || '@rej.test';
begin
  -- ── 익명(anon) ──────────────────────────────────────────────
  set local role anon;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);

  r := public.dev_signup('not-an-email', 'password1', '닉'); assert r = 'invalid_email', '1 ' || r;
  r := public.dev_signup(e_req, 'short', '닉');              assert r = 'weak_password', '2 ' || r;
  r := public.dev_signup(e_req, 'password1', '   ');         assert r = 'invalid_nickname', '3 ' || r;
  r := public.dev_signup(e_req, 'password1', '요청자', '같이 테스트해요'); assert r = 'requested', '4 ' || r;
  r := public.dev_signup(e_req, 'attackerpw', '공격자');      assert r = 'pending', '5 덮어쓰기 거부 ' || r;
  r := public.dev_signup(e_rej, 'password2', '거절될사람');   assert r = 'requested', '6 ' || r;
  r := public.dev_signup('DEMO@downforce.dev', 'password1', '중복'); assert r = 'exists', '7 ' || r;

  begin perform 1 from public.dev_signup_requests; raise exception 'FAIL 8 테이블 직접 조회됨';
  exception when insufficient_privilege then null; end;
  begin perform public.dev_list_signup_requests(); raise exception 'FAIL 9 anon 목록 조회됨';
  exception when insufficient_privilege then null; end;
  begin perform public.dev_create_email_user('a@b.cd', 'x', 'x'); raise exception 'FAIL 10 내부 함수 호출됨';
  exception when insufficient_privilege then null; end;

  -- 소유자 최초 가입
  r := public.dev_signup('JaehoGim80@gmail.com', 'ownerpass1', '재호'); assert r = 'created', '11 ' || r;
  r := public.dev_signup('jaehogim80@gmail.com', 'otherpass1', '가짜'); assert r = 'exists', '12 두 번째 소유자 가입 거부 ' || r;
  reset role;

  select id into v_owner from auth.users where email = 'jaehogim80@gmail.com';
  assert v_owner is not null, '13 소유자 계정 없음';
  select encrypted_password = extensions.crypt('ownerpass1', encrypted_password) into ok from auth.users where id = v_owner;
  assert ok, '14 소유자 비밀번호 불일치';
  assert exists (select 1 from auth.identities where user_id = v_owner and provider = 'email'), '15 identity 없음';
  assert exists (select 1 from public.profiles where id = v_owner and display_name = '재호'), '16 프로필 트리거 미동작';

  -- ── 가드: Supabase 가입 API를 직접 부른 것과 같은 INSERT ────────────
  begin
    insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data)
    values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
            t || '@bypass.test', '{"provider":"email","providers":["email"]}');
    raise exception 'FAIL 17 직접 이메일 가입이 통과됨';
  exception when raise_exception then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  -- 카카오 가입은 막지 않는다
  insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data)
  values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
          t || '@kakao.test', '{"provider":"kakao","providers":["kakao"]}');

  -- ── 소유자 아닌 로그인 사용자 ───────────────────────────────────
  set local role authenticated;
  perform set_config('request.jwt.claims', '{"sub":"11111111-aaaa-4aaa-8aaa-111111111111","role":"authenticated"}', true);
  assert public.dev_is_owner() = false, '18';
  begin perform public.dev_decide_signup(e_req, true); raise exception 'FAIL 19 남이 승인함';
  exception when insufficient_privilege then null; end;

  -- ── 소유자 ─────────────────────────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  assert public.dev_is_owner(), '20';
  select count(*) into n from public.dev_list_signup_requests() l where l.email in (e_req, e_rej) and l.status = 'pending';
  assert n = 2, '21 목록 ' || n;
  assert not exists (select 1 from public.dev_list_signup_requests() l where l.email = 'jaehogim80@gmail.com'), '22 소유자 행 노출';

  r := public.dev_decide_signup(e_req, true);  assert r = 'approved', '23 ' || r;
  r := public.dev_decide_signup(e_req, true);  assert r = 'approved', '24 중복 승인 무해 ' || r;
  r := public.dev_decide_signup(e_rej, false); assert r = 'rejected', '25 ' || r;
  r := public.dev_decide_signup('nobody@x.test', true); assert r = 'not_found', '26 ' || r;
  reset role;

  select id into v_new from auth.users where email = e_req;
  assert v_new is not null, '27 승인했는데 계정 없음';
  select encrypted_password = extensions.crypt('password1', encrypted_password) into ok from auth.users where id = v_new;
  assert ok, '28 요청자 비밀번호가 요청 때 정한 것과 다름';
  assert not exists (select 1 from auth.users where email = e_rej), '29 거절했는데 계정 생김';
  assert not exists (select 1 from public.dev_signup_requests where password_hash is not null and status <> 'pending'), '30 처리 후 해시 남음';

  set local role anon;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  r := public.dev_signup(e_rej, 'password9', '재시도'); assert r = 'rejected', '31 ' || r;
  r := public.dev_signup(e_req, 'password9', '재가입'); assert r = 'exists', '32 ' || r;
  reset role;

  raise exception 'ALL_PASS (32 checks) — rolled back';
end $$;
