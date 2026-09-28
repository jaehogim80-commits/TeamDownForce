'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

// 탭은 3개 — 크루는 '마이페이지' 안으로 (제품설계 5-E)
const TABS = [
  { href: '/today', label: '오늘' },
  { href: '/records', label: '기록' },
  { href: '/me', label: '마이페이지' },
]
export const TAB_ORDER = TABS.map((t) => t.href)

export default function Tabs() {
  const path = usePathname()
  const active = TABS.findIndex((t) => path.startsWith(t.href))
  return (
    <div className="tabs">
      <nav style={{ '--tab-i': Math.max(active, 0), '--tab-n': TABS.length } as React.CSSProperties}>
        {/* 주황 막대가 탭 사이를 달려서 옮겨간다 */}
        {active >= 0 && <span className="tab-bar" aria-hidden="true" />}
        {TABS.map((t, i) => (
          <Link key={t.href} href={t.href} aria-current={i === active ? 'page' : undefined}>
            {t.label}
          </Link>
        ))}
      </nav>
    </div>
  )
}
