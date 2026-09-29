-- 102 — 개발 DB 전용. 005 이후에 적용한다.
-- 1) 개발 가입 소유자 = 창립자 (이메일 상수를 한 곳으로)
create or replace function public.dev_owner_email()
returns text language sql immutable set search_path = '' as
$$ select public.founder_email() $$;
revoke execute on function public.dev_owner_email() from public, anon, authenticated;

-- 2) 기존 테스트 계정 → tester, 번호 제외
insert into public.account_designations (email, account_type, note) values
  ('demo@downforce.dev', 'tester', '시드 테스트 계정'),
  ('new@downforce.dev',  'tester', '시드 테스트 계정 (온보딩 전)')
on conflict (email) do nothing;

update public.profiles p set account_type = d.account_type
  from auth.users u join public.account_designations d on d.email = lower(u.email)
 where u.id = p.id and d.account_type <> 'founder';
update public.member_ledger l set excluded = true
  from public.profiles p where p.id = l.user_id and p.account_type <> 'member';

-- 3) 개발 가입으로 승인된 계정은 developer — 계정을 만들기 직전에 지정해 둔다
create or replace function public.dev_create_email_user(p_email text, p_hash text, p_nickname text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id  uuid := gen_random_uuid();
  v_now timestamptz := now();
begin
  if p_email <> public.founder_email() then
    insert into public.account_designations (email, account_type, note)
    values (p_email, 'developer', '개발용 가입 승인')
    on conflict (email) do nothing;
  end if;

  perform set_config('downforce.dev_signup', 'on', true);
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_sso_user, is_anonymous)
  values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', p_email, p_hash, v_now,
    '', '', '', '', '', '', '', '',
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    jsonb_build_object('nickname', p_nickname), v_now, v_now, false, false);
  insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (v_id::text, v_id,
          jsonb_build_object('sub', v_id::text, 'email', p_email, 'email_verified', true),
          'email', v_now, v_now, v_now);
  perform set_config('downforce.dev_signup', '', true);
  return v_id;
end $$;
revoke execute on function public.dev_create_email_user(text, text, text) from public, anon, authenticated;
