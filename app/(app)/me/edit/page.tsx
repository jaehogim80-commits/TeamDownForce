import Link from 'next/link'
import HandleField from '@/app/HandleField'
import { getViewer } from '@/lib/session'
import { cutoffLabel } from '@/lib/date'
import { getMembership, numberLabel } from '@/lib/membership'
import { changePassword, setDayCutoff, updateProfile } from '../actions'

const ERR: Record<string, string> = {
  name: '이름은 1~20자입니다.',
  handle: '핸들은 영문 소문자·숫자·밑줄 3~20자입니다. (u_로 시작 불가)',
  taken: '이미 쓰고 있는 핸들입니다.',
  save: '저장하지 못했습니다. 다시 시도해 주세요.',
  cutoff: '하루의 경계를 저장하지 못했습니다.',
  pw_short: '비밀번호는 8~72자입니다.',
  pw_match: '두 비밀번호가 다릅니다.',
  pw_same: '지금 쓰는 비밀번호와 같습니다.',
  pw_kakao: '카카오로 가입한 계정은 비밀번호가 없습니다.',
  pw_fail: '비밀번호를 바꾸지 못했습니다. 다시 로그인한 뒤 시도해 주세요.',
}
const OK: Record<string, string> = {
  profile: '프로필을 저장했습니다.',
  cutoff: '하루의 경계를 저장했습니다. 오늘은 그대로이고 내일부터 적용됩니다.',
  password: '비밀번호를 바꿨습니다.',
}

/** 마이페이지 › 프로필 · 계정 관리 */
export default async function EditPage({ searchParams }: { searchParams: Promise<{ e?: string; s?: string }> }) {
  const { supabase, user, profile, today, cutoff } = await getViewer()
  const { e, s } = await searchParams
  const [membership, { data: pending }] = await Promise.all([
    getMembership(supabase, user.id),
    supabase.from('day_cutoff_settings').select('effective_on,hour').gt('effective_on', today).order('effective_on').limit(1).maybeSingle(),
  ])
  const isEmail = user.identities?.some((i) => i.provider === 'email') ?? false
  const isKakao = user.identities?.some((i) => i.provider === 'kakao') ?? false
  const joined = new Intl.DateTimeFormat('ko-KR', { timeZone: profile.timezone, dateStyle: 'long' }).format(new Date(profile.created_at))

  return (
    <main className="shell">
      <header className="header">
        <span className="brand">프로필 · 계정 관리</span>
        <Link href="/me" className="small muted">← 마이페이지</Link>
      </header>

      {e && ERR[e] && <p className="err">{ERR[e]}</p>}
      {s && OK[s] && <p className="ok">{OK[s]}</p>}

      <p className="label" style={{ margin: '6px 2px 8px' }}>프로필</p>
      <form action={updateProfile} className="card">
        <label className="field">
          <span>이름 (1~20자)</span>
          <input name="display_name" defaultValue={profile.display_name} maxLength={20} required />
        </label>
        <HandleField defaultValue={profile.handle} />
        <button className="btn primary" type="submit">프로필 저장</button>
      </form>

      <p className="label" style={{ margin: '18px 2px 8px' }} id="cutoff">하루의 경계</p>
      <form action={setDayCutoff} className="card">
        <p className="small muted" style={{ marginBottom: 10 }}>
          이 시각 전까지는 전날로 기록됩니다. 오늘 기록이 흔들리지 않도록 <b style={{ color: 'var(--ink)' }}>내일부터</b> 적용됩니다.
        </p>
        <p className="small" style={{ marginBottom: 10 }}>
          지금: {cutoffLabel(cutoff)}
          {pending && <span style={{ color: 'var(--fire)' }}> · 내일부터 {cutoffLabel(pending.hour)}</span>}
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <select name="hour" defaultValue={String(pending?.hour ?? cutoff)} className="select" aria-label="하루의 경계">
            {[0, 1, 2, 3, 4, 5, 6].map((h) => <option key={h} value={h}>{cutoffLabel(h)}</option>)}
          </select>
          <button className="btn ghost" type="submit" style={{ width: 'auto', padding: '0 18px' }}>저장</button>
        </div>
      </form>

      {isEmail && (
        <>
          <p className="label" style={{ margin: '18px 2px 8px' }}>비밀번호 변경</p>
          <form action={changePassword} className="card">
            <label className="field">
              <span>새 비밀번호 (8자 이상)</span>
              <input name="password" type="password" autoComplete="new-password" minLength={8} maxLength={72} required />
            </label>
            <label className="field">
              <span>새 비밀번호 확인</span>
              <input name="confirm" type="password" autoComplete="new-password" minLength={8} maxLength={72} required />
            </label>
            <button className="btn ghost" type="submit">비밀번호 변경</button>
          </form>
        </>
      )}

      <p className="label" style={{ margin: '18px 2px 8px' }}>계정 정보</p>
      <section className="card" style={{ paddingTop: 4, paddingBottom: 4 }}>
        <div className="row"><span className="muted">로그인 방식</span><span>{isKakao ? '카카오' : isEmail ? '이메일' : '-'}</span></div>
        <div className="row"><span className="muted">이메일</span><span className="small" style={{ wordBreak: 'break-all', textAlign: 'right' }}>{user.email || '제공되지 않음'}</span></div>
        <div className="row"><span className="muted">가입일</span><span className="small">{joined}</span></div>
        <div className="row"><span className="muted">회원 구분</span><span className="small">{numberLabel(membership)}{membership.founding_member ? ' · 창립 멤버' : ''}</span></div>
      </section>
      <p className="small muted" style={{ margin: '0 2px' }}>회원 구분과 가입일은 바꿀 수 없습니다. 탈퇴는 마이페이지 맨 아래에 있습니다.</p>
    </main>
  )
}
