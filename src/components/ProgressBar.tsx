/**
 * ProgressBar Component - pages_11 §9.5
 * Gradient fill with caption
 */

import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme/theme';

export interface ProgressBarProps {
  current: number;
  total: number;
  style?: ViewStyle;
  testID?: string;
}

/**
 * @MX:NOTE
 * ProgressBar component - reading progress indicator
 * Track: bg-muted, 4dp height, radius-full
 * Fill: brand-500 → brand-300 gradient (left to right)
 * Caption: "current / totalp (percentage%)"
 * Clamps percentage at 100%
 * Hides label when total is 0
 * Supports dark mode
 */
export const ProgressBar: React.FC<ProgressBarProps> = ({
  current,
  total,
  style,
  testID = 'progress-bar',
}) => {
  const theme = useTheme();

  const percentage = total > 0 ? Math.min(Math.round((current / total) * 100), 100) : 0;
  const showLabel = total > 0;

  return (
    <View testID={testID} style={[styles.container, style]}>
      <View
        style={[
          styles.track,
          {
            backgroundColor: theme.colors.bg.muted,
            borderRadius: theme.radius.full,
          },
        ]}
      >
        <LinearGradient
          colors={[theme.colors.brand[500], theme.colors.brand[300]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[
            styles.fill,
            {
              width: `${percentage}%`,
              borderRadius: theme.radius.full,
            },
          ]}
        />
      </View>
      {showLabel && (
        <Text
          style={[
            styles.caption,
            {
              color: theme.colors.text.secondary,
              fontSize: theme.typography.caption.fontSize,
              lineHeight: theme.typography.caption.lineHeight,
            },
          ]}
        >
          {current} / {total}p ({percentage}%)
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 4,
  },
  track: {
    height: 4, // pages_11 §9.5: 4dp track height
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
  caption: {
    marginTop: 4,
    textAlign: 'center',
  },
});
