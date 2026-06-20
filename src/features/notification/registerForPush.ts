/**
 * 푸시 토큰 획득 + 권한 요청 (SPEC-NOTIF-001 REQ-NOTIF-001, REQ-NOTIF-002)
 *
 * - REQ-NOTIF-002: requestPermissionsAsync(iOS/Android). 거부 시 skip push.
 * - REQ-NOTIF-001: getExpoPushTokenAsync 토큰 획득.
 * - Android: 사전 채널 생성(setNotificationChannelAsync).
 *
 * @MX:NOTE: [AUTO] 모든 실패 경로는 null 반환(silent). 알림 센터(REQ-NOTIF-005~008)는
 *   푸시 권한/토큰 실패와 무관하게 동작한다. throw 하면 호출자(usePushTokenRegistration)가
 *   catch 하기도 하지만, 본 함수 단에서도 try/catch 로 null 반환해 방어적 깊이를 제공한다.
 * @MX:NOTE: [AUTO] projectId 는 Constants.expoConfig.extra.eas.projectId 에서 읽어 getExpoPushTokenAsync
 *   에 명시 전달. SDK 55 기본값이 존재하나 EAS Build 미사용 환경 대비 안전망.
 *   @MX:REASON: projectId 누락 시 Expo Push 서버가 400 응답하며 토큰 획득이 실패한다.
 * @MX:SPEC SPEC-NOTIF-001
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';

/** 안드로이드 기본 알림 채널 ID (REQ-NOTIF-001 Android 요구) */
const ANDROID_CHANNEL_ID = 'default';

/**
 * 알림 권한을 요청하고 Expo Push Token 을 획득한다.
 *
 * @returns 토큰 문자열 또는 null(권한 거부/토큰 획득 실패). 절대 reject 하지 않는다.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  // REQ-NOTIF-001 Android: 토큰 획득 전 기본 채널 생성 (없으면 알림 미표시)
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: '기본 알림',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  // REQ-NOTIF-002: 권한 요청. 거부 시 skip push.
  const perm = await Notifications.requestPermissionsAsync();
  if (perm.status !== 'granted') {
    return null;
  }

  // REQ-NOTIF-001: 토큰 획득. projectId 명시 전달 (EAS Build 환경 일관성).
  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  try {
    const tokenRes = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    return tokenRes.data;
  } catch {
    // silent failure — 알림 센터 unaffected
    return null;
  }
}
