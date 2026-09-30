import { signInWithEmail } from './actions'

/** 이메일 로그인 — 평소엔 버튼 하나로 접어 두고, 누르면 펼친다 (자바스크립트 없이 details로) */
export default function EmailLogin({ open }: { open: boolean }) {
  return (
    <details className="email-box" open={open}>
      <summary className="btn ghost">이메일</summary>
      <form action={signInWithEmail}>
        <label className="field">
          <span>이메일</span>
          <input name="email" type="email" autoComplete="email" maxLength={254} required />
        </label>
        <label className="field">
          <span>비밀번호</span>
          <input name="password" type="password" autoComplete="current-password" maxLength={72} required />
        </label>
        <button className="btn primary" type="submit">로그인</button>
      </form>
      <p className="auth-links">
        <a href="/login/signup">가입</a>
        <a href="/login/forgot">비밀번호 찾기</a>
      </p>
    </details>
  )
}
