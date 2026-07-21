/**
 * 독서 알림 라우트 — my/alarm
 * SPEC-ROUTINE-001
 *
 * AlarmScreen 을 테마 셸에 감싸 렌더한다.
 * AlarmScreen 이 자체 로딩/에러 가드를 처리하므로 라우트 셸은 최소로 유지한다.
 *
 * @MX:NOTE: [AUTO] 라우트 셸 — 알림 설정 화면 진입점. token-only 스타일링.
 * @MX:SPEC SPEC-ROUTINE-001
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../../../src/theme/theme';
import { AlarmScreen } from '../../../src/features/routine/components/AlarmScreen';

export default function AlarmRoute(): React.JSX.Element {
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg.base }]}>
      <AlarmScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
