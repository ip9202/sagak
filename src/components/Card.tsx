/**
 * Card Component - pages_11 §9.2/9.3
 * Base card with bg-surface, radius-lg, shadow-sm
 */

import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../theme/theme';
import { spacing } from '../theme/tokens';

export interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  testID?: string;
}

/**
 * @MX:NOTE
 * Card component - base container for BookCard and EmotionRecordCard
 * Background: bg-surface
 * Border radius: radius-lg (16dp)
 * Shadow: shadow-sm
 * Supports dark mode
 */
export const Card: React.FC<CardProps> = ({ children, style, testID = 'card' }) => {
  const theme = useTheme();

  return (
    <View
      testID={testID}
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.bg.surface,
          borderRadius: theme.radius.lg,
          shadowColor: '#2D1F0E', // text-primary color for shadow
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.08,
          shadowRadius: 3,
          elevation: 1, // Android elevation
        },
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: spacing[4],
  },
});
