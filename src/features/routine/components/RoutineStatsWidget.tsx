/**
 * 루틴 통계 위젯 (SPEC-ROUTINE-001 REQ-ROUT-010)
 *
 * 일일 목표 대비 진행률을 ProgressBar 로 표시.
 * - R22: 진행률 50% 표시
 * - R23: 목표 달성(100%) 시 GOAL_ACHIEVED 다정한 메시지
 * - R24: 목표 미설정 시 기본 900초
 *
 * 비과시 원칙(SPEC-UI-002 FROZEN): 좋아요/팔로워/랭킹 표시 없음.
 *
 * @MX:NOTE: [AUTO] ProgressBar 는 기존 컴포넌트 재사용(seconds → percentage 환산). token-only 스타일링.
 * @MX:SPEC SPEC-ROUTINE-001
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../../theme/theme';
import { ProgressBar } from '../../../components/ProgressBar';
import {
  useReadingStats,
  getDailyGoal,
  GOAL_ACHIEVED,
  DEFAULT_DAILY_GOAL_SECONDS,
} from '../index';
import { useEffect, useState } from 'react';

export function RoutineStatsWidget(): React.JSX.Element {
  const theme = useTheme();
  const statsQuery = useReadingStats();
  const [goalSeconds, setGoalSeconds] = useState<number>(
    DEFAULT_DAILY_GOAL_SECONDS,
  );

  useEffect(() => {
    let mounted = true;
    void getDailyGoal().then((g) => {
      if (mounted) setGoalSeconds(g);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const todaySeconds = statsQuery.data?.today_duration_seconds ?? 0;
  const progress =
    goalSeconds > 0 ? Math.min(todaySeconds, goalSeconds) : todaySeconds;
  const isAchieved = goalSeconds > 0 && todaySeconds >= goalSeconds;

  return (
    <View
      testID="routine-stats-widget"
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.bg.surface,
          borderRadius: theme.radius.lg,
          padding: theme.spacing[5],
          borderWidth: 1,
          borderColor: theme.colors.border.default,
        },
      ]}
    >
      <Text style={[styles.title, { color: theme.colors.text.primary }]}>
        오늘의 독서
      </Text>
      <ProgressBar current={progress} total={goalSeconds} />
      {isAchieved ? (
        <Text
          testID="routine-goal-achieved"
          style={[styles.achievement, { color: theme.colors.text.brand }]}
        >
          {GOAL_ACHIEVED}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 }, // spacing[2] - 자식 간 간격
  title: { fontSize: 16, fontWeight: '600' }, // typography.headingSm(16/600/23)과 lineHeight 불일치로 유지
  achievement: { fontSize: 14, fontWeight: '500' }, // typography.bodyMd(14/400/22)와 fontWeight 불일치, ctaLabel(14/600/22)와도 불일치로 유지
});
