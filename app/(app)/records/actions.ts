'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getViewer } from '@/lib/session'
import { isYmd } from '@/lib/date'

// 일정 메모는 체크인과 별개다 — 어느 날짜든(과거·미래) 자유롭게 적고 지울 수 있다
function back(date: string, e?: string) {
  const q = new URLSearchParams({ m: date.slice(0, 7), d: date })
  if (e) q.set('e', e)
  return `/records?${q.toString()}`
}

export async function addNote(formData: FormData) {
  const date = String(formData.get('date') ?? '')
  const time = String(formData.get('time') ?? '').trim()
  const body = String(formData.get('body') ?? '').trim()
  if (!isYmd(date)) redirect('/records')
  if (body.length < 1 || body.length > 200) redirect(back(date, 'body'))
  if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) redirect(back(date, 'time'))

  const { supabase, user } = await getViewer()
  const { error } = await supabase
    .from('calendar_notes')
    .insert({ user_id: user.id, note_date: date, time_of_day: time || null, body })
  revalidatePath('/records')
  redirect(back(date, error ? 'save' : undefined))
}

export async function deleteNote(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  const date = String(formData.get('date') ?? '')
  if (!isYmd(date)) redirect('/records')

  const { supabase, user } = await getViewer()
  // RLS가 본인 메모만 허용하지만, 조건을 코드에도 명시해 둔다
  await supabase.from('calendar_notes').delete().eq('id', id).eq('user_id', user.id)
  revalidatePath('/records')
  redirect(back(date))
}
