/**
 * 마이페이지 도메인 공개 API (SPEC-PROFILE-001)
 *
 * @MX:SPEC SPEC-PROFILE-001
 */
export type {
  Profile,
  ProfileUpdateInput,
  UserStats,
  PointLog,
  Badge,
  BadgeInput,
  BadgeCategory,
} from './types';

export { computeBadges, BADGE_THRESHOLDS } from './badges';
export { getProfile, getUserStats, getPointLogs } from './queries';
export { updateProfile, validateProfileInput, NICKNAME_MAX_LENGTH } from './mutations';
export { PROFILE_QUERY_KEY, useProfile } from './useProfile';
export {
  USER_STATS_QUERY_KEY,
  USER_STATS_STALE_TIME,
  useUserStats,
} from './useUserStats';
export { POINT_LOGS_QUERY_KEY, POINT_LOGS_STALE_TIME, usePointLogs } from './usePointLogs';
export { useUpdateProfile } from './useUpdateProfile';
export { StatCard } from './components/StatCard';
export type { StatCardProps } from './components/StatCard';
export { BadgeCard } from './components/BadgeCard';
export type { BadgeCardProps } from './components/BadgeCard';
