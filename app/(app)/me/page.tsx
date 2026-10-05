import Link from 'next/link'
import { getViewer } from '@/lib/session'
import { cutoffLabel } from '@/lib/date'
import { signOut } from '@/app/login/actions'
import { badgeOf, getMembership, numberLabel } from '@/lib/membership'
import DeleteAccount from './DeleteAccount'

export default async function MyPage() {
  const { supabase, user, profile, today, cutoff } = await getViewer()
  const year = today.slice(0, 4)
  const [{ data: streak }, { count: yearDays }, membership, { data: founder }, { data: pendingCutoff }, { data: summary }] = await Promise.all([
    supabase.from('user_streaks').select('current_streak,longest_streak').maybeSingle(),
    // 기록일 = Work 또는 Life 체크리스트를 완료한 날 (스트릭과 같은 기준, 007)
    supabase.from('day_logs').select('*', { count: 'exact', head: true }).gte('local_date', `${year}-01-01`).or('work_done.eq.true,life_done.eq.true'),
    getMembership(supabase, user.id),
    supabase.rpc('is_founder'),
    supabase.from('day_cutoff_settings').select('effective_on,hour').gt('effective_on', today).order('effective_on').limit(1).maybeSingle(),
    supabase.rpc('streak_summary', { p_today: today }), // 퍼펙트 위크 수 (013)
  ])
  const joined = profile.created_at.slice(0, 7).replace('-', '.')
  const badge = badgeOf(membership)

  // 개발 환경의 창립자에게만 개발용 가입 승인 메뉴 (dev_* 함수는 개발 DB에만 있다)
  let devPending: number | null = null
  if (process.env.NEXT_PUBLIC_DEV_LOGIN === '1' && founder) {
    const { data: isOwner } = await supabase.rpc('dev_is_owner')
    if (isOwner) {
      const { data: reqs } = await supabase.rpc('dev_list_signup_requests')
      devPending = (reqs ?? []).filter((x) => x.status === 'pending').length
    }
  }

  return (
    <main className="shell">
      <header className="header">
        <span className="brand">마이페이지</span>
      </header>

      <section className="card" style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        <div style={{ width: 52, height: 52, borderRadius: 16, background: 'var(--card2)', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 20 }}>
          {profile.display_name.slice(0, 1)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 800, fontSize: 17 }}>{profile.display_name}</p>
          <p className="small muted">@{profile.handle} · {joined} 가입 · {numberLabel(membership)}</p>
        </div>
        {badge && <span className="chip" style={badge.accent ? { color: 'var(--fire)' } : undefined}>{badge.text}</span>}
      </section>

      <section className="card stats">
        <div><b>{streak?.current_streak ?? 0}</b><span className="small muted">연속</span></div>
        <div><b>{streak?.longest_streak ?? 0}</b><span className="small muted">최장</span></div>
        <div><b>{yearDays ?? 0}</b><span className="small muted">{year}년 기록일</span></div>
        <div><b>{summary?.[0]?.perfect_weeks ?? 0}</b><span className="small muted">퍼펙트 위크</span></div>
      </section>

      <section className="card">
        <p className="label" style={{ marginBottom: 4 }}>내 크루</p>
        <div className="row"><span className="muted">크루 둘러보기</span><span className="chip">곧 열려요</span></div>
      </section>

      <p className="label" style={{ margin: '18px 2px 8px' }}>내 정보</p>
      <section className="card" style={{ paddingTop: 4, paddingBottom: 4 }}>
        <Link className="row" href="/me/edit"><span>프로필 · 계정 관리</span><span className="muted">›</span></Link>
        <Link className="row" href="/me/edit#cutoff">
          <span>하루의 경계</span>
          <span className="small muted">
            {cutoffLabel(cutoff)}
            {pendingCutoff && ` → 내일부터 ${cutoffLabel(pendingCutoff.hour)}`} ›
          </span>
        </Link>
      </section>

      {(founder || devPending !== null) && (
        <>
          <p className="label" style={{ margin: '18px 2px 8px' }}>운영</p>
          <section className="card" style={{ paddingTop: 4, paddingBottom: 4 }}>
            {founder && <Link className="row" href="/me/accounts"><span>계정 관리 (창립자)</span><span className="muted">›</span></Link>}
            {devPending !== null && (
              <a className="row" href="/dev/approvals">
                <span>개발용 가입 승인</span>
                <span className={devPending > 0 ? 'chip' : 'muted'} style={devPending > 0 ? { color: 'var(--fire)' } : undefined}>
                  {devPending > 0 ? `대기 ${devPending}` : '›'}
                </span>
              </a>
            )}
          </section>
        </>
      )}

      <section className="card" style={{ paddingTop: 4, paddingBottom: 4, marginTop: 18 }}>
        <a className="row" href="/privacy"><span>개인정보처리방침</span><span className="muted">›</span></a>
        <form action={signOut} className="row"><button type="submit" style={{ padding: 0 }}>로그아웃</button></form>
      </section>

      <DeleteAccount />
    </main>
  )
}
