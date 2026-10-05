import Link from 'next/link'
import { getViewer, cellOf } from '@/lib/session'
import { addDays, addMonths, isYm, isYmd, labelKo, monthEnd, weekStart } from '@/lib/date'
import { addNote, deleteNote } from './actions'

const ERR: Record<string, string> = {
  body: '메모는 1~200자로 적어 주세요.',
  time: '시간 형식을 확인해 주세요.',
  save: '메모를 저장하지 못했습니다. 다시 시도해 주세요.',
}

/**
 * 기록 탭 — 월 달력.
 * 칸 색은 그날 Work/Life 체크리스트를 전부 끝냈는지(day_logs.work_done/life_done), 칸 아래 점은 일정 메모.
 * 날짜를 누르면 그날 체크한 루틴과 메모를 아래에 보여준다.
 */
export default async function RecordsPage({ searchParams }: { searchParams: Promise<{ m?: string; d?: string; e?: string }> }) {
  const { supabase, today } = await getViewer()
  const sp = await searchParams

  const ym = isYm(sp.m) ? sp.m : today.slice(0, 7)
  const first = `${ym}-01`
  const last = monthEnd(ym)
  // 선택 날짜: 주소에 있으면 그 날, 없으면 이번 달을 볼 때만 오늘
  const sel = isYmd(sp.d) && sp.d.startsWith(ym) ? sp.d : today.startsWith(ym) ? today : null

  const [{ data: logs }, { data: notes }, { data: checks }] = await Promise.all([
    // 달력 앞뒤로 걸친 주까지 읽는다 — 퍼펙트 위크는 월 경계를 넘는 주도 7칸으로 판정한다 (5-B)
    supabase.from('day_logs').select('local_date,work_done,life_done,work_required,work_completed,life_required,life_completed').gte('local_date', weekStart(first)).lte('local_date', addDays(weekStart(last), 6)),
    supabase.from('calendar_notes').select('id,note_date,time_of_day,body').gte('note_date', first).lte('note_date', last)
      .order('note_date').order('time_of_day', { nullsFirst: true }).order('created_at'),
    sel
      ? supabase.from('checkins').select('id,title_at_time,axis,note,off_window').eq('local_date', sel).order('created_at')
      : Promise.resolve({ data: [] as { id: string; title_at_time: string; axis: 'work' | 'life'; note: string | null; off_window: boolean }[] }),
  ])

  const byDate = new Map((logs ?? []).map((l) => [l.local_date, l]))
  const noteDays = new Set((notes ?? []).map((n) => n.note_date))
  const dayNotes = (notes ?? []).filter((n) => n.note_date === sel)

  const cells: { d: string; c: string }[] = []
  for (let d = weekStart(first); d <= last; d = addDays(d, 1)) {
    if (d < first) { cells.push({ d, c: 'pad' }); continue }
    const r = byDate.get(d)
    cells.push({ d, c: d > today ? 'future' : cellOf(r?.work_done, r?.life_done) })
  }
  const count = (k: string) => cells.filter((x) => x.c === k).length

  // 퍼펙트 위크 (5-B) — 그 주 월~일 7칸이 전부 채워진 줄. 지난 달·다음 달에 걸친 날도 칸으로 센다
  const filled = (d: string) => d <= today && cellOf(byDate.get(d)?.work_done, byDate.get(d)?.life_done) !== 'n'
  const perfectWeeks = new Set<string>()
  for (let i = 0; i < cells.length; i += 7) {
    const mon = cells[i].d
    if (Array.from({ length: 7 }, (_, k) => addDays(mon, k)).every(filled)) perfectWeeks.add(mon)
  }
  const inPerfect = (d: string) => perfectWeeks.has(weekStart(d))
  const [y, m] = ym.split('-').map(Number)
  const href = (month: string, day?: string) => `/records?m=${month}${day ? `&d=${day}` : ''}`

  const selLog = sel ? byDate.get(sel) : undefined
  const selFuture = sel ? sel > today : false

  return (
    <main className="shell">
      <header className="header">
        <span className="brand">기록</span>
        {!today.startsWith(ym) && <Link href={href(today.slice(0, 7), today)} className="small muted">오늘로</Link>}
      </header>

      <section className="card">
        <div className="cal-nav">
          <Link href={href(addMonths(ym, -1))} aria-label="이전 달">‹</Link>
          <span>{y}년 {m}월</span>
          <Link href={href(addMonths(ym, 1))} aria-label="다음 달">›</Link>
        </div>
        <div className="month">
          {['월', '화', '수', '목', '금', '토', '일'].map((w) => <span key={w} className="wd">{w}</span>)}
          {cells.map((x) =>
            x.c === 'pad' ? (
              <span key={x.d} />
            ) : (
              <Link
                key={x.d}
                href={href(ym, x.d)}
                scroll={false}
                className={`cell day ${x.c}${x.d === today ? ' today' : ''}${x.d === sel ? ' sel' : ''}${noteDays.has(x.d) ? ' note' : ''}${inPerfect(x.d) ? ' pw' : ''}`}
                aria-label={`${labelKo(x.d)}${noteDays.has(x.d) ? ', 메모 있음' : ''}`}
                aria-current={x.d === sel ? 'date' : undefined}
              >
                {Number(x.d.slice(8))}
              </Link>
            ),
          )}
        </div>
        <div className="legend">
          <span><i style={{ background: 'var(--work)' }} />Work {count('w')}</span>
          <span><i style={{ background: 'var(--life)' }} />Life {count('l')}</span>
          <span><i style={{ background: 'linear-gradient(135deg,var(--work) 0 50%,var(--life) 50%)' }} />둘 다 {count('b')}</span>
          <span><i style={{ boxShadow: 'inset 0 0 0 1.5px var(--line)' }} />쉰 날 {count('n')}</span>
          <span><i className="dot-i" />메모</span>
          {perfectWeeks.size > 0 && <span style={{ color: 'var(--fire)' }}><i className="pw-i" />퍼펙트 위크 {perfectWeeks.size}</span>}
        </div>
      </section>

      {sel && (
        <section className="card" id="day">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
            <p style={{ fontWeight: 800 }}>{labelKo(sel)}</p>
            {!selFuture && (
              <span className="small">
                <span style={{ color: selLog?.work_done ? 'var(--work)' : 'var(--muted)' }}>
                  Work {selLog?.work_completed ?? 0}/{selLog?.work_required ?? 0}{selLog?.work_done ? ' 완료' : ''}
                </span>
                <span className="muted"> · </span>
                <span style={{ color: selLog?.life_done ? 'var(--life)' : 'var(--muted)' }}>
                  Life {selLog?.life_completed ?? 0}/{selLog?.life_required ?? 0}{selLog?.life_done ? ' 완료' : ''}
                </span>
              </span>
            )}
          </div>

          {!selFuture && (
            <>
              <p className="label" style={{ margin: '4px 0 6px' }}>체크한 루틴</p>
              {(checks ?? []).length === 0 ? (
                <p className="small muted" style={{ marginBottom: 10 }}>기록이 없습니다.</p>
              ) : (
                <ul className="done-list">
                  {(checks ?? []).map((c) => (
                    <li key={c.id}>
                      <span className="dot" style={{ background: c.axis === 'work' ? 'var(--work)' : 'var(--life)' }} />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        {c.title_at_time}
                        {c.off_window && <span className="win off" style={{ marginLeft: 6 }}>시간 외</span>}
                        {c.note && <span className="done-note">💬 {c.note}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          <p className="label" style={{ margin: '12px 0 6px' }}>일정 메모</p>
          {dayNotes.length === 0 && <p className="small muted">메모가 없습니다.</p>}
          {dayNotes.map((n) => (
            <div key={n.id} className="note-row">
              <span className="note-time">{n.time_of_day ? n.time_of_day.slice(0, 5) : '종일'}</span>
              <span className="note-body">{n.body}</span>
              <form action={deleteNote}>
                <input type="hidden" name="id" value={n.id} />
                <input type="hidden" name="date" value={sel} />
                <button type="submit" className="small muted" aria-label="메모 삭제">삭제</button>
              </form>
            </div>
          ))}

          {sp.e && ERR[sp.e] && <p className="err">{ERR[sp.e]}</p>}
          <form action={addNote} className="add" style={{ marginTop: 10 }}>
            <input type="hidden" name="date" value={sel} />
            <input type="time" name="time" aria-label="시간 (선택)" className="time-in" />
            <input type="text" name="body" placeholder="+ 일정 메모" maxLength={200} aria-label="메모 내용" required />
            <button type="submit">추가</button>
          </form>
        </section>
      )}

      <p className="small muted" style={{ textAlign: 'center', marginTop: 8 }}>이미지 저장 · 공유는 다음 업데이트에서 열립니다</p>
    </main>
  )
}
