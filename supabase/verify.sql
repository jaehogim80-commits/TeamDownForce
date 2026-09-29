-- DownForce 스키마 검증 · 로컬 PG16과 Supabase PG17에서 같은 코드로 돌린다
-- 모든 변경은 마지막 RAISE EXCEPTION으로 롤백된다 → 운영 DB에 흔적이 남지 않는다
do $$
declare
  A uuid := '0a0a0a0a-0000-4000-8000-00000000000a';
  B uuid := '0b0b0b0b-0000-4000-8000-00000000000b';
  RW uuid := 'a1a1a1a1-0000-4000-8000-0000000000a1';   -- A의 Work 루틴
  RL uuid := 'a2a2a2a2-0000-4000-8000-0000000000a2';   -- A의 Life 루틴
  RC uuid := 'a3a3a3a3-0000-4000-8000-0000000000a3';   -- A의 크루 루틴
  RB uuid := 'b1b1b1b1-0000-4000-8000-0000000000b1';   -- B의 루틴
  today date := (now() at time zone 'Asia/Seoul')::date;
  r text := E'\n';
  pass int := 0; fail int := 0;
  n int; v text; ok boolean;

  procedure_dummy int;
begin
  -- ── 준비 (관리자 권한) ─────────────────────────────────
  insert into auth.users (id, raw_user_meta_data) values (A, '{"nickname":"검증A"}'), (B, '{}');
  insert into public.routines (id, user_id, title, axis, category) values
    (RW, A, '새벽 러닝', 'work', '러닝'), (RL, A, '독서', 'life', '독서'), (RB, B, 'B 루틴', 'work', null);
  insert into public.routines (id, user_id, title, axis, source, crew_id)
    values (RC, A, '크루 루틴', 'work', 'crew', 'c0c0c0c0-0000-4000-8000-0000000000c0');

  -- T01 가입 트리거
  select count(*) into n from public.profiles
   where id in (A,B) and handle ~ '^u_[0-9a-f]{12}$' and signup_seq is not null and onboarded_at is null;
  ok := n = 2;  r := r || format('%s T01 가입 → 프로필 자동 생성 (임시 핸들·순번·온보딩 대기) %s/2', case when ok then '✅' else '❌' end, n) || E'\n';
  if ok then pass:=pass+1; else fail:=fail+1; end if;

  select display_name into v from public.profiles where id = B;
  ok := v = '새 사용자';  r := r || format('%s T02 닉네임 없는 가입 → 기본 이름 "%s"', case when ok then '✅' else '❌' end, v) || E'\n';
  if ok then pass:=pass+1; else fail:=fail+1; end if;

  -- ── 회원 A로 로그인 ─────────────────────────────────────
  perform set_config('request.jwt.claim.sub', A::text, true);
  execute 'set local role authenticated';

  -- T03 체크인 → day_logs 자동 생성
  insert into public.checkins (user_id, routine_id, local_date, axis, title_at_time) values (A, RW, today, 'work', 'x');
  select count(*) into n from public.day_logs where user_id = A and local_date = today and work_count = 1;
  ok := n = 1; r := r || format('%s T03 체크인 → day_logs 자동 생성', case when ok then '✅' else '❌' end) || E'\n';
  if ok then pass:=pass+1; else fail:=fail+1; end if;

  -- T04 같은 날 같은 루틴 두 번
  begin
    insert into public.checkins (user_id, routine_id, local_date, axis, title_at_time) values (A, RW, today, 'work', 'x');
    ok := false;
  exception when unique_violation then ok := true; end;
  r := r || format('%s T04 같은 날 같은 루틴 두 번 → 거부', case when ok then '✅' else '❌' end) || E'\n';
  if ok then pass:=pass+1; else fail:=fail+1; end if;

  -- T05 Life 루틴을 Work로 위조 → 루틴 값으로 덮어써진다
  insert into public.checkins (user_id, routine_id, local_date, axis, title_at_time) values (A, RL, today, 'work', '가짜 제목');
  select axis::text || '/' || title_at_time into v from public.checkins where routine_id = RL;
  ok := v = 'life/독서'; r := r || format('%s T05 축·제목 위조 → 루틴 값으로 교정 (%s)', case when ok then '✅' else '❌' end, v) || E'\n';
  if ok then pass:=pass+1; else fail:=fail+1; end if;

  -- T06 남의 루틴에 체크
  begin
    insert into public.checkins (user_id, routine_id, local_date, axis, title_at_time) values (A, RB, today, 'work', 'x');
    ok := false;
  exception when insufficient_privilege then ok := true; end;
  r := r || format('%s T06 남의 루틴에 체크 → 거부', case when ok then '✅' else '❌' end) || E'\n';
  if ok then pass:=pass+1; else fail:=fail+1; end if;

  -- T07 과거 날짜 위조 (±1일 밖)
  begin
    insert into public.checkins (user_id, routine_id, local_date, axis, title_at_time) values (A, RW, today - 5, 'work', 'x');
    ok := false;
  exception when insufficient_privilege then ok := true; end;
  r := r || format('%s T07 5일 전 날짜로 체크 → 거부', case when ok then '✅' else '❌' end) || E'\n';
  if ok then pass:=pass+1; else fail:=fail+1; end if;

  -- T08 크루 루틴 삭제 시도
  delete from public.routines where id = RC;  get diagnostics n = row_count;
  ok := n = 0; r := r || format('%s T08 크루 루틴 삭제 → 0건', case when ok then '✅' else '❌' end) || E'\n';
  if ok then pass:=pass+1; else fail:=fail+1; end if;

  -- T09 day_logs 직접 쓰기
  begin
    insert into public.day_logs (user_id, local_date, work_count) values (A, today - 1, 5);
    ok := false;
  exception when insufficient_privilege then ok := true; end;
  r := r || format('%s T09 day_logs 직접 INSERT → 거부', case when ok then '✅' else '❌' end) || E'\n';
  if ok then pass:=pass+1; else fail:=fail+1; end if;

  -- T10/T11 하루 경계: 오늘 거부 · 내일 허용
  begin
    insert into public.day_cutoff_settings (user_id, effective_on, hour) values (A, today, 4); ok := false;
  exception when insufficient_privilege then ok := true; end;
  r := r || format('%s T10 하루 경계를 오늘부터 → 거부', case when ok then '✅' else '❌' end) || E'\n';
  if ok then pass:=pass+1; else fail:=fail+1; end if;
  begin
    insert into public.day_cutoff_settings (user_id, effective_on, hour) values (A, today + 1, 4); ok := true;
  exception when others then ok := false; end;
  r := r || format('%s T11 하루 경계를 내일부터 → 허용', case when ok then '✅' else '❌' end) || E'\n';
  if ok then pass:=pass+1; else fail:=fail+1; end if;

  -- T12/T13 app_opens: 오늘만
  begin insert into public.app_opens values (A, today); ok := true; exception when others then ok := false; end;
  r := r || format('%s T12 앱 연 날 기록 (오늘) → 허용', case when ok then '✅' else '❌' end) || E'\n';
  if ok then pass:=pass+1; else fail:=fail+1; end if;
  begin insert into public.app_opens values (A, today - 3); ok := false; exception when insufficient_privilege then ok := true; end;
  r := r || format('%s T13 앱 연 날 기록 (3일 전) → 거부', case when ok then '✅' else '❌' end) || E'\n';
  if ok then pass:=pass+1; else fail:=fail+1; end if;

  -- T14~T17 profiles 컬럼 권한
  begin update public.profiles set role = 'admin' where id = A; ok := false;
  exception when insufficient_privilege then ok := true; end;
  r := r || format('%s T14 스스로 관리자 승격 → 거부', case when ok then '✅' else '❌' end) || E'\n';
  if ok then pass:=pass+1; else fail:=fail+1; end if;
  begin update public.profiles set created_at = '2020-01-01' where id = A; ok := false;
  exception when insufficient_privilege then ok := true; end;
  r := r || format('%s T15 가입일 위조 (개척자 뱃지) → 거부', case when ok then '✅' else '❌' end) || E'\n';
  if ok then pass:=pass+1; else fail:=fail+1; end if;
  begin update public.profiles set signup_seq = 1 where id = A; ok := false;
  exception when others then ok := true; end;
  r := r || format('%s T16 가입 순번 위조 (창립 멤버) → 거부', case when ok then '✅' else '❌' end) || E'\n';
  if ok then pass:=pass+1; else fail:=fail+1; end if;
  update public.profiles set handle = 'jaeho_kim', display_name = '재호', onboarded_at = now() where id = A;
  get diagnostics n = row_count;
  ok := n = 1; r := r || format('%s T17 온보딩 (핸들·이름 변경) → 허용', case when ok then '✅' else '❌' end) || E'\n';
  if ok then pass:=pass+1; else fail:=fail+1; end if;

  -- T18 트리거 함수 직접 호출
  begin perform public.handle_new_user(); ok := false;
  exception when insufficient_privilege then ok := true; when others then ok := sqlstate = '42501'; end;
  r := r || format('%s T18 가입 트리거 함수 직접 호출 → 거부', case when ok then '✅' else '❌' end) || E'\n';
  if ok then pass:=pass+1; else fail:=fail+1; end if;

  -- ── 회원 B로 전환 ───────────────────────────────────────
  perform set_config('request.jwt.claim.sub', B::text, true);
  select count(*) into n from public.checkins where user_id = A;
  ok := n = 0; r := r || format('%s T19 남의 체크인 조회 → %s건', case when ok then '✅' else '❌' end, n) || E'\n';
  if ok then pass:=pass+1; else fail:=fail+1; end if;

  -- ── 관리자로 돌아와 스트릭 · 탈퇴 ────────────────────────
  execute 'reset role';
  insert into public.checkins (user_id, routine_id, local_date, axis, title_at_time)
    select A, RW, today - g, 'work', 'x' from generate_series(1,6) g;       -- 7일 연속
  select current_streak::text || '/' || longest_streak into v from public.user_streaks where user_id = A;
  ok := v = '7/7'; r := r || format('%s T20 7일 연속 → 스트릭 %s', case when ok then '✅' else '❌' end, v) || E'\n';
  if ok then pass:=pass+1; else fail:=fail+1; end if;

  delete from public.checkins where user_id = A and routine_id = RW and local_date = today - 3;
  select current_streak::text || '/' || longest_streak into v from public.user_streaks where user_id = A;
  ok := v = '3/3'; r := r || format('%s T21 가운데 하루 취소 → 스트릭 %s (정직하게 감소)', case when ok then '✅' else '❌' end, v) || E'\n';
  if ok then pass:=pass+1; else fail:=fail+1; end if;

  -- T22 회원 탈퇴 (체크인이 있는 사용자)
  begin
    delete from auth.users where id = A;
    select count(*) into n from public.profiles where id = A;
    select n + count(*) into n from public.checkins where user_id = A;
    select n + count(*) into n from public.day_logs where user_id = A;
    select n + count(*) into n from public.user_streaks where user_id = A;
    ok := n = 0;
  exception when others then ok := false; v := sqlerrm; end;
  r := r || format('%s T22 기록 있는 회원 탈퇴 → 전부 삭제%s', case when ok then '✅' else '❌' end,
                   case when ok then '' else ' (' || v || ')' end) || E'\n';
  if ok then pass:=pass+1; else fail:=fail+1; end if;

  r := r || format(E'\n  통과 %s · 실패 %s · PostgreSQL %s', pass, fail, current_setting('server_version'));
  raise exception '%', r;   -- 결과 출력 + 전체 롤백
end $$;
