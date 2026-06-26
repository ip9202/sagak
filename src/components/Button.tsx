/**
 * Button Component - pages_11 §9.1
 * 5 variants: primary, secondary, ghost, destructive, disabled
 */

import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useTheme } from '../theme/theme';
import { typography } from '../theme/tokens';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive' | 'disabled';

export interface ButtonProps {
  variant: ButtonVariant;
  onPress: () => void;
  children: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

/**
 * @MX:NOTE
 * Button component - primary action element
 * Supports 5 visual variants with dark mode
 * Loading state shows ActivityIndicator
 * Touch target: 48dp (non-ghost), 40dp + hitSlop (ghost)
 */
export const Button: React.FC<ButtonProps> = ({
  variant,
  onPress,
  children,
  loading = false,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
  style,
  textStyle,
}) => {
  const theme = useTheme();

  // When disabled, disabled variant takes priority (no loading spinner)
  const isDisabled = disabled || variant === 'disabled';
  const isLoading = loading && !isDisabled;

  const buttonStyle = [
    styles.button,
    styles[variant],
    {
      backgroundColor: getBackgroundColor(variant, theme),
      borderColor: getBorderColor(variant, theme),
      borderWidth: variant === 'secondary' || variant === 'destructive' ? 1 : 0,
      // @MX:NOTE: [AUTO] SPEC-UI-002 — .pen PrimaryButton padding [0,24] 준거.
      //           비고스트 variant(primary/secondary/destructive/disabled)에만 24 적용.
      //           ghost 는 styles.ghost 에서 12 유지(별도 variant).
      paddingHorizontal: variant === 'ghost' ? theme.spacing[3] : theme.spacing[6],
      opacity: isDisabled ? 0.5 : 1,
    },
    style,
  ];

  const textColor = getTextColor(variant, theme);

  return (
    <TouchableOpacity
      testID="button"
      style={buttonStyle}
      onPress={onPress}
      disabled={isDisabled || isLoading}
      accessible={true}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      hitSlop={variant === 'ghost' ? { top: 4, bottom: 4, left: 4, right: 4 } : undefined}
    >
      {isLoading ? (
        <ActivityIndicator testID="button-spinner" color={theme.colors.text.inverse} />
      ) : (
        <Text
          style={[
            styles.text,
            styles[variant],
            { color: textColor },
            textStyle,
          ]}
        >
          {children}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const getBackgroundColor = (variant: ButtonVariant, theme: ReturnType<typeof useTheme>): string => {
  switch (variant) {
    case 'primary':
      return theme.colors.brand[500];
    case 'secondary':
    case 'ghost':
      return 'transparent';
    case 'destructive':
      return theme.colors.semantic.error;
    case 'disabled':
      return theme.colors.bg.muted;
    default:
      return theme.colors.brand[500];
  }
};

const getBorderColor = (variant: ButtonVariant, theme: ReturnType<typeof useTheme>): string => {
  switch (variant) {
    case 'secondary':
      return theme.colors.brand[500];
    case 'destructive':
      return theme.colors.semantic.error;
    default:
      return 'transparent';
  }
};

const getTextColor = (variant: ButtonVariant, theme: ReturnType<typeof useTheme>): string => {
  switch (variant) {
    case 'primary':
    case 'destructive':
      return theme.colors.text.inverse;
    case 'disabled':
      return theme.colors.text.disabled;
    case 'secondary':
      return theme.colors.text.brand;
    case 'ghost':
      return theme.colors.text.brand;
    default:
      return theme.colors.text.inverse;
  }
};

const styles = StyleSheet.create({
  button: {
    height: 48, // spacing[12] - 비고스트 버튼 높이 (pages_11 §9.1)
    // paddingHorizontal 은 인라인(비고스트 theme.spacing[6]=24 / ghost theme.spacing[3]=12)으로 오버라이드됨 (SPEC-UI-002)
    borderRadius: 10, // radius.md - 모서리 반경
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  text: {
    ...typography.buttonLabel,
  },
  // All 5 variants (primary, secondary, ghost, destructive, disabled)
  primary: {},
  secondary: {},
  ghost: {
    height: 40, // spacing[10] - 고스트 버튼 높이
    paddingHorizontal: 12, // spacing[3] - 고스트 버튼 좌우 패딩
  },
  destructive: {},
  disabled: {},
});
