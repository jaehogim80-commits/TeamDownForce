// 지금 할 항목 고르기 — 서버(첫 화면)와 클라이언트(30초마다)가 같은 계산을 쓴다.
// 시간 판정은 DB의 in_window(008)와 같다 — 시작 포함, 끝 미포함, 자정을 넘는 시간 지원.

export type FocusItem = { id: string; ws: string | null; we: string | null; done: boolean }

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))

export function minutesIn(timeZone: string, d = new Date()): number {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d)
  const h = Number(p.find((x) => x.type === 'hour')?.value ?? 0)
  const m = Number(p.find((x) => x.type === 'minute')?.value ?? 0)
  return h * 60 + m
}

export function pickFocus(items: FocusItem[], now: number): string | null {
  let best: { id: string; left: number } | null = null
  for (const it of items) {
    if (it.done || !it.ws || !it.we) continue
    const s = toMin(it.ws), e = toMin(it.we)
    const inside = s < e ? now >= s && now < e : now >= s || now < e
    if (!inside) continue
    const left = (e - now + 1440) % 1440 || 1440
    if (!best || left < best.left) best = { id: it.id, left }
  }
  return best?.id ?? null
}
