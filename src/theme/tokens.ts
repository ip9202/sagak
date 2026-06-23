/**
 * Design Tokens - pages_11 §2-8
 * Single Source of Truth for all design values
 */

export const colors = {
  brand: {
    50: '#FDF7EE',
    100: '#F8EDD8',
    200: '#F0D8A8',
    300: '#E6B96A',
    400: '#D4943D',
    500: '#C17B2F',
  },
  bg: {
    base: '#FDFAF5',
    surface: '#FFFFFF',
    muted: '#F4EFE8',
    overlay: 'rgba(45,31,14,0.40)' as const,
  },
  text: {
    primary: '#2D1F0E',
    secondary: '#7A6350',
    tertiary: '#A89585',
    disabled: '#C8B8A8',
    inverse: '#FDFAF5',
    brand: '#C17B2F',
  },
  border: {
    default: '#E8DDD0',
    strong: '#C8B8A8',
    brand: '#C17B2F',
  },
  semantic: {
    success: '#4A8C6A',
    error: '#C94040',
    warning: '#E8A020',
    info: '#3A7DB5',
  },
  spoiler: {
    blur: 'blur(12px)',
    labelBg: 'rgba(45,31,14,0.90)' as const,
  },
} as const;

export const spacing = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
} as const;

// @MX:NOTE: [AUTO] SPEC-NAV-001/F03-Home 토큰 전용 준수(SPEC-UI-002 FROZEN)를 위해
// displaySm / alarmTitle / sectionLabel 세 토큰을 추가. fontSize 오름차순 정렬 유지.
export const typography = {
  displayLg: { fontSize: 28, fontWeight: '700' as const, lineHeight: 36 },
  displayMd: { fontSize: 24, fontWeight: '700' as const, lineHeight: 32 },
  // @MX:NOTE: [AUTO] 화면 타이틀 균일성(SPEC-UI-002 FROZEN: 22/700). 홈 탭 헤더 등.
  displaySm: { fontSize: 22, fontWeight: '700' as const, lineHeight: 30 },
  headingLg: { fontSize: 20, fontWeight: '700' as const, lineHeight: 28 },
  headingMd: { fontSize: 18, fontWeight: '600' as const, lineHeight: 26 },
  headingSm: { fontSize: 16, fontWeight: '600' as const, lineHeight: 23 },
  // @MX:NOTE: [AUTO] AlarmCard 타이틀(F03-Home). lineHeight 21 ≈ 15 * 1.4.
  alarmTitle: { fontSize: 15, fontWeight: '600' as const, lineHeight: 21 },
  // @MX:NOTE: [AUTO] SPEC-EMOTION-001 P1-B — 감정 입력 프롬프트/입력 본문(15/400). alarmTitle(15/600)과 가중치가 다르고 bodyMd(14/400)와 크기가 달라 추가.
  bodyPrompt: { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
  bodyLg: { fontSize: 16, fontWeight: '400' as const, lineHeight: 26 },
  bodyMd: { fontSize: 14, fontWeight: '400' as const, lineHeight: 22 },
  // @MX:NOTE: [AUTO] CTA 라벨(14/600). bodyMd(14/400) 보다 강조된 버튼 텍스트.
  ctaLabel: { fontSize: 14, fontWeight: '600' as const, lineHeight: 22 },
  // @MX:NOTE: [AUTO] 섹션 라벨(13/600). bodySm(13/400) 와 동일 크기, 가중치 600.
  sectionLabel: { fontSize: 13, fontWeight: '600' as const, lineHeight: 18 },
  bodySm: { fontSize: 13, fontWeight: '400' as const, lineHeight: 20 },
  caption: { fontSize: 12, fontWeight: '400' as const, lineHeight: 17 },
  label: { fontSize: 11, fontWeight: '500' as const, lineHeight: 14 },
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

// @MX:NOTE: [AUTO] 테두리 두께 토큰 (SPEC-UI-002 FROZEN — borderWidth 수치 하드코딩 금지).
//           hairline(1px) 은 입력 필드/카드 테두리의 표준 두께. BookDetailScreen/EmotionRecordCard
//           등 기존 코드의 borderWidth:1 하드코딩을 P3 전역 정정에서 이 토큰으로 통일 예정.
export const borderWidth = {
  hairline: 1,
} as const;

// @MX:NOTE: [AUTO] 컨트롤 최소 높이 토큰 (SPEC-UI-002 FROZEN). 다중 줄 텍스트 입력(contentInput)의
//           최소 높이 등 컴포넌트 고유 레이아웃 값. spacing 체계(4의 배수)로 표현 불가한 값.
// @MX:NOTE: [AUTO] SPEC-COMPLETION-001 P1-C — button(44): 완독 리포트 재시도 버튼 최소 탭 영역.
//           접근성 권장 최소 탭타겟 44pt. spacing(4의 배수)으로 표현 불가.
export const minHeight = {
  input: 100,
  button: 44,
} as const;

export const shadow = {
  sm: '0 1px 3px rgba(45,31,14,0.08)',
  md: '0 4px 12px rgba(45,31,14,0.12)',
  lg: '0 8px 24px rgba(45,31,14,0.16)',
} as const;

export const motion = {
  duration: {
    fast: 150,
    normal: 250,
    slow: 400,
  },
  easing: {
    default: 'cubic-bezier(0.4, 0, 0.2, 1)',
    spring: 'spring(tension:60,friction:12)',
  },
} as const;

export const iconSizes = {
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
} as const;

export const fontFamily = {
  ios: 'Apple SD Gothic Neo',
  android: 'Noto Sans KR',
  point: 'Noto Serif KR',
} as const;

/**
 * @MX:ANCHOR
 * Design tokens object - single source of truth for all styling values
 * Consumed by all components via useTheme() hook
 * fan_in >= 3 (Button, Card, BookCard, EmotionRecordCard, StickerReaction, ProgressBar)
 */
