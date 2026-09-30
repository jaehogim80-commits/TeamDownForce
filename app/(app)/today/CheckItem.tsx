'use client'

import { useOptimistic, useState, useTransition } from 'react'
import Link from 'next/link'
import { saveCheckNote, toggleCheck } from './actions'
import { postCheck } from '../feed/actions'
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
  posted: boolean
}) {
  const [pending, start] = useTransition()
  const [done, setDone] = useOptimistic(props.done)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(props.note ?? '')
  const [saving, startSave] = useTransition()
  const [burst, setBurst] = useState(0) // 체크할 때마다 스피드라인 한 번
  const [sheet, setSheet] = useState(false) // 올리기 확인
  const [withNote, setWithNote] = useState(true)
  const [posting, startPost] = useTransition()
  const [justPosted, setJustPosted] = useState(false)
  const posted = props.posted || justPosted
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
            else setJustPosted(false) // 체크를 취소하면 올린 글도 DB에서 함께 내려간다 (011)
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
            <div className="share-line">
              <button type="button" className="note-view" onClick={() => setEditing(true)} style={{ flex: 1 }}>
                {props.note ? <span>💬 {props.note}</span> : <span className="muted">+ 코멘트</span>}
              </button>
              {/* 피드 올리기 — 본인이 누를 때만. 자동 공개 없음 (피드 결정요약 2-1) */}
              {posted ? (
                <Link href="/feed" className="share-done">피드 ✓</Link>
              ) : (
                !sheet && (
                  <button type="button" className="share-btn" onClick={() => setSheet(true)}>
                    올리기
                  </button>
                )
              )}
            </div>
          )}
          {sheet && !posted && (
            <div className="share-sheet">
              <p>
                <b style={{ color: 'var(--ink)' }}>DownForce 전체에 공개됩니다.</b> 체크를 취소하면 글도 내려갑니다.
              </p>
              <div className="row2">
                {props.note ? (
                  <label>
                    <input type="checkbox" checked={withNote} onChange={(e) => setWithNote(e.target.checked)} />
                    코멘트도
                  </label>
                ) : (
                  <span style={{ marginRight: 'auto' }} />
                )}
                <button type="button" onClick={() => setSheet(false)}>취소</button>
                <button
                  type="button"
                  className="go"
                  disabled={posting}
                  onClick={() =>
                    startPost(async () => {
                      const r = await postCheck(props.id, withNote && !!props.note)
                      if (r.ok) {
                        setJustPosted(true)
                        setSheet(false)
                      }
                    })
                  }
                >
                  {posting ? '올리는 중' : '올리기'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
