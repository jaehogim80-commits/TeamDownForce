import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

/**
 * 회원 탈퇴
 * 1) 카카오로 가입한 회원이면 카카오 연결 해제 (카카오 정책상 필수 — 2026-08-24 데브톡 공식 답변)
 * 2) Supabase 사용자 삭제 → profiles 이하 전부 cascade (탈퇴 cascade 결함은 001에서 수정됨)
 *
 * 순서가 중요하다: 카카오 해제가 실패하면 삭제하지 않는다. 반대로 하면 우리 쪽 기록은 지워졌는데
 * 카카오에는 연결이 남아, 해제할 회원번호를 다시 찾을 방법이 없어진다.
 */
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ message: '로그인이 필요합니다.' }, { status: 401 })

  const admin = createAdminClient()
  if (!admin) {
    return NextResponse.json(
      { message: '탈퇴 기능이 아직 설정되지 않았습니다 (서버 키 미등록). 운영팀에 문의해 주세요.' },
      { status: 503 },
    )
  }

  const kakao = user.identities?.find((i) => i.provider === 'kakao')
  if (kakao) {
    const adminKey = process.env.KAKAO_ADMIN_KEY
    if (!adminKey) {
      return NextResponse.json({ message: '카카오 연결 해제 설정이 없습니다. 운영팀에 문의해 주세요.' }, { status: 503 })
    }
    const res = await fetch('https://kapi.kakao.com/v1/user/unlink', {
      method: 'POST',
      headers: {
        Authorization: `KakaoAK ${adminKey}`,
        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
      },
      body: new URLSearchParams({ target_id_type: 'user_id', target_id: kakao.id }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      // -101: 이미 연결이 끊긴 사용자 — 목표 상태와 같으므로 계속 진행
      if (body?.code !== -101) {
        return NextResponse.json({ message: '카카오 연결 해제에 실패했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 502 })
      }
    }
  }

  const { error } = await admin.auth.admin.deleteUser(user.id)
  if (error) return NextResponse.json({ message: '탈퇴 처리 중 오류가 발생했습니다.' }, { status: 500 })

  await supabase.auth.signOut()
  return NextResponse.json({ ok: true })
}
