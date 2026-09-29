-- ============================================================================
-- DownForce 006 · 캘린더 일정 메모 — 운영·개발 DB 공통
-- 체크인(local_date 불변)과 완전히 분리된 테이블. 날짜는 사용자가 고른 달력 날짜 그대로다.
-- ============================================================================
create table public.calendar_notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,  -- 탈퇴 시 함께 삭제
  note_date   date not null check (note_date between date '2000-01-01' and date '2100-12-31'),
  time_of_day time,                                                               -- 선택
  body        text not null check (char_length(btrim(body)) between 1 and 200),
  created_at  timestamptz not null default now()
);
create index calendar_notes_user_date on public.calendar_notes (user_id, note_date);

alter table public.calendar_notes enable row level security;
create policy notes_read   on public.calendar_notes for select to authenticated using (user_id = (select auth.uid()));
create policy notes_insert on public.calendar_notes for insert to authenticated with check (user_id = (select auth.uid()));
create policy notes_update on public.calendar_notes for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notes_delete on public.calendar_notes for delete to authenticated using (user_id = (select auth.uid()));

revoke all on public.calendar_notes from anon;
grant select, insert, update, delete on public.calendar_notes to authenticated;
