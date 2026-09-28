import { createServerClient } from '@supabase/ssr'
import { createClient as createPlainClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import type { Database } from '@/lib/database.types'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!

/** 로그인한 사용자 권한으로 동작하는 서버 클라이언트. RLS가 그대로 적용된다 */
export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient<Database>(URL, KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // 서버 컴포넌트에서는 쿠키를 쓸 수 없다 — 세션 갱신은 proxy.ts가 맡는다
        }
      },
    },
  })
}

/**
 * RLS를 우회하는 관리자 클라이언트. 회원 탈퇴 한 곳에서만 쓴다.
 * 비밀 키는 서버 환경변수에만 두고 NEXT_PUBLIC_ 접두사를 절대 붙이지 않는다.
 */
export function createAdminClient() {
  const secret = process.env.SUPABASE_SECRET_KEY
  if (!secret) return null
  return createPlainClient<Database>(URL, secret, { auth: { persistSession: false } })
}
