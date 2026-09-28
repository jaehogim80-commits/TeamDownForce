import { notFound } from 'next/navigation'
import { signInDev } from '@/app/login/actions'

export const metadata = { title: '개발용 로그인 · DownForce', robots: { index: false, follow: false } }

/**
 * 개발 전용 로그인 — 일반 사용자 로그인(/login)과 분리한 페이지.
 * NEXT_PUBLIC_DEV_LOGIN=1 인 환경(개발 DB에 연결된 배포)에서만 존재하고, 운영에서는 404다.
 * 가입 화면 캡처(카카오 심사 제출물)에 개발 폼이 섞이지 않게 하려는 목적도 있다.
 */
export default async function DevLoginPage({ searchParams }: { searchParams: Promise<{ e?: string; s?: string }> }) {
  if (process.env.NEXT_PUBLIC_DEV_LOGIN !== '1') notFound()
  const { e, s } = await searchParams

  return (
    <main className="shell" style={{ paddingTop: 48 }}>
      <div className="dev-banner">개발 환경 · 개발 DB에 연결됨 · 실제 사용자 데이터 아님</div>
      <p className="brand" style={{ marginTop: 24 }}>DOWNFORCE</p>
      <h1 style={{ fontSize: 24, fontWeight: 800, margin: '14px 0 6px' }}>개발용 로그인</h1>
      <p className="muted small" style={{ marginBottom: 22 }}>
        개발 계정 전용입니다. 일반 사용자는 <a href="/login" style={{ textDecoration: 'underline' }}>카카오 로그인</a>을 씁니다.
      </p>

      {s === 'created' && <p className="ok">가입했습니다. 방금 정한 비밀번호로 로그인해 주세요.</p>}
      {e && <p className="err">계정 정보가 맞지 않습니다. 가입 요청 중이라면 승인 후에 로그인할 수 있습니다.</p>}
      <form action={signInDev}>
        <label className="field">
          <span>이메일</span>
          <input name="email" type="email" autoComplete="username" required />
        </label>
        <label className="field">
          <span>비밀번호</span>
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        <button className="btn ghost" type="submit" style={{ marginTop: 6 }}>개발 계정으로 들어가기</button>
      </form>

      <p className="small muted" style={{ marginTop: 18, textAlign: 'center' }}>
        계정이 없나요? <a href="/dev/signup" style={{ textDecoration: 'underline' }}>개발용 회원가입</a>
      </p>
    </main>
  )
}
