'use server'

import { revalidatePath } from 'next/cache'
import { getViewer } from '@/lib/session'
import { checkDraft, cleanDraft, dupKey, type RoutineDraft, type RoutineError } from '@/lib/routine'

export type ChecklistChange = RoutineDraft & {
  id: string | null   // null = 새 루틴
  deleted: boolean
}

export type SaveResult = { ok: true } | { ok: false; error: RoutineError | 'save'; index?: number }

const t = (v: string) => (v ? v : null)

/**
 * 체크리스트 편집 — 한 번에 전체 저장.
 * 바뀐 것만 보낸다: 수정 → update, 삭제 → 보관(archived_at), 새 항목 → insert.
 * 루틴이 바뀔 때마다 DB 트리거가 오늘 기록만 다시 계산하고, 지난 기록은 그대로 둔다 (007).
 * 시간은 안내용 — 밖에서 체크해도 완료로 인정되고 '시간 외'만 남는다 (008).
 */
export async function saveChecklist(changes: ChecklistChange[]): Promise<SaveResult> {
  if (!Array.isArray(changes) || changes.length > 100) return { ok: false, error: 'save' }

  const { supabase, user } = await getViewer()
  const { data: current, error: readErr } = await supabase
    .from('routines')
    .select('id,title,axis,hint,window_start,window_end,sort_order')
    .eq('user_id', user.id)
    .eq('source', 'personal')
    .is('archived_at', null)
  if (readErr || !current) return { ok: false, error: 'save' }
  const byId = new Map(current.map((r) => [r.id, r]))

  // 1) 전부 검사한 뒤에 쓴다 — 하나라도 틀리면 아무것도 저장하지 않는다
  // 클라이언트 값은 믿지 않는다 — 모양부터 다시 만든다
  const S = (v: unknown) => (typeof v === 'string' ? v : '')
  const rows = changes.map((c) => ({
    id: typeof c?.id === 'string' && c.id ? c.id : null,
    deleted: c?.deleted === true,
    ...cleanDraft({ title: S(c?.title), axis: c?.axis === 'life' ? 'life' : 'work', hint: S(c?.hint), ws: S(c?.ws), we: S(c?.we) }),
  }))
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    if (r.id && !byId.has(r.id)) return { ok: false, error: 'save', index: i }
    if (r.deleted) continue
    const e = checkDraft(r)
    if (e) return { ok: false, error: e, index: i }
  }
  // 저장 후의 목록에서 같은 축·같은 이름이 둘이면 막는다
  const touched = new Set(rows.map((r) => r.id).filter(Boolean))
  const after = [
    ...current.filter((r) => !touched.has(r.id)).map((r) => ({ key: dupKey(r), index: -1 })),
    ...rows.map((r, i) => ({ key: r.deleted ? null : dupKey(r), index: i })),
  ]
  const seen = new Set<string>()
  for (const a of after) {
    if (!a.key) continue
    if (seen.has(a.key)) return { ok: false, error: 'dup', index: a.index >= 0 ? a.index : undefined }
    seen.add(a.key)
  }

  // 2) 쓰기
  let order = Math.max(0, ...current.map((r) => r.sort_order))
  for (const r of rows) {
    if (r.id) {
      const cur = byId.get(r.id)!
      if (r.deleted) {
        const { error } = await supabase
          .from('routines')
          .update({ archived_at: new Date().toISOString() })
          .eq('id', r.id).eq('user_id', user.id).eq('source', 'personal')
        if (error) return fail()
        continue
      }
      const next = { title: r.title, axis: r.axis, hint: t(r.hint), window_start: t(r.ws), window_end: t(r.we) }
      const same =
        cur.title === next.title && cur.axis === next.axis && (cur.hint ?? null) === next.hint &&
        (cur.window_start?.slice(0, 5) ?? null) === next.window_start &&
        (cur.window_end?.slice(0, 5) ?? null) === next.window_end
      if (same) continue
      const { error } = await supabase
        .from('routines')
        .update(next)
        .eq('id', r.id).eq('user_id', user.id).eq('source', 'personal')
      if (error) return fail()
    } else if (!r.deleted) {
      const { error } = await supabase.from('routines').insert({
        user_id: user.id,
        title: r.title,
        axis: r.axis,
        hint: t(r.hint),
        window_start: t(r.ws),
        window_end: t(r.we),
        sort_order: ++order,
      })
      if (error) return fail()
    }
  }
  refresh()
  return { ok: true }
}

function refresh() {
  revalidatePath('/today')
  revalidatePath('/today/edit')
  revalidatePath('/records')
}

/** 중간에 실패하면 앞의 변경은 이미 들어갔을 수 있다 — 화면을 새로 읽게 한다 */
function fail(): SaveResult {
  refresh()
  return { ok: false, error: 'save' }
}
