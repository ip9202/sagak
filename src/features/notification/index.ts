/**
 * 알림 센터 도메인 공개 API (SPEC-NOTIF-001)
 *
 * @MX:SPEC SPEC-NOTIF-001
 */
export type { NotificationType, NotificationRow } from './types';

export {
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} from './queries';

export {
  routeForNotification,
  NOTIFICATION_CENTER_ROUTE,
} from './routeMapper';

export {
  useNotifications,
  NOTIFICATIONS_KEY,
  NOTIFICATION_QUERY_PREFIX,
} from './useNotifications';
export { useUnreadCount, UNREAD_COUNT_KEY } from './useUnreadCount';
// SPEC-NOTIF-002 REQ-NOTIF2-001: 알림 센터 Realtime INSERT 구독
export { useNotificationsRealtime } from './useNotificationsRealtime';
export { useMarkAsRead } from './useMarkAsRead';
export { useMarkAllAsRead } from './useMarkAllAsRead';

// SPEC-NOTIF-001 Optional (REQ-NOTIF-001~004): client Expo Push integration
export { registerPushToken } from './registerToken';
export { registerForPushNotifications } from './registerForPush';
export { usePushTokenRegistration } from './usePushTokenRegistration';
export { useNotificationResponse } from './useNotificationResponse';
