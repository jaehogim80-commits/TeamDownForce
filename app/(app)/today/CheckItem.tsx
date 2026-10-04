'use client'

import { useEffect, useOptimistic, useState, useTransition } from 'react'
import Link from 'next/link'
import { saveCheckNote, toggleCheck } from './actions'
import { postCheck } from '../feed/actions'
import { useNowFocus } from './NowFocus'
import { iconOf, isMilestone, milestoneLabel, tierOf } from '@/lib/streak'

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
  /** 오늘을 빼고 어제까지 이어진 연속 일수 (012). 오늘 체크하면 +1 */
  streakBase: number
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
  const [celebrate, setCelebrate] = useState(0) // 새 단계에 올라선 순간의 일수 — 잠깐만 보인다
  useEffect(() => {
    if (!celebrate) return
    const t = setTimeout(() => setCelebrate(0), 2300)
    return () => clearTimeout(t)
  }, [celebrate])
  const days = done ? props.streakBase + 1 : props.streakBase
  const tier = tierOf(days)
  const showStreak = days >= 2 // 1일째는 표시하지 않는다
  const hasWindow = !!(props.windowStart && props.windowEnd)
  const { focusId, setDone: markDone } = useNowFocus()
  const isNow = focusId === props.id // 지금 할 항목 — 한 번에 하나만

  return (
    <div className={`item-wrap ${props.axis} ${done ? 'on' : ''} ${isNow ? 'now' : ''} ${celebrate ? 'celebrating' : ''} ${celebrate >= 30 ? 'blaze' : ''}`}>
      <button
        type="button"
        className={`item ${props.axis} ${done ? 'on' : ''}`}
        aria-pressed={done}
        aria-current={isNow ? 'step' : undefined}
        aria-busy={pending}
        onClick={() =>
          start(async () => {
            if (!done) {
              setBurst((b) => b + 1)
              const next = props.streakBase + 1
              if (isMilestone(next)) setCelebrate(next) // 3·7·14·30·50·100… 에 올라서는 순간만
            } else {
              setJustPosted(false) // 체크를 취소하면 올린 글도 DB에서 함께 내려간다 (011)
              setCelebrate(0)
            }
            setDone(!done)
            markDone(props.id, !done)
            await toggleCheck(props.id, !done)
          })
        }
      >
        {burst > 0 && done && <span key={`s${burst}`} className="check-streak" aria-hidden="true" />}
        {celebrate > 0 && done && (
          <span key={`m${burst}`} className="milestone" role="status">
            <b>{iconOf(tierOf(celebrate))} {milestoneLabel(celebrate)}</b>
          </span>
        )}
        <span key={`b${burst}`} className={`box ${burst > 0 && done ? 'pop' : ''}`}>{done ? '✓' : ''}</span>
        <span className="t">
          <span className="t-main">
            {props.title}
            {props.category && <span className="cat"> · {props.category}</span>}
            {showStreak && (
              <span
                key={`k${burst}`}
                className={`streak s${tier} ${done ? '' : 'wait'} ${celebrate > 0 && done ? 'up' : ''}`}
                aria-label={done ? `${days}일 연속` : `${days}일 연속, 오늘 체크하면 ${days + 1}일`}
              >
                {iconOf(tier)}
                {days}일
              </span>
            )}
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
