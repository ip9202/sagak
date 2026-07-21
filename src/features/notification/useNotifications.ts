/**
 * 알림 목록 조회 React Query 훅 (SPEC-NOTIF-001 REQ-NOTIF-005)
 *
 * @MX:SPEC SPEC-NOTIF-001
 */
import { useQuery } from '@tanstack/react-query';
import { getNotifications } from './queries';
import type { NotificationRow } from './types';

/** 알림 도메인 공통 queryKey 접두사 — invalidateQueries 일괄 적용용 */
export const NOTIFICATION_QUERY_PREFIX = 'notification' as const;

export const NOTIFICATIONS_KEY = [
  NOTIFICATION_QUERY_PREFIX,
  'list',
] as const;

export function useNotifications(): ReturnType<
  typeof useQuery<NotificationRow[], Error>
> {
  return useQuery<NotificationRow[], Error>({
    queryKey: NOTIFICATIONS_KEY,
    queryFn: getNotifications,
  });
}
