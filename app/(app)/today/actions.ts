'use server'

import { revalidatePath } from 'next/cache'
import { getViewer } from '@/lib/session'

function refresh() {
  revalidatePath('/today')
  revalidatePath('/records')
}

/**
 * 체크/취소. 날짜는 클라이언트가 보내지 않는다 — 서버가 lib/date로 한 번만 계산한다.
 * 축·카테고리·제목도 보내봤자 DB 트리거(snapshot_checkin)가 루틴 값으로 덮어쓴다.
 */
export async function toggleCheck(routineId: string, checked: boolean) {
  const { supabase, user, today } = await getViewer()

  if (checked) {
    const { error } = await supabase.from('checkins').insert({
      user_id: user.id,
      routine_id: routineId,
      local_date: today,
      axis: 'work',          // 트리거가 루틴 값으로 교정
      title_at_time: '-',    // 트리거가 루틴 값으로 교정
    })
    if (error && error.code !== '23505') throw new Error(error.message) // 23505 = 이미 체크됨
  } else {
    const { error } = await supabase
      .from('checkins')
      .delete()
      .eq('user_id', user.id)
      .eq('routine_id', routineId)
      .eq('local_date', today)
    if (error) throw new Error(error.message)
  }
  refresh()
}

/** 오늘 체크한 항목의 코멘트. DB가 note 한 칸만, 오늘·어제 체크분만 고치게 허용한다 (008) */
export async function saveCheckNote(routineId: string, note: string) {
  const text = note.trim().slice(0, 200) || null
  const { supabase, user, today } = await getViewer()
  await supabase
    .from('checkins')
    .update({ note: text })
    .eq('user_id', user.id)
    .eq('routine_id', routineId)
    .eq('local_date', today)
  refresh()
}

// 루틴 추가·수정·삭제는 체크리스트 편집 페이지에서 한 번에 저장한다 → ./edit/actions.ts
