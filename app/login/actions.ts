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

// ── 이메일 가입·로그인·비밀번호 재설정 (2026-09-30) ──────────────────────────
// 가입은 메일 인증을 거친다. 회원 번호는 인증 순간에 발급된다 (DB 010).
// 가입·재설정 요청은 이미 있는 주소인지 드러내지 않는다 — 결과 화면은 언제나 "메일을 확인하세요".
// 이메일 주소는 URL에 싣지 않는다 (개인정보를 쿼리 문자열에 넣지 않는 원칙).

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function readEmail(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  return EMAIL_RE.test(email) && email.length <= 254 ? email : ''
}

/** Supabase가 "가입 한도" 등으로 거절했을 때를 한 곳에서 문구로 바꾼다 */
function authErrKey(error: { code?: string; status?: number }) {
  if (error.code === 'over_email_send_rate_limit' || error.status === 429) return 'rate'
  if (error.code === 'weak_password') return 'pw'
  return 'fail'
}

export async function signUpWithEmail(formData: FormData) {
  if (formData.get('agree') !== 'on') redirect('/login/signup?e=agree')
  const email = readEmail(formData)
  const password = String(formData.get('password') ?? '')
  const nickname = String(formData.get('nickname') ?? '').trim()
  if (!email) redirect('/login/signup?e=email')
  if (password.length < 8 || password.length > 72) redirect('/login/signup?e=pw')
  if (nickname.length < 1 || nickname.length > 20) redirect('/login/signup?e=name')

  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${await origin()}/auth/callback`, data: { nickname } },
  })
  if (error) {
    // 개발 DB는 승인 절차를 거치지 않은 이메일 가입을 DB에서 막는다 (dev 101)
    if (process.env.NEXT_PUBLIC_DEV_LOGIN === '1' && (error.status ?? 0) >= 500) redirect('/login/signup?e=dev')
    redirect(`/login/signup?e=${authErrKey(error)}`)
  }
  redirect('/login/verify?s=sent')
}

export async function signInWithEmail(formData: FormData) {
  const email = readEmail(formData)
  const password = String(formData.get('password') ?? '')
  if (!email || !password) redirect('/login?m=email&e=cred')

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    if (error.code === 'email_not_confirmed') redirect('/login/verify?s=unconfirmed')
    if (error.status === 429) redirect('/login?m=email&e=rate')
    redirect('/login?m=email&e=cred')
  }
  redirect('/today')
}

/** 인증 메일 다시 보내기 — 가입 안 된 주소여도 같은 안내를 보여준다 */
export async function resendConfirmation(formData: FormData) {
  const email = readEmail(formData)
  if (!email) redirect('/login/verify?e=email')
  const supabase = await createClient()
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: `${await origin()}/auth/callback` },
  })
  if (error && authErrKey(error) === 'rate') redirect('/login/verify?e=rate')
  redirect('/login/verify?s=resent')
}

export async function requestPasswordReset(formData: FormData) {
  const email = readEmail(formData)
  if (!email) redirect('/login/forgot?e=email')
  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await origin()}/auth/callback?next=/login/reset`,
  })
  if (error && authErrKey(error) === 'rate') redirect('/login/forgot?e=rate')
  redirect('/login/forgot?s=sent')
}

/** 재설정 메일의 링크로 들어온 세션에서만 새 비밀번호를 정한다 */
export async function setNewPassword(formData: FormData) {
  const password = String(formData.get('password') ?? '')
  const confirm = String(formData.get('confirm') ?? '')
  if (password.length < 8 || password.length > 72) redirect('/login/reset?e=pw')
  if (password !== confirm) redirect('/login/reset?e=same')

  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) redirect('/login/forgot?e=expired')
  // 카카오 계정은 비밀번호가 없다 — 여기서 비밀번호를 붙이지 않는다
  if (!data.user.identities?.some((i) => i.provider === 'email')) redirect('/today')
  const { error } = await supabase.auth.updateUser({ password })
  if (error) redirect(`/login/reset?e=${error.code === 'same_password' ? 'old' : authErrKey(error)}`)
  redirect('/today')
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
