// 날짜를 만드는 곳은 여기 하나뿐이어야 한다 (구축지시서 4.1)
// local_date는 한 번 쓰이면 절대 재계산하지 않는다 — 그래서 계산 지점이 하나여야 한다.

export function localDate(now: Date, timezone: string, cutoffHour: number): string {
  const shifted = new Date(now.getTime() - cutoffHour * 3600_000)
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(shifted) // YYYY-MM-DD
}

export function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + n))
  return t.toISOString().slice(0, 10)
}

export function daysBetween(a: string, b: string): number {
  const toUtc = (s: string) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d) }
  return Math.round((toUtc(b) - toUtc(a)) / 86_400_000)
}

/** 그 주 월요일 (월~일 기준) */
export function weekStart(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay() // 0=일
  return addDays(ymd, dow === 0 ? -6 : 1 - dow)
}

const WD = ['일', '월', '화', '수', '목', '금', '토']
export function weekdayKo(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  return WD[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
}

// ── 달력 표시용 (기록 탭). 체크인 local_date 계산과는 무관하다 ──

/** 'YYYY-MM' 형식이고 2000~2100년이면 true */
export function isYm(s: string | undefined): s is string {
  return !!s && /^(20\d\d|2100)-(0[1-9]|1[0-2])$/.test(s)
}

/** 'YYYY-MM-DD' 형식이고 실제로 있는 날짜면 true */
export function isYmd(s: string | undefined): s is string {
  if (!s || !/^(20\d\d|2100)-\d\d-\d\d$/.test(s)) return false
  const [y, m, d] = s.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d))
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d
}

/** 'YYYY-MM'에 n개월을 더한다 */
export function addMonths(ym: string, n: number): string {
  const [y, m] = ym.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1 + n, 1))
  return t.toISOString().slice(0, 7)
}

/** 그 달의 마지막 날 'YYYY-MM-DD' */
export function monthEnd(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return `${ym}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`
}

export function labelKo(ymd: string): string {
  const [, m, d] = ymd.split('-').map(Number)
  return `${m}월 ${d}일 ${weekdayKo(ymd)}요일`
}

/** 하루의 경계 표시 — 0 = 자정, 1~6 = 새벽 N시 */
export function cutoffLabel(h: number): string {
  return h === 0 ? '자정' : `새벽 ${h}시`
}
