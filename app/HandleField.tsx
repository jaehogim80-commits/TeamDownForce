'use client'

/**
 * 핸들 입력 — 대문자를 쳐도 바로 소문자로 바뀐다 (서버도 한 번 더 소문자로 바꾼다).
 * 핸들 = 겹치지 않는 공개 아이디. 이름(닉네임)은 겹쳐도 되지만 핸들은 한 사람뿐이다.
 */
export default function HandleField({ defaultValue }: { defaultValue: string }) {
  return (
    <label className="field">
      <span>핸들 · 영문 소문자·숫자·밑줄 3~20자</span>
      <input
        name="handle"
        defaultValue={defaultValue}
        placeholder="jaeho_kim"
        pattern="[a-z0-9_]{3,20}"
        maxLength={20}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        required
        onInput={(e) => {
          const el = e.currentTarget
          const lower = el.value.toLowerCase()
          if (lower !== el.value) {
            const pos = el.selectionStart
            el.value = lower
            if (pos !== null) el.setSelectionRange(pos, pos)
          }
        }}
      />
      <small className="muted" style={{ display: 'block', fontSize: 12, lineHeight: 1.5, marginTop: 6 }}>
        나만 쓰는 공개 아이디(@핸들)예요. 이름은 다른 사람과 겹칠 수 있지만 핸들은 하나뿐이라, 크루 초대나 공유 카드에서 나를 정확히 찾을 때 씁니다.
      </small>
    </label>
  )
}
