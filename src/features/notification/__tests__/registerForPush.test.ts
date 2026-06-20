/**
 * SPEC-NOTIF-001 REQ-NOTIF-001/002: 푸시 토큰 획득 + 권한 요청 단위 테스트
 *
 * acceptance N1/N2 검증:
 * - N1: getExpoPushTokenAsync 토큰 획득, 실패 시 silent null (알림 센터 unaffected)
 * - N2: requestPermissionsAsync 거부 시 skip push (null 반환, throw 없음)
 * - Android 채널 사전 생성 (setNotificationChannelAsync)
 *
 * @MX:SPEC SPEC-NOTIF-001
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';
// jest.config.js moduleNameMapper 가 expo-notifications 를 본 __mocks__ 로 매핑.
// 실제 코드가 쓰는 import 경로 그대로 import 하면 자동으로 mock 이 주입된다.
import * as Notifications from 'expo-notifications';
// 제어 헬퍼는 mock 소스에서 직접 import (경로 명시).
import * as MockControl from './__mocks__/expo-notifications';
import { registerForPushNotifications } from '../registerForPush';

describe('SPEC-NOTIF-001 REQ-NOTIF-001/002: registerForPushNotifications', () => {
  const originalOS = Platform.OS;

  beforeEach(() => {
    MockControl.__reset();
  });

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
  });

  function setPlatform(os: 'ios' | 'android'): void {
    Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
  }

  it('권한 granted + 토큰 획득 성공 시 token 문자열 반환', async () => {
    setPlatform('ios');
    MockControl.setPermissionResponse({
      status: 'granted',
      granted: true,
      canAskAgain: true,
      expires: 'never',
    });
    MockControl.setTokenResult({ type: 'expo', data: 'ExponentPushToken[abc123]' });

    const token = await registerForPushNotifications();

    expect(token).toBe('ExponentPushToken[abc123]');
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(Notifications.getExpoPushTokenAsync).toHaveBeenCalledTimes(1);
  });

  it('권한 거부(status !== granted) 시 null 반환, throw 하지 않음', async () => {
    setPlatform('ios');
    MockControl.setPermissionResponse({
      status: 'denied',
      granted: false,
      canAskAgain: false,
      expires: 'never',
    });

    const token = await registerForPushNotifications();

    expect(token).toBeNull();
    expect(Notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
  });

  it('getExpoPushTokenAsync reject 시 null 반환, throw 하지 않음 (silent failure)', async () => {
    setPlatform('ios');
    MockControl.setPermissionResponse({
      status: 'granted',
      granted: true,
      canAskAgain: true,
      expires: 'never',
    });
    MockControl.setTokenError(new Error('network offline'));

    const token = await registerForPushNotifications();

    expect(token).toBeNull();
  });

  it('Android 시 토큰 획득 전 setNotificationChannelAsync 호출', async () => {
    setPlatform('android');
    MockControl.setPermissionResponse({
      status: 'granted',
      granted: true,
      canAskAgain: true,
      expires: 'never',
    });
    MockControl.setTokenResult({ type: 'expo', data: 'ExponentPushToken[android]' });

    const token = await registerForPushNotifications();

    expect(token).toBe('ExponentPushToken[android]');
    expect(Notifications.setNotificationChannelAsync).toHaveBeenCalled();
    const channelIndex = (Notifications.setNotificationChannelAsync as jest.Mock).mock.invocationCallOrder[0];
    const tokenIndex = (Notifications.getExpoPushTokenAsync as jest.Mock).mock.invocationCallOrder[0];
    expect(channelIndex).toBeLessThan(tokenIndex);
  });

  it('W1: __DEV__에서 projectId 누락 시 console.warn 호출 (EAS 설정 누락 가시성)', async () => {
    setPlatform('ios');
    const originalDev = (global as unknown as { __DEV__?: boolean }).__DEV__;
    (global as unknown as { __DEV__?: boolean }).__DEV__ = true;
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    MockControl.setPermissionResponse({
      status: 'granted',
      granted: true,
      canAskAgain: true,
      expires: 'never',
    });
    MockControl.setTokenResult({ type: 'expo', data: 'ExponentPushToken[noProjectId]' });

    // expoConfig.extra.eas 누락 상황 시뮬레이션
    const original = Constants.expoConfig;
    Object.defineProperty(Constants, 'expoConfig', {
      value: { extra: {} },
      configurable: true,
    });

    try {
      const token = await registerForPushNotifications();

      // silent-failure 반환 동작은 유지 (요구사항: 동작 변경 금지)
      expect(token).toBe('ExponentPushToken[noProjectId]');
      // DEV 경고가 발생해야 함
      expect(warnSpy).toHaveBeenCalled();
      const serialized = warnSpy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(serialized).toContain('projectId');
      expect(serialized).toContain('registerForPush');
    } finally {
      warnSpy.mockRestore();
      (global as unknown as { __DEV__?: boolean }).__DEV__ = originalDev;
      Object.defineProperty(Constants, 'expoConfig', {
        value: original,
        configurable: true,
      });
    }
  });
});
