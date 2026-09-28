import LoginForm from './LoginForm'
import DWheel from './DWheel'

const ERR: Record<string, string> = {
  agree: '만 14세 이상 확인과 개인정보처리방침 동의가 필요합니다.',
  kakao: '카카오 로그인을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.',
  callback: '로그인을 마치지 못했습니다. 다시 시도해 주세요.',
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const { e } = await searchParams

  return (
    <main className="shell login">
      <div className="login-rise">
        <p className="brand">DOWNFORCE</p>
        <h1>
          Work Hard.
          <br />
          <em>Live Yours.</em>
        </h1>
        <p className="muted" style={{ marginTop: 14 }}>
          오늘 한 일과 오늘 누린 삶을 한 칸씩.
          <br />
          성과가 아니라 거르지 않은 날을 셉니다.
        </p>
      </div>

      <DWheel />

      <div className="login-rise">
        <div className="card" style={{ padding: 18, marginBottom: 18 }}>
          <div className="week" aria-hidden="true">
            {['b', 'w', 'w', 'l', 'b', 'n', 'w'].map((c, i) => (
              <div key={i} className={`cell ${c}`} />
            ))}
          </div>
          <p className="small muted" style={{ marginTop: 10 }}>
            <span style={{ color: 'var(--work)' }}>■</span> Work · <span style={{ color: 'var(--life)' }}>■</span> Life · 둘 다 하면 반반
          </p>
        </div>

        {e && ERR[e] && <p className="err">{ERR[e]}</p>}
        <LoginForm />
      </div>
    </main>
  )
}
