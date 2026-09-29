-- ============================================================================
-- DownForce 005 · 계정 유형과 창립 멤버 번호 — 운영·개발 DB 공통
--
-- 왜: signup_seq는 모든 가입(창립자·개발자·테스터 포함)에 번호를 매긴다.
--     창립 멤버(첫 30명)는 "실제 회원"만 세야 한다.
--
-- 구조
--   profiles.account_type   member | founder | developer | tester  (회원이 직접 못 바꾼다)
--   account_designations    가입 전에 이메일로 유형을 미리 지정 (창립자 이메일은 코드에 고정)
--   member_ledger           일반 회원(member)에게만 번호를 발급하는 장부.
--                           탈퇴해도 행이 남는다 → 뒷사람이 승계하지 않는다 (rules.ts reassignOnLeave=false)
--                           나중에 개발자·테스터로 재분류되면 excluded=true → 번호 계산에서 빠진다
--   member_number(user)     excluded가 아닌 장부 행 중 몇 번째인지 = 화면에 보이는 회원 번호
--   창립 멤버               account_type='member' 이고 member_number <= 30
--
-- signup_seq는 그대로 둔다 (가입 순서라는 사실 기록). 화면은 더 이상 signup_seq를 쓰지 않는다.
-- ============================================================================

-- 창립자 ----------------------------------------------------------------------
create or replace function public.founder_email()
returns text language sql immutable set search_path = '' as
$$ select 'jaehogim80@gmail.com'::text $$;

-- 계정 유형 -------------------------------------------------------------------
alter table public.profiles
  add column account_type text not null default 'member'
  check (account_type in ('member', 'founder', 'developer', 'tester'));
-- 002의 컬럼 단위 update 권한 목록에 없으므로 회원은 이 값을 바꿀 수 없다

-- 가입 전 지정 ----------------------------------------------------------------
create table public.account_designations (
  email        text primary key check (email = lower(btrim(email)) and length(email) <= 254),
  account_type text not null check (account_type in ('founder', 'developer', 'tester')),
  note         text check (length(note) <= 200),
  created_at   timestamptz not null default now()
);
alter table public.account_designations enable row level security;
revoke all on public.account_designations from anon, authenticated;

insert into public.account_designations (email, account_type, note)
values (public.founder_email(), 'founder', '창립자');

-- 회원 번호 장부 --------------------------------------------------------------
create table public.member_ledger (
  member_no  bigint generated always as identity primary key,
  user_id    uuid unique references public.profiles(id) on delete set null,
  excluded   boolean not null default false,
  issued_at  timestamptz not null default now()
);
alter table public.member_ledger enable row level security;
revoke all on public.member_ledger from anon, authenticated;

-- 가입 트리거 교체 — 003의 "절대 실패하지 않는다" 원칙 유지 ------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_name  text;
  v_email text;
  v_type  text;
begin
  v_name := nullif(btrim(coalesce(
              new.raw_user_meta_data->>'nickname', new.raw_user_meta_data->>'name',
              new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'user_name', '')), '');
  v_name := coalesce(left(v_name, 20), '새 사용자');

  -- 카카오는 이메일 동의 전이면 email이 비어 있다 → 일반 회원으로 시작 (창립자가 나중에 재분류 가능)
  v_email := lower(btrim(coalesce(new.email, new.raw_user_meta_data->>'email', '')));
  v_type := case
    when v_email <> '' and v_email = public.founder_email() then 'founder'
    else coalesce((select d.account_type from public.account_designations d where v_email <> '' and d.email = v_email), 'member')
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

-- 기존 회원 정리 (운영 DB는 0명이라 변화 없음) --------------------------------
update public.profiles p
   set account_type = case
         when lower(u.email) = public.founder_email() then 'founder'
         else coalesce((select d.account_type from public.account_designations d where d.email = lower(u.email)), 'member')
       end
  from auth.users u
 where u.id = p.id;
update public.profiles set role = 'admin' where account_type = 'founder';

insert into public.member_ledger (user_id)
select id from public.profiles where account_type = 'member' order by signup_seq
on conflict (user_id) do nothing;

-- 조회 ------------------------------------------------------------------------
create or replace function public.member_number(p_user uuid)
returns integer language sql stable security definer set search_path = '' as $$
  select (select count(*) from public.member_ledger l2
           where not l2.excluded and l2.member_no <= l.member_no)::integer
    from public.member_ledger l
   where l.user_id = p_user and not l.excluded
$$;

-- 화면용. 창립 멤버 기준 30 = config/rules.ts founding.founderSeq
create or replace function public.membership(p_user uuid)
returns table (account_type text, member_number integer, founding_member boolean)
language sql stable security definer set search_path = '' as $$
  select p.account_type,
         public.member_number(p.id),
         p.account_type = 'member' and coalesce(public.member_number(p.id) <= 30, false)
    from public.profiles p
   where p.id = p_user
$$;

-- 창립자 전용 관리 ------------------------------------------------------------
create or replace function public.is_founder()
returns boolean language sql stable security definer set search_path = '' as
$$ select exists (select 1 from public.profiles where id = auth.uid() and account_type = 'founder') $$;

create or replace function public.admin_list_accounts()
returns table (id uuid, display_name text, handle text, email text, account_type text,
               member_number integer, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_founder() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
    select p.id, p.display_name, p.handle, u.email::text, p.account_type,
           public.member_number(p.id), p.created_at
      from public.profiles p join auth.users u on u.id = p.id
     order by p.signup_seq;
end $$;

-- 반환값: ok | self | founder_locked | not_found | invalid
create or replace function public.admin_set_account_type(p_user uuid, p_type text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_old text;
begin
  if not public.is_founder() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_type not in ('member', 'developer', 'tester') then return 'invalid'; end if;  -- 창립자는 지정 대상이 아니다
  if p_user = auth.uid() then return 'self'; end if;

  select account_type into v_old from public.profiles where id = p_user for update;
  if not found then return 'not_found'; end if;
  if v_old = 'founder' then return 'founder_locked'; end if;
  if v_old = p_type then return 'ok'; end if;

  update public.profiles set account_type = p_type where id = p_user;
  if p_type = 'member' then
    -- 예전 번호가 있으면 그 자리로 복귀, 없으면 새 번호
    update public.member_ledger set excluded = false where user_id = p_user;
    if not found then insert into public.member_ledger (user_id) values (p_user); end if;
  else
    update public.member_ledger set excluded = true where user_id = p_user;
  end if;
  return 'ok';
end $$;

-- 권한 -----------------------------------------------------------------------
revoke execute on function public.founder_email()                    from public, anon, authenticated;
revoke execute on function public.member_number(uuid)                from public, anon;
revoke execute on function public.membership(uuid)                   from public, anon;
revoke execute on function public.is_founder()                       from public, anon;
revoke execute on function public.admin_list_accounts()              from public, anon;
revoke execute on function public.admin_set_account_type(uuid, text) from public, anon;
grant execute on function public.member_number(uuid)                to authenticated;
grant execute on function public.membership(uuid)                   to authenticated;
grant execute on function public.is_founder()                       to authenticated;
grant execute on function public.admin_list_accounts()              to authenticated;
grant execute on function public.admin_set_account_type(uuid, text) to authenticated;
