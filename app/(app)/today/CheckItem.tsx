'use client'

import { useOptimistic, useState, useTransition } from 'react'
import { saveCheckNote, toggleCheck } from './actions'
import { useNowFocus } from './NowFocus'

/** 'HH:MM:SS' → 'HH:MM' */
const hm = (t: string | null) => (t ? t.slice(0, 5) : '')

export default function CheckItem(props: {
  id: string
  title: string
  category: string | null
  hint: string | null
  windowStart: string | null
  windowEnd: string | null
  axis: 'work' | 'life'
  done: boolean
  offWindow: boolean
  note: string | null
}) {
  const [pending, start] = useTransition()
  const [done, setDone] = useOptimistic(props.done)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(props.note ?? '')
  const [saving, startSave] = useTransition()
  const [burst, setBurst] = useState(0) // 체크할 때마다 스피드라인 한 번
  const hasWindow = !!(props.windowStart && props.windowEnd)
  const { focusId, setDone: markDone } = useNowFocus()
  const isNow = focusId === props.id // 지금 할 항목 — 한 번에 하나만

  return (
    <div className={`item-wrap ${props.axis} ${done ? 'on' : ''} ${isNow ? 'now' : ''}`}>
      <button
        type="button"
        className={`item ${props.axis} ${done ? 'on' : ''}`}
        aria-pressed={done}
        aria-current={isNow ? 'step' : undefined}
        aria-busy={pending}
        onClick={() =>
          start(async () => {
            if (!done) setBurst((b) => b + 1)
            setDone(!done)
            markDone(props.id, !done)
            await toggleCheck(props.id, !done)
          })
        }
      >
        {burst > 0 && done && <span key={`s${burst}`} className="check-streak" aria-hidden="true" />}
        <span key={`b${burst}`} className={`box ${burst > 0 && done ? 'pop' : ''}`}>{done ? '✓' : ''}</span>
        <span className="t">
          <span className="t-main">
            {props.title}
            {props.category && <span className="cat"> · {props.category}</span>}
          </span>
          {props.hint && <span className="t-hint">{props.hint}</span>}
        </span>
        {hasWindow && (
          <span className={`win ${done && props.offWindow ? 'off' : ''} ${isNow ? 'now' : ''}`}>
            {done && props.offWindow ? '시간 외' : `${hm(props.windowStart)}–${hm(props.windowEnd)}`}
          </span>
        )}
      </button>

      {/* 체크한 항목에만 코멘트 */}
      {done && props.done && (
        <div className="note-line">
          {editing ? (
            <form
              className="note-form"
              onSubmit={(e) => {
                e.preventDefault()
                startSave(async () => {
                  await saveCheckNote(props.id, draft)
                  setEditing(false)
                })
              }}
            >
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={200}
                placeholder="코멘트 (예: 5.2km, 페이스 좋았음)"
                aria-label={`${props.title} 코멘트`}
                autoFocus
              />
              <button type="submit" disabled={saving}>{saving ? '저장 중' : '저장'}</button>
            </form>
          ) : (
            <button type="button" className="note-view" onClick={() => setEditing(true)}>
              {props.note ? <span>💬 {props.note}</span> : <span className="muted">+ 코멘트</span>}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
