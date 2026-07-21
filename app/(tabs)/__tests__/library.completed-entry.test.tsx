/**
 * 서재 completed 항목 "완독 다이어리" 진입 아이콘 버튼 테스트
 * (SPEC-COMPLETION-002, REQ-COMP2-013)
 *
 * 검증 대상:
 * - completed 상태 항목에 다이어리 진입 버튼(testID=library-item-${id}-diary-entry) 노출
 * - 진입 버튼 탭 → router.push('/completion/${book_id}') 호출
 * - reading / shelved 상태에는 진입 버튼 미노출 (비경쟁/상태 일관성)
 * - completed 항목의 행(BookCard 본체) 탭은 여전히 /{book_id} (BookDetail) — 회귀 방지
 *
 * 기존 library.test.tsx 의 router mock(getLibrary 제어) 패턴을 재사용하되,
 * 본 파일은 push 호출 인자 검증에 집중하기 위해 독립 mockPush 를 둔다.
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
jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    LinearGradient: (props: { children?: React.ReactNode }) =>
      React.createElement(View, props),
  };
});

jest.mock('../../../src/auth/useSession', () => ({
  useSession: jest.fn(),
}));

// 헤더 Search/Plus 아이콘의 네이티브 의존성 mock (기존 library.test.tsx 와 동일).
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  const MockIcon = ({ name }: { name: string }) =>
    React.createElement(Text, { testID: `feather-${name}` }, name);
  return { __esModule: true, Feather: MockIcon };
});

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
import LibraryTab from '../library';

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
        <LibraryTab />
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

/**
 * 테스트용 LibraryItem 팩토리.
 * status / book_id / id 만 교체해가며 completed/reading/shelved 시나리오를 만든다.
 */
function makeItem(overrides: Partial<LibraryItem>): LibraryItem {
  return {
    id: 'ub-1',
    book_id: 'b-1',
    user_id: 'u-1',
    status: 'reading',
    current_page: 50,
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
    ...overrides,
  } as LibraryItem;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedUseSession.mockReturnValue(authenticatedSession as any);
  getLibraryMock.mockResolvedValue([]);
});

describe('SPEC-COMPLETION-002 REQ-COMP2-013: 서재 completed 항목 완독 다이어리 진입', () => {
  it('completed 상태 항목에 다이어리 진입 버튼(testID=library-item-${id}-diary-entry)이 노출된다', async () => {
    getLibraryMock.mockResolvedValue([makeItem({ status: 'completed' })]);
    const { getByTestId } = renderTab(createClient());
    await waitFor(() => {
      expect(getByTestId('library-item-ub-1-diary-entry')).toBeTruthy();
    });
  });

  it('다이어리 진입 버튼 탭 → router.push("/completion/${book_id}") 호출', async () => {
    getLibraryMock.mockResolvedValue([makeItem({ status: 'completed' })]);
    const { getByTestId } = renderTab(createClient());
    await waitFor(() => {
      expect(getByTestId('library-item-ub-1-diary-entry')).toBeTruthy();
    });
    fireEvent.press(getByTestId('library-item-ub-1-diary-entry'));
    expect(mockPush).toHaveBeenCalledWith('/completion/b-1');
  });

  it('reading 상태 항목에는 다이어리 진입 버튼이 노출되지 않는다', async () => {
    getLibraryMock.mockResolvedValue([makeItem({ status: 'reading' })]);
    const { getByTestId, queryByTestId } = renderTab(createClient());
    await waitFor(() => {
      expect(getByTestId('library-item-ub-1')).toBeTruthy();
    });
    expect(queryByTestId('library-item-ub-1-diary-entry')).toBeNull();
  });

  it('shelved 상태 항목에는 다이어리 진입 버튼이 노출되지 않는다', async () => {
    getLibraryMock.mockResolvedValue([makeItem({ status: 'shelved' })]);
    const { getByTestId, queryByTestId } = renderTab(createClient());
    await waitFor(() => {
      expect(getByTestId('library-item-ub-1')).toBeTruthy();
    });
    expect(queryByTestId('library-item-ub-1-diary-entry')).toBeNull();
  });

  it('completed 항목의 행(BookCard 본체) 탭은 여전히 /{book_id} (BookDetail) — 회귀 방지', async () => {
    getLibraryMock.mockResolvedValue([makeItem({ status: 'completed' })]);
    const { getByTestId } = renderTab(createClient());
    await waitFor(() => {
      expect(getByTestId('library-item-ub-1')).toBeTruthy();
    });
    fireEvent.press(getByTestId('library-item-ub-1'));
    expect(mockPush).toHaveBeenCalledWith('/b-1');
  });
});
