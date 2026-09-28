'use server'

import { redirect } from 'next/navigation'
import { getViewer } from '@/lib/session'

export async function finishOnboarding(formData: FormData) {
  const handle = String(formData.get('handle') ?? '').trim().toLowerCase()
  const name = String(formData.get('display_name') ?? '').trim()
  if (!/^[a-z0-9_]{3,20}$/.test(handle) || handle.startsWith('u_')) redirect('/onboarding?e=handle')
  if (name.length < 1 || name.length > 20) redirect('/onboarding?e=name')

  const { supabase, user } = await getViewer()
  // 회원이 바꿀 수 있는 컬럼은 이 다섯 개뿐이다 (002 컬럼 권한) — role·가입일·순번은 여기서 못 건드린다
  const { error } = await supabase
    .from('profiles')
    .update({ handle, display_name: name, onboarded_at: new Date().toISOString() })
    .eq('id', user.id)
  if (error) redirect(error.code === '23505' ? '/onboarding?e=taken' : '/onboarding?e=handle')
  redirect('/today')
}
