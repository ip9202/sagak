/**
 * BookDetailScreen "같이 읽는 독자 보기" 진입점 테스트 (SPEC-CLUB-001 T-008 이후)
 *
 * BookDetailScreen 에서 ReadersScreen(/readers 라우트) 으로 진입하는 CTA 를 검증한다.
 * - 서재 섹션(등록된 책) 하단에 CTA 가 렌더링된다.
 * - CTA 탭 시 router.push({ pathname: '/readers', params: { bookId } }) 가 호출된다.
 *   readers.tsx 라우트는 useLocalSearchParams<{ bookId: string }>() 로 param 을 읽으므로,
 *   진입 측 param key 도 'bookId' 로 일치시킨다.
 *
 * ReadersScreen 본체 로직은 본 테스트 범위 밖 (진입점 CTA + push 만 검증).
 *
 * @jest-environment jsdom
 */
import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { ThemeProvider } from '../../../theme/theme';
import { BookDetailScreen } from '../BookDetailScreen';
import type { LibraryItem } from '../../../features/library/types';

// 네이티브 모듈 mock (library.test.tsx 와 동일 패턴)
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
jest.mock('expo-linear-gradient', () => {
  const R = require('react');
  const { View } = require('react-native');
  return {
    LinearGradient: (props: { children?: React.ReactNode }) =>
      R.createElement(View, props),
  };
});

// expo-router mock — push 호출 검증을 위해 외부 고정 jest.fn 노출 (library.test.tsx 패턴)
const mockRouterPush = jest.fn();
const mockRouterReplace = jest.fn();
const mockRouterBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: jest.fn(() => ({
    push: mockRouterPush,
    replace: mockRouterReplace,
    back: mockRouterBack,
  })),
}));

jest.mock('../../../auth/useSession', () => ({
  useSession: jest.fn(),
}));

jest.mock('../bookDetailApi', () => ({
  getBookDetail: jest.fn(),
}));

jest.mock('../../../features/library/libraryApi', () => ({
  __esModule: true,
  getLibrary: jest.fn(),
  getLibraryItem: jest.fn(),
  addBook: jest.fn(),
  deleteBook: jest.fn(),
  updateProgress: jest.fn(),
  updateStatus: jest.fn(),
  updateVisibility: jest.fn(),
}));

jest.mock('../../../features/library/useLibraryItem', () => ({
  useLibraryItem: jest.fn(),
}));

import { useSession } from '../../../auth/useSession';
import { getBookDetail } from '../bookDetailApi';
import { useLibraryItem } from '../../../features/library/useLibraryItem';
import type { BookRow } from '../../../types/book';

const mockedUseSession = useSession as jest.MockedFunction<typeof useSession>;
const mockedGetBookDetail = getBookDetail as jest.MockedFunction<typeof getBookDetail>;
const mockedUseLibraryItem = useLibraryItem as jest.MockedFunction<typeof useLibraryItem>;

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

const sampleBook: BookRow = {
  id: 'b-readers-1',
  isbn: '9788937477029',
  title: '미드나잇 라이브러리',
  author: '매트 헤이그',
  publisher: '다산책방',
  published_at: '2021-06-15',
  cover_url: 'https://example.com/cover.jpg',
  total_pages: 400,
  kakao_id: 'kakao-1',
  created_at: '2024-01-01T00:00:00Z',
};

const sampleLibraryItem: LibraryItem = {
  id: 'ub-readers-1',
  book_id: 'b-readers-1',
  user_id: 'u-1',
  status: 'reading',
  current_page: 120,
  is_public: true,
  last_progress_at: '2026-06-15T00:00:00Z',
  created_at: '2026-06-01T00:00:00Z',
  books: {
    id: 'b-readers-1',
    title: '미드나잇 라이브러리',
    author: '매트 헤이그',
    cover_url: 'https://example.com/cover.jpg',
    total_pages: 400,
  },
} as LibraryItem;

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

function renderScreen(props: { bookId: string; onRequireAuth?: () => void }) {
  const client = createTestQueryClient();
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <BookDetailScreen
          bookId={props.bookId}
          onRequireAuth={props.onRequireAuth ?? jest.fn()}
        />
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRouterPush.mockClear();
  mockRouterReplace.mockClear();
  mockRouterBack.mockClear();
  mockedUseSession.mockReturnValue(authenticatedSession as any);
  mockedGetBookDetail.mockResolvedValue(sampleBook);
  mockedUseLibraryItem.mockReturnValue({
    data: sampleLibraryItem,
    isLoading: false,
    isError: false,
    error: null,
  } as any);
});

describe('SPEC-CLUB-001: BookDetailScreen → ReadersScreen 진입점', () => {
  it('서재 섹션에 "같이 읽는 독자 보기" CTA 가 렌더링된다', async () => {
    const { getByTestId } = renderScreen({ bookId: 'b-readers-1' });
    await waitFor(() => {
      expect(getByTestId('book-detail-library-section')).toBeTruthy();
    });
    // @MX:NOTE: [AUTO] 진입점 CTA — testID 로 식별. readers 라우트 진입 게이트.
    expect(getByTestId('readers-entry-button')).toBeTruthy();
  });

  it('CTA 탭 시 router.push({ pathname: "/readers", params: { bookId } }) 를 호출한다', async () => {
    const { getByTestId } = renderScreen({ bookId: 'b-readers-1' });
    const button = await waitFor(() => getByTestId('readers-entry-button'));
    fireEvent.press(button);

    expect(mockRouterPush).toHaveBeenCalledWith({
      pathname: '/readers',
      params: { bookId: 'b-readers-1' },
    });
  });
});
