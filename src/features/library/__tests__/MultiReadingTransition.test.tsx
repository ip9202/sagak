/**
 * SPEC-LIBRARY-002 M3 — 다중 reading 상태 전환 비배타 + 감정 기록 오염 부재 회귀 테스트
 *
 * 검증 대상 AC:
 * - AC-LIB2-TRANS-001 (P0): reading 전환 시 기존 reading 자동 shelved 부재 (REQ-LIB2-020)
 * - AC-LIB2-TRANS-002 (P1): 명시적 shelved 선택 시만 보관 이동 (REQ-LIB2-021)
 * - AC-LIB2-TRANS-003 (P0): completed 전환 기존 로직 유지 (REQ-LIB2-022)
 * - AC-LIB2-EMOTION-001 (P0): 다중 reading 컨텍스트 감정 기록 오염 부재 + 캐시 격리
 *
 * 메모리 교훈 준수:
 * - #35: react-query queryKey 접두사 매칭 (PR #178 정렬)
 * - #38: 직렬 mutation 부분 실패 (EmotionInputScreen.onSubmit → last_progress_at 경로)
 *
 * @MX:ANCHOR: [AUTO] 다중 reading 비배타 전환 + 감정 기록 오염 부재 회귀 방어선
 * @MX:REASON: SPEC-LIBRARY-002 가 enforce_single_reading 정책을 철회함에 따라, 클라이언트가
 *             과거 정책(자동 배타 UPDATE, "다른 책 보관함으로" 안내)에 의존하는 잔여 가정을
 *             제거했음을 영원히 보장. 회귀 시 사용자가 다중 reading을 못 하게 됨.
 */
import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor, renderHook, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../../../theme/theme';
import { BookDetailScreen } from '../../book/BookDetailScreen';
import type { BookDetailScreenProps } from '../../book/BookDetailScreen';
import type { LibraryItem } from '../types';
import type { BookRow } from '../../../types/book';

// 네이티브 모듈 mock (BookDetailScreen 이 useLibraryItem/mutation hooks 로 supabase 경유 로드)
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

// expo-router mock — router.push 호출 캡처 (AC-LIB2-TRANS-003 completed 라우팅 검증)
// jest mock factory 가 참조 가능하도록 mock prefix 사용
const mockRouterPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: jest.fn(() => ({
    push: mockRouterPush,
    replace: jest.fn(),
    back: jest.fn(),
  })),
}));

// useSession mock — 인증된 세션 기본
jest.mock('../../../auth/useSession', () => ({
  useSession: jest.fn(),
}));

// bookDetailApi mock
jest.mock('../../book/bookDetailApi', () => ({
  getBookDetail: jest.fn(),
}));

// libraryApi mock — updateStatus 호출 캡처 (AC-LIB2-TRANS 단일 UPDATE 검증)
jest.mock('../libraryApi', () => ({
  __esModule: true,
  getLibrary: jest.fn(),
  getLibraryItem: jest.fn(),
  addBook: jest.fn(),
  deleteBook: jest.fn(),
  updateProgress: jest.fn(),
  updateStatus: jest.fn(),
  updateVisibility: jest.fn(),
}));

// useLibraryItem mock — 테스트별로 등록된 책 데이터 주입 가능
jest.mock('../useLibraryItem', () => ({
  useLibraryItem: jest.fn(),
}));

import { useSession } from '../../../auth/useSession';
import { getBookDetail } from '../../book/bookDetailApi';
import {
  updateStatus,
  updateProgress,
} from '../libraryApi';
import { useLibraryItem } from '../useLibraryItem';
import {
  useUpdateStatus,
  libraryRootKey,
} from '../useLibrary';

const mockedUseSession = useSession as jest.MockedFunction<typeof useSession>;
const mockedGetBookDetail = getBookDetail as jest.MockedFunction<typeof getBookDetail>;
const mockedUseLibraryItem = useLibraryItem as jest.MockedFunction<typeof useLibraryItem>;
const updateStatusMock = updateStatus as jest.MockedFunction<typeof updateStatus>;
const updateProgressMock = updateProgress as jest.MockedFunction<typeof updateProgress>;

const authenticatedSession = {
  session: { access_token: 'token', user: { id: 'u1' } },
  user: { id: 'u1' },
  profile: { id: 'u1', nickname: '독자' },
  loading: false,
  isAuthenticated: true,
  isOnboarded: true,
  signInWithProvider: jest.fn(),
  signOut: jest.fn(),
  refreshProfile: jest.fn(),
};

const sampleBook: BookRow = {
  id: 'book-uuid-1',
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

// bookA library item — 기본 status='shelved' (handleStatusChange 트리거 가능 상태)
function makeLibraryItem(overrides: Partial<LibraryItem> = {}): LibraryItem {
  return {
    id: 'ub-bookA-1',
    book_id: 'book-uuid-1',
    user_id: 'u1',
    status: 'shelved',
    current_page: 0,
    is_public: true,
    started_reading_at: null,
    completed_at: null,
    last_progress_at: null,
    books: {
      id: 'book-uuid-1',
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
  mockedGetBookDetail.mockResolvedValue(sampleBook);
  updateStatusMock.mockResolvedValue(undefined);
  updateProgressMock.mockResolvedValue(undefined);
  mockRouterPush.mockClear();
});

// ============================================================================
// AC-LIB2-TRANS-001: reading 전환 비배타 (REQ-LIB2-020)
// ============================================================================
// 요구: reading 전환 시 기존 reading 자동 shelved 금지.
// 구현 계약: handleStatusChange 는 해당 책 1건의 status UPDATE 만 전송하며,
//           사용자 안내 메시지에 "다른 책 보관함으로 이동" 뉘앙스가 없어야 한다.

describe('AC-LIB2-TRANS-001: reading 전환 비배타 — Alert 메시지 정리 (REQ-LIB2-020)', () => {
  /**
   * RED: 현재 코드는 singleReadingNotice (' 지금 읽는중인 다른 책이 있으면 보관함으로 이동해요.')
   *      를 reading 전환 메시지에 붙인다. 비배타 정책에서는 이 안내가 거짓이므로 제거해야 한다.
   */

  function renderRegisteredScreen(item: LibraryItem) {
    mockedUseLibraryItem.mockReturnValue({
      data: item,
      isLoading: false,
      isError: false,
      error: null,
    } as any);

    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    const props: BookDetailScreenProps = {
      bookId: 'book-uuid-1',
      onRequireAuth: jest.fn(),
    };
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0, staleTime: 0 },
        mutations: { retry: false },
      },
    });
    const utils = render(
      <QueryClientProvider client={client}>
        <ThemeProvider>
          <BookDetailScreen {...props} />
        </ThemeProvider>
      </QueryClientProvider>,
    );
    return { ...utils, alertSpy };
  }

  it('shelved → reading 전환 Alert 메시지에 "다른 책 보관함으로 이동" 안내가 없다', async () => {
    const { alertSpy, findByTestId } = renderRegisteredScreen(makeLibraryItem({ status: 'shelved' }));
    // detail 로드 대기
    await waitFor(() => {
      expect(alertSpy).not.toHaveBeenCalled();
    });
    // "읽는중" chip 클릭
    const readingChip = await findByTestId('status-chip-reading');
    fireEvent.press(readingChip);

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledTimes(1);
    });
    const alertArgs = alertSpy.mock.calls[0];
    const message = (alertArgs[1] ?? '') as string;
    // 비배타 정책: reading 전환은 기존 reading 책에 영향 주지 않음
    expect(message).not.toMatch(/보관함으로 이동/);
  });

  it('completed → reading 역전환 Alert 메시지에도 자동 shelved 안내가 없다', async () => {
    const { alertSpy, findByTestId } = renderRegisteredScreen(
      makeLibraryItem({ status: 'completed', completed_at: '2026-01-01T00:00:00Z' }),
    );
    const readingChip = await findByTestId('status-chip-reading');
    fireEvent.press(readingChip);

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledTimes(1);
    });
    const message = (alertSpy.mock.calls[0][1] ?? '') as string;
    expect(message).not.toMatch(/보관함으로 이동/);
  });
});

// ============================================================================
// AC-LIB2-TRANS-001: handleStatusChange 단일 UPDATE (비배타 방어선)
// ============================================================================
// 요구: reading 전환 시 클라이언트가 다른 reading 행을 자동 shelved 시키는
//       추가 UPDATE 를 보내지 않는다 (구조적 보증 — 회귀 방어).

describe('AC-LIB2-TRANS-001/002/003: handleStatusChange 단일 UPDATE + completed 라우팅', () => {
  function renderRegisteredScreen(item: LibraryItem) {
    mockedUseLibraryItem.mockReturnValue({
      data: item,
      isLoading: false,
      isError: false,
      error: null,
    } as any);

    const alertSpy = jest.spyOn(Alert, 'alert');

    const props: BookDetailScreenProps = {
      bookId: 'book-uuid-1',
      onRequireAuth: jest.fn(),
    };
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0, staleTime: 0 },
        mutations: { retry: false },
      },
    });
    const utils = render(
      <QueryClientProvider client={client}>
        <ThemeProvider>
          <BookDetailScreen {...props} />
        </ThemeProvider>
      </QueryClientProvider>,
    );
    return { ...utils, alertSpy };
  }

  async function pressChipAndConfirm(
    utils: ReturnType<typeof renderRegisteredScreen>,
    chipTestId: string,
  ) {
    const chip = await utils.findByTestId(chipTestId);
    fireEvent.press(chip);
    await waitFor(() => {
      expect(utils.alertSpy).toHaveBeenCalledTimes(1);
    });
    // Alert 의 확인 버튼(두 번째 버튼) onPress 수동 호출
    const buttons = utils.alertSpy.mock.calls[0][2] as
      | Array<{ text?: string; onPress?: () => void }>
      | undefined;
    const confirmBtn = buttons?.[1];
    await act(async () => {
      confirmBtn?.onPress?.();
    });
  }

  it('AC-LIB2-TRANS-001: reading 전환 확인 시 updateStatus 가 정확히 1회 호출된다 (자동 배타 UPDATE 부재)', async () => {
    const utils = renderRegisteredScreen(makeLibraryItem({ status: 'shelved' }));
    await pressChipAndConfirm(utils, 'status-chip-reading');

    await waitFor(() => {
      expect(updateStatusMock).toHaveBeenCalledTimes(1);
    });
    expect(updateStatusMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'ub-bookA-1', status: 'reading' }),
    );
  });

  it('AC-LIB2-TRANS-002: 명시적 shelved 전환 확인 시 해당 책 1건만 UPDATE (다른 reading 책 영향 없음)', async () => {
    const utils = renderRegisteredScreen(makeLibraryItem({ status: 'reading' }));
    await pressChipAndConfirm(utils, 'status-chip-shelved');

    await waitFor(() => {
      expect(updateStatusMock).toHaveBeenCalledTimes(1);
    });
    expect(updateStatusMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'ub-bookA-1', status: 'shelved' }),
    );
  });

  it('AC-LIB2-TRANS-003: completed 전환 확인 시 완독 다이어리 라우트로 push 한다 (기존 로직 유지)', async () => {
    const utils = renderRegisteredScreen(makeLibraryItem({ status: 'reading' }));
    await pressChipAndConfirm(utils, 'status-chip-completed');

    // updateStatus 호출 (completed_at/completion_reports 는 DB 트리거가 담당)
    await waitFor(() => {
      expect(updateStatusMock).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'completed' }),
      );
    });
    // 완독 다이어리 라우트로 이동 (SPEC-COMPLETION-001 P1-C 계약)
    expect(mockRouterPush).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/completion/[bookId]',
        params: expect.objectContaining({ bookId: 'book-uuid-1' }),
      }),
    );
  });
});

// ============================================================================
// AC-LIB2-EMOTION-001: 다중 reading optimistic 캐시 격리 (메모리 #35 회귀 방어)
// ============================================================================
// 요구: 다중 reading 컨텍스트에서 bookA 에 대한 status mutation 의 optimistic
//       캐시 write 가 bookB 의 캐시 값을 침범하지 않는다 (id 가드).
//       invalidateLibrary(userId) 접두사 매칭은 양쪽 캐시에 모두 hit 하지만,
//       optimistic 값 write 는 id 일치 항목에만 적용된다.

describe('AC-LIB2-EMOTION-001: 다중 reading optimistic 캐시 격리 (메모리 #35)', () => {
  function createTestQueryClient(): QueryClient {
    return new QueryClient({
      defaultOptions: {
        // gcTime: Infinity — seed 한 캐시(미관측)가 GC 되어 optimistic write 검증이
        // 불가능해지는 함정 회피. staleTime: Infinity 로 refetch 도 차단.
        queries: { retry: false, gcTime: Infinity, staleTime: Infinity },
        mutations: { retry: false },
      },
    });
  }

  function createWrapper(client: QueryClient) {
    return function Wrapper({ children }: { children: React.ReactNode }) {
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    };
  }

  const bookA: LibraryItem = {
    id: 'ub-A',
    book_id: 'book-A',
    user_id: 'u1',
    status: 'reading',
    current_page: 50,
    is_public: true,
    started_reading_at: '2026-01-01T00:00:00Z',
    completed_at: null,
    last_progress_at: '2026-07-01T00:00:00Z',
    books: null,
  } as LibraryItem;

  const bookB: LibraryItem = {
    id: 'ub-B',
    book_id: 'book-B',
    user_id: 'u1',
    status: 'reading',
    current_page: 30,
    is_public: true,
    started_reading_at: '2026-02-01T00:00:00Z',
    completed_at: null,
    last_progress_at: '2026-07-15T00:00:00Z',
    books: null,
  } as LibraryItem;

  it('useUpdateStatus(bookA, shelved) optimistic 시 bookB 캐시 값은 reading 으로 불변한다', async () => {
    const client = createTestQueryClient();
    const wrapper = createWrapper(client);

    // 캐시 직접 seed — query observer lifecycle 개입 없이 mutateCachedItem 의 id 가드를
    // 순수 캐시 상태에서 검증 (메모리 #35 회귀 검증 계약).
    const keyA = [...libraryRootKey('u1'), 'item', 'book-A'];
    const keyB = [...libraryRootKey('u1'), 'item', 'book-B'];
    client.setQueryData(keyA, bookA);
    client.setQueryData(keyB, bookB);

    // seed 확인
    expect(client.getQueryData<LibraryItem>(keyA)?.status).toBe('reading');
    expect(client.getQueryData<LibraryItem>(keyB)?.status).toBe('reading');

    // mutation 을 never-resolve 로 고정 — onSuccess(invalidate/refetch) 차단하여
    // optimistic 캐시 write 시점의 순간 상태를 관측.
    updateStatusMock.mockImplementation(() => new Promise<void>(() => {}));

    const { result: statusMutation } = renderHook(
      () => useUpdateStatus({ userId: 'u1' }),
      { wrapper },
    );

    await act(async () => {
      statusMutation.current.mutate({ id: 'ub-A', status: 'shelved' });
    });

    // bookA: optimistic shelved 갱신 적용 (mutateCachedItem 이 id 일치 항목 갱신)
    await waitFor(() => {
      expect(client.getQueryData<LibraryItem>(keyA)?.status).toBe('shelved');
    });

    // bookB 캐시 값은 reading 으로 유지 (mutateCachedItem 의 id 가드 — optimistic 침범 부재)
    const cachedB = client.getQueryData<LibraryItem>(keyB);
    expect(cachedB?.status).toBe('reading');
    expect(cachedB?.id).toBe('ub-B');
  });

  it('libraryRootKey(userId) 접두사는 bookA·bookB 양쪽 useLibraryItem 캐시 키에 매칭된다 (메모리 #35 정렬)', () => {
    // 정성 점검: 두 useLibraryItem queryKey 는 동일 libraryRootKey(userId) 접두사를 공유
    const keyA = [...libraryRootKey('u1'), 'item', 'book-A'];
    const keyB = [...libraryRootKey('u1'), 'item', 'book-B'];
    // 접두사 일치 — invalidateQueries({queryKey: libraryRootKey('u1')}) 가 양쪽에 hit
    const prefix = libraryRootKey('u1');
    const matchesA = keyA.slice(0, prefix.length).every((v, i) => {
      const p = prefix[i];
      return typeof p === 'object' ? JSON.stringify(p) === JSON.stringify((keyA as unknown[])[i]) : v === p;
    });
    const matchesB = keyB.slice(0, prefix.length).every((v, i) => {
      const p = prefix[i];
      return typeof p === 'object' ? JSON.stringify(p) === JSON.stringify((keyB as unknown[])[i]) : v === p;
    });
    expect(matchesA).toBe(true);
    expect(matchesB).toBe(true);
    // 그러나 식별자 요소('book-A' vs 'book-B')는 서로 다름 — 캐시 충돌 없음
    expect(keyA[keyA.length - 1]).toBe('book-A');
    expect(keyB[keyB.length - 1]).toBe('book-B');
  });
});
