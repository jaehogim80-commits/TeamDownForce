'use client'

import { useEffect, useRef, useState } from 'react'
import { justBroke, recordState } from '@/lib/record'

/**
 * 오늘 화면 맨 위 — 하루 전체 연속 + 최장 기록 (연속 장치 결정요약 5장).
 * 체크하면 서버가 숫자를 다시 보내 준다(revalidatePath). 직전 숫자와 비교해 '처음 넘은 순간'에만 연출한다.
 * 앱을 새로 열었을 때는 비교할 직전 값이 없으니 연출하지 않는다 — 체크하는 그 순간만.
 */
export default function StreakHero(props: { current: number; prevBest: number; todayCell: string }) {
  const { current, prevBest } = props
  const last = useRef(current)
  const [burst, setBurst] = useState(0)

  useEffect(() => {
    if (justBroke(last.current, current, prevBest)) setBurst(current)
    else if (current <= prevBest) setBurst(0) // 체크를 취소해 다시 내려가면 연출도 거둔다
    last.current = current
  }, [current, prevBest])

  useEffect(() => {
    if (!burst) return
    const t = setTimeout(() => setBurst(0), 2600)
    return () => clearTimeout(t)
  }, [burst])

  const st = recordState(current, prevBest)

  return (
    <section className={`card hero rec-hero ${burst ? 'rec-burning' : ''}`}>
      <div>
        <p className="label">연속</p>
        <p className="n">
          {current}
          <small>일</small>
        </p>
        {st.kind === 'quiet' && <p className="rec rec-quiet">최고 {st.best}일</p>}
        {st.kind === 'near' && (
          <p className="rec rec-near" aria-label={`최고 기록 ${st.best}일까지 ${st.left}일 남음`}>
            최고 기록까지 <b>{st.left}일</b>
            <span className="rec-sub">최고 {st.best}일</span>
          </p>
        )}
        {st.kind === 'beating' && <p className="rec rec-beat">최고 기록 갱신 중</p>}
      </div>
      <div className="today">
        <div className={`cell lg ${props.todayCell}`} />
        <p className="small muted" style={{ marginTop: 6 }}>오늘</p>
      </div>
      {burst > 0 && (
        <span className="rec-burst" role="status">
          <b>최고 기록 갱신! {burst}일</b>
        </span>
      )}
    </section>
  )
}
