/**
 * @jest-environment jsdom
 *
 * SPEC-NOTIF-001 REQ-NOTIF-001~003: usePushTokenRegistration 오케스트레이션 훅 테스트
 *
 * 인증된 사용자에 한해 registerForPushNotifications + registerPushToken 을 1회(idempotent)
 * 실행하고, 미인증/loading/null-token 시 등록을 건너뛴다. 모든 에러는 swallow (silent).
 *
 * @MX:SPEC SPEC-NOTIF-001
 */
import { renderHook, act } from '@testing-library/react';

// useSession 을 제어 가능한 mock 으로 교체
let mockSessionReturn: {
  isAuthenticated: boolean;
  loading: boolean;
} | null = { isAuthenticated: true, loading: false };

jest.mock('../../../auth/useSession', () => ({
  useSession: () => mockSessionReturn,
}));

// registerForPushNotifications / registerPushToken 을 jest.fn 으로 교체
const mockRegisterForPush = jest.fn();
const mockRegisterToken = jest.fn();
jest.mock('../registerForPush', () => ({
  registerForPushNotifications: (...args: unknown[]) => mockRegisterForPush(...args),
}));
jest.mock('../registerToken', () => ({
  registerPushToken: (...args: unknown[]) => mockRegisterToken(...args),
}));

import { usePushTokenRegistration } from '../usePushTokenRegistration';

// async useEffect 가 settle 될 때까지 대기하는 헬퍼
async function flushPromises(): Promise<void> {
  // React act 내부에서 microtask flush
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('SPEC-NOTIF-001 REQ-NOTIF-001~003: usePushTokenRegistration', () => {
  beforeEach(() => {
    mockRegisterForPush.mockReset();
    mockRegisterToken.mockReset();
    mockSessionReturn = { isAuthenticated: true, loading: false };
  });

  it('인증 시 registerForPushNotifications + registerPushToken 각 1회 호출 (idempotent)', async () => {
    mockRegisterForPush.mockResolvedValue('ExponentPushToken[t1]');
    mockRegisterToken.mockResolvedValue(undefined);

    const { rerender } = renderHook(() => usePushTokenRegistration());
    await flushPromises();
    // 재렌더 여러 번 — ref 가드로 1회만 실행되어야 한다
    rerender();
    rerender();
    await flushPromises();

    expect(mockRegisterForPush).toHaveBeenCalledTimes(1);
    expect(mockRegisterToken).toHaveBeenCalledTimes(1);
    expect(mockRegisterToken).toHaveBeenCalledWith('ExponentPushToken[t1]');
  });

  it('useSession 이 null(loading) 반환 시 등록 호출 없음', async () => {
    mockSessionReturn = null;
    mockRegisterForPush.mockResolvedValue('ExponentPushToken[t1]');

    renderHook(() => usePushTokenRegistration());
    await flushPromises();

    expect(mockRegisterForPush).not.toHaveBeenCalled();
    expect(mockRegisterToken).not.toHaveBeenCalled();
  });

  it('미인증(isAuthenticated=false) 시 등록 호출 없음', async () => {
    mockSessionReturn = { isAuthenticated: false, loading: false };
    mockRegisterForPush.mockResolvedValue('ExponentPushToken[t1]');

    renderHook(() => usePushTokenRegistration());
    await flushPromises();

    expect(mockRegisterForPush).not.toHaveBeenCalled();
  });

  it('token null(권한 거부) 시 registerPushToken 호출하지 않음', async () => {
    mockSessionReturn = { isAuthenticated: true, loading: false };
    mockRegisterForPush.mockResolvedValue(null);

    renderHook(() => usePushTokenRegistration());
    await flushPromises();

    expect(mockRegisterForPush).toHaveBeenCalledTimes(1);
    expect(mockRegisterToken).not.toHaveBeenCalled();
  });

  it('registerPushToken throw 시 swallow (silent, hook crash 없음)', async () => {
    mockSessionReturn = { isAuthenticated: true, loading: false };
    mockRegisterForPush.mockResolvedValue('ExponentPushToken[t1]');
    mockRegisterToken.mockRejectedValue(new Error('rls denied'));

    // throw 되어도 hook 이 crash 하지 않아야 한다
    expect(() => {
      renderHook(() => usePushTokenRegistration());
    }).not.toThrow();
    await flushPromises();
    // 에러가 swallow 되었으므로 테스트 통과 = throw 가 밖으로 새어나가지 않음
    expect(mockRegisterToken).toHaveBeenCalled();
  });

  it('registerForPush throw 시 __DEV__===true 면 console.warn 호출', async () => {
    const originalDev = (global as unknown as { __DEV__?: boolean }).__DEV__;
    (global as unknown as { __DEV__?: boolean }).__DEV__ = true;
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockSessionReturn = { isAuthenticated: true, loading: false };
    mockRegisterForPush.mockRejectedValue(new Error('permission race'));
    mockRegisterToken.mockResolvedValue(undefined);

    try {
      renderHook(() => usePushTokenRegistration());
      await flushPromises();

      // DEV 모드에서는 프로그래밍 버그 가시성 확보를 위해 warn 출력
      expect(warnSpy).toHaveBeenCalled();
      expect(warnSpy.mock.calls[0]?.[0]).toContain('usePushTokenRegistration');
    } finally {
      warnSpy.mockRestore();
      (global as unknown as { __DEV__?: boolean }).__DEV__ = originalDev;
    }
  });

  it('registerPushToken throw 시 __DEV__===false 면 console.warn 미호출 (silent)', async () => {
    const originalDev = (global as unknown as { __DEV__?: boolean }).__DEV__;
    (global as unknown as { __DEV__?: boolean }).__DEV__ = false;
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockSessionReturn = { isAuthenticated: true, loading: false };
    mockRegisterForPush.mockResolvedValue('ExponentPushToken[t1]');
    mockRegisterToken.mockRejectedValue(new Error('rls denied'));

    try {
      renderHook(() => usePushTokenRegistration());
      await flushPromises();

      // PROD 에서는 완전 silent — 알림 센터 unaffected (REQ-NOTIF-001/002 silent failure)
      expect(mockRegisterToken).toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
      (global as unknown as { __DEV__?: boolean }).__DEV__ = originalDev;
    }
  });
});
