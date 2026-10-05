'use client'

import { useEffect, useState } from 'react'

/**
 * 오늘 화면 '이번 주' 7칸 + 퍼펙트 위크 (제품설계 5-B).
 * 7칸째를 채우는 그 순간에만 한 번: 불이 붙었다 → 잦아들고 → 과열된 기계처럼 달아오른 채 남는다.
 * 이미 달성한 주를 다시 열면 마지막 '과열' 상태만 정적으로 보인다.
 * 칸 = Work 또는 Life 체크리스트를 전부 끝낸 날 — Life 한 칸으로도 채워진다.
 */
export type WeekCell = { d: string; c: string; wd: string; isToday: boolean }

export default function WeekStrip(props: { week: WeekCell[]; perfect: boolean }) {
  const [prevPerfect, setPrevPerfect] = useState(props.perfect)
  const [ignite, setIgnite] = useState(false)

  // 렌더 중에 바로 판단한다 — 효과(useEffect)로 미루면 과열 상태가 한 프레임 먼저 비쳤다가 점화된다
  if (prevPerfect !== props.perfect) {
    setPrevPerfect(props.perfect)
    setIgnite(props.perfect)
  }

  useEffect(() => {
    if (!ignite) return
    const t = setTimeout(() => setIgnite(false), 3000)
    return () => clearTimeout(t)
  }, [ignite])

  return (
    <section className={`card pw-card ${props.perfect ? 'pw-hot' : ''} ${ignite ? 'pw-igniting' : ''}`} style={{ marginTop: 18 }}>
      <div className="pw-head" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <p className="label">이번 주</p>
        {props.perfect && <span className="chip" style={{ color: 'var(--fire)' }}>퍼펙트 위크</span>}
      </div>
      <div className={`week ${props.perfect ? 'fire' : ''}`}>
        {props.week.map((x, i) => (
          <div className="col" key={x.d}>
            <div className={`cell ${x.c} ${x.isToday ? 'today' : ''}`} style={{ '--i': i } as React.CSSProperties} />
            <span className="small muted">{x.wd}</span>
          </div>
        ))}
      </div>
      {ignite && (
        <span className="pw-burst" role="status">
          <b>퍼펙트 위크! 7일을 모두 채웠어요</b>
        </span>
      )}
    </section>
  )
}
