/**
 * 완독 다이어리 라우트 테스트 (SPEC-COMPLETION-001 P1-C conformance)
 *
 * 검증 대상:
 * - 세션 로딩(useSession null) 시 로딩 인디케이터
 * - 미인증 시 로그인 라우트로 replace (useEffect 패턴)
 * - bookId → userBookId 매핑 (useLibraryItem.data.id → CompletionDiaryScreen props)
 * - CompletionDiaryScreen 렌더링
 *
 * @jest-environment jsdom
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../../../../src/theme/theme';

// expo-router mock
const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockUseLocalSearchParams = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: jest.fn(() => ({ replace: mockReplace, push: mockPush })),
  useLocalSearchParams: (...args: unknown[]) => mockUseLocalSearchParams(...args),
}));

// 네이티브 인증/저장소 모듈 mock
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  },
}));
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
  WHEN_UNLOCKED: 'WHEN_UNLOCKED',
}));

// @expo/vector-icons(Feather) mock
jest.mock('@expo/vector-icons', () => {
  const ReactMod = require('react');
  const { Text } = require('react-native');
  const MockIcon = (props: Record<string, unknown>) =>
    ReactMod.createElement(
      Text,
      { testID: 'feather-icon' },
      (props.name as string) || 'icon',
    );
  return {
    __esModule: true,
    Feather: MockIcon,
    default: MockIcon,
  };
});

// 도메인 훅/API mock
jest.mock('../../../../src/auth/useSession', () => ({
  useSession: jest.fn(),
}));
jest.mock('../../../../src/features/library/useLibraryItem', () => ({
  useLibraryItem: jest.fn(),
}));

// react-native-svg mock — EmotionCurveChart 가 내부적으로 사용
jest.mock('react-native-svg', () => {
  const ReactMod = require('react');
  const { View } = require('react-native');
  const Mock = ({ children, testID }: { children?: React.ReactNode; testID?: string }) =>
    ReactMod.createElement(View, { testID }, children);
  const Line = (props: { testID?: string }) =>
    ReactMod.createElement(View, { testID: props.testID ?? 'svg-line' });
  const Polyline = (props: { testID?: string; stroke?: string }) =>
    ReactMod.createElement(View, { testID: props.testID ?? 'svg-polyline', stroke: props.stroke });
  const Circle = (props: { testID?: string; fill?: string }) =>
    ReactMod.createElement(View, { testID: props.testID ?? 'svg-circle', fill: props.fill });
  const G = ({ children }: { children?: React.ReactNode }) =>
    ReactMod.createElement(View, null, children);
  return { __esModule: true, default: Mock, Svg: Mock, Line, Polyline, Circle, G };
});

// CompletionDiaryScreen 내부 useCompletionReport mock — 라우트는 매핑/가드/렌더링에 집중
jest.mock('../../../../src/features/completion/useCompletionReport', () => ({
  __esModule: true,
  useCompletionReport: jest.fn(),
}));

import { useSession } from '../../../../src/auth/useSession';
import { useLibraryItem } from '../../../../src/features/library/useLibraryItem';
import { useCompletionReport } from '../../../../src/features/completion/useCompletionReport';
import type { LibraryItem } from '../../../../src/features/library/types';

import CompletionBookRoute from '../[bookId]';

const mockedUseSession = useSession as jest.MockedFunction<typeof useSession>;
const mockedUseLibraryItem = useLibraryItem as jest.MockedFunction<typeof useLibraryItem>;
const mockedUseCompletionReport = useCompletionReport as jest.MockedFunction<typeof useCompletionReport>;

const authenticatedSession = {
  session: { access_token: 'tok', user: { id: 'u-1' } },
  user: { id: 'u-1' },
  profile: { id: 'u-1', nickname: '독자' },
  loading: false,
  isAuthenticated: true,
  isOnboarded: true,
  signInWithProvider: jest.fn(),
  signOut: jest.fn(),
  refreshProfile: jest.fn(),
};

const sampleLibraryItem: LibraryItem = {
  id: 'ub-1',
  book_id: 'b-1',
  user_id: 'u-1',
  status: 'completed',
  current_page: 400,
  is_public: true,
  last_progress_at: '2026-06-15T00:00:00Z',
  created_at: '2026-06-01T00:00:00Z',
  books: {
    id: 'b-1',
    title: '미드나잇 라이브러리',
    author: '매트 헤이그',
    cover_url: null,
    total_pages: 400,
  },
} as LibraryItem;

function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

function renderRoute(client: QueryClient): ReturnType<typeof render> {
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <CompletionBookRoute />
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockReplace.mockClear();
  mockUseLocalSearchParams.mockReturnValue({ bookId: 'b-1' });
  mockedUseSession.mockReturnValue(authenticatedSession as unknown as ReturnType<typeof useSession>);
  mockedUseLibraryItem.mockReturnValue({
    data: sampleLibraryItem,
    isLoading: false,
    isError: false,
    error: null,
  } as unknown as ReturnType<typeof useLibraryItem>);
  // CompletionDiaryScreen 이 success/empty 상태로 렌더되도록 CelebrationHeader 노출
  mockedUseCompletionReport.mockReturnValue({
    status: 'empty',
    data: { total_records: 0, emotion_curve: [], highlights: [] },
    refetch: jest.fn(),
  } as unknown as ReturnType<typeof useCompletionReport>);
});

describe('SPEC-COMPLETION-001 P1-C: 완독 다이어리 라우트 (completion/[bookId])', () => {
  describe('세션 가드', () => {
    it('useSession 이 null(로딩)이면 로딩 인디케이터를 렌더링한다', () => {
      mockedUseSession.mockReturnValue(null as unknown as ReturnType<typeof useSession>);
      const { getByTestId } = renderRoute(createTestQueryClient());
      expect(getByTestId('completion-route-loading')).toBeTruthy();
    });

    it('미인증 시 로그인 라우트로 replace 한다', () => {
      mockedUseSession.mockReturnValue({
        ...authenticatedSession,
        session: null,
        user: null,
        isAuthenticated: false,
      } as unknown as ReturnType<typeof useSession>);
      renderRoute(createTestQueryClient());
      expect(mockReplace).toHaveBeenCalledWith('/(auth)/login');
    });
  });

  describe('데이터 매핑 (bookId → userBookId)', () => {
    it('useLibraryItem 에 bookId 와 userId 를 전달한다', () => {
      renderRoute(createTestQueryClient());
      expect(mockedUseLibraryItem).toHaveBeenCalledWith(
        expect.objectContaining({ bookId: 'b-1', userId: 'u-1' }),
      );
    });
  });

  describe('렌더링', () => {
    it('인증 시 CompletionDiaryScreen 을 렌더링한다 (축하 배지 노출)', () => {
      const { getByTestId } = renderRoute(createTestQueryClient());
      expect(getByTestId('completion-badge')).toBeTruthy();
    });

    it('인증 시 라우트 화면 컨테이너를 렌더링한다', () => {
      const { getByTestId } = renderRoute(createTestQueryClient());
      expect(getByTestId('completion-route-screen')).toBeTruthy();
    });
  });
});
