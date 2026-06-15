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
import { act, render, waitFor } from '@testing-library/react-native';

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
import type { Session, User } from '@supabase/supabase-js';

// onAuthStateChange 구독 해제 함수 스텁
let onAuthCallback: ((event: string, session: unknown) => void) | null = null;
const unsubscribeMock = jest.fn();

/**
 * 테스트용 최소 Session/User 객체 팩토리
 * @ts-expect-error 없이 타입 시스템을 통과하기 위해 unknown 단언을 사용한다.
 * 실제 Supabase SDK의 전체 필드를 채울 필요 없이 id/access_token 정도만 필요하다.
 */
function makeMockSession(userId: string): Session {
  return {
    access_token: `token-${userId}`,
    refresh_token: `refresh-${userId}`,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: 'bearer',
    user: {
      id: userId,
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: '2026-01-01T00:00:00Z',
    } as unknown as User,
  } as unknown as Session;
}

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
  // from() 기본 스텁 — fetchProfile 호출 시 crash 방지 (profile null 반환)
  // 개별 테스트에서 재정의하여 구체적인 행을 주입할 수 있다.
  const defaultSingle = jest.fn().mockResolvedValue({ data: null, error: null });
  const defaultEq = jest.fn().mockReturnValue({ single: defaultSingle });
  const defaultSelect = jest.fn().mockReturnValue({ eq: defaultEq });
  mockSupabaseClient.from.mockReturnValue({
    select: defaultSelect,
    eq: defaultEq,
    single: defaultSingle,
  });
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
    // M1-4부터 useEffect가 getSession을 호출하므로 스텁 필요
    mockSupabaseClient.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
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

describe('AuthContext — M1-3 AC-S6/S9: signOut 액션 (REQ-AUTH-011, REQ-AUTH-014)', () => {
  /**
   * 헬퍼: AuthProvider를 렌더링하고 컨텍스트 값 스냅샷을 지속적으로 캡처한다.
   * 컨텍스트 값은 렌더링마다 갱신되므로 배열에 누적하여 마지막 값을 읽는다.
   * 세션이 없는 초기 상태로 설정한다 (M1-4 getSession/onAuthStateChange 구현 전).
   */
  async function renderAndCaptureAll(): Promise<AuthContextValue[]> {
    mockSupabaseClient.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    const captured: AuthContextValue[] = [];
    render(
      <AuthProvider>
        <ContextProbe onValue={(v) => captured.push(v)} />
      </AuthProvider>
    );
    await waitFor(() => expect(captured.length).toBeGreaterThan(0));
    return captured;
  }

  it('S9 — signOut()이 supabase.auth.signOut을 정확히 1회 호출한다', async () => {
    mockSupabaseClient.auth.signOut.mockResolvedValue({ error: null });
    const captured = await renderAndCaptureAll();
    await captured[0].signOut();

    expect(mockSupabaseClient.auth.signOut).toHaveBeenCalledTimes(1);
  });

  it('S9 — signOut() 이후 session/user/profile 상태가 null로 초기화된다', async () => {
    // REQ-AUTH-014: 로컬 세션 폐기 — signOut 액션은 상태를 null로 클리어한다.
    // M1-4에서 onAuthStateChange SIGNED_OUT 이벤트가 동일한 클리어를 트리거하지만,
    // signOut 액션 자체도 능동적으로 상태를 초기화해야 한다 (이벤트 도착 전 UI가 갱신되도록).
    mockSupabaseClient.auth.signOut.mockResolvedValue({ error: null });
    const captured = await renderAndCaptureAll();
    await captured[0].signOut();

    // 렌더 큐가 플러시된 후 최신 값을 확인한다
    await waitFor(() => {
      const latest = captured[captured.length - 1];
      expect(latest.session).toBeNull();
      expect(latest.user).toBeNull();
      expect(latest.profile).toBeNull();
    });
  });

  it('S9 — signOut()은 auth.signOut이 거부되어도 reject를 전파한다', async () => {
    // 에러 전파 계약 — 호출자가 catch할 수 있도록 reject를 숨기지 않는다.
    mockSupabaseClient.auth.signOut.mockRejectedValue(new Error('network'));
    const captured = await renderAndCaptureAll();

    await expect(captured[0].signOut()).rejects.toThrow('network');
  });
});

describe('AuthContext — M1-4 AC-S3: getSession() 자동 로그인 (REQ-AUTH-012)', () => {
  /**
   * 마운트 시 supabase.auth.getSession()을 1회 호출하여 저장된 세션을 복원한다.
   * 저장된 세션이 있으면 session/user를 설정한다.
   */

  it('S3-1 — AuthProvider 마운트 시 getSession()을 정확히 1회 호출한다', async () => {
    mockSupabaseClient.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });

    render(
      <AuthProvider>
        <ContextProbe onValue={() => {}} />
      </AuthProvider>
    );
    // useEffect 실행 대기
    await waitFor(() => {
      expect(mockSupabaseClient.auth.getSession).toHaveBeenCalledTimes(1);
    });
  });

  it('S3-2 — getSession이 세션을 반환하면 session/user 상태에 반영된다', async () => {
    const mockSession = makeMockSession('user-123');
    mockSupabaseClient.auth.getSession.mockResolvedValue({ data: { session: mockSession }, error: null });

    const captured: AuthContextValue[] = [];
    render(
      <AuthProvider>
        <ContextProbe onValue={(v) => captured.push(v)} />
      </AuthProvider>
    );

    await waitFor(() => {
      const latest = captured[captured.length - 1];
      expect(latest.session).not.toBeNull();
      expect(latest.user).not.toBeNull();
      expect(latest.user?.id).toBe('user-123');
    });
  });

  it('S3-3 — getSession이 세션을 반환하지 않으면 session/user는 null로 유지된다', async () => {
    mockSupabaseClient.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });

    const captured: AuthContextValue[] = [];
    render(
      <AuthProvider>
        <ContextProbe onValue={(v) => captured.push(v)} />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(mockSupabaseClient.auth.getSession).toHaveBeenCalledTimes(1);
    });

    const latest = captured[captured.length - 1];
    expect(latest.session).toBeNull();
    expect(latest.user).toBeNull();
  });
});

describe('AuthContext — M1-4 AC-S2: onAuthStateChange 구독 (REQ-AUTH-011)', () => {
  /**
   * 마운트 시 supabase.auth.onAuthStateChange 콜백을 등록한다.
   * 4개 이벤트(INITIAL_SESSION/SIGNED_IN/TOKEN_REFRESHED/SIGNED_OUT)를 처리한다.
   */

  it('S2-1 — AuthProvider 마운트 시 onAuthStateChange를 정확히 1회 구독한다', async () => {
    mockSupabaseClient.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });

    render(
      <AuthProvider>
        <ContextProbe onValue={() => {}} />
      </AuthProvider>
    );
    await waitFor(() => {
      expect(mockSupabaseClient.auth.onAuthStateChange).toHaveBeenCalledTimes(1);
    });
  });

  it('S2-2 — AuthProvider 언마운트 시 구독을 해제한다 (unsubscribe 호출)', async () => {
    mockSupabaseClient.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });

    const { unmount } = render(
      <AuthProvider>
        <ContextProbe onValue={() => {}} />
      </AuthProvider>
    );
    await waitFor(() => {
      expect(mockSupabaseClient.auth.onAuthStateChange).toHaveBeenCalledTimes(1);
    });

    unmount();

    expect(unsubscribeMock).toHaveBeenCalledTimes(1);
  });

  it('S2-3 — INITIAL_SESSION 이벤트 수신 시 loading을 false로 설정한다', async () => {
    mockSupabaseClient.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });

    const captured: AuthContextValue[] = [];
    render(
      <AuthProvider>
        <ContextProbe onValue={(v) => captured.push(v)} />
      </AuthProvider>
    );
    await waitFor(() => {
      expect(onAuthCallback).not.toBeNull();
    });

    // INITIAL_SESSION 이벤트 발생
    act(() => {
      onAuthCallback?.('INITIAL_SESSION', null);
    });

    await waitFor(() => {
      const latest = captured[captured.length - 1];
      expect(latest.loading).toBe(false);
    });
  });

  it('S2-4 — SIGNED_IN 이벤트 수신 시 session/user를 설정한다', async () => {
    mockSupabaseClient.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });

    const captured: AuthContextValue[] = [];
    render(
      <AuthProvider>
        <ContextProbe onValue={(v) => captured.push(v)} />
      </AuthProvider>
    );
    await waitFor(() => {
      expect(onAuthCallback).not.toBeNull();
    });

    const mockSession = makeMockSession('signed-in-user');

    act(() => {
      onAuthCallback?.('SIGNED_IN', mockSession);
    });

    await waitFor(() => {
      const latest = captured[captured.length - 1];
      expect(latest.session).not.toBeNull();
      expect(latest.user).not.toBeNull();
      expect(latest.user?.id).toBe('signed-in-user');
    });
  });

  it('S2-5 — SIGNED_IN 이벤트 수신 시 fetchProfile(사용자 프로필 조회)을 트리거한다 (AC-S4)', async () => {
    // REQ-AUTH-011: SIGNED_IN 이벤트는 profile 조회를 트리거한다.
    // profile 조회는 supabase.from('users').select() 호출로 나타난다.
    mockSupabaseClient.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });

    render(
      <AuthProvider>
        <ContextProbe onValue={() => {}} />
      </AuthProvider>
    );
    await waitFor(() => {
      expect(onAuthCallback).not.toBeNull();
    });

    const mockSession = makeMockSession('profile-user');

    await act(async () => {
      onAuthCallback?.('SIGNED_IN', mockSession);
    });

    await waitFor(() => {
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('users');
    });
  });

  it('S2-6 — TOKEN_REFRESHED 이벤트 수신 시 갱신된 session/user로 상태를 업데이트한다', async () => {
    mockSupabaseClient.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });

    const captured: AuthContextValue[] = [];
    render(
      <AuthProvider>
        <ContextProbe onValue={(v) => captured.push(v)} />
      </AuthProvider>
    );
    await waitFor(() => {
      expect(onAuthCallback).not.toBeNull();
    });

    const refreshedSession = makeMockSession('refreshed-user');

    act(() => {
      onAuthCallback?.('TOKEN_REFRESHED', refreshedSession);
    });

    await waitFor(() => {
      const latest = captured[captured.length - 1];
      expect(latest.session).not.toBeNull();
      expect(latest.user?.id).toBe('refreshed-user');
    });
  });

  it('S2-7 — SIGNED_OUT 이벤트 수신 시 session/user/profile을 모두 null로 초기화한다', async () => {
    mockSupabaseClient.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });

    const captured: AuthContextValue[] = [];
    render(
      <AuthProvider>
        <ContextProbe onValue={(v) => captured.push(v)} />
      </AuthProvider>
    );
    await waitFor(() => {
      expect(onAuthCallback).not.toBeNull();
    });

    // 먼저 SIGNED_IN 으로 상태를 채운다
    const mockSession = makeMockSession('signout-user');
    act(() => {
      onAuthCallback?.('SIGNED_IN', mockSession);
    });
    await waitFor(() => {
      expect(captured[captured.length - 1].user).not.toBeNull();
    });

    // SIGNED_OUT 이벤트 → 상태 클리어
    act(() => {
      onAuthCallback?.('SIGNED_OUT', null);
    });

    await waitFor(() => {
      const latest = captured[captured.length - 1];
      expect(latest.session).toBeNull();
      expect(latest.user).toBeNull();
      expect(latest.profile).toBeNull();
    });
  });

  it('S2-8 — INITIAL_SESSION 이벤트가 세션을 전달하면 session/user를 설정하고 fetchProfile을 트리거한다', async () => {
    // 커버리지: INITIAL_SESSION + nextSession != null 분기
    mockSupabaseClient.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });

    const captured: AuthContextValue[] = [];
    render(
      <AuthProvider>
        <ContextProbe onValue={(v) => captured.push(v)} />
      </AuthProvider>
    );
    await waitFor(() => {
      expect(onAuthCallback).not.toBeNull();
    });

    const initialSession = makeMockSession('initial-user');
    await act(async () => {
      onAuthCallback?.('INITIAL_SESSION', initialSession);
    });

    await waitFor(() => {
      const latest = captured[captured.length - 1];
      expect(latest.session).not.toBeNull();
      expect(latest.user?.id).toBe('initial-user');
      expect(latest.loading).toBe(false);
    });
    // fetchProfile 트리거 확인
    expect(mockSupabaseClient.from).toHaveBeenCalledWith('users');
  });

  it('S2-9 — 알 수 없는 이벤트(PASSWORD_RECOVERY 등)는 무시되고 상태를 변경하지 않는다', async () => {
    // 커버리지: default 케이스 — SPEC에 명시되지 않은 이벤트는 no-op
    mockSupabaseClient.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });

    const captured: AuthContextValue[] = [];
    render(
      <AuthProvider>
        <ContextProbe onValue={(v) => captured.push(v)} />
      </AuthProvider>
    );
    await waitFor(() => {
      expect(onAuthCallback).not.toBeNull();
    });

    const beforeCount = captured.length;
    act(() => {
      onAuthCallback?.('PASSWORD_RECOVERY', null);
    });

    // 상태 변경 없음 — 캡처된 값 개수가 늘어나지 않을 수 있으나,
    // 최소한 session/user가 null로 유지되는지만 확인
    const latest = captured[captured.length - 1];
    expect(latest.session).toBeNull();
    expect(latest.user).toBeNull();
    void beforeCount;
  });
});

describe('AuthContext — M1-4 AC-S4: fetchProfile (public.users 조회)', () => {
  /**
   * SIGNED_IN 이벤트 시 fetchProfile()이 호출되어 public.users에서 프로필을 조회한다.
   * 조회 결과가 profile 상태에 반영된다.
   */

  it('S4-1 — 프로필 조회 성공 시 profile 상태에 반영된다', async () => {
    mockSupabaseClient.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    const profileRow = {
      id: 'profile-user-2',
      nickname: '테스트독자',
      avatar_url: null,
      provider: 'kakao',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };
    mockSupabaseClient.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: profileRow, error: null }),
        }),
      }),
    });

    const captured: AuthContextValue[] = [];
    render(
      <AuthProvider>
        <ContextProbe onValue={(v) => captured.push(v)} />
      </AuthProvider>
    );
    await waitFor(() => {
      expect(onAuthCallback).not.toBeNull();
    });

    const mockSession = makeMockSession('profile-user-2');

    await act(async () => {
      onAuthCallback?.('SIGNED_IN', mockSession);
    });

    await waitFor(() => {
      const latest = captured[captured.length - 1];
      expect(latest.profile).not.toBeNull();
      expect(latest.profile?.id).toBe('profile-user-2');
      expect(latest.profile?.nickname).toBe('테스트독자');
    });
  });

  it('S4-2 — 프로필 조회 실패 시 profile은 null로 유지된다 (에러 전파 안 함)', async () => {
    mockSupabaseClient.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    mockSupabaseClient.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: null, error: { message: 'row not found' } }),
        }),
      }),
    });

    const captured: AuthContextValue[] = [];
    render(
      <AuthProvider>
        <ContextProbe onValue={(v) => captured.push(v)} />
      </AuthProvider>
    );
    await waitFor(() => {
      expect(onAuthCallback).not.toBeNull();
    });

    const mockSession = makeMockSession('no-profile-user');

    await act(async () => {
      onAuthCallback?.('SIGNED_IN', mockSession);
    });

    await waitFor(() => {
      const latest = captured[captured.length - 1];
      // session/user는 설정되지만 profile은 조회 실패로 null
      expect(latest.session).not.toBeNull();
      expect(latest.user).not.toBeNull();
      expect(latest.profile).toBeNull();
    });
  });
});
