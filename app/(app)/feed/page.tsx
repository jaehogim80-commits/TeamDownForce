import Link from 'next/link'
import { getViewer } from '@/lib/session'
import { PAGE_SIZE } from '@/lib/feed'
import FeedCard from './FeedCard'
import './feed.css'

/**
 * 피드 — DownForce 전체에 공개된, 본인이 고른 기록만 (결정요약 2장).
 * 시간순. 무한 스크롤 대신 '더 보기' — 절제된 규율과 맞지 않는 끝없는 스크롤은 쓰지 않는다.
 * 하루 게시물이 약 50개를 넘으면 내 체크리스트와 겹치는 단어 순으로 바꾼다 (지금은 아님).
 */
export default async function FeedPage({ searchParams }: { searchParams: Promise<{ before?: string }> }) {
  const { supabase } = await getViewer()
  const { before } = await searchParams
  const cursor = before && !Number.isNaN(Date.parse(before)) ? before : null

  const { data: rows } = await supabase.rpc('feed_page', { p_before: cursor, p_limit: PAGE_SIZE })
  const list = rows ?? []
  const now = Date.now()
  const last = list.length === PAGE_SIZE ? list[list.length - 1].created_at : null

  return (
    <main className="shell">
      <header className="header">
        <span className="brand">피드</span>
        <span className="small muted">모두에게 공개된 오늘의 기록</span>
      </header>

      {cursor && (
        <Link href="/feed" className="feed-more" style={{ marginBottom: 8 }}>
          ↑ 최신으로
        </Link>
      )}

      {list.length === 0 ? (
        <section className="card feed-empty">
          <b>{cursor ? '더 지난 기록이 없어요.' : '아직 올라온 기록이 없어요.'}</b>
          <p className="small muted">
            오늘 탭에서 체크한 항목의 <b style={{ display: 'inline', color: 'var(--work)' }}>올리기</b>를 누르면 여기에 나타납니다.
            <br />
            고른 것만 올라가고, 나머지는 나만 봅니다.
          </p>
        </section>
      ) : (
        list.map((r) => <FeedCard key={r.id} row={r} now={now} />)
      )}

      {last && (
        <Link href={`/feed?before=${encodeURIComponent(last)}`} className="feed-more">
          더 보기
        </Link>
      )}
    </main>
  )
}
