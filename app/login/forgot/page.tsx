import AuthHead from '../AuthHead'
import { requestPasswordReset } from '../actions'

export const metadata = { title: '비밀번호 찾기 · DownForce' }

const ERR: Record<string, string> = {
  email: '이메일 형식을 확인해 주세요.',
  rate: '메일을 너무 자주 요청했습니다. 잠시 후 다시 시도해 주세요.',
  expired: '링크가 만료됐거나 이미 사용됐습니다. 다시 요청해 주세요.',
}

export default async function ForgotPage({ searchParams }: { searchParams: Promise<{ s?: string; e?: string }> }) {
  const { s, e } = await searchParams
  return (
    <main className="shell auth-page">
      <AuthHead
        title="비밀번호 찾기"
        lead="가입한 이메일로 재설정 링크를 보냅니다. 카카오로 가입했다면 카카오 로그인을 이용해 주세요."
      />

      {s === 'sent' && (
        <div className="notice">
          <b>메일을 보냈습니다.</b> 가입된 이메일이면 재설정 링크가 도착합니다. 링크는 한 번만 쓸 수 있습니다.
        </div>
      )}
      {e && ERR[e] && <p className="err">{ERR[e]}</p>}

      <form action={requestPasswordReset}>
        <label className="field">
          <span>이메일</span>
          <input name="email" type="email" autoComplete="email" maxLength={254} required />
        </label>
        <button className="btn primary" type="submit">보내기</button>
      </form>
    </main>
  )
}
