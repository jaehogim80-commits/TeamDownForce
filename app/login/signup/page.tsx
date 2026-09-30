import AuthHead from '../AuthHead'
import { signUpWithEmail } from '../actions'

export const metadata = { title: '가입 · DownForce' }

const ERR: Record<string, React.ReactNode> = {
  agree: '만 14세 이상 확인과 개인정보처리방침 동의가 필요합니다.',
  email: '이메일 형식을 확인해 주세요.',
  pw: '비밀번호는 8~72자로 정해 주세요.',
  name: '닉네임은 1~20자로 입력해 주세요.',
  rate: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',
  fail: '가입하지 못했습니다. 잠시 후 다시 시도해 주세요.',
  dev: (
    <>
      개발 환경은 승인된 이메일만 가입할 수 있습니다. <a href="/dev/signup" style={{ textDecoration: 'underline' }}>가입 요청</a>
    </>
  ),
}

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const { e } = await searchParams
  return (
    <main className="shell auth-page">
      <AuthHead title="이메일로 가입" lead="가입하면 인증 메일을 보냅니다. 메일의 링크를 누르면 가입이 끝나고 회원 번호가 발급됩니다." />

      {e && ERR[e] && <p className="err">{ERR[e]}</p>}
      <form action={signUpWithEmail}>
        <label className="field">
          <span>이메일</span>
          <input name="email" type="email" autoComplete="email" maxLength={254} required />
        </label>
        <label className="field">
          <span>비밀번호 (8자 이상)</span>
          <input name="password" type="password" autoComplete="new-password" minLength={8} maxLength={72} required />
        </label>
        <label className="field">
          <span>닉네임 (1~20자)</span>
          <input name="nickname" type="text" autoComplete="nickname" maxLength={20} required />
        </label>
        <label className="check" style={{ margin: '4px 0 16px' }}>
          <input type="checkbox" name="agree" required />
          <span>
            만 14세 이상이며, <a href="/privacy" target="_blank">개인정보처리방침</a>을 확인하고 동의합니다.
          </span>
        </label>
        <button className="btn primary" type="submit">가입</button>
      </form>
    </main>
  )
}
