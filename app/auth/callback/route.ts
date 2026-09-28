import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// 카카오 → Supabase → 여기. 인가 코드를 세션으로 바꾼다 (PKCE)
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const forwardedHost = request.headers.get('x-forwarded-host')
      const base = process.env.NODE_ENV === 'development' || !forwardedHost ? origin : `https://${forwardedHost}`
      // 온보딩이 필요하면 (app) 레이아웃이 알아서 보낸다
      return NextResponse.redirect(`${base}/today`)
    }
  }
  return NextResponse.redirect(`${origin}/login?e=callback`)
}
