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
    height: 48, // pages_11 §9.1: 48dp for non-ghost variants
    paddingHorizontal: 16,
    borderRadius: 10, // radius-md
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  },
  // All 5 variants (primary, secondary, ghost, destructive, disabled)
  primary: {},
  secondary: {},
  ghost: {
    height: 40,
    paddingHorizontal: 12,
  },
  destructive: {},
  disabled: {},
});
