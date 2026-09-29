-- ============================================================================
-- 101_dev_signup_approval — 개발 DB(downforce-dev) 전용. 운영 DB에는 적용하지 않는다.
--
-- 규칙
--   1. 소유자 이메일(jaehogim80@gmail.com)만 승인 없이 바로 가입된다. 한 번만.
--   2. 그 밖의 이메일은 가입 요청만 남는다. 비밀번호는 요청할 때 정하고 해시로만 보관한다.
--   3. 소유자가 승인하면 그 해시로 계정이 만들어지고, 요청자는 바로 로그인할 수 있다.
--   4. 이메일 가입은 이 경로로만 된다. Supabase 가입 API를 직접 불러도 트리거가 막는다.
--      (카카오 등 다른 로그인은 막지 않는다)
-- ============================================================================

-- 가입 요청 ------------------------------------------------------------------
create table public.dev_signup_requests (
  email         text primary key
                check (email = lower(btrim(email)) and length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  nickname      text not null check (length(btrim(nickname)) between 1 and 20),
  note          text check (length(note) <= 200),
  password_hash text,                         -- 승인·거절하는 순간 지운다
  status        text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_at  timestamptz not null default now(),
  decided_at    timestamptz,
  user_id       uuid
);
-- 직접 읽기·쓰기 불가. 아래 함수로만 접근한다 (정책 없음 = 전부 거부)
alter table public.dev_signup_requests enable row level security;
revoke all on public.dev_signup_requests from anon, authenticated;

-- 소유자 ---------------------------------------------------------------------
create or replace function public.dev_owner_email()
returns text language sql immutable set search_path = '' as
$$ select 'jaehogim80@gmail.com'::text $$;

-- 소유자 여부 — 서명 검증된 JWT의 auth.uid()로만 판단한다 (이메일 문자열을 믿지 않는다)
create or replace function public.dev_is_owner()
returns boolean language sql stable security definer set search_path = '' as
$$ select exists (select 1 from auth.users where id = auth.uid() and lower(email) = public.dev_owner_email()) $$;

-- 내부용: 이메일 계정 생성 ------------------------------------------------------
-- GoTrue가 만드는 행과 같은 모양. 토큰 칸을 NULL로 두면 로그인 시 GoTrue가 오류를 낸다
create or replace function public.dev_create_email_user(p_email text, p_hash text, p_nickname text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id  uuid := gen_random_uuid();
  v_now timestamptz := now();
begin
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

-- 가드: 이메일 가입은 위 함수를 거친 것만 --------------------------------------
create or replace function public.dev_guard_email_signup()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.raw_app_meta_data->>'provider' = 'email'
     and coalesce(current_setting('downforce.dev_signup', true), '') <> 'on' then
    raise exception '개발용 이메일 가입은 /dev/signup 승인 절차로만 가능합니다' using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger dev_guard_email_signup
  before insert on auth.users
  for each row execute function public.dev_guard_email_signup();

-- 공개: 가입(소유자) 또는 가입 요청(그 밖) ----------------------------------------
-- 반환값: created | requested | pending | rejected | exists | invalid_email | invalid_nickname | weak_password
create or replace function public.dev_signup(p_email text, p_password text, p_nickname text, p_note text default null)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_nick  text := btrim(coalesce(p_nickname, ''));
  v_note  text := nullif(left(btrim(coalesce(p_note, '')), 200), '');
  v_hash  text;
  v_status text;
begin
  if length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then return 'invalid_email'; end if;
  if length(v_nick) not between 1 and 20 then return 'invalid_nickname'; end if;
  -- bcrypt는 72바이트까지만 본다
  if length(coalesce(p_password, '')) < 8 or octet_length(p_password) > 72 then return 'weak_password'; end if;
  if exists (select 1 from auth.users where lower(email) = v_email) then return 'exists'; end if;

  v_hash := extensions.crypt(p_password, extensions.gen_salt('bf', 10));

  if v_email = public.dev_owner_email() then
    perform public.dev_create_email_user(v_email, v_hash, v_nick);
    insert into public.dev_signup_requests (email, nickname, status, decided_at)
    values (v_email, v_nick, 'approved', now())
    on conflict (email) do update set status = 'approved', decided_at = now(), password_hash = null;
    return 'created';
  end if;

  select status into v_status from public.dev_signup_requests where email = v_email for update;
  if not found then
    insert into public.dev_signup_requests (email, nickname, note, password_hash)
    values (v_email, v_nick, v_note, v_hash)
    on conflict (email) do nothing;
    return 'requested';
  end if;

  -- 승인됐지만 계정이 없다 = 탈퇴한 사람. 다시 승인받아야 한다
  if v_status = 'approved' then
    update public.dev_signup_requests
       set status = 'pending', nickname = v_nick, note = v_note, password_hash = v_hash,
           requested_at = now(), decided_at = null, user_id = null
     where email = v_email;
    return 'requested';
  end if;

  -- 대기 중인 요청의 비밀번호를 남이 덮어쓰지 못하게 그대로 둔다
  return v_status;  -- pending | rejected
end $$;

-- 소유자: 요청 목록 · 승인/거절 -------------------------------------------------
create or replace function public.dev_list_signup_requests()
returns table (email text, nickname text, note text, status text, requested_at timestamptz, decided_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.dev_is_owner() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
    select r.email, r.nickname, r.note, r.status, r.requested_at, r.decided_at
      from public.dev_signup_requests r
     where r.email <> public.dev_owner_email()
     order by (r.status = 'pending') desc, coalesce(r.decided_at, r.requested_at) desc
     limit 100;
end $$;

-- 반환값: approved | rejected | exists | not_found | (이미 처리된 경우 그 상태)
create or replace function public.dev_decide_signup(p_email text, p_approve boolean)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_req public.dev_signup_requests;
  v_id  uuid;
begin
  if not public.dev_is_owner() then raise exception 'forbidden' using errcode = '42501'; end if;

  select * into v_req from public.dev_signup_requests where email = lower(btrim(p_email)) for update;
  if not found then return 'not_found'; end if;
  if v_req.status <> 'pending' then return v_req.status; end if;

  if not p_approve then
    update public.dev_signup_requests
       set status = 'rejected', decided_at = now(), password_hash = null
     where email = v_req.email;
    return 'rejected';
  end if;

  if exists (select 1 from auth.users where lower(email) = v_req.email) then
    update public.dev_signup_requests
       set status = 'approved', decided_at = now(), password_hash = null
     where email = v_req.email;
    return 'exists';
  end if;

  v_id := public.dev_create_email_user(v_req.email, v_req.password_hash, v_req.nickname);
  update public.dev_signup_requests
     set status = 'approved', decided_at = now(), password_hash = null, user_id = v_id
   where email = v_req.email;
  return 'approved';
end $$;

-- 권한 -----------------------------------------------------------------------
revoke execute on function public.dev_owner_email()                         from public, anon, authenticated;
revoke execute on function public.dev_create_email_user(text, text, text)   from public, anon, authenticated;
revoke execute on function public.dev_guard_email_signup()                  from public, anon, authenticated;
revoke execute on function public.dev_is_owner()                            from public, anon;
revoke execute on function public.dev_list_signup_requests()                from public, anon;
revoke execute on function public.dev_decide_signup(text, boolean)          from public, anon;
revoke execute on function public.dev_signup(text, text, text, text)        from public;

grant execute on function public.dev_signup(text, text, text, text)  to anon, authenticated;
grant execute on function public.dev_is_owner()                      to authenticated;
grant execute on function public.dev_list_signup_requests()          to authenticated;
grant execute on function public.dev_decide_signup(text, boolean)    to authenticated;
