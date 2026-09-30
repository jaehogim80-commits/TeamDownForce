-- 010 — 이메일 가입자는 메일 인증을 마친 뒤에 회원 번호를 받는다 (운영·개발 공통)
--
-- 문제: 이메일 가입을 열면 인증하지 않은 가입(오타 주소·남의 주소·버려진 계정)도 가입 즉시 번호를 받는다.
--       번호는 소급·승계가 없으므로 창립 멤버 자리가 인증도 안 된 계정에 영구히 소모된다.
-- 해결: handle_new_user는 인증 전 이메일 가입자의 장부 기록을 건너뛴다.
--       auth.users.email_confirmed_at이 비어 있다가 채워지는 순간 새 트리거가 번호를 발급한다.
--       카카오 가입, 인증 메일을 끈 환경(가입 즉시 email_confirmed_at이 채워짐)은 지금과 같다.

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_name     text;
  v_email    text;
  v_provider text;
  v_pid      text;
  v_type     text;
begin
  v_name := nullif(btrim(coalesce(
              new.raw_user_meta_data->>'nickname', new.raw_user_meta_data->>'name',
              new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'user_name', '')), '');
  v_name := coalesce(left(v_name, 20), '새 사용자');

  v_email    := lower(btrim(coalesce(new.email, new.raw_user_meta_data->>'email', '')));
  v_provider := coalesce(new.raw_app_meta_data->>'provider', '');
  v_pid      := btrim(coalesce(new.raw_user_meta_data->>'provider_id', new.raw_user_meta_data->>'sub', ''));

  v_type := case
    when v_email <> '' and v_email = public.founder_email() then 'founder'
    else coalesce(
      (select d.account_type from public.provider_designations d
        where v_pid <> '' and d.provider = v_provider and d.provider_id = v_pid),
      (select d.account_type from public.account_designations d
        where v_email <> '' and d.email = v_email),
      'member')
  end;

  begin
    insert into public.profiles (id, handle, display_name, avatar_url, account_type, role)
    values (new.id, 'u_' || substr(replace(new.id::text, '-', ''), 1, 12), v_name,
            new.raw_user_meta_data->>'avatar_url', v_type,
            case when v_type = 'founder' then 'admin' else 'member' end)
    on conflict (id) do nothing;
  exception when unique_violation then
    insert into public.profiles (id, handle, display_name, avatar_url, account_type, role)
    values (new.id, 'u_' || substr(replace(new.id::text, '-', ''), 1, 18), v_name,
            new.raw_user_meta_data->>'avatar_url', v_type,
            case when v_type = 'founder' then 'admin' else 'member' end)
    on conflict (id) do nothing;
  end;

  -- 바뀐 곳: 이메일 가입인데 아직 인증 전이면 번호를 주지 않는다 (인증 순간 아래 트리거가 준다)
  if v_type = 'member' and not (v_provider = 'email' and new.email_confirmed_at is null) then
    insert into public.member_ledger (user_id) values (new.id) on conflict (user_id) do nothing;
  end if;
  return new;
end $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- 메일 인증 순간 번호 발급. 003과 같은 원칙 — 절대 실패하지 않는다 (인증이 막히면 안 된다)
create or replace function public.handle_email_confirmed()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.profiles p where p.id = new.id and p.account_type = 'member') then
    insert into public.member_ledger (user_id) values (new.id) on conflict (user_id) do nothing;
  end if;
  return new;
exception when others then
  return new;
end $$;
revoke execute on function public.handle_email_confirmed() from public, anon, authenticated;

create trigger on_auth_email_confirmed
  after update of email_confirmed_at on auth.users
  for each row
  when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function public.handle_email_confirmed();
