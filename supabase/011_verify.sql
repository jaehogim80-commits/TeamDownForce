-- 011 검증 — 마이그레이션 뒤에 붙여 한 번에 실행하고, 마지막 예외로 전부 롤백한다
do $$
declare
  a uuid := gen_random_uuid();  -- 올리는 사람
  b uuid := gen_random_uuid();  -- 반응·가져오는 사람
  c uuid := gen_random_uuid();  -- 같은 루틴을 이미 가진 사람 · 신고자
  d uuid := gen_random_uuid();  -- 신고자
  e uuid := gen_random_uuid();  -- 신고자
  ra uuid; rb uuid; rc uuid; ck uuid; ck_old uuid; ck_b uuid; post uuid; n int; t text; ok boolean;
  today date := (now() at time zone 'Asia/Seoul')::date;
begin
  perform set_config('downforce.dev_signup', 'on', true);  -- 개발 DB의 이메일 가입 차단(dev_101)을 이 검증에서만 연다
  insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
  select '00000000-0000-0000-0000-000000000000', u, 'authenticated', 'authenticated', u::text || '@example.com', now(),
         '{"provider":"email","providers":["email"]}', jsonb_build_object('nickname', nm)
    from (values (a, '올림'), (b, '반응'), (c, '보유'), (d, '신고1'), (e, '신고2')) v(u, nm);

  insert into public.routines (user_id, title, axis, window_start, window_end) values (a, '새벽 러닝', 'life', '05:30', '06:30') returning id into ra;
  insert into public.routines (user_id, title, axis) values (b, '독서', 'life') returning id into rb;
  insert into public.routines (user_id, title, axis) values (c, '새벽 러닝', 'life') returning id into rc;
  insert into public.checkins (user_id, routine_id, local_date, axis, title_at_time) values (a, ra, today, 'work', '-') returning id into ck;
  insert into public.checkins (user_id, routine_id, local_date, axis, title_at_time) values (a, ra, today - 3, 'work', '-') returning id into ck_old;
  insert into public.checkins (user_id, routine_id, local_date, axis, title_at_time) values (b, rb, today, 'work', '-') returning id into ck_b;

  set local role authenticated;

  -- A가 올린다. 제목·축은 보낸 값이 아니라 체크에서 온다
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  insert into public.feed_posts (user_id, checkin_id, title, axis, caption)
  values (a, ck, '가짜 제목', 'work', '  5km 완주  ') returning id into post;
  select title || '|' || axis || '|' || coalesce(caption, '') || '|' || window_start::text into t from public.feed_posts where id = post;
  assert t = '새벽 러닝|life|5km 완주|05:30:00', '1 내용은 체크·루틴에서 복사 ' || t;

  begin
    insert into public.feed_posts (user_id, checkin_id) values (a, ck_b);
    raise exception 'FAIL 2 남의 체크를 올림';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.feed_posts (user_id, checkin_id) values (a, ck_old);
    raise exception 'FAIL 3 사흘 전 체크를 올림';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.feed_posts (user_id, checkin_id) values (a, ck);
    raise exception 'FAIL 4 같은 체크를 두 번 올림';
  exception when unique_violation then null;
  end;
  begin
    insert into public.feed_reactions (post_id, user_id, emoji) values (post, a, 'fire');
    raise exception 'FAIL 5 내 글에 반응';
  exception when insufficient_privilege then null;
  end;

  -- B가 반응하고 바꾼다
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  insert into public.feed_reactions (post_id, user_id, emoji) values (post, b, 'fire');
  update public.feed_reactions set emoji = 'clap' where post_id = post and user_id = b;
  select fire::text || clap::text || my_reaction || coalesce(import_count::text, 'null') into t from public.feed_page() where id = post;
  assert t = '01clapnull', '6 반응 집계 · 남의 글엔 가져간 수 없음 ' || t;

  -- B가 가져온다
  assert public.feed_import(post) = 'imported', '7 가져오기';
  select title || '|' || axis || '|' || window_start::text || '|' || coalesce(hint, '-') into t
    from public.routines where user_id = b and title = '새벽 러닝';
  assert t = '새벽 러닝|life|05:30:00|-', '8 가져온 루틴 (메모는 안 옴) ' || t;
  assert public.feed_import(post) = 'already', '9 두 번 가져오기';
  begin
    insert into public.feed_imports (post_id, user_id) values (post, b);
    raise exception 'FAIL 10 가져오기 기록 직접 쓰기';
  exception when insufficient_privilege then null;
  end;

  -- C는 같은 루틴이 이미 있다
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  assert public.feed_import(post) = 'exists', '11 이미 있는 루틴';
  select count(*) into n from public.feed_imports;
  assert n = 0, '12 남의 가져오기 기록은 안 보임 ' || n;

  -- A는 가져간 수를 본다
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  select import_count into n from public.feed_page() where id = post;
  assert n = 1, '13 올린 사람은 가져간 수를 본다 ' || n;
  assert public.feed_import(post) = 'own', '14 내 글 가져오기';

  -- B가 A를 숨긴다
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  insert into public.feed_mutes (user_id, muted_user_id) values (b, a);
  assert not exists (select 1 from public.feed_page() where id = post), '15 숨긴 사람 글은 안 보임';
  delete from public.feed_mutes where user_id = b;

  -- 신고 3건이면 숨겨진다
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  insert into public.feed_reports (post_id, reporter_id, reason) values (post, c, 'spam');
  begin
    perform 1 from public.feed_reports;
    raise exception 'FAIL 16 신고 목록 조회됨';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claims', json_build_object('sub', d, 'role', 'authenticated')::text, true);
  insert into public.feed_reports (post_id, reporter_id, reason) values (post, d, 'abuse');
  assert exists (select 1 from public.feed_page() where id = post), '17 신고 2건은 그대로';
  perform set_config('request.jwt.claims', json_build_object('sub', e, 'role', 'authenticated')::text, true);
  insert into public.feed_reports (post_id, reporter_id, reason) values (post, e, 'other');
  assert not exists (select 1 from public.feed_page() where id = post), '18 신고 3건이면 숨김';
  assert not exists (select 1 from public.feed_posts where id = post), '19 숨긴 글은 직접 조회도 안 됨';
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  select hidden into ok from public.feed_page() where id = post;
  assert ok, '20 올린 사람에겐 숨김 표시로 보임';

  -- 체크를 취소하면 글도 사라진다
  reset role;
  delete from public.checkins where id = ck;
  assert not exists (select 1 from public.feed_posts where id = post), '21 체크 취소 → 글 삭제';
  assert not exists (select 1 from public.feed_reactions where post_id = post), '22 반응도 삭제';

  -- 로그인 안 한 사람은 아무것도 못 본다
  set local role anon;
  begin
    perform 1 from public.feed_posts;
    raise exception 'FAIL 23 비로그인 조회';
  exception when insufficient_privilege then null;
  end;
  reset role;

  raise exception 'ALL_PASS (23 checks) — rolled back';
end $$;
