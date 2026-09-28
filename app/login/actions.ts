'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

async function origin() {
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host')
  const proto = h.get('x-forwarded-proto') ?? 'https'
  return `${proto}://${host}`
}

export async function signInWithKakao(formData: FormData) {
  // 만 14세 이상 · 개인정보처리방침 동의는 버튼 활성화 조건이지만, 서버에서 한 번 더 확인한다
  if (formData.get('agree') !== 'on') redirect('/login?e=agree')

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'kakao',
    options: { redirectTo: `${await origin()}/auth/callback` },
  })
  if (error || !data.url) redirect('/login?e=kakao')
  redirect(data.url)
}

/** 개발용 로그인 — NEXT_PUBLIC_DEV_LOGIN=1 인 환경(개발 DB)에서만 동작한다 */
export async function signInDev(formData: FormData) {
  if (process.env.NEXT_PUBLIC_DEV_LOGIN !== '1') redirect('/login') // 운영에서는 이 경로 자체가 없다
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get('email') ?? ''),
    password: String(formData.get('password') ?? ''),
  })
  if (error) redirect('/dev/login?e=1')
  redirect('/today')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
