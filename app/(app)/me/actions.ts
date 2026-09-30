'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getViewer } from '@/lib/session'
import { addDays, localDate } from '@/lib/date'

const EDIT = '/me/edit'

/** 이름·핸들 — 온보딩과 같은 규칙 (profiles 컬럼 권한 002: 회원이 바꿀 수 있는 컬럼만) */
export async function updateProfile(formData: FormData) {
  const handle = String(formData.get('handle') ?? '').trim().toLowerCase()
  const name = String(formData.get('display_name') ?? '').trim()
  if (name.length < 1 || name.length > 20) redirect(`${EDIT}?e=name`)
  if (!/^[a-z0-9_]{3,20}$/.test(handle) || handle.startsWith('u_')) redirect(`${EDIT}?e=handle`)

  const { supabase, user } = await getViewer()
  const { error } = await supabase.from('profiles').update({ handle, display_name: name }).eq('id', user.id)
  if (error) redirect(`${EDIT}?e=${error.code === '23505' ? 'taken' : 'save'}`)
  revalidatePath('/me')
  redirect(`${EDIT}?s=profile`)
}

/**
 * 하루의 경계 — 오늘은 절대 바꾸지 않고 "내일부터" 적용한다 (구축지시서 3-A.1, RLS가 강제).
 * 이미 예약해 둔 미래 값이 있으면 지우고 새로 예약한다 (UPDATE 경로는 DB에 없다).
 */
export async function setDayCutoff(formData: FormData) {
  const hour = Number(formData.get('hour'))
  if (!Number.isInteger(hour) || hour < 0 || hour > 6) redirect(`${EDIT}?e=cutoff`)

  const { supabase, user, today, cutoff } = await getViewer()
  // RLS 기준일(서울 날짜)과 사용자의 '오늘' 중 늦은 쪽의 다음 날
  const seoulToday = localDate(new Date(), 'Asia/Seoul', 0)
  const base = today > seoulToday ? today : seoulToday
  const effective = addDays(base, 1)

  await supabase.from('day_cutoff_settings').delete().eq('user_id', user.id).gt('effective_on', seoulToday)
  if (hour !== cutoff) {
    const { error } = await supabase.from('day_cutoff_settings').insert({ user_id: user.id, effective_on: effective, hour })
    if (error) redirect(`${EDIT}?e=cutoff`)
  }
  revalidatePath('/me')
  redirect(`${EDIT}?s=cutoff`)
}

/** 비밀번호 변경 — 이메일로 가입한 계정만. 카카오 계정은 비밀번호가 없다 */
export async function changePassword(formData: FormData) {
  const password = String(formData.get('password') ?? '')
  const confirm = String(formData.get('confirm') ?? '')
  if (password.length < 8 || password.length > 72) redirect(`${EDIT}?e=pw_short`)
  if (password !== confirm) redirect(`${EDIT}?e=pw_match`)

  const { supabase, user } = await getViewer()
  if (!user.identities?.some((i) => i.provider === 'email')) redirect(`${EDIT}?e=pw_kakao`)
  const { error } = await supabase.auth.updateUser({ password })
  if (error) redirect(`${EDIT}?e=${error.code === 'same_password' ? 'pw_same' : 'pw_fail'}`)
  redirect(`${EDIT}?s=password`)
}

/** 창립자 전용 — 계정 유형 변경. 권한 확인은 DB 함수(is_founder)가 한다 */
export async function setAccountType(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  const type = String(formData.get('type') ?? '')
  if (type !== 'member' && type !== 'developer' && type !== 'tester') redirect('/me/accounts?r=invalid')

  const { supabase } = await getViewer()
  const { data, error } = await supabase.rpc('admin_set_account_type', { p_user: id, p_type: type })
  revalidatePath('/me/accounts')
  redirect(`/me/accounts?r=${error ? 'error' : encodeURIComponent(String(data))}`)
}
