'use client'

import { useState } from 'react'
import { signInWithKakao } from './actions'

// 카카오 심볼 — 디자인 가이드: 형태·비율·색상 변경 금지, 심볼 없이 버튼 구성 금지
function KakaoSymbol() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#000"
        d="M9 1.5C4.58 1.5 1 4.28 1 7.71c0 2.2 1.47 4.13 3.7 5.23l-.94 3.44c-.08.3.26.54.52.37l4.1-2.72c.2.02.41.03.62.03 4.42 0 8-2.78 8-6.35S13.42 1.5 9 1.5Z"
      />
    </svg>
  )
}

export default function LoginForm() {
  const [agree, setAgree] = useState(false)
  return (
    <form action={signInWithKakao}>
      <label className="check" style={{ marginBottom: 14 }}>
        <input type="checkbox" name="agree" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
        <span>
          만 14세 이상이며, <a href="/privacy" target="_blank">개인정보처리방침</a>을 확인하고 동의합니다.
        </span>
      </label>
      <button className="kakao" type="submit" disabled={!agree}>
        <KakaoSymbol />
        카카오 로그인
      </button>
    </form>
  )
}
