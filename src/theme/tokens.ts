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

/**
 * @MX:ANCHOR
 * Design tokens object - single source of truth for all styling values
 * Consumed by all components via useTheme() hook
 * fan_in >= 3 (Button, Card, BookCard, EmotionRecordCard, StickerReaction, ProgressBar)
 */
