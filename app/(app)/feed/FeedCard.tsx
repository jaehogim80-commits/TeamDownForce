'use client'

import { useState, useTransition } from 'react'
import type { FeedEmoji, FeedRow } from '@/lib/database.types'
import { EMOJI, REPORT_REASONS, ago } from '@/lib/feed'
import { deletePost, importPost, muteUser, react, reportPost } from './actions'

const hm = (t: string | null) => (t ? t.slice(0, 5) : '')

type Take = 'idle' | 'imported' | 'already' | 'exists' | 'gone'
const TAKE_LABEL: Record<Take, string> = {
  idle: '가져오기',
  imported: '가져옴 ✓',
  already: '가져옴 ✓',
  exists: '이미 있음',
  gone: '사라진 글',
}

/**
 * 피드 한 장. 참고한 것과 뺀 것 (결정요약 2장)
 * - Strava kudos: 한 번 누르는 반응 → 정해진 이모지 셋 중 하나
 * - Pinterest 저장: 남의 것을 내 것으로 → 가져오기 (메모는 안 옴)
 * - Instagram 좋아요 숨기기: 인기 경쟁 방지 → 가져간 수는 올린 사람에게만
 * - Duolingo 피드의 모르는 사람 과다 → 이 사람 숨기기
 * - 댓글·팔로워 수·조회수는 넣지 않는다
 */
export default function FeedCard({ row, now }: { row: FeedRow; now: number }) {
  const [mine, setMine] = useState<FeedEmoji | null>(row.my_reaction)
  const [counts, setCounts] = useState({ fire: row.fire, clap: row.clap, muscle: row.muscle })
  const [take, setTake] = useState<Take>(row.imported_by_me ? 'already' : 'idle')
  const [menu, setMenu] = useState<'closed' | 'open' | 'report'>('closed')
  const [gone, setGone] = useState<'' | 'deleted' | 'muted' | 'reported'>('')
  const [pending, start] = useTransition()

  if (gone) {
    const msg = { deleted: '글을 내렸습니다.', muted: `${row.display_name}님의 글을 더 보지 않습니다.`, reported: '신고했습니다. 확인 후 조치합니다.' }[gone]
    return <p className="card small muted">{msg}</p>
  }

  const tap = (key: FeedEmoji) => {
    if (row.is_mine) return
    const next = mine === key ? null : key
    const prev = mine
    setMine(next)
    setCounts((c) => {
      const n = { ...c }
      if (prev) n[prev] -= 1
      if (next) n[next] += 1
      return n
    })
    start(async () => {
      const r = await react(row.id, next)
      if (!r.ok) {
        // 되돌린다
        setMine(prev)
        setCounts({ fire: row.fire, clap: row.clap, muscle: row.muscle })
      }
    })
  }

  return (
    <article className={`card post ${row.axis}`}>
      <header className="post-head">
        <span className="avatar" aria-hidden="true">
          {row.avatar_url ? <img src={row.avatar_url} alt="" loading="lazy" referrerPolicy="no-referrer" /> : row.display_name.slice(0, 1)}
        </span>
        <span className="post-who">
          <b>{row.display_name}</b>
          <span className="small muted">
            @{row.handle} · {ago(row.created_at, now)}
            {row.streak > 1 && <> · 연속 {row.streak}일</>}
          </span>
        </span>
        <button
          type="button"
          className="post-more"
          aria-label="더보기"
          aria-expanded={menu !== 'closed'}
          onClick={() => setMenu(menu === 'closed' ? 'open' : 'closed')}
        >
          ⋯
        </button>
      </header>

      <div className="post-body">
        <p className="post-title">{row.title}</p>
        <p className="post-tags">
          <span className="ax">{row.axis === 'work' ? 'Work' : 'Life'}</span>
          {row.window_start && row.window_end && <span>{hm(row.window_start)}–{hm(row.window_end)}</span>}
        </p>
      </div>
      {row.caption && <p className="post-caption">{row.caption}</p>}

      <footer className="post-foot">
        {EMOJI.map((e) => (
          <button
            key={e.key}
            type="button"
            className="react"
            aria-pressed={mine === e.key}
            aria-label={`${e.label} ${counts[e.key]}`}
            disabled={row.is_mine || row.hidden}
            onClick={() => tap(e.key)}
          >
            {e.char}
            <b>{counts[e.key] > 0 ? counts[e.key] : ''}</b>
          </button>
        ))}
        {!row.is_mine && (
          <button
            type="button"
            className="take"
            disabled={take !== 'idle' || pending}
            onClick={() =>
              start(async () => {
                const r = await importPost(row.id)
                setTake(r === 'imported' ? 'imported' : r === 'already' ? 'already' : r === 'exists' ? 'exists' : 'gone')
              })
            }
          >
            {TAKE_LABEL[take]}
          </button>
        )}
      </footer>

      {take === 'imported' && <p className="post-note">내 체크리스트 {row.axis === 'work' ? 'Work' : 'Life'}에 추가했어요. 오늘 탭에서 바로 체크할 수 있어요.</p>}
      {take === 'exists' && <p className="post-note">같은 이름의 루틴이 이미 내 체크리스트에 있어요.</p>}
      {row.is_mine && row.hidden && <p className="post-note">신고가 쌓여 숨겨졌어요. 다른 사람에게는 보이지 않습니다.</p>}
      {row.is_mine && !row.hidden && (row.import_count ?? 0) > 0 && (
        <p className="post-note me">{row.import_count}명이 내 체크리스트로 가져갔어요 · 나에게만 보여요</p>
      )}

      {menu === 'open' && (
        <div className="post-menu">
          {row.is_mine ? (
            <button
              type="button"
              className="danger"
              onClick={() => start(async () => { await deletePost(row.id); setGone('deleted') })}
            >
              삭제
            </button>
          ) : (
            <>
              <button type="button" onClick={() => start(async () => { await muteUser(row.user_id); setGone('muted') })}>
                숨기기
              </button>
              <button type="button" className="danger" onClick={() => setMenu('report')}>신고</button>
            </>
          )}
          <button type="button" onClick={() => setMenu('closed')}>닫기</button>
        </div>
      )}
      {menu === 'report' && (
        <div className="post-menu" role="group" aria-label="신고 사유">
          {REPORT_REASONS.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => start(async () => { const x = await reportPost(row.id, r.key); if (x.ok) setGone('reported') })}
            >
              {r.label}
            </button>
          ))}
          <button type="button" onClick={() => setMenu('closed')}>취소</button>
        </div>
      )}
    </article>
  )
}
