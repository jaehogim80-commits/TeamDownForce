import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// 로그인 없이 열리는 경로. 개인정보처리방침은 카카오 심사에 제출하는 공개 URL이라 반드시 열려 있어야 한다
const PUBLIC = ['/login', '/privacy', '/auth', '/dev/login', '/dev/signup']
// 로그인한 사람이 다시 볼 필요 없는 화면
const GUEST_ONLY = ['/login', '/login/signup', '/dev/login', '/dev/signup']

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    },
  )

  // 세션 갱신 + 서명 검증. getSession()은 쿠키를 그대로 믿으므로 쓰지 않는다
  const { data } = await supabase.auth.getClaims()
  const loggedIn = !!data?.claims

  const path = request.nextUrl.pathname
  const isPublic = PUBLIC.some((p) => path === p || path.startsWith(p + '/'))

  if (!loggedIn && !isPublic) {
    const url = request.nextUrl.clone()
    // 개발 화면(/dev/approvals 등)에서 튕기면 개발용 로그인으로
    url.pathname = path.startsWith('/dev/') ? '/dev/login' : '/login'
    url.search = ''
    return NextResponse.redirect(url)
  }
  if (loggedIn && GUEST_ONLY.includes(path)) {
    const url = request.nextUrl.clone()
    url.pathname = '/today'
    return NextResponse.redirect(url)
  }
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)'],
}
