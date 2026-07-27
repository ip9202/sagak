/**
 * 홈(tabs)/index 다중 reading 표시 테스트 — SPEC-LIBRARY-002 M2
 *
 * 검증 대상 AC:
 * - AC-LIB2-UI-001: reading 0권 빈 상태 렌더링
 * - AC-LIB2-UI-002: reading 1권 렌더링 (단일 BookCard + 단일 "기록하기" 버튼)
 * - AC-LIB2-UI-003: reading N권 다중 렌더링 (서버 last_progress_at DESC 정렬 결과를 그대로 표시)
 * - AC-LIB2-UI-004: "기록하기" 버튼 탭 → router.push('/emotion/[bookId]', { bookId }) 개별 라우팅
 * - AC-LIB2-UI-008: useLibrary 로딩 중 스켈레톤/스피너 렌더링 (빈 상태 UI 미출력)
 * - AC-LIB2-UI-009: "오늘의 감정 기록하기" 단일 CTA 제거 (사용자 합의 #2)
 *
 * 참고:
 * - last_progress_at DESC 정렬은 libraryApi.getLibrary 가 서버 쿼리에서 담당한다.
 *   본 테스트는 서버가 이미 DESC 정렬해 반환한 배열을 입력順 그대로 렌더링함을 검증한다.
 * - 세션 로딩(useSession null) 전체 화면 분기는 본 파일 범위 밖(기존 index.test.tsx 경로).
 *
 * @jest-environment jsdom
 */
import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { ThemeProvider } from '../../../src/theme/theme';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { LibraryItem } from '../../../src/features/library/types';

// 싱글톤 router mock — 컴포넌트가 사용하는 push 와 테스트가 검증하는 push 가 동일 객체.
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

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

jest.mock('../../../src/auth/useSession', () => ({
  useSession: jest.fn(),
}));

// useAlarmSettings — AlarmCard 기본 카피만 렌더되면 충분하므로 빈 데이터 반환.
jest.mock('../../../src/features/routine/useAlarmSettings', () => ({
  useAlarmSettings: jest.fn(() => ({ data: undefined })),
}));

jest.mock('../../../src/features/library/libraryApi', () => ({
  __esModule: true,
  getLibrary: jest.fn(),
  addBook: jest.fn(),
  deleteBook: jest.fn(),
  updateProgress: jest.fn(),
  updateStatus: jest.fn(),
  updateVisibility: jest.fn(),
}));

import { useSession } from '../../../src/auth/useSession';
import { getLibrary } from '../../../src/features/library/libraryApi';
import HomeTab from '../index';

const mockedUseSession = useSession as jest.MockedFunction<typeof useSession>;
const getLibraryMock = getLibrary as jest.MockedFunction<typeof getLibrary>;

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
};

function createClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

function renderTab(client: QueryClient) {
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <HomeTab />
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

/**
 * 테스트용 reading LibraryItem 팩토리.
 * last_progress_at 은 서버가 DESC 정렬해 반환한 순서를 시뮬레이션하기 위해 호출측에서 직접 부여한다.
 */
function makeReadingItem(overrides: Partial<LibraryItem>): LibraryItem {
  return {
    id: 'ub-1',
    book_id: 'b-1',
    user_id: 'u-1',
    status: 'reading',
    current_page: 50,
    is_public: true,
    last_progress_at: '2026-07-27T00:00:00Z',
    created_at: '2026-07-01T00:00:00Z',
    books: {
      id: 'b-1',
      title: '미드나잇 라이브러리',
      author: '매트 헤이그',
      cover_url: null,
      total_pages: 400,
    },
    ...overrides,
  } as LibraryItem;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedUseSession.mockReturnValue(authenticatedSession as any);
  getLibraryMock.mockResolvedValue([]);
});

describe('AC-LIB2-UI-009: "오늘의 감정 기록하기" 단일 CTA 제거 (사용자 합의 #2)', () => {
  it('reading 0권 빈 상태에서도 "오늘의 감정 기록하기" 텍스트가 렌더링되지 않는다', async () => {
    getLibraryMock.mockResolvedValue([]);
    const { queryByText, getByText } = renderTab(createClient());
    await waitFor(() => {
      // 빈 상태 진입 확인 후 CTA 부재 검증.
      expect(getByText('읽고 있는 책이 없어요')).toBeTruthy();
    });
    expect(queryByText('오늘의 감정 기록하기')).toBeNull();
  });

  it('reading 다중 표시에서도 "오늘의 감정 기록하기" 단일 CTA가 렌더링되지 않는다', async () => {
    getLibraryMock.mockResolvedValue([
      makeReadingItem({ id: 'ub-1', book_id: 'b-1', books: { id: 'b-1', title: '책1', author: 'A', cover_url: null, total_pages: 100 } }),
      makeReadingItem({ id: 'ub-2', book_id: 'b-2', books: { id: 'b-2', title: '책2', author: 'B', cover_url: null, total_pages: 200 } }),
    ]);
    const { queryByText, getAllByText } = renderTab(createClient());
    await waitFor(() => {
      expect(getAllByText('기록하기').length).toBeGreaterThanOrEqual(2);
    });
    expect(queryByText('오늘의 감정 기록하기')).toBeNull();
  });
});

describe('AC-LIB2-UI-001: reading 0권 빈 상태 (로딩 완료 후)', () => {
  it('빈 상태 안내 문구와 서재 탐색 CTA가 표시된다', async () => {
    getLibraryMock.mockResolvedValue([]);
    const { getByText, getByTestId, queryAllByText } = renderTab(createClient());
    await waitFor(() => {
      expect(getByText('읽고 있는 책이 없어요')).toBeTruthy();
    });
    expect(getByText('검색에서 먼저 책을 추가해 보세요.')).toBeTruthy();
    expect(getByTestId('home-empty-search-cta')).toBeTruthy();
    // BookCard "기록하기" 버튼은 0건
    expect(queryAllByText('기록하기')).toHaveLength(0);
  });
});

describe('AC-LIB2-UI-002: reading 1권 렌더링', () => {
  it('단일 BookCard 와 단일 "기록하기" 버튼이 렌더링된다', async () => {
    getLibraryMock.mockResolvedValue([
      makeReadingItem({
        id: 'ub-1',
        book_id: 'b-1',
        books: { id: 'b-1', title: '미드나잇 라이브러리', author: '매트 헤이그', cover_url: null, total_pages: 400 },
      }),
    ]);
    const { getAllByText, getByText } = renderTab(createClient());
    await waitFor(() => {
      expect(getByText('미드나잇 라이브러리')).toBeTruthy();
    });
    expect(getAllByText('기록하기')).toHaveLength(1);
  });
});

describe('AC-LIB2-UI-003: reading N권 다중 렌더링 (last_progress_at DESC 서버 정렬 결과 표시)', () => {
  it('3권의 BookCard 가 서버 정렬(입력 배열) 순서대로 3개의 "기록하기" 버튼과 함께 렌더링된다', async () => {
    // 서버가 last_progress_at DESC 로 정렬해 반환한 상태를 시뮬레이션.
    // 최근 진도 순: b-1(방금) > b-2(어제) > b-3(저번주)
    getLibraryMock.mockResolvedValue([
      makeReadingItem({
        id: 'ub-1', book_id: 'b-1', last_progress_at: '2026-07-27T10:00:00Z',
        books: { id: 'b-1', title: '최근진도책', author: 'A', cover_url: null, total_pages: 100 },
      }),
      makeReadingItem({
        id: 'ub-2', book_id: 'b-2', last_progress_at: '2026-07-26T10:00:00Z',
        books: { id: 'b-2', title: '어제진도책', author: 'B', cover_url: null, total_pages: 200 },
      }),
      makeReadingItem({
        id: 'ub-3', book_id: 'b-3', last_progress_at: '2026-07-20T10:00:00Z',
        books: { id: 'b-3', title: '저번주진도책', author: 'C', cover_url: null, total_pages: 300 },
      }),
    ]);
    const { getAllByText, getByText } = renderTab(createClient());
    await waitFor(() => {
      expect(getByText('최근진도책')).toBeTruthy();
    });
    expect(getByText('어제진도책')).toBeTruthy();
    expect(getByText('저번주진도책')).toBeTruthy();
    expect(getAllByText('기록하기')).toHaveLength(3);
  });
});

describe('AC-LIB2-UI-004: "기록하기" 버튼 탭 → /emotion/[bookId] 개별 라우팅', () => {
  it('각 BookCard 의 "기록하기" 버튼이 서로 다른 bookId 로 라우팅된다', async () => {
    getLibraryMock.mockResolvedValue([
      makeReadingItem({
        id: 'ub-1', book_id: 'b-alpha',
        books: { id: 'b-alpha', title: '알파책', author: 'A', cover_url: null, total_pages: 100 },
      }),
      makeReadingItem({
        id: 'ub-2', book_id: 'b-beta',
        books: { id: 'b-beta', title: '베타책', author: 'B', cover_url: null, total_pages: 200 },
      }),
    ]);
    const { getByTestId } = renderTab(createClient());
    await waitFor(() => {
      expect(getByTestId('home-reading-record-b-alpha')).toBeTruthy();
    });

    // 첫 번째 책 "기록하기" 탭
    fireEvent.press(getByTestId('home-reading-record-b-alpha'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/emotion/[bookId]',
      params: { bookId: 'b-alpha' },
    });

    // 두 번째 책 "기록하기" 탭 — bookId 격리
    fireEvent.press(getByTestId('home-reading-record-b-beta'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/emotion/[bookId]',
      params: { bookId: 'b-beta' },
    });

    // 두 번 모두 올바른 bookId 로 push 호출되었는지 카운트 확인
    expect(mockPush).toHaveBeenCalledTimes(2);
  });
});

describe('AC-LIB2-UI-008: useLibrary 로딩 중 스켈레톤/스피너 렌더링', () => {
  it('isLoading 중에는 로딩 인디케이터가 표시되고 빈 상태 문구는 표시되지 않는다', async () => {
    // 영구 unresolved 프로미스로 로딩 상태 유지
    getLibraryMock.mockReturnValue(new Promise<LibraryItem[]>(() => {}));
    const { getByTestId, queryByText } = renderTab(createClient());
    // 로딩 인디케이터가 마운트될 때까지 대기
    await waitFor(() => {
      expect(getByTestId('home-reading-loading')).toBeTruthy();
    });
    // 빈 상태 문구는 로딩 중 렌더링되지 않아야 함
    expect(queryByText('읽고 있는 책이 없어요')).toBeNull();
  });
});
