'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { checkDraft, cleanDraft, dupKey, ROUTINE_ERR, type RoutineDraft } from '@/lib/routine'
import { saveChecklist } from './actions'
import { AxisButton, type AxisView } from '../../AxisToggle'

type Item = RoutineDraft & { key: string; id: string | null; deleted: boolean }
type Props = { items: (RoutineDraft & { id: string })[] }

const EMPTY: RoutineDraft = { title: '', axis: 'work', hint: '', ws: '', we: '' }
const same = (a: RoutineDraft, b: RoutineDraft) => {
  const x = cleanDraft(a), y = cleanDraft(b)
  return x.title === y.title && x.axis === y.axis && x.hint === y.hint && x.ws === y.ws && x.we === y.we
}

/** 이름·Work/Life·메모·시간 입력칸 — 새 루틴과 기존 루틴이 같은 모양을 쓴다 */
function Fields(props: {
  d: RoutineDraft
  set: (patch: Partial<RoutineDraft>) => void
  side?: React.ReactNode
  disabled?: boolean
}) {
  const { d, set, side, disabled } = props
  return (
    <div className="edit-grid">
      <div className="edit-line">
        <input value={d.title} onChange={(e) => set({ title: e.target.value })} maxLength={60} placeholder="루틴 이름" aria-label="루틴 이름" disabled={disabled} />
        <select value={d.axis} onChange={(e) => set({ axis: e.target.value === 'life' ? 'life' : 'work' })} aria-label="Work 또는 Life" disabled={disabled}>
          <option value="work">Work</option>
          <option value="life">Life</option>
        </select>
        {side}
      </div>
      <input value={d.hint} onChange={(e) => set({ hint: e.target.value })} maxLength={100} placeholder="메모 (선택)" aria-label="메모" disabled={disabled} />
      <div className="edit-line">
        <span className="small muted time-label">시간</span>
        <input type="time" value={d.ws} onChange={(e) => set({ ws: e.target.value })} aria-label="시작 시간 (선택)" disabled={disabled} />
        <span className="small muted">~</span>
        <input type="time" value={d.we} onChange={(e) => set({ we: e.target.value })} aria-label="끝 시간 (선택)" disabled={disabled} />
        {(d.ws || d.we) && !disabled && (
          <button type="button" className="clear" onClick={() => set({ ws: '', we: '' })} aria-label="시간 지우기">✕</button>
        )}
      </div>
    </div>
  )
}

export default function ChecklistEditor({ items: initial }: Props) {
  const router = useRouter()
  const base = useRef(new Map(initial.map((r) => [r.id, r])))
  const seq = useRef(0)
  const [items, setItems] = useState<Item[]>(() => initial.map((r) => ({ ...r, key: r.id, deleted: false })))
  const [draft, setDraft] = useState<RoutineDraft>(EMPTY)
  const [addMsg, setAddMsg] = useState<{ err: boolean; text: string } | null>(null)
  const [err, setErr] = useState<{ text: string; key?: string } | null>(null)
  const [saving, start] = useTransition()
  const [view, setView] = useState<AxisView>('all') // 기억하지 않는다

  // 바뀐 개수 — 새 항목 + 삭제 + 수정
  const changed = useMemo(
    () =>
      items.filter((it) => {
        if (!it.id) return !it.deleted
        if (it.deleted) return true
        return !same(it, base.current.get(it.id)!)
      }).length,
    [items],
  )

  // 저장하지 않고 창을 닫으려 하면 붙잡는다
  useEffect(() => {
    if (!changed || saving) return
    const h = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [changed, saving])

  const patch = (key: string, p: Partial<Item>) => {
    setErr(null)
    setItems((xs) => xs.map((x) => (x.key === key ? { ...x, ...p } : x)))
  }

  function add() {
    const d = cleanDraft(draft)
    const e = checkDraft(d)
    if (e) return setAddMsg({ err: true, text: ROUTINE_ERR[e] })
    if (items.some((x) => !x.deleted && dupKey(x) === dupKey(d))) return setAddMsg({ err: true, text: ROUTINE_ERR.dup })
    setItems((xs) => [...xs, { ...d, key: `new-${++seq.current}`, id: null, deleted: false }])
    if (view !== 'all' && view !== d.axis) setView('all') // 방금 넣은 항목이 숨지 않게
    setDraft({ ...EMPTY, axis: d.axis })
    setAddMsg({ err: false, text: `'${d.title}'을(를) 목록에 넣었어요. 아래 저장을 눌러야 반영됩니다.` })
  }

  function save() {
    setErr(null)
    const payload = items.filter((x) => x.id || !x.deleted)
    start(async () => {
      const res = await saveChecklist(
        payload.map((x) => ({ id: x.id, deleted: x.deleted, title: x.title, axis: x.axis, hint: x.hint, ws: x.ws, we: x.we })),
      )
      if (res.ok) {
        router.push('/today')
        return
      }
      const bad = res.index !== undefined ? payload[res.index] : undefined
      if (bad && view !== 'all' && view !== bad.axis) setView('all') // 문제 항목이 숨지 않게
      setErr({ text: (bad ? `'${bad.title.trim() || '이름 없음'}' — ` : '') + ROUTINE_ERR[res.error], key: bad?.key })
    })
  }

  const groups = (['work', 'life'] as const)
    .filter((axis) => view === 'all' || view === axis)
    .map((axis) => ({ axis, list: items.filter((x) => x.axis === axis) }))

  return (
    <>
      <p className="label" style={{ margin: '6px 2px 8px' }}>새 루틴</p>
      <div className="card add-card">
        <Fields d={draft} set={(p) => { setAddMsg(null); setDraft((d) => ({ ...d, ...p })) }} />
        <button type="button" className="btn ghost add-btn" onClick={add}>+ 목록에 추가</button>
        {addMsg && <p className={addMsg.err ? 'err' : 'ok'}>{addMsg.text}</p>}
      </div>

      <div className="list-head axis-head">
        <span className="label">내 루틴</span>
        <AxisButton view={view} onChange={setView} />
      </div>

      {groups.map((g) => (
        <div key={g.axis}>
          <div className="sec">
            <span className="dot" style={{ background: `var(--${g.axis})` }} />
            <span className="label">{g.axis === 'work' ? 'Work' : 'Life'}</span>
            <span className="small muted" style={{ marginLeft: 'auto' }}>{g.list.filter((x) => !x.deleted).length}개</span>
          </div>
          {g.list.length === 0 && <p className="small muted" style={{ margin: '0 2px 6px' }}>루틴이 없습니다.</p>}
          {g.list.map((it) =>
            it.deleted ? (
              <div key={it.key} className="edit-card gone">
                <span className="gone-title">{it.title}</span>
                <span className="small muted">저장하면 삭제</span>
                <button type="button" className="undo" onClick={() => patch(it.key, { deleted: false })}>되돌리기</button>
              </div>
            ) : (
              <div key={it.key} className={`edit-card ${err?.key === it.key ? 'bad' : ''} ${it.id ? '' : 'fresh'}`}>
                <Fields
                  d={it}
                  set={(p) => patch(it.key, p)}
                  side={
                    <button
                      type="button"
                      className="del"
                      aria-label={`${it.title} 삭제`}
                      onClick={() =>
                        it.id ? patch(it.key, { deleted: true }) : setItems((xs) => xs.filter((x) => x.key !== it.key))
                      }
                    >
                      삭제
                    </button>
                  }
                />
                {!it.id && <span className="chip fresh-chip">새 항목</span>}
              </div>
            ),
          )}
        </div>
      ))}

      <div className="save-bar">
        {err && <p className="err" role="alert">{err.text}</p>}
        <button type="button" className="btn primary" onClick={save} disabled={!changed || saving}>
          {saving ? '저장 중…' : changed ? `저장 · 변경 ${changed}개` : '바뀐 내용 없음'}
        </button>
      </div>
    </>
  )
}
