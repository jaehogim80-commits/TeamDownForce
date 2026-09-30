import type { FeedEmoji, FeedReportReason } from '@/lib/database.types'

/** 피드 이모지 — 정해진 셋만 (댓글 없음 · 결정요약 2-5). 🔥는 브랜드의 불꽃 */
export const EMOJI: { key: FeedEmoji; char: string; label: string }[] = [
  { key: 'fire', char: '🔥', label: '불꽃' },
  { key: 'clap', char: '👏', label: '박수' },
  { key: 'muscle', char: '💪', label: '힘' },
]
export const isEmoji = (v: unknown): v is FeedEmoji => v === 'fire' || v === 'clap' || v === 'muscle'

export const REPORT_REASONS: { key: FeedReportReason; label: string }[] = [
  { key: 'spam', label: '광고·도배' },
  { key: 'abuse', label: '욕설·비방' },
  { key: 'private', label: '개인정보 노출' },
  { key: 'other', label: '기타' },
]
export const isReason = (v: unknown): v is FeedReportReason =>
  v === 'spam' || v === 'abuse' || v === 'private' || v === 'other'

/** '3분 전' 같은 상대 시각. now는 서버가 한 번 정해 내려준다 (화면마다 흔들리지 않게) */
export function ago(iso: string, now: number) {
  const s = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000))
  if (s < 60) return '방금'
  if (s < 3600) return `${Math.floor(s / 60)}분 전`
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`
  const d = Math.floor(s / 86400)
  return d === 1 ? '어제' : `${d}일 전`
}

export const PAGE_SIZE = 20
