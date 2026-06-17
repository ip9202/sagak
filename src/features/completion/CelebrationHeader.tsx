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
    paddingVertical: 24,
  },
  badge: {
    borderRadius: 9999,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginBottom: 12,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  message: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
});
