/**
 * 독서 타이머 라우트 — my/timer
 * SPEC-ROUTINE-001
 *
 * useLocalSearchParams 로 선택적 bookId 를 읽어 TimerScreen 에 주입한다.
 * TimerScreen 이 자체 로딩/에러 가드를 처리하므로 라우트 셸은 최소로 유지한다.
 *
 * @MX:NOTE: [AUTO] 라우트 셸 — bookId 없이 진입 시 시작 버튼 비활성화(화면 본체 동작). token-only 스타일링.
 * @MX:SPEC SPEC-ROUTINE-001
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../../src/theme/theme';
import { TimerScreen } from '../../../src/features/routine/components/TimerScreen';

export default function TimerRoute(): React.JSX.Element {
  const theme = useTheme();
  const { bookId } = useLocalSearchParams<{ bookId?: string }>();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg.base }]}>
      <TimerScreen bookId={bookId} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
