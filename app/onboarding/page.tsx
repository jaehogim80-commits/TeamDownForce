import { redirect } from 'next/navigation'
import { getViewer } from '@/lib/session'
import { finishOnboarding } from './actions'
import { badgeOf, getMembership, numberLabel } from '@/lib/membership'

const ERR: Record<string, string> = {
  handle: '핸들은 영문 소문자·숫자·밑줄 3~20자입니다.',
  taken: '이미 쓰고 있는 핸들입니다.',
  name: '이름은 1~20자입니다.',
}

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const { supabase, user, profile } = await getViewer()
  if (profile.onboarded_at) redirect('/today')
  const { e } = await searchParams
  // 창립 멤버 판정은 signup_seq가 아니라 회원 번호(005) — 창립자·개발자·테스터는 번호를 받지 않는다
  const membership = await getMembership(supabase, user.id)
  const badge = badgeOf(membership)

  return (
    <main className="shell" style={{ paddingTop: 48 }}>
      <p className="brand">DOWNFORCE</p>
      <h1 style={{ fontSize: 24, fontWeight: 800, margin: '20px 0 6px' }}>반갑습니다.</h1>
      <p className="muted" style={{ marginBottom: 20 }}>격자와 공유 카드에 들어갈 이름만 정하면 시작합니다.</p>

      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p className="label">회원 구분</p>
          <p style={{ fontSize: 22, fontWeight: 800 }}>{numberLabel(membership)}</p>
        </div>
        {badge && <span className="chip" style={badge.accent ? { color: 'var(--fire)' } : undefined}>{badge.text}</span>}
      </div>

      {e && ERR[e] && <p className="err">{ERR[e]}</p>}
      <form action={finishOnboarding}>
        <label className="field">
          <span>이름 (1~20자)</span>
          <input name="display_name" defaultValue={profile.display_name} maxLength={20} required />
        </label>
        <label className="field">
          <span>핸들 · 영문 소문자·숫자·밑줄 3~20자</span>
          <input name="handle" defaultValue={profile.handle.startsWith('u_') ? '' : profile.handle} placeholder="jaeho_kim" pattern="[a-z0-9_]{3,20}" maxLength={20} required />
        </label>
        <button className="btn primary" type="submit" style={{ marginTop: 8 }}>시작하기</button>
      </form>
    </main>
  )
}
