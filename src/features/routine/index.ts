/**
 * 루틴/타이머 도메인 공개 API (SPEC-ROUTINE-001)
 *
 * @MX:SPEC SPEC-ROUTINE-001
 */
export type {
  ReadingSessionRow,
  ReadingStats,
  AlarmSettings,
  DailyGoalSeconds,
  AlarmTimeString,
} from './types';

export {
  START_PROMPT,
  END_ENCOURAGEMENT,
  END_ENCOURAGEMENT_SHORT,
  STREAK_ACHIEVEMENT,
  GOAL_ACHIEVED,
  INVALID_TIME_FORMAT,
  pickEndEncouragement,
} from './copy';

export { startSession, endSession, getActiveSession } from './sessionApi';
export {
  getAlarmSettings,
  updateAlarmTime,
  toggleAlarmEnabled,
  normalizeAlarmTime,
} from './alarmApi';
export { getReadingStats } from './statsApi';
export { calculateStreak } from './streakCalculator';
export {
  getDailyGoal,
  setDailyGoal,
  DEFAULT_DAILY_GOAL_SECONDS,
} from './goalStorage';
export { useReadingTimer, formatElapsed } from './useReadingTimer';
export { useActiveSession, ACTIVE_SESSION_QUERY_KEY } from './useActiveSession';
export {
  useAlarmSettings,
  useInvalidateAlarmSettings,
  ALARM_SETTINGS_QUERY_KEY,
} from './useAlarmSettings';
export { useReadingStats, READING_STATS_QUERY_KEY } from './useReadingStats';
