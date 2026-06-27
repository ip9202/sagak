/**
 * 마이 탭 "완독 다이어리" 진입점 테스트 (SPEC-COMPLETION-002, REQ-COMP2-012)
 *
 * 검증 대상 (시나리오 13):
 * - 인증 상태에서 "완독 다이어리" 행(testID=my-completion-diary) 이 노출된다
 * - 행 탭 → router.push('/completion') 호출 (리스트 라우트)
 * - @MX:TODO 가 제거되어 no-op 가 아니다
 *
 * 기존 my.test.tsx 의 useRouter mock 은 push 를 캡처하지 않으므로, 본 파일은
 * 별도 mockPush 로 push 호출을 검증한다.
 *
 * @jest-environment jsdom
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ThemeProvider } from '../../../src/theme/theme';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn(), clear: jest.fn() },
}));
jest.mock('expo-secure-store', () => ({
  default: { getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() },
}));

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
}));

jest.mock('../../../src/auth/useSession', () => ({
  useSession: jest.fn(),
}));

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

const authenticatedSession = {
  session: { access_token: 'tok', user: { id: 'u-1' } },
  user: { id: 'u-1', email: 'reader@example.com' },
  profile: { id: 'u-1', nickname: '독자', provider: 'naver' as const },
  loading: false,
  isAuthenticated: true,
  isOnboarded: true,
  signInWithProvider: jest.fn(),
  signOut: jest.fn(),
  refreshProfile: jest.fn(),
};

function createClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

function withTheme(ui: React.ReactElement) {
  const client = createClient();
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider>{ui}</ThemeProvider>
    </QueryClientProvider>,
  );
}

describe('SPEC-COMPLETION-002 REQ-COMP2-012: 마이 "완독 다이어리" 진입점', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseSession.mockReturnValue(authenticatedSession as any);
  });

  it('인증 상태에서 "완독 다이어리" 행이 노출된다', () => {
    const { getByTestId, getByText } = withTheme(<MyTab />);
    expect(getByTestId('my-completion-diary')).toBeTruthy();
    expect(getByText('완독 다이어리')).toBeTruthy();
  });

  it('시나리오 13: 행 탭 → router.push("/completion") 호출', () => {
    const { getByTestId } = withTheme(<MyTab />);
    fireEvent.press(getByTestId('my-completion-diary'));
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/completion');
  });
});
