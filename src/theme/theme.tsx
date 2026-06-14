/**
 * Theme System - ThemeProvider + useTheme hook
 * pages_11 §3 다크모드 지원
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { colors, spacing, radius, shadow, typography, motion, iconSizes, fontFamily } from './tokens';
import { darkColors } from './darkTokens';

export type ThemeMode = 'light' | 'dark';

export interface Theme {
  mode: ThemeMode;
  colors: typeof colors;
  darkColors: typeof darkColors;
  spacing: typeof spacing;
  radius: typeof radius;
  shadow: typeof shadow;
  typography: typeof typography;
  motion: typeof motion;
  iconSizes: typeof iconSizes;
  fontFamily: typeof fontFamily;
}

const ThemeContext = createContext<Theme>({
  mode: 'light',
  colors,
  darkColors,
  spacing,
  radius,
  shadow,
  typography,
  motion,
  iconSizes,
  fontFamily,
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [mode, setMode] = useState<ThemeMode>(systemColorScheme === 'dark' ? 'dark' : 'light');

  useEffect(() => {
    setMode(systemColorScheme === 'dark' ? 'dark' : 'light');
  }, [systemColorScheme]);

  const theme: Theme = {
    mode,
    colors: mode === 'dark' ? darkColors : colors,
    darkColors,
    spacing,
    radius,
    shadow,
    typography,
    motion,
    iconSizes,
    fontFamily,
  };

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
};

/**
 * @MX:ANCHOR
 * useTheme hook - primary method for accessing design tokens
 * Consumed by all 6 components (Button, Card, ProgressBar, BookCard, EmotionRecordCard, StickerReaction)
 * fan_in >= 6 (every component uses this)
 */
export const useTheme = (): Theme => {
  const theme = useContext(ThemeContext);
  if (!theme) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return theme;
};
