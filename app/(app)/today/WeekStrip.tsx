'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * 오늘 화면 '이번 주' 7칸 + 퍼펙트 위크 (제품설계 5-B).
 * 7칸째를 채우는 그 순간에만 한 번 불이 붙는다. 이미 달성한 주를 다시 열면 정적인 불꽃 테두리만 남는다.
 * 칸 = Work 또는 Life 체크리스트를 전부 끝낸 날 — Life 한 칸으로도 채워진다.
 */
export type WeekCell = { d: string; c: string; wd: string; isToday: boolean }

export default function WeekStrip(props: { week: WeekCell[]; perfect: boolean }) {
  const last = useRef(props.perfect)
  const [ignite, setIgnite] = useState(false)

  useEffect(() => {
    if (!last.current && props.perfect) setIgnite(true)
    if (!props.perfect) setIgnite(false)
    last.current = props.perfect
  }, [props.perfect])

  useEffect(() => {
    if (!ignite) return
    const t = setTimeout(() => setIgnite(false), 2800)
    return () => clearTimeout(t)
  }, [ignite])

  return (
    <section className={`card pw-card ${ignite ? 'pw-igniting' : ''}`} style={{ marginTop: 18 }}>
      <div className="pw-head" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <p className="label">이번 주</p>
        {props.perfect && <span className="chip" style={{ color: 'var(--fire)' }}>퍼펙트 위크</span>}
      </div>
      <div className={`week ${props.perfect ? 'fire' : ''}`}>
        {props.week.map((x, i) => (
          <div className="col" key={x.d}>
            <div className={`cell ${x.c} ${x.isToday ? 'today' : ''}`} style={ignite ? { animationDelay: `${i * 90}ms` } : undefined} />
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
