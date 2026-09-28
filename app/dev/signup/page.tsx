import { notFound } from 'next/navigation'
import { signUpDev } from '@/app/dev/actions'

export const metadata = { title: '개발용 회원가입 · DownForce', robots: { index: false, follow: false } }

// dev_signup 반환값 → 안내 문구. ok=true면 성공 안내
const MSG: Record<string, { ok?: boolean; text: string }> = {
  requested: { ok: true, text: '가입 요청을 보냈습니다. 승인되면 방금 정한 비밀번호로 로그인할 수 있습니다.' },
  pending: { text: '이 이메일은 이미 승인을 기다리고 있습니다.' },
  rejected: { text: '승인되지 않은 요청입니다. 관리자에게 문의해 주세요.' },
  exists: { text: '이미 가입된 이메일입니다. 로그인해 주세요.' },
  invalid_email: { text: '이메일 형식을 확인해 주세요.' },
  invalid_nickname: { text: '닉네임은 1~20자로 입력해 주세요.' },
  weak_password: { text: '비밀번호는 8자 이상이어야 합니다.' },
  error: { text: '처리하지 못했습니다. 잠시 후 다시 시도해 주세요.' },
}

/**
 * 개발 전용 회원가입 — NEXT_PUBLIC_DEV_LOGIN=1 인 환경에서만 존재한다.
 * 소유자 이메일은 바로 가입되고, 나머지는 소유자 승인 후 계정이 만들어진다 (DB 함수 dev_signup).
 */
export default async function DevSignupPage({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  if (process.env.NEXT_PUBLIC_DEV_LOGIN !== '1') notFound()
  const { s } = await searchParams
  const msg = s ? MSG[s] : undefined

  return (
    <main className="shell" style={{ paddingTop: 48 }}>
      <div className="dev-banner">개발 환경 · 개발 DB에 연결됨 · 실제 사용자 데이터 아님</div>
      <p className="brand" style={{ marginTop: 24 }}>DOWNFORCE</p>
      <h1 style={{ fontSize: 24, fontWeight: 800, margin: '14px 0 6px' }}>개발용 회원가입</h1>
      <p className="muted small" style={{ marginBottom: 22 }}>
        관리자 승인 후 계정이 만들어집니다. 승인되면 여기서 정한 비밀번호로 로그인합니다.
      </p>

      {msg && <p className={msg.ok ? 'ok' : 'err'}>{msg.text}</p>}
      <form action={signUpDev}>
        <label className="field">
          <span>이메일</span>
          <input name="email" type="email" autoComplete="email" maxLength={254} required />
        </label>
        <label className="field">
          <span>비밀번호 (8자 이상)</span>
          <input name="password" type="password" autoComplete="new-password" minLength={8} maxLength={72} required />
        </label>
        <label className="field">
          <span>닉네임</span>
          <input name="nickname" type="text" maxLength={20} required />
        </label>
        <label className="field">
          <span>관리자에게 한마디 (선택)</span>
          <input name="note" type="text" maxLength={200} placeholder="예: 디자인 검토하는 OO입니다" />
        </label>
        <button className="btn primary" type="submit" style={{ marginTop: 6 }}>가입 요청</button>
      </form>

      <p className="small muted" style={{ marginTop: 18, textAlign: 'center' }}>
        이미 계정이 있나요? <a href="/dev/login" style={{ textDecoration: 'underline' }}>개발용 로그인</a>
      </p>
    </main>
  )
}
