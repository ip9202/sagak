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

export const typography = {
  displayLg: { fontSize: 28, fontWeight: '700' as const, lineHeight: 36 },
  displayMd: { fontSize: 24, fontWeight: '700' as const, lineHeight: 32 },
  headingLg: { fontSize: 20, fontWeight: '700' as const, lineHeight: 28 },
  headingMd: { fontSize: 18, fontWeight: '600' as const, lineHeight: 26 },
  headingSm: { fontSize: 16, fontWeight: '600' as const, lineHeight: 23 },
  bodyLg: { fontSize: 16, fontWeight: '400' as const, lineHeight: 26 },
  bodyMd: { fontSize: 14, fontWeight: '400' as const, lineHeight: 22 },
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
