import { NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { safeNext } from '@/lib/safeNext'

const TYPES: EmailOtpType[] = ['signup', 'email', 'recovery', 'email_change']

/**
 * 메일 링크(토큰 방식) — 가입한 기기와 메일을 여는 기기가 달라도 된다.
 * Supabase 메일 템플릿의 링크를 이 주소로 바꿔야 쓰인다:
 *   가입:    {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
 *   재설정:  {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/login/reset
 * 템플릿을 바꾸기 전에는 /auth/callback(코드 방식)이 쓰인다.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const isReset = type === 'recovery'
  const next = safeNext(searchParams.get('next'), isReset ? '/login/reset' : '/today')

  if (tokenHash && type && TYPES.includes(type)) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (!error) return NextResponse.redirect(`${origin}${next}`)
  }
  return NextResponse.redirect(`${origin}${isReset ? '/login/forgot?e=expired' : '/login/verify?e=expired'}`)
}
