/**
 * Dark Mode Tokens - pages_11 §3
 * 6 explicitly defined values + derived rules
 */

import { colors as lightColors } from './tokens';

// Derived token rules (pages_11 미명시, 파생값):
// - Text: brighten inversion (lighten by ~10-20%)
// - Border: match surface tones
// - Shadow: preserve alpha values
// - Brand: derive from light tokens with brightness adjustment
export const darkColors = {
  brand: {
    50: '#2A1C0E',    // pages_11 미명시, 파생값 (darkened for readability)
    100: '#342212',   // pages_11 미명시, 파생값
    200: '#4A3318',   // pages_11 미명시, 파생값
    300: '#634422',   // pages_11 미명시, 파생값
    400: '#9A6B32',   // pages_11 미명시, 파생값
    500: '#D4943D',   // pages_11 §3 명시값 (brightness +10% from light)
  },
  bg: {
    base: '#1A1208',   // pages_11 §3 명시값
    surface: '#2A1C0E', // pages_11 §3 명시값
    muted: '#342212',   // pages_11 §3 명시값
    overlay: 'rgba(45,31,14,0.60)' as const, // pages_11 미명시, 파생값 (alpha 60% for dark mode)
  },
  text: {
    primary: '#F0E4D0',  // pages_11 §3 명시값
    secondary: '#B89878', // pages_11 §3 명시값
    tertiary: '#8A7260',  // pages_11 미명시, 파생값 (brightened version)
    disabled: '#6A5444',  // pages_11 미명시, 파생값 (desaturated for low contrast)
    inverse: '#1A1208',   // pages_11 미명시, 파생값 (inverse of primary)
    brand: '#D4943D',     // pages_11 미명시, 파생값 (match brand-500)
  },
  border: {
    default: '#342212',  // pages_11 미명시, 파생값 (match bg-muted)
    strong: '#4A3318',   // pages_11 미명시, 파생값 (lighter than default)
    brand: '#D4943D',    // pages_11 미명시, 파생값 (match brand-500)
  },
  semantic: {
    success: '#5A9C7A', // pages_11 미명시, 파생값 (brightened for dark mode)
    error: '#E55050',   // pages_11 미명시, 파생값 (brightened)
    warning: '#F8B030',  // pages_11 미명시, 파생값 (brightened)
    info: '#4A8DC5',    // pages_11 미명시, 파생값 (brightened)
  },
  spoiler: {
    blur: 'blur(12px)',
    labelBg: 'rgba(240,228,208,0.90)' as const, // pages_11 미명시, 파생값 (use text-primary with alpha)
  },
} as const;
