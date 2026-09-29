-- ============================================================================
-- DownForce 008 · 루틴 설명·시간대, 체크 코멘트 — 운영·개발 DB 공통 (2026-09-28)
-- CheckPoint(checklist_items.hint / starts_at·ends_at, item_results.comment)에서 가져온 것을
-- DownForce의 "매일 반복" 모델에 맞게 바꿨다.
--
--   routines.hint                  루틴 설명 한 줄 (100자)
--   routines.window_start/end      매일 반복되는 시각대 (날짜가 아니라 시각). 22:00~01:00처럼 자정을 넘겨도 된다
--   checkins.off_window            체크한 순간이 시각대 밖이었는가 — 체크 시점에 확정되는 스냅샷
--   checkins.note (기존)           체크 코멘트. 오늘·어제 체크한 것만 코멘트를 고칠 수 있다
--
-- 시각대는 표시만 한다: 시각대 밖에서도 체크할 수 있고, 완료 판정·스트릭(007)에는 영향이 없다.
-- ============================================================================

-- 1) 루틴 -------------------------------------------------------------------
alter table public.routines
  add column hint text check (hint is null or char_length(hint) <= 100),
  add column window_start time,
  add column window_end   time,
  add constraint routines_window_pair check (
    (window_start is null and window_end is null)
    or (window_start is not null and window_end is not null and window_start <> window_end)
  );

-- 2) 체크 스냅샷 -------------------------------------------------------------
alter table public.checkins
  add column off_window boolean not null default false;

-- 시각대 안인가 (자정을 넘기는 시각대 포함)
create or replace function public.in_window(p_t time, p_start time, p_end time)
returns boolean language sql immutable set search_path = '' as $$
  select case
    when p_start is null or p_end is null then true
    when p_start < p_end then p_t >= p_start and p_t < p_end
    else p_t >= p_start or p_t < p_end            -- 예: 22:00~01:00
  end
$$;

-- 001의 snapshot_checkin에 시각대 판정을 더한다. 기존 교정(축·카테고리·크루·제목, 본인·미보관만)은 그대로
create or replace function public.snapshot_checkin() returns trigger
language plpgsql security definer set search_path = public as $$
declare r routines%rowtype; tz text;
begin
  select * into r from routines where id = new.routine_id;
  if r.id is null or r.user_id <> new.user_id then
    raise exception '본인 루틴이 아닙니다' using errcode = '42501';
  end if;
  if r.archived_at is not null then
    raise exception '보관된 루틴입니다' using errcode = '42501';
  end if;
  new.axis          := r.axis;
  new.category      := r.category;
  new.crew_id       := r.crew_id;
  new.title_at_time := r.title;

  select timezone into tz from profiles where id = new.user_id;
  new.off_window := not in_window((now() at time zone coalesce(tz, 'Asia/Seoul'))::time, r.window_start, r.window_end);
  return new;
end $$;

-- 3) 코멘트만 고칠 수 있게 ----------------------------------------------------
-- 지금까지 checkins에는 UPDATE 정책이 없었다(기록은 지우고 다시 넣는다).
-- 코멘트(note) 한 칸만, 체크를 넣을 수 있는 기간(서울 날짜 ±1일)에 한해 연다.
revoke update on public.checkins from authenticated;
grant  update (note) on public.checkins to authenticated;

create policy checkins_update_note on public.checkins for update to authenticated
  using (user_id = (select auth.uid())
         and local_date between (now() at time zone 'Asia/Seoul')::date - 1
                            and (now() at time zone 'Asia/Seoul')::date + 1)
  with check (user_id = (select auth.uid()));

-- 4) 권한 -------------------------------------------------------------------
revoke execute on function public.snapshot_checkin() from public, anon, authenticated;
revoke execute on function public.in_window(time, time, time) from public, anon;
