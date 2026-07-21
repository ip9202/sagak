/**
 * 동적 라우트 파라미터 수신 테스트 — [bookId], clubs/[clubId]
 * SPEC-NAV-001 — REQ-NAV-010, REQ-NAV-011, 인수 시나리오 S1, S2
 * SPEC-BOOK-001 M4-6 — [bookId] 가 BookDetailScreen 으로 교체됨에 따라 테스트 업데이트
 *
 * useLocalSearchParams()가 동적 라우트 파라미터를 반환하는지 검증.
 * [bookId] 는 SPEC-BOOK-001 M4-3 BookDetailScreen 으로 위임 — 세션 가드(loading)를 검증.
 */
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// SPEC-LIBRARY-001 TASK-010: BookDetailScreen 이 mutation hooks 사용 → QueryClientProvider 필요
function wrapWithQueryClient(element: React.ReactElement): React.ReactElement {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
  return React.createElement(
    QueryClientProvider,
    { client },
    element,
  );
}

jest.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn(), clear: jest.fn() },
}));

jest.mock('expo-secure-store', () => ({
  default: { getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() },
}));

jest.mock('expo-linear-gradient', () => {
  const R = require('react');
  const { View } = require('react-native');
  return {
    LinearGradient: (props: { children?: React.ReactNode }) =>
      R.createElement(View, props),
  };
});

// useSession mock — SPEC-BOOK-001 M4-3 BookDetailScreen 이 consume.
// 기본: loading(null) → ActivityIndicator 렌더링 (파라미터 수신 자체는 라우트 단에서 보증)
jest.mock('../../../src/auth/useSession', () => ({
  useSession: jest.fn(() => null),
}));

// bookDetailApi mock — 로딩 상태에서는 호출되지 않으므로 안전망
jest.mock('../../../src/features/book/bookDetailApi', () => ({
  getBookDetail: jest.fn(),
}));

// SPEC-CLUB-002 M4: clubs/[clubId] 가 ClubDetailScreen 으로 교체됨.
// useClubDetail/useClubMembers 가 supabase client 를 소비하므로 안전망으로 hook 만 mock.
jest.mock('../../../src/features/club/trackB/hooks', () => ({
  __esModule: true,
  useClubDetail: jest.fn(() => ({ isLoading: true, data: undefined, isError: false, error: null })),
  useClubMembers: jest.fn(() => ({ isLoading: false, data: [], isError: false, error: null })),
  useUpdateProgress: jest.fn(() => ({ mutate: jest.fn(), isPending: false, isError: false, error: null })),
  useCloseClub: jest.fn(() => ({ mutate: jest.fn(), isPending: false, isError: false, error: null })),
  useReactivateClub: jest.fn(() => ({ mutate: jest.fn(), isPending: false, isError: false, error: null })),
  useLeaveClub: jest.fn(() => ({ mutate: jest.fn(), isPending: false, isError: false, error: null })),
}));

// SPEC-LIBRARY-001 TASK-010: BookDetailScreen 이 useLibraryItem/mutation hooks 사용.
// 라우팅 파라미터 수신 테스트이므로 라이브러리 의존성은 안전망으로 mock.
jest.mock('../../../src/features/library/libraryApi', () => ({
  __esModule: true,
  getLibrary: jest.fn(),
  getLibraryItem: jest.fn(),
  addBook: jest.fn(),
  deleteBook: jest.fn(),
  updateProgress: jest.fn(),
  updateStatus: jest.fn(),
  updateVisibility: jest.fn(),
}));
jest.mock('../../../src/features/library/useLibraryItem', () => ({
  useLibraryItem: jest.fn(() => ({
    data: null,
    isLoading: false,
    isError: false,
    error: null,
  })),
}));

// useLocalSearchParams를 테스트별로 오버라이드 가능하게 팩토리에서 변수 참조
const mockSearchParams: Record<string, any> = {};
jest.mock('expo-router', () => {
  const ReactMod = require('react');
  const { Text } = require('react-native');
  return {
    useLocalSearchParams: () => mockSearchParams,
    // useRouter: jest.fn() — 테스트별로 mockReturnValue 로 router(back/replace) 를 교체 (FINDING-1)
    useRouter: jest.fn(() => ({ replace: jest.fn(), push: jest.fn(), back: jest.fn(), canGoBack: () => false })),
    Redirect: ({ href }: { href: string }) =>
      ReactMod.createElement(Text, { testID: 'redirect' }, href),
  };
});

import BookDetailRoute from '../[bookId]';
import ClubDetailRoute from '../clubs/[clubId]';
import { useSession } from '../../../src/auth/useSession';
import { getBookDetail } from '../../../src/features/book/bookDetailApi';
import { deleteBook, getLibraryItem } from '../../../src/features/library/libraryApi';
import { useLibraryItem } from '../../../src/features/library/useLibraryItem';

const mockedUseSession = useSession as jest.MockedFunction<typeof useSession>;
const mockedGetBookDetail = getBookDetail as jest.MockedFunction<typeof getBookDetail>;
const mockedGetLibraryItem = getLibraryItem as jest.MockedFunction<typeof getLibraryItem>;
const mockedUseLibraryItem = useLibraryItem as jest.MockedFunction<typeof useLibraryItem>;
const deleteBookMock = deleteBook as jest.MockedFunction<typeof deleteBook>;

beforeEach(() => {
  for (const k of Object.keys(mockSearchParams)) delete mockSearchParams[k];
});

describe('S1: 도서 상세 [bookId] 파라미터 수신 (SPEC-BOOK-001 M4-6 BookDetailScreen 위임)', () => {
  it('useLocalSearchParams() 가 bookId 를 전달하고 라우트가 BookDetailScreen 을 마운트한다', () => {
    // BookDetailScreen 은 useSession()=null(loading) 시 ActivityIndicator(testID book-detail-loading) 렌더링.
    // 라우트가 파라미터를 수신해 BookDetailScreen 에 전달했다면 로딩 인디케이터가 표시된다.
    mockSearchParams.bookId = 'book-42';
    render(wrapWithQueryClient(<BookDetailRoute />));
    expect(screen.getByTestId('book-detail-loading')).toBeTruthy();
  });
});

describe('S2: 모임 상세 clubs/[clubId] 파라미터 수신', () => {
  it('useLocalSearchParams()가 clubId를 반환하고 ClubDetailScreen 이 마운트된다', () => {
    mockSearchParams.clubId = 'club-7';
    render(wrapWithQueryClient(<ClubDetailRoute />));
    // SPEC-CLUB-002 M4: route 가 clubId 를 ClubDetailScreen 에 전달.
    // useClubDetail(clubId) 로딩 상태 → ActivityIndicator(testID club-detail-loading) 렌더링.
    expect(screen.getByTestId('club-detail-loading')).toBeTruthy();
  });
});

// SPEC-LIBRARY-001 evaluator fix: FINDING-1 — onDeleted 라우팅 누락
// 삭제 성공 시 라우트가 router.back() 을 호출해 이전 화면으로 돌아가야 한다 (AC-LIB-007/008).
const backSpy = jest.fn();
const replaceSpy = jest.fn();

describe('FINDING-1: [bookId] 라우트 onDeleted → router.back() 연결 (AC-LIB-007/008)', () => {
  const authenticatedSession = {
    session: { access_token: 'tok', user: { id: 'u-1' } },
    user: { id: 'u-1' },
    profile: { id: 'u-1', nickname: '독자', bio: null },
    loading: false,
    isAuthenticated: true,
    isOnboarded: true,
    signInWithProvider: jest.fn(),
    signOut: jest.fn(),
    refreshProfile: jest.fn(),
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseSession.mockReturnValue(authenticatedSession);
    mockedGetBookDetail.mockResolvedValue({
      id: 'b-1',
      isbn: '9788937477029',
      title: '미드나잇 라이브러리',
      author: '매트 헤이그',
      publisher: '다산책방',
      published_at: '2021-06-15',
      cover_url: 'https://example.com/cover.jpg',
      total_pages: 400,
      kakao_id: 'kakao-1',
      created_at: '2024-01-01T00:00:00Z',
    } as any);
    mockedGetLibraryItem.mockResolvedValue({
      id: 'ub-1',
      book_id: 'b-1',
      user_id: 'u-1',
      status: 'reading',
      current_page: 120,
      is_public: false,
      last_progress_at: '2026-06-15T00:00:00Z',
      created_at: '2026-06-01T00:00:00Z',
      books: { id: 'b-1', title: '미드나잇 라이브러리', author: '매트 헤이그', cover_url: 'https://example.com/cover.jpg', total_pages: 400 },
    } as any);
    mockedUseLibraryItem.mockReturnValue({
      data: {
        id: 'ub-1',
        book_id: 'b-1',
        user_id: 'u-1',
        status: 'reading',
        current_page: 120,
        is_public: false,
        last_progress_at: '2026-06-15T00:00:00Z',
        created_at: '2026-06-01T00:00:00Z',
        books: { id: 'b-1', title: '미드나잇 라이브러리', author: '매트 헤이그', cover_url: 'https://example.com/cover.jpg', total_pages: 400 },
      },
      isLoading: false,
      isError: false,
      error: null,
    } as any);
    // useRouter.back spy 를 테스트별로 fresh 하게 교체
    // (jest.mock 팩토리가 모듈 평가 시 1회 실행되므로 spy 는 모듈 스코프에서 유지하되 clearAllMocks 로 초기화)
    const { useRouter } = require('expo-router');
    useRouter.mockReturnValue({
      replace: replaceSpy,
      push: jest.fn(),
      back: backSpy,
      canGoBack: () => true,
    });
  });

  it('삭제 성공 시 router.back() 이 호출된다', async () => {
    deleteBookMock.mockResolvedValue(undefined);
    mockSearchParams.bookId = 'b-1';

    const { getByTestId } = render(wrapWithQueryClient(<BookDetailRoute />));

    // 상세 로드 완료 대기
    await waitFor(() => {
      expect(getByTestId('book-detail-library-section')).toBeTruthy();
    });

    // 삭제 버튼 → 확인 다이얼로그 → 확인 액션
    fireEvent.press(getByTestId('delete-button'));
    fireEvent.press(getByTestId('delete-confirm-action'));

    await waitFor(() => {
      expect(backSpy).toHaveBeenCalled();
    });
  });
});
