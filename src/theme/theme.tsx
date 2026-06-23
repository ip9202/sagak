/**
 * Theme System - ThemeProvider + useTheme hook
 * pages_11 §3 다크모드 지원
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { colors, spacing, radius, borderWidth, minHeight, shadow, typography, motion, iconSizes, fontFamily } from './tokens';
import { darkColors } from './darkTokens';

export type ThemeMode = 'light' | 'dark';

// Explicit structural type for theme tokens (enables both light and dark to satisfy the same shape)
export interface ThemeTokens {
  brand: {
    50: string;
    100: string;
    200: string;
    300: string;
    400: string;
    500: string;
  };
  bg: {
    base: string;
    surface: string;
    muted: string;
    overlay: string;
  };
  text: {
    primary: string;
    secondary: string;
    tertiary: string;
    disabled: string;
    inverse: string;
    brand: string;
  };
  border: {
    default: string;
    strong: string;
    brand: string;
  };
  semantic: {
    success: string;
    error: string;
    warning: string;
    info: string;
  };
  spoiler: {
    blur: string;
    labelBg: string;
  };
}

export interface Theme {
  mode: ThemeMode;
  colors: ThemeTokens;
  darkColors: ThemeTokens;
  spacing: typeof spacing;
  radius: typeof radius;
  borderWidth: typeof borderWidth;
  minHeight: typeof minHeight;
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
  borderWidth,
  minHeight,
  shadow,
  typography,
  motion,
  iconSizes,
  fontFamily,
});

// Context for manual mode control
export const ManualModeContext = createContext<{
  manualMode: ThemeMode | null;
  setManualMode: (mode: ThemeMode | null) => void;
}>({
  manualMode: null,
  setManualMode: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [mode, setMode] = useState<ThemeMode>(systemColorScheme === 'dark' ? 'dark' : 'light');
  const [manualMode, setManualMode] = useState<ThemeMode | null>(null);

  useEffect(() => {
    if (manualMode === null) {
      setMode(systemColorScheme === 'dark' ? 'dark' : 'light');
    }
  }, [systemColorScheme, manualMode]);

  const theme: Theme = {
    mode: manualMode || mode,
    colors: (manualMode || mode) === 'dark' ? darkColors : colors,
    darkColors,
    spacing,
    radius,
    borderWidth,
    minHeight,
    shadow,
    typography,
    motion,
    iconSizes,
    fontFamily,
  };

  return (
    <ManualModeContext.Provider value={{ manualMode, setManualMode }}>
      <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
    </ManualModeContext.Provider>
  );
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

/**
 * @MX:NOTE
 * useManualMode hook - controls manual theme override
 * Used by dev screen for dark mode toggle demonstration
 */
export const useManualMode = () => useContext(ManualModeContext);
