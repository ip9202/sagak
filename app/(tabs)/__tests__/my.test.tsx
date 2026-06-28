/**
 * 마이 탭(MyTab) 컴포넌트 테스트 (SPEC-AUTH-001 PR #19)
 *
 * 검증 대상:
 * - 로딩 상태 (useSession null) → my-loading
 * - 미인증 상태 (session 존재, user null) → my-signed-out + "로그인이 필요해요"
 * - 인증 상태 → my-screen + 닉네임/제공자/이메일
 * - 로그아웃 버튼 press → Alert 확인 → signOut() 호출
 * - signOut 실패 시 Alert 노출 (catch 분기)
 *
 * @jest-environment jsdom
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { ThemeProvider } from '../../../src/theme/theme';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Alert mock — handleSignOut 확인 다이얼로그 + 실패 Alert 검증용.
jest.spyOn(Alert, 'alert').mockImplementation(
  (_title, _message, buttons?: any) => {
    // 두 번째 버튼(destructive)의 onPress를 즉시 실행하여 로그아웃 플로우 시뮬레이션.
    if (Array.isArray(buttons) && buttons.length >= 2) {
      const confirm = buttons[1];
      if (confirm && typeof confirm.onPress === 'function') {
        confirm.onPress();
      }
    }
  },
);

// 네이티브 모듈 mock (tabs-shells.test.tsx 와 동일 패턴)
jest.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn(), clear: jest.fn() },
}));

jest.mock('expo-secure-store', () => ({
  default: { getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() },
}));

// SPEC-ROUTINE-001: my.tsx 가 독서 루틴 메뉴 진입을 위해 useRouter 사용 — 테스트 환경용 최소 mock.
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

// useSession mock
jest.mock('../../../src/auth/useSession', () => ({
  useSession: jest.fn(),
}));

// 연결계정 identities 훅 stub — MyTab 이 useUserIdentities 호출 (빈 배열 폴백).
jest.mock('../../../src/auth/useUserIdentities', () => ({
  useUserIdentities: jest.fn(() => ({ data: [], isLoading: false })),
}));

// SPEC-PROFILE-001: my.tsx 가 통계/포인트 훅을 호출 — 렌더링 분기 테스트용 stub.
// (실제 데이터 검증은 my-profile.test.tsx 가 담당)
jest.mock('../../../src/features/profile', () => ({
  useUserStats: jest.fn(() => ({ data: undefined })),
  usePointLogs: jest.fn(() => ({ data: [] })),
  computeBadges: jest.fn(() => []),
  StatCard: () => null,
  BadgeCard: () => null,
}));

import { useSession } from '../../../src/auth/useSession';
import MyTab from '../my';

const mockedUseSession = useSession as jest.MockedFunction<typeof useSession>;

function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

function withTheme(ui: React.ReactElement) {
  const client = createTestQueryClient();
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider>{ui}</ThemeProvider>
    </QueryClientProvider>,
  );
}

const authenticatedSession = {
  session: { access_token: 'tok', user: { id: 'u-1' } },
  user: { id: 'u-1', email: 'reader@example.com' },
  profile: { id: 'u-1', nickname: '독자', provider: 'naver' as const, bio: '매일 조금씩 읽어요' },
  loading: false,
  isAuthenticated: true,
  isOnboarded: true,
  signInWithProvider: jest.fn(),
  signOut: jest.fn(),
  refreshProfile: jest.fn(),
};

const signedOutSession = {
  session: null,
  user: null,
  profile: null,
  loading: false,
  isAuthenticated: false,
  isOnboarded: false,
  signInWithProvider: jest.fn(),
  signOut: jest.fn(),
  refreshProfile: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('SPEC-AUTH-001 PR #19: 마이 탭 렌더링', () => {
  it('로딩 상태(useSession null)에서 my-loading을 렌더링한다', () => {
    mockedUseSession.mockReturnValue(null as any);
    const { getByTestId } = withTheme(<MyTab />);
    expect(getByTestId('my-loading')).toBeTruthy();
  });

  it('미인증 상태(user null)에서 my-signed-out + "로그인이 필요해요"를 렌더링한다', () => {
    mockedUseSession.mockReturnValue(signedOutSession as any);
    const { getByTestId, getByText } = withTheme(<MyTab />);
    expect(getByTestId('my-signed-out')).toBeTruthy();
    expect(getByText('로그인이 필요해요')).toBeTruthy();
  });

  it('인증 상태에서 my-screen과 닉네임/제공자/이메일을 렌더링한다', () => {
    mockedUseSession.mockReturnValue(authenticatedSession as any);
    const { getByTestId, getByText } = withTheme(<MyTab />);
    expect(getByTestId('my-screen')).toBeTruthy();
    expect(getByText('독자')).toBeTruthy();
    // 제공자 라벨 (naver → 네이버)
    expect(getByText('네이버')).toBeTruthy();
    expect(getByText('reader@example.com')).toBeTruthy();
  });

  it('profile.bio 가 있으면 동적 bio 를 렌더링한다 (SPEC-PROFILE-001 bio)', () => {
    mockedUseSession.mockReturnValue(authenticatedSession as any);
    const { getByText } = withTheme(<MyTab />);
    expect(getByText('매일 조금씩 읽어요')).toBeTruthy();
  });

  it('profile.bio 가 null/빈값이면 BIO_PLACEHOLDER 폴백을 렌더링한다', () => {
    mockedUseSession.mockReturnValue({
      ...authenticatedSession,
      profile: { id: 'u-1', nickname: '독자', provider: 'naver' as const, bio: null },
    } as any);
    const { getByText } = withTheme(<MyTab />);
    // .pen F15-My 기본 문구 폴백
    expect(getByText('매일 조금씩, 종이책과 함께')).toBeTruthy();
  });

  it('로그아웃 버튼 press → 확인 → signOut() 호출', async () => {
    const signOutSpy = jest.fn().mockResolvedValue(undefined);
    mockedUseSession.mockReturnValue({
      ...authenticatedSession,
      signOut: signOutSpy,
    } as any);

    const { getByTestId } = withTheme(<MyTab />);
    fireEvent.press(getByTestId('my-logout-button'));

    // Alert.alert 의 confirm 버튼 onPress가 mock 내에서 즉시 실행됨.
    await waitFor(() => {
      expect(signOutSpy).toHaveBeenCalledTimes(1);
    });
  });

  it('signOut 실패 시 실패 Alert을 노출한다 (catch 분기)', async () => {
    const signOutSpy = jest.fn().mockRejectedValue(new Error('token refresh failed'));
    mockedUseSession.mockReturnValue({
      ...authenticatedSession,
      signOut: signOutSpy,
    } as any);

    const { getByTestId } = withTheme(<MyTab />);
    fireEvent.press(getByTestId('my-logout-button'));

    await waitFor(() => {
      expect(signOutSpy).toHaveBeenCalledTimes(1);
    });
    // 실패 Alert 호출 검증 (원인 미노출 고정 메시지)
    await waitFor(() => {
      const calls = (Alert.alert as jest.Mock).mock.calls;
      const failureCall = calls.find((c) => c[0] === '로그아웃 실패');
      expect(failureCall).toBeTruthy();
      expect(failureCall[1]).toBe('잠시 후 다시 시도해주세요.');
    });
  });
});
