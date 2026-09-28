/**
 * DownForce 규칙 상수 — 한 곳에 모은다.
 * 여기 있는 값은 마이그레이션 없이 배포만으로 바뀐다. DB에 두지 않는 이유가 이것이다.
 * 근거는 제품설계 v3.1의 해당 절 번호를 각주로 달아둔다.
 */
export const RULES = {
  streak: {
    /** Life만 기록한 날도 스트릭을 유지한다 (5.2) */
    countsLifeAsActive: true,
    /** 단, 뱃지·티어는 work_count 기준 (5.2) */
    rewardsRequireWork: true,
    graceDays: 0,
  },

  day: {
    /** 하루 경계 기본값 = 자정 (3-A) */
    defaultCutoffHour: 0,
    cutoffRange: [0, 6] as const,
    /** 변경은 다음 날부터. 오늘 행은 쓸 수 없다 — RLS가 강제 (3-A.1) */
    cutoffAppliesFrom: 'tomorrow' as const,
  },

  crew: {
    capacityMin: 3, capacityMax: 7, capacityDefault: 5,
    /**
     * 주간 목표 = 활성 멤버 × 배수 (올림). 단위는 "칸" (7.1-a)
     * 값은 전부 3.0이지만 자리를 나눠둔다 — 확장 시 공부·창작은 4.5~5.5 (7.1-b)
     */
    weeklyPerMember: {
      default: 3.0,
      '러닝': 3.0, '헬스·웨이트': 3.0, '홈트': 3.0, '등산·트레일': 3.0,
      '수영': 3.0, '자전거': 3.0, '요가·필라테스': 3.0, '기타': 3.0,
    } as Record<string, number>,
    /** 게이지 길이 = 활성 멤버 × 7칸. 목표는 그 위의 눈금 (7.7) */
    gaugeMaxPerMember: 7,
    /** 주간 목표는 주 중에 오르지 않는다. 내려가기만 (6.6-a) */
    targetMonotonicDown: true,
    inactiveDays: 14,
    termWeeks: 4,
    seasonWeeks: 12,
    pitStopsPerSeason: 3,
    joinRequestTtlHours: 48,
    minCrewsForFilterUI: 20,
    /** 주 마감은 하루 뒤에 확정 — 경계가 늦은 멤버 보호 (3-A.3) */
    weekCloseDelayDays: 1,
  },

  invite: {
    /** 크루 권유는 7일 스트릭 시점 (6.8) */
    crewPromptAfterStreakDays: 7,
  },

  photo: {
    /** 선택. 없어도 체크·스트릭 정상 (4-A.2) */
    required: false,
    /** 갤러리 허용. 즉시 촬영 강제 안 함 (4-A.2) */
    allowGallery: true,
    maxPerCheckin: 1,
    resizeLongEdge: 1080,
    thumbLongEdge: 200,
    jpegQuality: 0.75,
    /** EXIF는 촬영 시각만 남기고 전부 제거. GPS는 반드시 (4-A.3) */
    keepExif: ['DateTimeOriginal'] as const,
    retainOriginalDays: 90,
  },

  slot: {
    /** 화면당 한 자리. 보여줄 게 없으면 숨긴다 (5-C) */
    maxPerScreen: 1,
    maxPerDay: 1,
    muteDaysOnDismiss: 14,
    /** 1차에는 시스템 권유만. 광고·제휴 금지 (5-C) */
    allowSponsored: false,
  },

  categories: ['러닝','헬스·웨이트','홈트','등산·트레일','수영','자전거','요가·필라테스','기타'],
  keywords: {
    시간대: ['새벽','아침','점심','저녁'],
    대상: ['초보환영','직장인','주말만'],
    분위기: ['조용히','빡세게','인증만'],
    지역: ['서울','경기','온라인'],
  },

  /**
   * 브랜드 · 축 색상 (제품설계 5-G). 24개 대비·색각이상 검사 전부 통과.
   * 다크는 중성 회색이 아니라 따뜻한 베이스다 — 주황 브랜드와 같은 온도.
   */
  color: {
    // 다크 (앱 기본)
    bg:          '#141210',
    card:        '#23201A',
    card2:       '#2B271F',   // 격자 빈칸도 이 값
    line:        '#332E26',
    ink:         '#F2EFE9',   // 16.28
    muted:       '#8A8579',   //  5.08
    dim:         '#666155',   //  3.03
    // 축
    work:        '#F5511E',   // 다크 5.41 / 화이트 3.45
    life:        '#2F8FD8',   // 다크 5.38 / 화이트 3.48
    fire:        '#FFD24A',   // 퍼펙트 위크 (5-B)
    // 라이트 (공유 이미지 · 인스타 피드)
    bgLight:     '#FFFFFF',
    surfLight:   '#F7F7F8',
    emptyLight:  '#E8E8EC',
    inkLight:    '#18181B',
    mutedLight:  '#71717A',
    workOnLight: '#C23B10',   // 5.35
    lifeOnLight: '#22689C',   // 5.95
  },

  /**
   * ⚠️ 흰 배경 대비와 다크 배경 대비는 반비례한다. 두 값이 같아지는 지점이 4.33이므로
   *    양쪽 모두 본문 기준(4.5)을 넘는 색은 존재하지 않는다.
   *    workOnLight · lifeOnLight는 취향이 아니라 구조상 강제되는 것이다.
   * ⚠️ 불은 주황 계열이라 work와 뭉친다. #FF8A2B 초안은 중적색약에서 ΔE 8.5로
   *    사실상 구분 불가였다. #FFD24A로 올려 20.1을 확보했다.
   *    그래도 색만으로 구분시키지 말 것 — 애니메이션 또는 테두리를 동반한다 (5-B).
   */
  colorConstraints: {
    dualBackgroundCeiling: 4.33,
    minAxisSeparationDeltaE: 20,
    fireNeedsNonColorCue: true,
  },

  /** 초기 한정 뱃지 — 이중 구조 (제품설계 5-F) */
  founding: {
    /** 개척자: 서비스 오픈 후 N일 안에 가입 */
    pioneerDays: 90,
    /**
     * 창립 멤버: 회원 번호 N번 이내. 회원 번호 = member_ledger 기준 (005).
     * 창립자·개발자·테스터는 번호를 받지 않는다 → 창립 멤버 30명에 포함되지 않는다.
     * DB 함수 public.membership()에 같은 값(30)이 들어 있다 — 바꾸면 둘 다 바꾼다.
     */
    founderSeq: 30,
    /**
     * 탈퇴해도 뒷사람이 승계하지 않는다. 번호는 자리가 아니라 사실이다 (장부 행이 남는다).
     * 예외: 창립자가 계정을 개발자·테스터로 재분류하면 그 번호는 계산에서 빠진다.
     */
    reassignOnLeave: false,
  },

  /** 슬로건 — 단일화 (미결 7 해결). 다른 카피는 캠페인용이며 이 자리에 오지 않는다 */
  slogan: 'Work Hard. Live Yours.',

  kpi: {
    d30Retention: 0.30,
    dailyCardSaveRate: 0.40,
    weeklyGridShareRate: 0.15,
    crewCreateRate: 0.30,
    crewFormCompleteRate: 0.80,
    avgRecordDaysPerWeek: 3.5,
  },
} as const;

/** 크루 주간 목표 (칸). 활성 멤버 수와 카테고리로 계산 */
export function crewWeeklyTarget(activeMembers: number, category: string): number {
  const m = RULES.crew.weeklyPerMember[category] ?? RULES.crew.weeklyPerMember.default;
  return Math.ceil(activeMembers * m);
}

/** 게이지 최대치 (칸) */
export function crewGaugeMax(activeMembers: number): number {
  return activeMembers * RULES.crew.gaugeMaxPerMember;
}
