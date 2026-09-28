import Image from 'next/image'
import LoginForm from './LoginForm'

// 빈 도로를 달려오는 D 바퀴와 주황 빛 꼬리 (힉스필드 z_image, 시안 A — 2026-09-28 사용자 선택).
// 지금은 힉스필드 저장소 주소를 Vercel 이미지 최적화로 불러온다. 운영 전에는 자체 저장소로 옮긴다
const LOGIN_BG = 'https://d8j0ntlcm91z4.cloudfront.net/user_3JIch9X05DBc4KilK4wvf4Hk9iZ/hf_20260928_152250_4bf24169-d284-466d-b778-283bd4a2f240.png'

const ERR: Record<string, string> = {
  agree: '만 14세 이상 확인과 개인정보처리방침 동의가 필요합니다.',
  kakao: '카카오 로그인을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.',
  callback: '로그인을 마치지 못했습니다. 다시 시도해 주세요.',
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const { e } = await searchParams

  return (
    <main className="shell login">
      <div className="login-bg" aria-hidden="true">
        <Image src={LOGIN_BG} alt="" fill priority sizes="100vw" quality={70} />
      </div>

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

      <div className="login-rise">
        <div className="card glass" style={{ padding: 18, marginBottom: 18 }}>
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
