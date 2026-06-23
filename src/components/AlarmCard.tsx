/**
 * AlarmCard 컴포넌트 (SPEC-NAV-001 홈 탭 F03-Home)
 *
 * 따뜻한 리마인더 카드. 배경 brand[50], 곡률 radius.lg, padding spacing[5].
 * title(theme.typography.alarmTitle) / subtitle(theme.typography.bodySm) 두 줄을 세로로 쌓는다 (gap spacing[2]).
 * token-only 스타일링 (SPEC-UI-002 FROZEN — 하드코딩 금지).
 *
 * 비과시 원칙(SPEC-UI-002 FROZEN): 좋아요/팔로워/랭킹 표시 없음.
 *
 * @MX:NOTE: [AUTO] 따뜻한 리마인더 카드 — 부모(HomeTab)가 title/subtitle 카피를 계산해 주입. 컴포넌트 자체는 순수 표현.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/theme';

export interface AlarmCardProps {
  title: string;
  subtitle: string;
  testID?: string;
}

/**
 * @MX:NOTE: [AUTO] AlarmCard — brand[50] 배경의 따뜻한 카드. 자식 컴포넌트 없이 단일 소비자(HomeTab).
 */
export const AlarmCard: React.FC<AlarmCardProps> = ({
  title,
  subtitle,
  testID = 'alarm-card',
}): React.JSX.Element => {
  const theme = useTheme();

  return (
    <View
      testID={testID}
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.brand[50],
          borderRadius: theme.radius.lg,
          padding: theme.spacing[5],
          gap: theme.spacing[2],
        },
      ]}
    >
      <Text
        style={[
          theme.typography.alarmTitle,
          { color: theme.colors.text.primary },
        ]}
      >
        {title}
      </Text>
      <Text
        style={[
          theme.typography.bodySm,
          { color: theme.colors.text.secondary },
        ]}
      >
        {subtitle}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'column',
  },
});
