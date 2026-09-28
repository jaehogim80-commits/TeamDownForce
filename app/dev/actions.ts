'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// 개발 DB(downforce-dev)에만 있는 함수를 부른다. 운영에서는 들어오기 전에 돌려보낸다
function devOnly() {
  if (process.env.NEXT_PUBLIC_DEV_LOGIN !== '1') redirect('/login')
}

/**
 * 개발용 회원가입.
 * - 소유자 이메일: 바로 계정이 생기고 로그인까지 된다
 * - 그 밖의 이메일: 가입 요청만 남는다. 소유자가 승인하면 여기서 정한 비밀번호로 로그인할 수 있다
 */
export async function signUpDev(formData: FormData) {
  devOnly()
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const password = String(formData.get('password') ?? '')
  const nickname = String(formData.get('nickname') ?? '').trim()
  const note = String(formData.get('note') ?? '').trim()

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('dev_signup', {
    p_email: email,
    p_password: password,
    p_nickname: nickname,
    p_note: note,
  })
  if (error) redirect('/dev/signup?s=error')

  if (data === 'created') {
    const { error: loginError } = await supabase.auth.signInWithPassword({ email, password })
    if (loginError) redirect('/dev/login?s=created')
    redirect('/today') // 온보딩 전이면 (app) 레이아웃이 온보딩으로 보낸다
  }
  redirect(`/dev/signup?s=${encodeURIComponent(String(data))}`)
}

/** 소유자만: 가입 요청 승인·거절. 권한 확인은 DB 함수가 auth.uid()로 한다 */
export async function decideSignup(formData: FormData) {
  devOnly()
  const email = String(formData.get('email') ?? '')
  const approve = formData.get('decision') === 'approve'

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('dev_decide_signup', { p_email: email, p_approve: approve })
  revalidatePath('/dev/approvals')
  if (error) redirect('/dev/approvals?r=error')
  redirect(`/dev/approvals?r=${encodeURIComponent(String(data))}`)
}
