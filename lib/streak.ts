/**
 * 항목별 연속 일수 — 단계와 기록 순간 (2026-10-04).
 * 평소엔 단계 배지만 조용히, 새 단계에 올라서는 체크 순간에만 크게 한 번 (제품설계 9장: 매번 재생하면 무감각해진다).
 * 오늘 아직 안 한 항목은 숫자를 흐리게 — 경고색·알림은 쓰지 않는다 (9장: 끊김을 처벌하지 않는다).
 */
export const MILESTONES = [3, 7, 14, 30, 50, 100, 200, 365] as const

export type Tier = 0 | 1 | 2 | 3 | 4 | 5

/** 0: 1~2일(작은 숫자) · 1: 3~6 · 2: 7~13 · 3: 14~29 · 4: 30~99 · 5: 100+ */
export function tierOf(days: number): Tier {
  if (days >= 100) return 5
  if (days >= 30) return 4
  if (days >= 14) return 3
  if (days >= 7) return 2
  if (days >= 3) return 1
  return 0
}

export const isMilestone = (days: number) => (MILESTONES as readonly number[]).includes(days)

/** 배지 앞 기호 — 3일부터 불꽃이 붙는다 */
export const iconOf = (t: Tier) => (t === 0 ? '' : t === 1 ? '⚡' : '🔥')

/** 기록 순간 문구 */
export function milestoneLabel(days: number) {
  if (days >= 365) return '1년 연속!'
  if (days >= 100) return `${days}일 — 전설`
  return `${days}일 연속 달성`
}
