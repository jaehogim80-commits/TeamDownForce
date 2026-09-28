import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { decideSignup } from '@/app/dev/actions'

export const metadata = { title: '가입 승인 · DownForce', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

const RESULT: Record<string, { ok?: boolean; text: string }> = {
  approved: { ok: true, text: '승인했습니다. 요청자가 신청 때 정한 비밀번호로 바로 로그인할 수 있습니다.' },
  rejected: { ok: true, text: '거절했습니다.' },
  exists: { text: '이미 가입된 이메일이라 새 계정은 만들지 않았습니다.' },
  not_found: { text: '요청을 찾지 못했습니다.' },
  error: { text: '처리하지 못했습니다. 다시 시도해 주세요.' },
}

const STATUS: Record<string, string> = { pending: '대기', approved: '승인', rejected: '거절' }

function kst(iso: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(iso))
}

/** 소유자 전용 — 개발용 가입 요청 승인·거절. 소유자가 아니면 페이지가 없는 것처럼 404 */
export default async function DevApprovalsPage({ searchParams }: { searchParams: Promise<{ r?: string }> }) {
  if (process.env.NEXT_PUBLIC_DEV_LOGIN !== '1') notFound()
  const supabase = await createClient()
  const { data: isOwner } = await supabase.rpc('dev_is_owner')
  if (!isOwner) notFound()

  const { r } = await searchParams
  const result = r ? RESULT[r] : undefined
  const { data: rows } = await supabase.rpc('dev_list_signup_requests')
  const pending = (rows ?? []).filter((x) => x.status === 'pending')
  const done = (rows ?? []).filter((x) => x.status !== 'pending')

  return (
    <main className="shell" style={{ paddingTop: 32 }}>
      <div className="dev-banner">개발 환경 · 개발 DB 가입 승인</div>
      <header className="header" style={{ marginTop: 20 }}>
        <span className="brand">가입 승인</span>
        <a href="/me" className="small muted">← 마이페이지</a>
      </header>

      {result && <p className={result.ok ? 'ok' : 'err'}>{result.text}</p>}

      <p className="label" style={{ margin: '14px 2px 8px' }}>대기 {pending.length}</p>
      {pending.length === 0 && <div className="card small muted">기다리는 요청이 없습니다.</div>}
      {pending.map((x) => (
        <div key={x.email} className="card">
          <p style={{ fontWeight: 700 }}>{x.nickname}</p>
          <p className="small muted" style={{ wordBreak: 'break-all' }}>{x.email} · {kst(x.requested_at)}</p>
          {x.note && <p className="small" style={{ marginTop: 8 }}>“{x.note}”</p>}
          <form action={decideSignup} style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <input type="hidden" name="email" value={x.email} />
            <button className="btn primary" type="submit" name="decision" value="approve" style={{ padding: 11 }}>승인</button>
            <button className="btn ghost" type="submit" name="decision" value="reject" style={{ padding: 11 }}>거절</button>
          </form>
        </div>
      ))}

      {done.length > 0 && (
        <>
          <p className="label" style={{ margin: '22px 2px 8px' }}>처리됨</p>
          <section className="card" style={{ paddingTop: 4, paddingBottom: 4 }}>
            {done.map((x) => (
              <div key={x.email} className="row">
                <span style={{ minWidth: 0 }}>
                  <span>{x.nickname}</span>
                  <span className="small muted" style={{ display: 'block', wordBreak: 'break-all' }}>{x.email}</span>
                </span>
                <span className="chip" style={x.status === 'approved' ? { color: 'var(--life)' } : undefined}>
                  {STATUS[x.status] ?? x.status}
                </span>
              </div>
            ))}
          </section>
        </>
      )}
    </main>
  )
}
