/**
 * 알림 센터 라우트 — my/notifications
 * SPEC-NOTIF-001
 *
 * NotificationsScreen 을 테마 셸에 감싸 렌더한다.
 * NotificationsScreen 이 자체 로딩/에러/빈 가드를 처리하므로 라우트 셸은 최소로 유지한다.
 *
 * @MX:NOTE: [AUTO] 라우트 셸 — 알림 센터 진입점. token-only 스타일링.
 * @MX:SPEC SPEC-NOTIF-001
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../../../src/theme/theme';
import { NotificationsScreen } from '../../../src/features/notification/components/NotificationsScreen';

export default function NotificationsRoute(): React.JSX.Element {
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg.base }]}>
      <NotificationsScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
