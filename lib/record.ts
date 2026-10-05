/**
 * 최장 기록 갱신 (2026-10-05, 연속 장치 결정요약 5장).
 * 넘을 대상 = 이미 끝난 연속 중 가장 긴 것(prev_best, 013). 지금 이어지는 연속은 넣지 않는다.
 *   · 지난 최고 7일 미만 → 아무것도 보이지 않는다 ("최고 2일"은 동기보다 민망함)
 *   · 평소 → "최고 N일"을 작게
 *   · 넘기까지 3일 이하 → "최고 기록까지 N일"을 크게
 *   · 넘은 뒤 → "최고 기록 갱신 중" 조용히. 연출은 처음 넘는 순간 한 번만 (화면이 판단)
 */
export const RECORD_MIN = 7
export const RECORD_NEAR = 3

export type RecordState =
  | { kind: 'hidden' }
  | { kind: 'quiet'; best: number }
  | { kind: 'near'; best: number; left: number }
  | { kind: 'beating'; best: number }

export function recordState(current: number, prevBest: number): RecordState {
  if (prevBest < RECORD_MIN) return { kind: 'hidden' }
  if (current > prevBest) return { kind: 'beating', best: prevBest }
  const left = prevBest + 1 - current // 이만큼 더 채우면 새 기록
  if (left <= RECORD_NEAR) return { kind: 'near', best: prevBest, left }
  return { kind: 'quiet', best: prevBest }
}

/** 이번 렌더에서 처음 기록을 넘었는가 — 직전 값이 최고와 같거나 낮았고 지금 넘었을 때만 */
export const justBroke = (prevCurrent: number, current: number, prevBest: number) =>
  prevBest >= RECORD_MIN && prevCurrent <= prevBest && current > prevBest
