/**
 * D 바퀴 — 둥근 바퀴가 화면 왼쪽 밖에서 오른쪽으로 달려 들어오고, 뒤로 늘어진 주황 빛 꼬리가 따라온다.
 * 꼬리의 뒤끝은 평평하게 잘려 있어서, 바퀴(둥근 앞) + 꼬리(평평한 뒤) = D.
 * 달릴 때는 꼬리가 길게 늘어났다가, 멈추면서 D 비율로 줄어든다 (속도가 떨어지면 빛 꼬리도 짧아진다).
 * 꼬리의 앞끝은 항상 바퀴 중심에 붙어 있다 — brand.css의 dw-run / dw-trail 키프레임이 같은 시점·같은 이동값을 쓴다.
 */
const R = 40 // 바퀴 반지름
const GROUND = 150 // 노면 y
const CX = 200 // 멈춘 뒤 바퀴 중심 x — D 전체가 화면 가운데 오도록
const TAIL = 48 // 멈춘 뒤 꼬리 길이 — D의 너비(TAIL + R) ≈ 높이(2R)
const TAIL_X = CX - TAIL // 꼬리의 평평한 뒤끝 x (D의 세로획)
const CY = GROUND - R

export default function DWheel() {
  const spokes = [0, 72, 144, 216, 288]
  return (
    <svg className="dwheel" viewBox="0 0 390 190" role="img" aria-label="D 모양으로 달리는 바퀴">
      <defs>
        <linearGradient id="dw-tail" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#C23B10" />
          <stop offset="0.55" stopColor="#F5511E" />
          <stop offset="1" stopColor="#FFB23A" />
        </linearGradient>
        {/* 꼬리 안의 스피드라인 — 실루엣은 유지하고 결만 준다 */}
        <pattern id="dw-lines" width="12" height="9" patternUnits="userSpaceOnUse">
          <rect width="12" height="2" y="3" fill="#141210" opacity="0.28" />
        </pattern>
        <radialGradient id="dw-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#F5511E" stopOpacity="0.35" />
          <stop offset="1" stopColor="#F5511E" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* 노면 */}
      <line x1="0" x2="390" y1={GROUND + 1} y2={GROUND + 1} stroke="#332E26" strokeWidth="2" />
      <g className="dw-lane">
        {Array.from({ length: 12 }, (_, i) => (
          <rect key={i} x={i * 40} y={GROUND + 22} width="20" height="3" rx="1.5" fill="#2B271F" />
        ))}
      </g>

      {/* 열기 */}
      <ellipse className="dw-glow" cx={CX} cy={CY} rx="120" ry="70" fill="url(#dw-glow)" />

      {/* 꼬리 — 뒤끝은 평평하게 잘린다 */}
      <g className="dw-tail" style={{ transformOrigin: `${CX}px 0` }}>
        <rect x={TAIL_X} y={GROUND - 2 * R} width={CX - TAIL_X} height={2 * R} fill="url(#dw-tail)" />
        <rect x={TAIL_X} y={GROUND - 2 * R} width={CX - TAIL_X} height={2 * R} fill="url(#dw-lines)" />
      </g>

      {/* 바퀴 — D의 둥근 앞 */}
      <g className="dw-wheel">
        <circle cx={CX} cy={CY} r={R} fill="#FFB23A" />
        <circle cx={CX} cy={CY} r={R - 7} fill="#141210" />
        <g className="dw-spokes" style={{ transformOrigin: `${CX}px ${CY}px` }}>
          {spokes.map((a) => (
            <line
              key={a}
              x1={CX}
              y1={CY}
              x2={CX + (R - 9) * Math.cos((a * Math.PI) / 180)}
              y2={CY + (R - 9) * Math.sin((a * Math.PI) / 180)}
              stroke="#F5511E"
              strokeWidth="3"
              strokeLinecap="round"
            />
          ))}
          <circle cx={CX} cy={CY} r="5" fill="#F5511E" />
        </g>
      </g>
    </svg>
  )
}
