/**
 * 독서 타이머 화면 컴포넌트 (SPEC-ROUTINE-001 REQ-ROUT-001~004)
 *
 * 활성 세션 표시 + 시작/종료 버튼 + 다정한 메시지.
 * REQ-ROUT-003 포그라운드 타이머, REQ-ROUT-004 다정한 카피.
 *
 * @MX:NOTE: [AUTO] 본 컴포넌트는 화면 본체 — 라우트 등록(my.tsx→my/index.tsx 전환)은 별도 작업 영역.
 * @MX:SPEC SPEC-ROUTINE-001
 */
import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme } from '../../../theme/theme';
import { Button } from '../../../components/Button';
import {
  useActiveSession,
  useReadingTimer,
  startSession,
  endSession,
  START_PROMPT,
  pickEndEncouragement,
} from '../index';

export function TimerScreen({ bookId }: { bookId?: string }): React.JSX.Element {
  const theme = useTheme();
  const sessionQuery = useActiveSession();
  const active = sessionQuery.data ?? null;

  const startedAt = active ? new Date(active.started_at) : null;
  const timer = useReadingTimer(startedAt);

  if (sessionQuery.isLoading) {
    return (
      <View
        testID="timer-loading"
        style={[styles.center, { backgroundColor: theme.colors.bg.base }]}
      >
        <ActivityIndicator color={theme.colors.brand[500]} />
      </View>
    );
  }

  const handleStart = (): void => {
    if (bookId) void startSession(bookId);
  };
  const handleEnd = (): void => {
    if (active) void endSession(active.id);
  };

  return (
    <View
      testID="timer-screen"
      style={[styles.container, { backgroundColor: theme.colors.bg.base }]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text.primary }]}>
          독서 타이머
        </Text>
      </View>
      <View style={styles.body}>
        {active ? (
          <>
            <Text
              testID="timer-display"
              style={[styles.timerText, { color: theme.colors.text.primary }]}
            >
              {timer.display}
            </Text>
            <Text
              style={[styles.encouragement, { color: theme.colors.text.brand }]}
            >
              {pickEndEncouragement(null)}
            </Text>
            <Button
              variant="primary"
              onPress={handleEnd}
              accessibilityLabel="독서 종료"
            >
              독서 종료
            </Button>
          </>
        ) : (
          <>
            <Text
              testID="timer-start-prompt"
              style={[styles.prompt, { color: theme.colors.text.secondary }]}
            >
              {START_PROMPT}
            </Text>
            <Button
              variant="primary"
              onPress={handleStart}
              disabled={!bookId}
              accessibilityLabel="독서 시작"
            >
              독서 시작
            </Button>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 }, // paddingHorizontal: spacing[5], paddingTop: spacing[2], paddingBottom: spacing[1]
  title: { fontSize: 22, fontWeight: '700' }, // typography.displaySm(22/700/30)
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 20 }, // gap: spacing[4], padding: spacing[5]
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  timerText: { fontSize: 48, fontWeight: '700', fontVariant: ['tabular-nums'] }, // typography 토큰에 없는 큰 크기 유지
  prompt: { fontSize: 18, textAlign: 'center' }, // typography.headingMd(18/600/26)과 fontWeight 불일치로 유지
  encouragement: { fontSize: 15 }, // typography.alarmTitle(15/600/21)과 fontWeight 불일치로 유지
});
