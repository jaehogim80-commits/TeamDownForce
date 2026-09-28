import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getViewer } from '@/lib/session'
import { TYPE_LABEL } from '@/lib/membership'
import { setAccountType } from '../actions'

export const dynamic = 'force-dynamic'

const RESULT: Record<string, { ok?: boolean; text: string }> = {
  ok: { ok: true, text: '바꿨습니다. 회원 번호가 다시 계산됐습니다.' },
  self: { text: '본인 계정의 구분은 바꿀 수 없습니다.' },
  founder_locked: { text: '창립자 계정은 바꿀 수 없습니다.' },
  not_found: { text: '계정을 찾지 못했습니다.' },
  invalid: { text: '잘못된 구분입니다.' },
  error: { text: '처리하지 못했습니다. 다시 시도해 주세요.' },
}

/**
 * 창립자 전용 — 계정 구분 관리.
 * 개발자·테스터로 바꾸면 창립 멤버 번호 계산에서 빠지고 뒷사람 번호가 당겨진다.
 * 탈퇴한 회원의 번호는 그대로 남는다 (승계 없음).
 */
export default async function AccountsPage({ searchParams }: { searchParams: Promise<{ r?: string }> }) {
  const { supabase, user } = await getViewer()
  const { data: founder } = await supabase.rpc('is_founder')
  if (!founder) notFound()

  const { r } = await searchParams
  const result = r ? RESULT[r] : undefined
  const { data: rows } = await supabase.rpc('admin_list_accounts')
  const list = rows ?? []
  const members = list.filter((x) => x.account_type === 'member')
  const founding = members.filter((x) => (x.member_number ?? 99) <= 30).length

  return (
    <main className="shell">
      <header className="header">
        <span className="brand">계정 관리</span>
        <Link href="/me" className="small muted">← 마이페이지</Link>
      </header>

      <section className="card stats">
        <div><b>{members.length}</b><span className="small muted">회원</span></div>
        <div><b>{founding}<small className="muted" style={{ fontSize: 13 }}>/30</small></b><span className="small muted">창립 멤버</span></div>
        <div><b>{list.length - members.length}</b><span className="small muted">운영·테스트</span></div>
      </section>
      <p className="small muted" style={{ margin: '0 2px 12px' }}>
        창립자·개발자·테스터는 회원 번호를 받지 않아 창립 멤버 30명에 포함되지 않습니다.
      </p>

      {result && <p className={result.ok ? 'ok' : 'err'}>{result.text}</p>}

      {list.map((x) => (
        <div key={x.id} className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontWeight: 700 }}>{x.display_name} <span className="small muted">@{x.handle}</span></p>
              <p className="small muted" style={{ wordBreak: 'break-all' }}>{x.email ?? '이메일 없음'}</p>
            </div>
            <span className="chip" style={{ alignSelf: 'flex-start', ...(x.account_type === 'founder' || (x.member_number ?? 99) <= 30 ? { color: 'var(--fire)' } : {}) }}>
              {x.account_type === 'member' ? `#${x.member_number}` : TYPE_LABEL[x.account_type]}
            </span>
          </div>
          {x.account_type !== 'founder' && x.id !== user.id && (
            <form action={setAccountType} style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <input type="hidden" name="id" value={x.id} />
              <select name="type" defaultValue={x.account_type} className="select" aria-label={`${x.display_name} 구분`}>
                <option value="member">회원</option>
                <option value="developer">개발자</option>
                <option value="tester">테스터</option>
              </select>
              <button className="btn ghost" type="submit" style={{ width: 'auto', padding: '0 16px' }}>변경</button>
            </form>
          )}
        </div>
      ))}
    </main>
  )
}
