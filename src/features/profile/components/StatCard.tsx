/**
 * 통계 카드 컴포넌트 (SPEC-PROFILE-001 REQ-PROF-004 시각화)
 *
 * .pen F15-My "Stat-*" 프레임 스타일 적용:
 * - cornerRadius 16, padding 14, gap 4 (vertical)
 * - value: fontSize 22 / fontWeight 700 / brand-500
 * - label: fontSize 11 / fontWeight 500 / text-secondary
 * - bg-surface
 *
 * @MX:SPEC SPEC-PROFILE-001
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../../theme/theme';

export interface StatCardProps {
  value: string | number;
  label: string;
  testID?: string;
}

/**
 * 단일 통계 지표 카드. 값 + 라벨 수직 배치.
 */
export const StatCard: React.FC<StatCardProps> = ({ value, label, testID }) => {
  const theme = useTheme();
  return (
    <View
      testID={testID}
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.bg.surface,
          borderRadius: theme.radius.lg, // .pen cornerRadius 16
        },
      ]}
    >
      <Text
        style={[
          styles.value,
          { color: theme.colors.brand[500] }, // .pen $brand-500
        ]}
      >
        {value}
      </Text>
      <Text
        style={[
          styles.label,
          { color: theme.colors.text.secondary }, // .pen $text-secondary
        ]}
      >
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    alignItems: 'center',
    padding: 14, // .pen padding 14
    gap: 4, // .pen gap 4
  },
  // .pen V: fontSize 22 / fontWeight 700
  value: {
    fontSize: 22,
    fontWeight: '700',
  },
  // .pen L: fontSize 11 / fontWeight 500
  label: {
    fontSize: 11,
    fontWeight: '500',
  },
});
