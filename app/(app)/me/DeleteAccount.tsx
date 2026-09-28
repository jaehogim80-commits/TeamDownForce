'use client'

import { useState } from 'react'

export default function DeleteAccount() {
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function run() {
    setBusy(true)
    setMsg(null)
    const res = await fetch('/api/account/delete', { method: 'POST' })
    if (res.ok) {
      window.location.href = '/login'
      return
    }
    const body = await res.json().catch(() => ({}))
    setMsg(body.message ?? '탈퇴를 처리하지 못했습니다.')
    setBusy(false)
  }

  if (!open)
    return (
      <button className="small muted" style={{ display: 'block', margin: '18px auto 0' }} onClick={() => setOpen(true)}>
        회원 탈퇴
      </button>
    )

  return (
    <section className="card" style={{ boxShadow: 'inset 0 0 0 1.5px #5A2A1A' }}>
      <p style={{ fontWeight: 700, marginBottom: 6 }}>탈퇴하면 모든 기록이 즉시 삭제됩니다</p>
      <p className="small muted" style={{ marginBottom: 12 }}>
        스트릭·격자·루틴·사진이 복구 불가능하게 지워지고, 카카오 계정 연결도 해제됩니다. 다시 가입해도 회원 번호는 새로 매겨집니다.
      </p>
      <label className="field">
        <span>확인을 위해 &lsquo;탈퇴&rsquo;를 입력하세요</span>
        <input value={typed} onChange={(e) => setTyped(e.target.value)} />
      </label>
      {msg && <p className="err">{msg}</p>}
      <button className="btn" style={{ background: '#5A2A1A' }} disabled={typed !== '탈퇴' || busy} onClick={run}>
        {busy ? '처리 중…' : '탈퇴하기'}
      </button>
    </section>
  )
}
