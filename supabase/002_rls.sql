-- DownForce 1차 · RLS. 모든 테이블에 켠다 — 안 켜면 익명 키로 전부 열린다
alter table profiles            enable row level security;
alter table day_cutoff_settings enable row level security;
alter table routines            enable row level security;
alter table checkins            enable row level security;
alter table checkin_photos      enable row level security;
alter table day_logs            enable row level security;
alter table user_streaks        enable row level security;
alter table app_opens           enable row level security;
alter table share_events        enable row level security;
alter table card_dismissals     enable row level security;

-- profiles : 공개 프로필이므로 읽기는 전체, 쓰기는 본인
create policy profiles_read  on profiles for select to authenticated using (true);
create policy profiles_write on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- day_cutoff_settings : 미래 행만 쓰고 지울 수 있다 (오늘·과거는 불변)
create policy cutoff_read on day_cutoff_settings for select to authenticated
  using (user_id = auth.uid());
create policy cutoff_insert_future on day_cutoff_settings for insert to authenticated
  with check (user_id = auth.uid()
              and effective_on > (now() at time zone 'Asia/Seoul')::date);
create policy cutoff_delete_future on day_cutoff_settings for delete to authenticated
  using (user_id = auth.uid()
         and effective_on > (now() at time zone 'Asia/Seoul')::date);
-- UPDATE 정책 없음 = 덮어쓰기 경로가 존재하지 않는다

-- routines : 크루 루틴은 본인이라도 쓸 수 없다
create policy routines_read on routines for select to authenticated
  using (user_id = auth.uid());
create policy routines_write_personal on routines for insert to authenticated
  with check (user_id = auth.uid() and source = 'personal');
create policy routines_update_personal on routines for update to authenticated
  using (user_id = auth.uid() and source = 'personal')
  with check (user_id = auth.uid() and source = 'personal');
create policy routines_delete_personal on routines for delete to authenticated
  using (user_id = auth.uid() and source = 'personal');

-- checkins
create policy checkins_read on checkins for select to authenticated using (user_id = auth.uid());
create policy checkins_insert on checkins for insert to authenticated
  with check (user_id = auth.uid()
              and local_date between (now() at time zone 'Asia/Seoul')::date - 1
                                 and (now() at time zone 'Asia/Seoul')::date + 1);
create policy checkins_delete on checkins for delete to authenticated using (user_id = auth.uid());
-- UPDATE 정책 없음 = 기록은 고치는 게 아니라 지우고 다시 넣는다

create policy photos_all on checkin_photos for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 집계 테이블 : 읽기만. 쓰기는 트리거(security definer)만
create policy day_logs_read on day_logs for select to authenticated using (user_id = auth.uid());
create policy streaks_read  on user_streaks for select to authenticated using (user_id = auth.uid());

-- app_opens : 오늘 것만 넣을 수 있다. 과거 방문 위조 차단
create policy opens_insert on app_opens for insert to authenticated
  with check (user_id = auth.uid()
              and local_date = (now() at time zone 'Asia/Seoul')::date);
create policy opens_read on app_opens for select to authenticated using (user_id = auth.uid());

-- 계측 : 넣기만 하고 못 읽는다
create policy share_insert on share_events for insert to authenticated with check (user_id = auth.uid());

create policy dismissals_all on card_dismissals for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- ── profiles 컬럼 단위 권한 (2026-09-26) ─────────────────────
-- profiles_write 정책은 "본인 행"만 막지 "어느 컬럼"은 막지 않는다.
-- 그대로 두면 회원이 브라우저에서 자기 role을 'admin'으로, created_at을 과거로 바꿀 수 있다
-- (→ 어드민 2차에서 전원 관리자 · 개척자 뱃지 위조). PG16에서 재현 확인.
-- 본인이 바꿔도 되는 컬럼만 연다. signup_seq는 identity라 원래 막혀 있다.
revoke update on profiles from authenticated;
grant  update (handle, display_name, avatar_url, timezone, onboarded_at) on profiles to authenticated;
