/**
 * AuthContext 단위/통합 테스트
 * SPEC-AUTH-001 — REQ-AUTH-010~014, AC-S1~S9
 *
 * 테스트 범위 (M1 마일스톤):
 * - M1-1 AC-S1: AuthProvider 배치 + AuthContext 상태/액션 노출
 * - M1-2 AC-S1: signInWithProvider 구현 (signInWithOAuth 호출)
 * - M1-3 AC-S5/S6/S9: signOut 구현 (auth.signOut 호출)
 * - M1-4 AC-S2/S3/S4: getSession + onAuthStateChange 구독
 * - M1-5 AC-S7/S8: fetchProfile + refreshProfile (public.users 조회)
 *
 * Mock 전략:
 * - getSupabaseClient 반환값을 주입하여 Supabase SDK 의존성을 분리
 * - expo-linking getOAuthRedirectUri 경계는 oauth.test.ts에서 이미 검증됨
 */
import React, { useContext } from 'react';
import { Text } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';

// oauth 모듈 모킹 — expo-linking 경계는 oauth.test.ts에서 이미 검증됨
const mockGetOAuthRedirectUri = jest.fn();
jest.mock('../oauth', () => ({
  getOAuthRedirectUri: (...args: unknown[]) => mockGetOAuthRedirectUri(...args),
}));

// getSupabaseClient 모듈을 먼저 모킹 (AuthProvider가 로드될 때와 동일한 인스턴스 주입)
const mockSupabaseClient: {
  auth: {
    getSession: jest.Mock;
    onAuthStateChange: jest.Mock;
    signInWithOAuth: jest.Mock;
    signOut: jest.Mock;
  };
  from: jest.Mock;
} = {
  auth: {
    getSession: jest.fn(),
    onAuthStateChange: jest.fn(),
    signInWithOAuth: jest.fn(),
    signOut: jest.fn(),
  },
  from: jest.fn(),
};

jest.mock('../../lib/supabase/client', () => ({
  getSupabaseClient: () => mockSupabaseClient,
}));

import { AuthProvider, AuthContext } from '../AuthContext';
import type { AuthContextValue } from '../types';

// onAuthStateChange 구독 해제 함수 스텁
let onAuthCallback: ((event: string, session: unknown) => void) | null = null;
const unsubscribeMock = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  onAuthCallback = null;
  // getOAuthRedirectUri 기본 스텁 — 각 테스트에서 재정의 가능
  mockGetOAuthRedirectUri.mockReturnValue('sagak://auth/callback');
  mockSupabaseClient.auth.getSession.mockReset();
  mockSupabaseClient.auth.onAuthStateChange.mockImplementation((cb: (event: string, session: unknown) => void) => {
    onAuthCallback = cb;
    return { data: { subscription: { unsubscribe: unsubscribeMock } } };
  });
  mockSupabaseClient.auth.signInWithOAuth.mockReset();
  mockSupabaseClient.auth.signOut.mockReset();
  mockSupabaseClient.from.mockReset();
});

/**
 * AuthContext 값을 읽기 위한 테스트 전용 컨슈머 컴포넌트
 */
function ContextProbe({ onValue }: { onValue: (v: AuthContextValue) => void }) {
  const value = useContext(AuthContext);
  if (value) onValue(value);
  return <Text>probe</Text>;
}

describe('AuthContext — M1-1 AC-S1: Provider 배치 및 상태 노출', () => {
  it('AuthProvider가 자식 트리를 감싼다 (children 렌더링)', () => {
    const { getByText } = render(
      <AuthProvider>
        <Text>child-content</Text>
      </AuthProvider>
    );
    expect(getByText('child-content')).toBeTruthy();
  });

  it('AuthProvider 범위 내에서 AuthContext가 null이 아닌 값을 노출한다', async () => {
    // 저장된 세션이 없다고 가정 (AC-S3 기본 상태)
    mockSupabaseClient.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });

    const captured: AuthContextValue[] = [];
    render(
      <AuthProvider>
        <ContextProbe onValue={(v) => captured.push(v)} />
      </AuthProvider>
    );
    await waitFor(() => expect(captured.length).toBeGreaterThan(0));

    expect(captured[0]).not.toBeNull();
  });

  it('AuthContext가 session/user/profile/loading 상태를 노출한다', async () => {
    mockSupabaseClient.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });

    const captured: AuthContextValue[] = [];
    render(
      <AuthProvider>
        <ContextProbe onValue={(v) => captured.push(v)} />
      </AuthProvider>
    );
    await waitFor(() => expect(captured.length).toBeGreaterThan(0));

    const value = captured[0];
    expect(value).toHaveProperty('session');
    expect(value).toHaveProperty('user');
    expect(value).toHaveProperty('profile');
    expect(value).toHaveProperty('loading');
    // 저장된 세션이 없으므로 session/user/profile은 null
    expect(value.session).toBeNull();
    expect(value.user).toBeNull();
    expect(value.profile).toBeNull();
  });

  it('AuthContext가 signInWithProvider/signOut/refreshProfile 액션을 노출한다', async () => {
    mockSupabaseClient.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });

    const captured: AuthContextValue[] = [];
    render(
      <AuthProvider>
        <ContextProbe onValue={(v) => captured.push(v)} />
      </AuthProvider>
    );
    await waitFor(() => expect(captured.length).toBeGreaterThan(0));

    const value = captured[0];
    expect(typeof value.signInWithProvider).toBe('function');
    expect(typeof value.signOut).toBe('function');
    expect(typeof value.refreshProfile).toBe('function');
  });

  it('AuthProvider 외부에서 AuthContext 사용 시 null을 반환한다 (G7 컨텍스트 누락 방어)', () => {
    // AuthProvider 없이 직접 useContext를 호출하면 null이어야 한다.
    // (useSession 훅의 throw 로직의 기반이 되는 계약)
    const Inner = () => {
      const value = useContext(AuthContext);
      return <Text>{value === null ? 'no-provider' : 'has-provider'}</Text>;
    };
    const { getByText } = render(<Inner />);
    expect(getByText('no-provider')).toBeTruthy();
  });
});

describe('AuthContext — M1-2 AC-S1: signInWithProvider OAuth 호출 (A1~A3)', () => {
  /**
   * 헬퍼: AuthProvider를 렌더링하고 첫 번째 context 값을 캡처한다.
   * 세션이 없는 초기 상태로 설정한다.
   */
  async function renderAndCapture(): Promise<AuthContextValue> {
    mockSupabaseClient.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    const captured: AuthContextValue[] = [];
    render(
      <AuthProvider>
        <ContextProbe onValue={(v) => captured.push(v)} />
      </AuthProvider>
    );
    await waitFor(() => expect(captured.length).toBeGreaterThan(0));
    return captured[0];
  }

  it('A1 — signInWithProvider("kakao")가 signInWithOAuth를 kakao provider로 호출한다', async () => {
    mockSupabaseClient.auth.signInWithOAuth.mockResolvedValue({ data: { provider: 'kakao', url: 'https://kauth.kakao.com/oauth/authorize' }, error: null });
    const value = await renderAndCapture();

    await value.signInWithProvider('kakao');

    expect(mockSupabaseClient.auth.signInWithOAuth).toHaveBeenCalledTimes(1);
    expect(mockSupabaseClient.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'kakao',
      options: { redirectTo: 'sagak://auth/callback' },
    });
  });

  it('A2 — signInWithProvider("apple")가 signInWithOAuth를 apple provider로 호출한다', async () => {
    mockSupabaseClient.auth.signInWithOAuth.mockResolvedValue({ data: { provider: 'apple', url: 'https://appleid.apple.com/auth/authorize' }, error: null });
    const value = await renderAndCapture();

    await value.signInWithProvider('apple');

    expect(mockSupabaseClient.auth.signInWithOAuth).toHaveBeenCalledTimes(1);
    expect(mockSupabaseClient.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'apple',
      options: { redirectTo: 'sagak://auth/callback' },
    });
  });

  it('A3 — signInWithProvider("google")가 signInWithOAuth를 google provider로 호출한다', async () => {
    mockSupabaseClient.auth.signInWithOAuth.mockResolvedValue({ data: { provider: 'google', url: 'https://accounts.google.com/o/oauth2/auth' }, error: null });
    const value = await renderAndCapture();

    await value.signInWithProvider('google');

    expect(mockSupabaseClient.auth.signInWithOAuth).toHaveBeenCalledTimes(1);
    expect(mockSupabaseClient.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: 'sagak://auth/callback' },
    });
  });

  it('signInWithProvider가 getOAuthRedirectUri() 결과를 redirectTo로 전달한다 (REQ-AUTH-002)', async () => {
    mockSupabaseClient.auth.signInWithOAuth.mockResolvedValue({ data: { provider: 'kakao', url: 'https://kauth.kakao.com' }, error: null });
    mockGetOAuthRedirectUri.mockReturnValue('sagak://custom-callback');
    const value = await renderAndCapture();

    await value.signInWithProvider('kakao');

    expect(mockGetOAuthRedirectUri).toHaveBeenCalledTimes(1);
    expect(mockSupabaseClient.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'kakao',
      options: { redirectTo: 'sagak://custom-callback' },
    });
  });
});
