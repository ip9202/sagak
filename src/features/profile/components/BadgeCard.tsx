/**
 * 배지 카드 컴포넌트 (SPEC-PROFILE-001 REQ-PROF-007 시각화)
 *
 * 획득(earned=true) → 컬러 brand-500 라벨 + opacity 1.
 * 잠김(earned=false) → 그레이스케일(text-tertiary) + opacity 0.5 + 잠금 표시.
 *
 * 비과시 원칙(SPEC-UI-002 FROZEN): 진행도/달성률 숫자 미노출, 라벨만 표시.
 *
 * @MX:SPEC SPEC-PROFILE-001
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../../theme/theme';

export interface BadgeCardProps {
  label: string;
  earned: boolean;
  testID?: string;
}

/**
 * 단일 배지 카드. earned 상태에 따라 시각화 분기.
 */
export const BadgeCard: React.FC<BadgeCardProps> = ({ label, earned, testID }) => {
  const theme = useTheme();
  const labelColor = earned ? theme.colors.brand[500] : theme.colors.text.tertiary;

  return (
    <View
      testID={testID}
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.bg.surface,
          borderRadius: theme.radius.lg,
          opacity: earned ? 1 : 0.5,
        },
      ]}
    >
      <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
      {!earned ? (
        <Text
          testID={testID ? `${testID}-locked` : 'badge-locked'}
          style={[styles.lock, { color: theme.colors.text.tertiary }]}
          accessibilityLabel="잠긴 배지"
        >
          🔒
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    gap: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  lock: {
    fontSize: 14,
  },
});
