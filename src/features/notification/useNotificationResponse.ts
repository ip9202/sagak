/**
 * useNotificationResponse: foreground 표시 + 알림 탭 라우팅 + 쿼리 무효화
 * (SPEC-NOTIF-001 REQ-NOTIF-004 + SPEC-NOTIF-002 REQ-NOTIF2-002)
 *
 * - N7: setNotificationHandler 로 foreground 알림 표시(shouldShowAlert: true) 등록.
 *   manager-quality W2: handler 등록은 module scope(import 시 1회)에서 수행 —
 *   Fast Refresh 가 module state 를 reset 하면서 component 가 persist 되는 경우
 *   effect 기반 등록이 누락/중복될 수 있어, import 시 1회 실행으로 회피한다.
 * - N8: 알림 탭(addNotificationResponseReceivedListener) 시 routeForNotification(type, ref_id)
 *        경로로 router.replace. 매핑 불가 시 NOTIFICATION_CENTER_ROUTE 폴백.
 * - N2-5: 포그라운드 푸시 수신(addNotificationReceivedListener) 시 즉시 알림 목록/카운트 invalidate.
 * - N2-6: 배너 탭 시 라우팅과 함께 동일 invalidate.
 * - N2-7: invalidateQueries 는 useMarkAsRead 와 동일 queryKey prefix([NOTIFICATION_QUERY_PREFIX]) 사용 —
 *          React Query 가 중복 재조회를 자동 정규화한다 (신규 추상화 금지, invalidate ONLY).
 *
 * @MX:NOTE: [AUTO] setNotificationHandler 는 모듈 로드(import) 시 1회만 등록 —
 *   Fast Refresh/effect lifecycle 분리로 module state reset 시에도 안전.
 * @MX:SPEC SPEC-NOTIF-001
 * @MX:SPEC SPEC-NOTIF-002
 */
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useQueryClient } from '@tanstack/react-query';
import { routeForNotification, NOTIFICATION_CENTER_ROUTE } from './routeMapper';
import { NOTIFICATION_QUERY_PREFIX } from './useNotifications';
import type { NotificationType } from './types';

// module scope — 등록은 import 시 1회. Fast Refresh 안전 (effect lifecycle 과 분리).
// N7: foreground 알림 수신 시 alert/sound/badge 표시 (NotificationBehavior 전체 필수).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * 알림 탭 라우팅 + 푸시 수신/탭 시 알림 도메인 쿼리 무효화를 설정한다.
 * foreground handler 등록은 import 시 이미 완료된다.
 * RootLayout 내부(AuthProvider + QueryClientProvider 안)에서 1회 호출.
 */
export function useNotificationResponse(): void {
  const router = useRouter();
  const qc = useQueryClient();

  useEffect(() => {
    // 알림 목록 + 읽지 않은 카운트를 무효화(useMarkAsRead 와 동일 패턴, invalidate ONLY).
    const invalidateNotifications = (): void => {
      void qc.invalidateQueries({ queryKey: [NOTIFICATION_QUERY_PREFIX] });
    };

    // N8 + N2-6: 알림 탭 시 routeForNotification 경로로 이동(매핑 불가 시 센터 폴백) + 쿼리 무효화.
    const responseSubscription =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data ?? {};
        const type = typeof data.type === 'string' ? (data.type as NotificationType) : null;
        const refId =
          typeof data.ref_id === 'string' || data.ref_id === null
            ? (data.ref_id as string | null)
            : null;
        const route = type ? routeForNotification(type, refId) : null;
        router.replace(route ?? NOTIFICATION_CENTER_ROUTE);
        invalidateNotifications();
      });

    // N2-5: 포그라운드 푸시 수신 시 즉시 목록 갱신.
    const receivedSubscription = Notifications.addNotificationReceivedListener(() => {
      invalidateNotifications();
    });

    return () => {
      responseSubscription.remove();
      receivedSubscription.remove();
    };
  }, [router, qc]);
}
