'use server'

import { revalidatePath } from 'next/cache'
import { getViewer } from '@/lib/session'
import { isEmoji, isReason } from '@/lib/feed'
import type { FeedEmoji } from '@/lib/database.types'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const okId = (v: unknown): v is string => typeof v === 'string' && UUID.test(v)

/**
 * 오늘 체크한 항목을 피드에 올린다. 본인이 누를 때만 — 자동 공개는 없다 (결정요약 2-1).
 * 제목·Work/Life·시간대는 DB 트리거가 체크·루틴에서 복사한다. 코멘트는 본인이 '코멘트도'를 골랐을 때만 붙는다.
 */
export async function postCheck(routineId: string, withNote: boolean): Promise<{ ok: boolean }> {
  if (!okId(routineId)) return { ok: false }
  const { supabase, user, today } = await getViewer()
  const { data: check } = await supabase
    .from('checkins')
    .select('id,note')
    .eq('user_id', user.id)
    .eq('routine_id', routineId)
    .eq('local_date', today)
    .maybeSingle()
  if (!check) return { ok: false }
  const { error } = await supabase
    .from('feed_posts')
    .insert({ user_id: user.id, checkin_id: check.id, caption: withNote ? check.note : null })
  if (error && error.code !== '23505') return { ok: false } // 23505 = 이미 올림
  revalidatePath('/today')
  revalidatePath('/feed')
  return { ok: true }
}

/** 내 글 내리기 */
export async function deletePost(postId: string) {
  if (!okId(postId)) return
  const { supabase, user } = await getViewer()
  await supabase.from('feed_posts').delete().eq('id', postId).eq('user_id', user.id)
  revalidatePath('/feed')
  revalidatePath('/today')
}

/** 반응 — 한 글에 한 사람 하나. 같은 걸 다시 누르면 취소, 다른 걸 누르면 바꾼다 */
export async function react(postId: string, emoji: FeedEmoji | null): Promise<{ ok: boolean }> {
  if (!okId(postId) || (emoji !== null && !isEmoji(emoji))) return { ok: false }
  const { supabase, user } = await getViewer()
  const { error: delErr } = await supabase.from('feed_reactions').delete().eq('post_id', postId).eq('user_id', user.id)
  if (delErr) return { ok: false }
  if (emoji) {
    const { error } = await supabase.from('feed_reactions').insert({ post_id: postId, user_id: user.id, emoji })
    if (error) return { ok: false }
  }
  return { ok: true }
}

/** 남의 항목을 내 체크리스트로 — 메모는 오지 않는다. 결과: imported | exists | already | own | gone */
export async function importPost(postId: string) {
  if (!okId(postId)) return 'gone' as const
  const { supabase } = await getViewer()
  const { data, error } = await supabase.rpc('feed_import', { p_post: postId })
  if (error || !data) return 'gone' as const
  if (data === 'imported') revalidatePath('/today')
  return data
}

/** 이 사람 글 안 보기 */
export async function muteUser(userId: string) {
  if (!okId(userId)) return
  const { supabase, user } = await getViewer()
  if (userId === user.id) return
  await supabase.from('feed_mutes').insert({ user_id: user.id, muted_user_id: userId })
  revalidatePath('/feed')
}

/** 신고 — 서로 다른 3명이 신고하면 DB가 자동으로 숨긴다 */
export async function reportPost(postId: string, reason: string): Promise<{ ok: boolean }> {
  if (!okId(postId) || !isReason(reason)) return { ok: false }
  const { supabase, user } = await getViewer()
  const { error } = await supabase.from('feed_reports').insert({ post_id: postId, reporter_id: user.id, reason })
  return { ok: !error || error.code === '23505' }
}
