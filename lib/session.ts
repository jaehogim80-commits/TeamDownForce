import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { localDate } from '@/lib/date'

/** 로그인 사용자 · 프로필 · 그 사람 기준 "오늘". 한 요청 안에서는 한 번만 계산한다 */
export const getViewer = cache(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile) redirect('/login')

  const now = new Date()
  const base = localDate(now, profile.timezone, 0)
  const { data: cutoff } = await supabase.rpc('current_cutoff', { p_user: user.id, p_today: base })
  const today = localDate(now, profile.timezone, cutoff ?? 0)

  return { supabase, user, profile, today, cutoff: cutoff ?? 0 }
})

/**
 * 격자 칸 4상태 (007): 그날의 Work 체크리스트를 전부 끝냈는가 × Life 체크리스트를 전부 끝냈는가.
 * 하나만 체크한 날은 '미완료' — 칸은 비어 있다. 완료 판정은 DB(day_logs.work_done/life_done)가 한다.
 */
export type Cell = 'w' | 'l' | 'b' | 'n'
export function cellOf(workDone: boolean | null | undefined, lifeDone: boolean | null | undefined): Cell {
  if (workDone && lifeDone) return 'b'
  if (workDone) return 'w'
  if (lifeDone) return 'l'
  return 'n'
}
