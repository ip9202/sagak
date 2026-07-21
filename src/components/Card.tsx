/**
 * Card Component - pages_11 §9.2/9.3
 * Base card with bg-surface, radius-lg, shadow-sm
 */

import React from 'react';
import { View, Pressable, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../theme/theme';
import { spacing } from '../theme/tokens';

export interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  testID?: string;
  /** 전달 시 Pressable 로 렌더되어 탭 가능 카드가 된다. 미전달 시 일반 View. */
  onPress?: () => void;
}

/**
 * @MX:NOTE
 * Card component - base container for BookCard and EmotionRecordCard
 * Background: bg-surface
 * Border radius: radius-lg (16dp)
 * Shadow: shadow-sm
 * Supports dark mode
 * onPress 전달 시 Pressable 로 전환 — 서재 책 탭 → 상세 이동 등.
 */
export const Card: React.FC<CardProps> = ({
  children,
  style,
  testID = 'card',
  onPress,
}) => {
  const theme = useTheme();

  const cardStyle = [
    styles.card,
    {
      backgroundColor: theme.colors.bg.surface,
      borderRadius: theme.radius.lg,
      shadowColor: theme.colors.text.primary, // text-primary color for shadow (token-only)
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 3,
      elevation: 1, // Android elevation
    },
    style,
  ];

  if (onPress) {
    return (
      <Pressable
        testID={testID}
        onPress={onPress}
        accessibilityRole="button"
        style={({ pressed }) => [cardStyle, { opacity: pressed ? 0.85 : 1 }]}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View testID={testID} style={cardStyle}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: spacing[4],
  },
});
