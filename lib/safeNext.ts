/**
 * 로그인 뒤 돌아갈 주소 — 우리 사이트 안의 경로만 허용한다 (열린 리디렉션 방지).
 * '//evil.com'이나 '/\evil.com'처럼 다른 사이트로 새는 모양은 전부 기본값으로.
 */
const ALLOWED = ['/today', '/login/reset', '/onboarding', '/me']

export function safeNext(next: string | null, fallback = '/today') {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return fallback
  return ALLOWED.some((p) => next === p || next.startsWith(p + '/') || next.startsWith(p + '?')) ? next : fallback
}
