import AuthHead from '../AuthHead'
import { resendConfirmation } from '../actions'

export const metadata = { title: '메일 인증 · DownForce' }

// 가입 요청 결과는 주소가 이미 있었는지와 상관없이 같은 문구 — 가입 여부를 드러내지 않는다
const MSG: Record<string, React.ReactNode> = {
  sent: (
    <>
      <b>인증 메일을 보냈습니다.</b> 메일의 링크를 누르면 가입이 끝납니다. 몇 분 안에 오지 않으면 스팸함을 확인하거나 아래에서 다시 보내 주세요.
    </>
  ),
  resent: <><b>인증 메일을 다시 보냈습니다.</b> 가장 최근 메일의 링크를 눌러 주세요.</>,
  unconfirmed: <><b>메일 인증이 아직 끝나지 않았습니다.</b> 받은 메일의 링크를 누른 뒤 로그인해 주세요.</>,
}
const ERR: Record<string, string> = {
  expired: '링크가 만료됐거나 이미 사용됐습니다. 인증 메일을 다시 받아 주세요.',
  email: '이메일 형식을 확인해 주세요.',
  rate: '메일을 너무 자주 요청했습니다. 잠시 후 다시 시도해 주세요.',
}

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ s?: string; e?: string }> }) {
  const { s, e } = await searchParams
  return (
    <main className="shell auth-page">
      <AuthHead title="메일 인증" />

      {s && MSG[s] && <div className="notice">{MSG[s]}</div>}
      {e && ERR[e] && <p className="err">{ERR[e]}</p>}

      <form action={resendConfirmation}>
        <label className="field">
          <span>가입한 이메일</span>
          <input name="email" type="email" autoComplete="email" maxLength={254} required />
        </label>
        <button className="btn ghost" type="submit">재발송</button>
      </form>
    </main>
  )
}
