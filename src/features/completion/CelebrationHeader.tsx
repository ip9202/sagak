/**
 * 완독 축하 헤더 컴포넌트 (SPEC-COMPLETION-001, REQ-COMP-009/010, 시나리오 12/13)
 *
 * 정적 텍스트("이 책과의 여정을 완성하셨어요") + 완독 배지.
 * 애니메이션 라이브러리 미사용 (6.3 해결됨 — 정적 MVP).
 * 배지에 SPEC-UI-001 강조색(amber brown, brand-500) 적용.
 *
 * 에러 상태에서의 미표시 여부는 부모(화면)가 마운트 여부로 제어한다 (시나리오 12 우).
 *
 * @MX:SPEC SPEC-COMPLETION-001
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/theme';
import { spacing, radius, typography } from '../../theme/tokens';

/**
 * 완독 축하 헤더를 렌더링한다 (REQ-COMP-009/010).
 */
export function CelebrationHeader(): React.ReactElement {
  const theme = useTheme();
  return (
    <View
      style={styles.container}
      accessible
      accessibilityRole="header"
      accessibilityLabel="완독 완료. 이 책과의 여정을 완성하셨어요"
    >
      <View
        testID="completion-badge"
        style={[
          styles.badge,
          { backgroundColor: theme.colors.brand[500] },
        ]}
      >
        <Text style={[styles.badgeText, { color: theme.colors.text.inverse }]}>
          완독
        </Text>
      </View>
      <Text style={[styles.message, { color: theme.colors.text.primary }]}>
        이 책과의 여정을 완성하셨어요
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: spacing[6],
  },
  badge: {
    borderRadius: radius.full,
    paddingHorizontal: spacing[4],
    // @MX:NOTE: [AUTO] 배지 세로 여백 6 → spacing 근사 (P1-B 사례와 일관).
    paddingVertical: spacing[2],
    marginBottom: spacing[3],
  },
  // @MX:NOTE: [AUTO] badgeText(13/700) → sectionLabel(13/600) 근사. 가중치 600→700 차이는 미미,
  //           새 토큰 추가는 오버엔지니어링(guide 4). 축하 배지 강조 의미는 sectionLabel 로 충분.
  badgeText: {
    ...typography.sectionLabel,
  },
  message: {
    ...typography.headingLg,
    textAlign: 'center',
  },
});
