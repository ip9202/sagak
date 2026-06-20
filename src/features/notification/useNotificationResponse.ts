/**
 * useNotificationResponse: foreground 표시 + 알림 탭 라우팅 (SPEC-NOTIF-001 REQ-NOTIF-004)
 *
 * - N7: setNotificationHandler 로 foreground 알림 표시(shouldShowAlert: true) 1회 등록.
 * - N8: 알림 탭(addNotificationResponseReceivedListener) 시 routeForNotification(type, ref_id)
 *        경로로 router.replace. 매핑 불가 시 NOTIFICATION_CENTER_ROUTE 폴백.
 *
 * @MX:NOTE: [AUTO] setNotificationHandler 는 모듈 로드 시 1회만 등록 — 모듈 boolean 가드로
 *   StrictMode double-invoke 및 다중 훅 마운트 시 중복 등록 방지.
 * @MX:SPEC SPEC-NOTIF-001
 */
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { routeForNotification, NOTIFICATION_CENTER_ROUTE } from './routeMapper';
import type { NotificationType } from './types';

// 모듈 로드당 1회 handler 등록 가드 (StrictMode/hot-reload safe)
let handlerRegistered = false;

/**
 * foreground 알림 표시 + 알림 탭 라우팅을 설정한다.
 * RootLayout 내부(AuthProvider 안)에서 1회 호출.
 */
export function useNotificationResponse(): void {
  const router = useRouter();

  useEffect(() => {
    if (!handlerRegistered) {
      handlerRegistered = true;
      // N7: foreground 알림 수신 시 alert/sound/badge 표시 (NotificationBehavior 전체 필수).
      //   shouldShowAlert(deprecated) + shouldShowBanner/shouldShowList 로 배너/알림센터 표시 보장.
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });
    }

    // N8: 알림 탭 시 routeForNotification 경로로 이동. 매핑 불가 시 센터 폴백.
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data ?? {};
        const type = typeof data.type === 'string' ? (data.type as NotificationType) : null;
        const refId =
          typeof data.ref_id === 'string' || data.ref_id === null
            ? (data.ref_id as string | null)
            : null;
        const route = type ? routeForNotification(type, refId) : null;
        router.replace(route ?? NOTIFICATION_CENTER_ROUTE);
      },
    );

    return () => {
      subscription.remove();
    };
  }, [router]);
}
