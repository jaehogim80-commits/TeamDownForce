import type { AccountType } from '@/lib/database.types'
import type { createClient } from '@/lib/supabase/server'

type Client = Awaited<ReturnType<typeof createClient>>

/**
 * 계정 유형과 회원 번호 (005). 화면은 signup_seq를 쓰지 않는다 —
 * signup_seq에는 창립자·개발자·테스터도 섞여 있어서 창립 멤버 판정에 쓸 수 없다.
 */
export type Membership = { account_type: AccountType; member_number: number | null; founding_member: boolean }

export async function getMembership(supabase: Client, userId: string): Promise<Membership> {
  const { data } = await supabase.rpc('membership', { p_user: userId })
  return data?.[0] ?? { account_type: 'member', member_number: null, founding_member: false }
}

export const TYPE_LABEL: Record<AccountType, string> = {
  member: '회원',
  founder: '창립자',
  developer: '개발자',
  tester: '테스터',
}

/** 프로필 옆 배지. 일반 회원 중 창립 멤버가 아니면 배지 없음 */
export function badgeOf(m: Membership): { text: string; accent: boolean } | null {
  if (m.account_type === 'founder') return { text: '창립자', accent: true }
  if (m.founding_member) return { text: '창립 멤버', accent: true }
  if (m.account_type === 'developer') return { text: '개발자', accent: false }
  if (m.account_type === 'tester') return { text: '테스터', accent: false }
  return null
}

/** '회원 #12' 같은 한 줄 표기 */
export function numberLabel(m: Membership): string {
  if (m.account_type === 'member') return m.member_number ? `회원 #${m.member_number}` : '회원'
  return TYPE_LABEL[m.account_type]
}
