'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { minutesIn, pickFocus, type FocusItem } from '@/lib/nowFocus'
import './now.css'

/**
 * 지금 할 항목 하나를 강조한다 (듀오링고의 '현재 레슨' 링).
 * 규칙: 아직 체크하지 않았고, 지금 시각이 그 루틴의 시간 안에 있는 항목 중 끝나는 시각이 가장 이른 것 1개.
 * 사용자 타임존 기준. 하루 경계와는 무관하다(시계 시각 기준).
 */

const Ctx = createContext<{ focusId: string | null; setDone: (id: string, done: boolean) => void }>({
  focusId: null,
  setDone: () => {},
})

export function useNowFocus() {
  return useContext(Ctx)
}

export function NowFocusProvider(props: {
  items: FocusItem[]
  timeZone: string
  initialNow: number // 서버가 계산한 분 — 첫 화면이 서버와 같게
  children: React.ReactNode
}) {
  const [now, setNow] = useState(props.initialNow)
  const [overrides, setOverrides] = useState<Record<string, boolean>>({})

  // 30초마다 시계를 다시 본다 — 새로고침 없이 강조가 옮겨간다
  useEffect(() => {
    const tick = () => setNow(minutesIn(props.timeZone))
    tick()
    const t = setInterval(tick, 30_000)
    return () => clearInterval(t)
  }, [props.timeZone])

  // 서버에서 새 목록이 오면 낙관적 표시는 버린다
  useEffect(() => setOverrides({}), [props.items])

  const setDone = useCallback((id: string, done: boolean) => setOverrides((o) => ({ ...o, [id]: done })), [])

  const focusId = useMemo(
    () => pickFocus(props.items.map((it) => (it.id in overrides ? { ...it, done: overrides[it.id] } : it)), now),
    [props.items, overrides, now],
  )

  return <Ctx.Provider value={{ focusId, setDone }}>{props.children}</Ctx.Provider>
}
