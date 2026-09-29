-- DownForce 003 · 가입 → profiles 자동 생성
-- 원칙: 이 트리거는 절대 실패하면 안 된다.
--       실패하면 auth.users 삽입까지 되돌려져 가입 자체가 막힌다 ("로그인이 안 돼요").
--
-- 가입 시점엔 사용자가 정한 핸들이 없다 → 임시 핸들을 부여하고,
-- onboarded_at is null 인 사용자를 앱이 온보딩 화면으로 보내 본인이 바꾸게 한다.
-- signup_seq(창립 멤버 순번)는 이 INSERT 시점에 매겨진다 = 실제 가입 순서.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  -- 카카오·구글 등 제공자마다 닉네임 키가 달라서 순서대로 시도한다
  v_name := nullif(btrim(coalesce(
              new.raw_user_meta_data->>'nickname',
              new.raw_user_meta_data->>'name',
              new.raw_user_meta_data->>'full_name',
              new.raw_user_meta_data->>'user_name',
              '')), '');
  v_name := coalesce(left(v_name, 20), '새 사용자');   -- display_name 1~20자 제약

  begin
    insert into public.profiles (id, handle, display_name, avatar_url)
    values (
      new.id,
      'u_' || substr(replace(new.id::text, '-', ''), 1, 12),   -- 14자 · ^[a-z0-9_]{3,20}$ 통과
      v_name,
      new.raw_user_meta_data->>'avatar_url'
    )
    on conflict (id) do nothing;                              -- 재시도·중복 호출에도 안전
  exception when unique_violation then
    -- 누군가 온보딩에서 이 임시 핸들과 같은 값을 골라둔 극단적 경우 → 18자로 늘려 재시도
    insert into public.profiles (id, handle, display_name, avatar_url)
    values (new.id, 'u_' || substr(replace(new.id::text, '-', ''), 1, 18), v_name,
            new.raw_user_meta_data->>'avatar_url')
    on conflict (id) do nothing;
  end;

  return new;
end;
$$;

-- 앱 사용자가 직접 호출할 이유가 없다
revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
