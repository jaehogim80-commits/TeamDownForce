import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getViewer, cellOf } from '@/lib/session'
import { addDays, daysBetween, labelKo, weekStart, weekdayKo } from '@/lib/date'
import CheckItem from './CheckItem'
import { AxisFilter } from '../AxisToggle'
import { NowFocusProvider } from './NowFocus'
import { minutesIn } from '@/lib/nowFocus'
import '../feed/feed.css'
import './streak.css'

export default async function TodayPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  // 예전 편집 주소(?edit=1)는 편집 페이지로 보낸다
  if ((await searchParams).edit === '1') redirect('/today/edit')
  const { supabase, user, today, profile } = await getViewer()

  // 계측이 화면보다 먼저 — 앱을 연 날 (D30 · DAU의 근거). 같은 날 두 번째부터는 무시
  await supabase.from('app_opens').upsert({ user_id: user.id, local_date: today }, { ignoreDuplicates: true })

  const monday = weekStart(today)
  const from = addDays(today, -6) < monday ? addDays(today, -6) : monday

  const [{ data: routines }, { data: todayChecks }, { data: logs }, { data: streak }] = await Promise.all([
    supabase.from('routines').select('id,title,axis,category,hint,window_start,window_end').is('archived_at', null).order('sort_order'),
    supabase.from('checkins').select('id,routine_id,note,off_window').eq('local_date', today),
    supabase.from('day_logs').select('local_date,work_done,life_done').gte('local_date', from).lte('local_date', addDays(monday, 6)),
    supabase.from('user_streaks').select('current_streak,last_active_on').maybeSingle(),
  ])
  // 오늘 피드에 올린 체크 (011) — 올린 항목은 '피드 ✓'로 보인다
  const { data: posts } = await supabase.from('feed_posts').select('checkin_id').eq('user_id', user.id).eq('local_date', today)
  const posted = new Set((posts ?? []).map((p) => p.checkin_id))
  // 항목별 연속 일수 (012) — 오늘을 뺀 '어제까지'를 넘기고, 오늘 체크 여부는 화면이 더한다
  const { data: streaks } = await supabase.rpc('routine_streaks', { p_today: today })
  const streakBase = new Map((streaks ?? []).map((s) => [s.routine_id, s.done_today ? s.streak - 1 : s.streak]))

  const done = new Set((todayChecks ?? []).map((c) => c.routine_id))
  const checkOf = new Map((todayChecks ?? []).map((c) => [c.routine_id, c]))
  const byDate = new Map((logs ?? []).map((l) => [l.local_date, l]))

  // 캐시를 그대로 믿지 않는다 — 끊기는 건 아무도 아무것도 안 할 때 일어난다 (4.2)
  const shown =
    streak && streak.last_active_on && daysBetween(streak.last_active_on, today) <= 1 ? streak.current_streak : 0

  // 칸 색은 "그 테마의 체크리스트를 전부 끝냈는가" (007) — 판정은 DB가 한다
  const t = byDate.get(today)
  const todayCell = cellOf(t?.work_done, t?.life_done)

  // 밸런스 — 최근 7일 중 Work/Life를 완료한 날 수 (4.5)
  let w7 = 0, l7 = 0
  for (let i = 0; i < 7; i++) {
    const r = byDate.get(addDays(today, -i))
    if (r?.work_done) w7++
    if (r?.life_done) l7++
  }
  const total = w7 + l7
  const wp = total ? Math.round((w7 / total) * 100) : 50

  const week = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(monday, i)
    const r = byDate.get(d)
    const future = d > today
    return { d, future, c: future ? 'future' : cellOf(r?.work_done, r?.life_done) }
  })
  const perfect = week.every((x) => !x.future && x.c !== 'n')

  const work = (routines ?? []).filter((r) => r.axis === 'work')
  const life = (routines ?? []).filter((r) => r.axis === 'life')
  const workDone = work.filter((r) => done.has(r.id)).length
  const lifeDone = life.filter((r) => done.has(r.id)).length

  return (
    <main className="shell">
      <header className="header">
        <span className="brand">DOWNFORCE</span>
        <span className="small muted">{labelKo(today)}</span>
      </header>

      <section className="card hero">
        <div>
          <p className="label">연속</p>
          <p className="n">
            {shown}
            <small>일</small>
          </p>
        </div>
        <div className="today">
          <div className={`cell lg ${todayCell}`} />
          <p className="small muted" style={{ marginTop: 6 }}>오늘</p>
        </div>
      </section>

      <section className="card">
        <p className="label">최근 7일 밸런스 · 완료한 날</p>
        <div className="bal" role="img" aria-label={`최근 7일 중 Work 완료 ${w7}일, Life 완료 ${l7}일`}>
          {total > 0 ? (
            <>
              <div className="w" style={{ width: `${wp}%` }} />
              <div className="l" style={{ width: `${100 - wp}%` }} />
            </>
          ) : (
            <div style={{ width: '100%', background: 'var(--card2)' }} />
          )}
          <div className="tick" />
        </div>
        <div className="bal-row">
          <span style={{ color: 'var(--work)' }}>Work {w7}</span>
          <span className="muted">균형</span>
          <span style={{ color: 'var(--life)' }}>Life {l7}</span>
        </div>
      </section>

      <NowFocusProvider
        timeZone={profile.timezone}
        initialNow={minutesIn(profile.timezone)}
        items={(routines ?? []).map((r) => ({ id: r.id, ws: r.window_start, we: r.window_end, done: done.has(r.id) }))}
      >
      <AxisFilter
        head={
          <>
            <span className="label">오늘의 체크리스트</span>
            <Link href="/today/edit" className="small edit-link">체크리스트 편집 ›</Link>
          </>
        }
      >
      {([
        { key: 'work' as const, label: 'Work', list: work, n: workDone },
        { key: 'life' as const, label: 'Life', list: life, n: lifeDone },
      ]).map((g) => (
        <div key={g.key} data-axis={g.key}>
          <div className="sec">
            <span className="dot" style={{ background: `var(--${g.key})` }} />
            <span className="label">{g.label}</span>
            {g.list.length > 0 && (
              <span className="small" style={{ marginLeft: 'auto', color: g.n === g.list.length ? `var(--${g.key})` : 'var(--muted)', fontWeight: 700 }}>
                {g.n}/{g.list.length}{g.n === g.list.length ? ' 완료' : ''}
              </span>
            )}
          </div>
          {g.list.length === 0 && (
            <p className="small muted" style={{ margin: '0 2px 6px' }}>
              {g.label} 루틴이 없습니다. <Link href="/today/edit" style={{ textDecoration: 'underline' }}>추가하기</Link>
            </p>
          )}
          {g.list.map((r) => (
            <CheckItem
              key={r.id}
              id={r.id}
              title={r.title}
              category={r.category}
              hint={r.hint}
              windowStart={r.window_start}
              windowEnd={r.window_end}
              axis={g.key}
              done={done.has(r.id)}
              offWindow={checkOf.get(r.id)?.off_window ?? false}
              note={checkOf.get(r.id)?.note ?? null}
              posted={posted.has(checkOf.get(r.id)?.id ?? '')}
              streakBase={streakBase.get(r.id) ?? 0}
            />
          ))}
        </div>
      ))}
      </AxisFilter>
      </NowFocusProvider>

      <section className="card" style={{ marginTop: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <p className="label">이번 주</p>
          {perfect && <span className="chip" style={{ color: 'var(--fire)' }}>퍼펙트 위크</span>}
        </div>
        <div className={`week ${perfect ? 'fire' : ''}`}>
          {week.map((x) => (
            <div className="col" key={x.d}>
              <div className={`cell ${x.c} ${x.d === today ? 'today' : ''}`} />
              <span className="small muted">{weekdayKo(x.d)}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
