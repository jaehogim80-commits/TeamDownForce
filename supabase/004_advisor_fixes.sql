-- DownForce 004 · Supabase 진단기 지적 반영 (2026-09-27)

-- ① RLS: auth.uid()를 행마다 다시 부르지 않게 (select auth.uid())로 감싼다 — 공식 권장 형태
alter policy profiles_write on profiles using (id = (select auth.uid())) with check (id = (select auth.uid()));
alter policy cutoff_read on day_cutoff_settings using (user_id = (select auth.uid()));
alter policy cutoff_insert_future on day_cutoff_settings with check (user_id = (select auth.uid()) and effective_on > (now() at time zone 'Asia/Seoul')::date);
alter policy cutoff_delete_future on day_cutoff_settings using (user_id = (select auth.uid()) and effective_on > (now() at time zone 'Asia/Seoul')::date);
alter policy routines_read on routines using (user_id = (select auth.uid()));
alter policy routines_write_personal on routines with check (user_id = (select auth.uid()) and source = 'personal');
alter policy routines_update_personal on routines using (user_id = (select auth.uid()) and source = 'personal') with check (user_id = (select auth.uid()) and source = 'personal');
alter policy routines_delete_personal on routines using (user_id = (select auth.uid()) and source = 'personal');
alter policy checkins_read on checkins using (user_id = (select auth.uid()));
alter policy checkins_insert on checkins with check (user_id = (select auth.uid()) and local_date between (now() at time zone 'Asia/Seoul')::date - 1 and (now() at time zone 'Asia/Seoul')::date + 1);
alter policy checkins_delete on checkins using (user_id = (select auth.uid()));
alter policy photos_all on checkin_photos using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy day_logs_read on day_logs using (user_id = (select auth.uid()));
alter policy streaks_read on user_streaks using (user_id = (select auth.uid()));
alter policy opens_insert on app_opens with check (user_id = (select auth.uid()) and local_date = (now() at time zone 'Asia/Seoul')::date);
alter policy opens_read on app_opens using (user_id = (select auth.uid()));
alter policy share_insert on share_events with check (user_id = (select auth.uid()));
alter policy dismissals_all on card_dismissals using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ② 검색 경로 고정 (함수가 엉뚱한 스키마의 같은 이름 테이블을 읽지 않게)
alter function public.current_cutoff(uuid, date) set search_path = public;
alter function public.recalc_streak(uuid, date)  set search_path = public;

-- ③ 트리거 전용 함수는 API(/rpc)로 부를 수 없게. 트리거 동작에는 영향 없다
revoke execute on function public.snapshot_checkin() from public, anon, authenticated;
revoke execute on function public.sync_day_log()     from public, anon, authenticated;
revoke execute on function public.sync_streak()      from public, anon, authenticated;
revoke execute on function public.recalc_streak(uuid, date)  from public, anon;
revoke execute on function public.current_cutoff(uuid, date) from public, anon;

-- ④ 외래키 인덱스 (루틴 삭제 cascade · 탈퇴 cascade가 전체 스캔하지 않게)
create index if not exists checkins_routine_id_idx on public.checkins (routine_id);
create index if not exists share_events_user_id_idx on public.share_events (user_id);
