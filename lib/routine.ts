// 루틴 입력 검사 — 체크리스트 편집 화면(클라이언트)과 저장 액션(서버)이 같은 규칙을 쓴다.
// DB 제약(008)과 같은 값: 이름 1~60자, 메모 ≤100자, 시간은 시작·끝 둘 다 있거나 둘 다 없음, 시작 ≠ 끝

export type RoutineDraft = {
  title: string
  axis: 'work' | 'life'
  hint: string   // 화면 이름은 '메모'
  ws: string     // 'HH:MM' 또는 ''
  we: string
}

export type RoutineError = 'title' | 'window' | 'dup'

export const ROUTINE_ERR: Record<RoutineError | 'save', string> = {
  title: '루틴 이름을 입력해 주세요.',
  window: '시간은 시작과 끝을 모두 넣어 주세요 (같은 시각은 안 됩니다).',
  dup: '같은 Work/Life 안에 이름이 같은 루틴이 있어요. 하나를 삭제하거나 이름을 바꿔 주세요.',
  save: '저장하지 못했습니다. 다시 시도해 주세요.',
}

const HM = /^([01]\d|2[0-3]):[0-5]\d$/

/** 입력값을 DB에 넣을 모양으로 다듬는다 */
export function cleanDraft(d: RoutineDraft): RoutineDraft {
  return {
    title: d.title.trim().slice(0, 60),
    axis: d.axis === 'life' ? 'life' : 'work',
    hint: d.hint.trim().slice(0, 100),
    ws: d.ws.trim().slice(0, 5),
    we: d.we.trim().slice(0, 5),
  }
}

export function checkDraft(d: RoutineDraft): RoutineError | null {
  if (!d.title) return 'title'
  const hasS = d.ws !== '', hasE = d.we !== ''
  if (hasS !== hasE) return 'window'
  if (hasS && (!HM.test(d.ws) || !HM.test(d.we) || d.ws === d.we)) return 'window'
  return null
}

/** 같은 축에 같은 이름이 둘이면 둘 다 체크해야 완료된다 (007) — 실수로 생기는 중복을 막는다 */
export const dupKey = (d: Pick<RoutineDraft, 'title' | 'axis'>) => `${d.axis}\u0000${d.title.trim()}`
