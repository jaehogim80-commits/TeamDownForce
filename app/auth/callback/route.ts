import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { safeNext } from '@/lib/safeNext'

function baseUrl(request: Request, origin: string) {
  const forwardedHost = request.headers.get('x-forwarded-host')
  return process.env.NODE_ENV === 'development' || !forwardedHost ? origin : `https://${forwardedHost}`
}

// 카카오 로그인 · 가입 인증 메일 · 비밀번호 재설정 메일 → Supabase → 여기. 코드를 세션으로 바꾼다 (PKCE)
// PKCE는 요청한 브라우저의 쿠키가 있어야 한다. 다른 기기에서 메일을 열면 실패하므로 /auth/confirm(토큰 방식)도 둔다
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = safeNext(searchParams.get('next'))
  const isReset = next.startsWith('/login/reset')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    // 온보딩이 필요하면 (app) 레이아웃이 알아서 보낸다
    if (!error) return NextResponse.redirect(`${baseUrl(request, origin)}${next}`)
  }
  // 메일 링크는 한 번만 쓸 수 있고 유효 시간이 짧다. 실패하면 다시 요청하는 화면으로
  const fail = isReset ? '/login/forgot?e=expired' : searchParams.get('error_code') ? '/login/verify?e=expired' : '/login?e=callback'
  return NextResponse.redirect(`${origin}${fail}`)
}
