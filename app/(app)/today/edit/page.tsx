import Link from 'next/link'
import { getViewer } from '@/lib/session'
import ChecklistEditor from './ChecklistEditor'

/** 오늘 › 체크리스트 편집 — 추가·수정·삭제를 모아 한 번에 저장한다 */
export default async function ChecklistEditPage() {
  const { supabase } = await getViewer()
  const { data: routines } = await supabase
    .from('routines')
    .select('id,title,axis,source,hint,window_start,window_end')
    .is('archived_at', null)
    .order('sort_order')

  const personal = (routines ?? []).filter((r) => r.source === 'personal')
  const crew = (routines ?? []).filter((r) => r.source !== 'personal')

  return (
    <main className="shell">
      <header className="header">
        <span className="brand">체크리스트 편집</span>
        <Link href="/today" className="small muted">← 오늘</Link>
      </header>

      <ChecklistEditor
        items={personal.map((r) => ({
          id: r.id,
          title: r.title,
          axis: r.axis,
          hint: r.hint ?? '',
          ws: r.window_start?.slice(0, 5) ?? '',
          we: r.window_end?.slice(0, 5) ?? '',
        }))}
      />

      {crew.length > 0 && (
        <>
          <p className="label" style={{ margin: '22px 2px 8px' }}>크루 루틴 · 여기서는 바꿀 수 없어요</p>
          {crew.map((r) => (
            <div key={r.id} className="edit-card ro">
              <span className="dot" style={{ background: `var(--${r.axis})` }} />
              <span>{r.title}</span>
            </div>
          ))}
        </>
      )}

      <p className="small muted" style={{ margin: '18px 2px 0' }}>
        삭제해도 지난 기록은 남습니다. Work/Life를 바꾸면 오늘 체크한 기록도 함께 바뀝니다.
        시간은 안내용이라 밖에서 체크해도 완료로 인정되고 &lsquo;시간 외&rsquo;만 표시됩니다.
      </p>
    </main>
  )
}
