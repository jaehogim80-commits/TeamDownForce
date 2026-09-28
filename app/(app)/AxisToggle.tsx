'use client'

import { useState } from 'react'

/** 전체 → Work → Life → 전체. 기억하지 않는다 — 화면을 다시 열면 전체부터 */
export type AxisView = 'all' | 'work' | 'life'
const NEXT: Record<AxisView, AxisView> = { all: 'work', work: 'life', life: 'all' }
const LABEL: Record<AxisView, string> = { all: '전체', work: 'Work', life: 'Life' } // 버튼 글자는 한 단어

export function AxisButton({ view, onChange }: { view: AxisView; onChange: (v: AxisView) => void }) {
  return (
    <button
      type="button"
      className={`axis-btn ${view}`}
      onClick={() => onChange(NEXT[view])}
      aria-label={`보기: ${LABEL[view]} (누르면 ${LABEL[NEXT[view]]})`}
    >
      <span className="axis-dot" />
      {LABEL[view]}
    </button>
  )
}

/**
 * 서버에서 그린 목록을 감싸 Work/Life 묶음만 보이게 한다.
 * 안쪽 묶음에 data-axis="work" | "life"를 달아 두면 CSS가 숨긴다.
 */
export function AxisFilter({ head, children }: { head: React.ReactNode; children: React.ReactNode }) {
  const [view, setView] = useState<AxisView>('all')
  return (
    <div className="axis-filter" data-view={view}>
      <div className="list-head">
        {head}
        <AxisButton view={view} onChange={setView} />
      </div>
      {children}
    </div>
  )
}
