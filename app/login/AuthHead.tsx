import './auth.css'

/** 가입·인증·재설정 화면 머리 — 뒤로 가기 + 워드마크 + 제목 */
export default function AuthHead({ title, lead }: { title: string; lead?: React.ReactNode }) {
  return (
    <>
      <a className="auth-back" href="/login">‹ 로그인</a>
      <p className="brand" style={{ marginTop: 22 }}>DOWNFORCE</p>
      <h1>{title}</h1>
      {lead && <p className="muted small lead">{lead}</p>}
    </>
  )
}
