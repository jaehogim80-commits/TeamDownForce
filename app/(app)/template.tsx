'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { TAB_ORDER } from './Tabs'

/**
 * 탭 전환 모션 — 질주. 화면이 달려오던 방향 그대로 미끄러져 들어온다.
 * template은 이동할 때마다 새로 붙으므로 들어오는 순간 한 번만 재생된다.
 * 오른쪽 탭으로 가면 오른쪽에서, 왼쪽 탭으로 가면 왼쪽에서. 탭 안의 이동(편집 등)은 오른쪽에서.
 * 움직임 줄이기 설정이면 CSS가 끈다 (brand.css).
 */
let last = -1

function tabIndex(path: string) {
  return TAB_ORDER.findIndex((h) => path.startsWith(h))
}

export default function Template({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  const now = tabIndex(path)
  const dir = last === -1 || now >= last ? 'r' : 'l'
  useEffect(() => {
    last = now
  }, [now])
  return (
    <div className={`dash-in ${dir}`} key={path}>
      <span className="dash-streak" aria-hidden="true" />
      {children}
    </div>
  )
}
