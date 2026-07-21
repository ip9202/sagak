/**
 * ProgressBar Component - pages_11 §9.5
 * Gradient fill with caption
 */

import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme/theme';
import { spacing } from '../theme/tokens';

export interface ProgressBarProps {
  current: number;
  total: number;
  style?: ViewStyle;
  testID?: string;
  /**
   * 내장 캡션("X / Yp (Z%)") 표시 여부.
   * 기본 true(하위 호환). 부모가 별도 서식(.pen BookCard 11/500 text.tertiary 등)으로
   * 캡션을 직접 렌더링할 때 false 로 끈다.
   */
  showCaption?: boolean;
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
  showCaption = true,
}) => {
  const theme = useTheme();

  const percentage = total > 0 ? Math.min(Math.round((current / total) * 100), 100) : 0;
  const showLabel = showCaption && total > 0;

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
      {/* @MX:NOTE: [AUTO] showCaption=false 면 부모가 .pen 서식(예: BookCard 11/500 text.tertiary) 으로 자체 렌더링. */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: spacing[1],
  },
  track: {
    height: spacing[1], // pages_11 §9.5: 4dp track height
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
  caption: {
    marginTop: spacing[1],
    textAlign: 'center',
  },
});
