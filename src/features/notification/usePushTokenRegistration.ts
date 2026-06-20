/**
 * usePushTokenRegistration: 푸시 토큰 등록 오케스트레이션 (SPEC-NOTIF-001 REQ-NOTIF-001~003)
 *
 * 인증된 사용자에 한해 1회(idempotent) 푸시 토큰 획득 + 서버 등록을 수행한다.
 * - loading/unauthenticated: 등록 건너뜀
 * - 토큰 null(권한 거부): 서버 등록 건너뜀
 * - 모든 에러 swallow (silent) — 알림 센터 unaffected
 *
 * @MX:NOTE: [AUTO] idempotency ref — re-render 시 중복 등록 방지. StrictMode(double-invoke) 대비.
 * @MX:NOTE: [AUTO] silent failure — registerForPush/registerPushToken throw 시 catch+swallow.
 *   알림 센터(REQ-NOTIF-005~008)는 푸시 등록 실패와 무관하게 동작한다.
 * @MX:SPEC SPEC-NOTIF-001
 */
import { useEffect, useRef } from 'react';
import { useSession } from '../../auth/useSession';
import { registerForPushNotifications } from './registerForPush';
import { registerPushToken } from './registerToken';

/**
 * 인증된 사용자의 Expo Push Token 을 획득해 서버에 1회 등록한다.
 * 호출자는 반환값 없이 렌더 트리에 배치하기만 하면 된다.
 */
export function usePushTokenRegistration(): void {
  const session = useSession();
  const doneRef = useRef(false);

  useEffect(() => {
    // loading(useSession null 반환) 또는 미인증 시 등록하지 않는다.
    if (!session || !session.isAuthenticated) {
      return;
    }
    // idempotency: 한 세션/마운트 생명주기 내 1회만 실행
    if (doneRef.current) {
      return;
    }
    doneRef.current = true;

    // void — 비동기 에러는 내부 catch. 반환된 Promise 를 await 하지 않는다 (useEffect async 금지).
    void (async () => {
      try {
        const token = await registerForPushNotifications();
        if (!token) {
          return;
        }
        await registerPushToken(token);
      } catch {
        // silent swallow — 알림 센터 unaffected
      }
    })();
  }, [session]);
}
