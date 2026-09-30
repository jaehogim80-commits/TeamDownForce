import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AuthHead from '../AuthHead'
import { setNewPassword } from '../actions'

export const metadata = { title: '새 비밀번호 · DownForce' }

const ERR: Record<string, string> = {
  pw: '비밀번호는 8~72자로 정해 주세요.',
  same: '두 비밀번호가 다릅니다.',
  old: '지금 쓰는 비밀번호와 다르게 정해 주세요.',
  rate: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',
  fail: '바꾸지 못했습니다. 재설정 메일을 다시 받아 주세요.',
}

/** 재설정 메일의 링크(→ /auth/callback 또는 /auth/confirm)로 로그인된 상태에서만 열린다 */
export default async function ResetPage({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) redirect('/login/forgot?e=expired')
  if (!data.user.identities?.some((i) => i.provider === 'email')) redirect('/today')
  const { e } = await searchParams

  return (
    <main className="shell auth-page">
      <AuthHead title="새 비밀번호" lead={data.user.email ? `${data.user.email} 계정의 비밀번호를 새로 정합니다.` : undefined} />

      {e && ERR[e] && <p className="err">{ERR[e]}</p>}
      <form action={setNewPassword}>
        <label className="field">
          <span>새 비밀번호 (8자 이상)</span>
          <input name="password" type="password" autoComplete="new-password" minLength={8} maxLength={72} required />
        </label>
        <label className="field">
          <span>한 번 더</span>
          <input name="confirm" type="password" autoComplete="new-password" minLength={8} maxLength={72} required />
        </label>
        <button className="btn primary" type="submit">변경</button>
      </form>
    </main>
  )
}
