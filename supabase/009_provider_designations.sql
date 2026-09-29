-- 009 — 카카오 회원번호로 계정 유형 지정 (운영·개발 공통)
--
-- 문제: 창립자 판정은 가입 이메일 = founder_email() 이었다(005). 그런데 카카오 이메일은 선택 동의이고,
--       창립자의 카카오 계정 이메일은 founder_email()과 다르다. 2026-09-29 개발 첫 카카오 로그인에서
--       이메일 없이 가입되어 창립자가 '일반 회원 1번'으로 잡혔다. 운영에서 그러면 1번 자리를 빼앗는다.
-- 해결: 로그인 제공자의 회원번호(카카오 회원번호)로도 유형을 미리 지정한다.
--       카카오 회원번호는 카카오 앱마다 따로 매겨지는데, 개발·운영이 같은 카카오 앱을 쓰므로 번호가 같다.
--
-- 판정 순서: 창립자 이메일 → 제공자 회원번호 지정 → 이메일 지정 → 일반 회원

create table public.provider_designations (
  provider     text not null check (provider in ('kakao')),
  provider_id  text not null check (provider_id ~ '^[0-9]{1,20}$'),
  account_type text not null check (account_type in ('founder', 'developer', 'tester')),
  note         text check (length(note) <= 200),
  created_at   timestamptz not null default now(),
  primary key (provider, provider_id)
);
alter table public.provider_designations enable row level security;
revoke all on public.provider_designations from anon, authenticated;

-- 창립자(김재호)의 DownForce 카카오 앱 회원번호 — 2026-09-29 개발 DB 첫 카카오 로그인에서 확인
insert into public.provider_designations (provider, provider_id, account_type, note)
values ('kakao', '5113279931', 'founder', '창립자 카카오 계정');

-- 가입 트리거 — 003의 "절대 실패하지 않는다" 원칙 유지. 바뀐 곳은 v_type 판정뿐
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

  if v_type = 'member' then
    insert into public.member_ledger (user_id) values (new.id) on conflict (user_id) do nothing;
  end if;
  return new;
end $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- 이미 가입한 계정 정리 — 지정된 카카오 회원번호인데 일반 회원으로 잡힌 계정을 바로잡는다.
-- 운영 DB는 0명이라 변화 없음. 개발 DB는 2026-09-29 카카오 계정 1개가 창립자로 바뀌고 장부 번호에서 빠진다.
with fix as (
  select p.id, d.account_type
    from public.profiles p
    join auth.identities i on i.user_id = p.id
    join public.provider_designations d on d.provider = i.provider and d.provider_id = i.provider_id
   where p.account_type = 'member'
)
update public.profiles p
   set account_type = fix.account_type,
       role = case when fix.account_type = 'founder' then 'admin' else p.role end
  from fix
 where p.id = fix.id;

update public.member_ledger l
   set excluded = true
  from public.profiles p
 where p.id = l.user_id and p.account_type <> 'member' and not l.excluded;
