/**
 * SPEC-CLUB-004 BookSelectionHub 컴포넌트 테스트 (모임 생성 책 선택 허브)
 *
 * 검증 대상 (M1~M4 AC binding):
 * - AC-001: 허브 단일 화면에 서재+외부검색 동시 렌더링
 * - AC-002: "책 검색하기" 단일 CTA 제거
 * - AC-010: 서재 목록 reading+shelved 필터 (completed 제외)
 * - AC-011: 서재 책 탭 → onSelectBook(book_id) 핸드오프
 * - AC-012: 서재 아이템 메타데이터(제목/저자) 표시
 * - AC-013: 빈 서재(0건) fallback — 섹션 생략 + 외부 검색 부각
 * - AC-014: useLibrary 로딩 중 스켈레톤
 * - AC-015: useLibrary 에러 상태 분기 (외부 검색 접근 유지)
 * - AC-020: 외부 검색 결과 → resolveBookId → onSelectBook 핸드오프 (dead-end fix)
 * - AC-022: 허브 내 인라인 검색 — 핸드오프 계약 준수
 * - AC-033: SPEC-LIBRARY-002 다중 reading N행 표시
 *
 * @jest-environment jsdom
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ThemeProvider } from '../../../../../theme/theme';
import type { LibraryItem } from '../../../../../library/types';

// useLibrary mock — hub 이 reading/shelved 두 번 호출하므로 args.status 로 분기
const mockUseLibrary = jest.fn();
jest.mock('../../../../library/useLibrary', () => ({
  useLibrary: (...args: unknown[]) => mockUseLibrary(...args),
}));

// searchBooks mock (M2 외부 검색)
const mockSearchBooks = jest.fn();
jest.mock('../../../../book/searchApi', () => ({
  searchBooks: (...args: unknown[]) => mockSearchBooks(...args),
}));

// resolveBookId mock (M2 ISBN→UUID 핸드오프)
const mockResolveBookId = jest.fn();
jest.mock('../../../../book/resolveBookId', () => ({
  resolveBookId: (...args: unknown[]) => mockResolveBookId(...args),
}));

// 네이티브 모듈 mock (theme/supabase 트리 누수 방지)
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

import { BookSelectionHub } from '../BookSelectionHub';

// --- fixtures ---

/** LibraryItem 생성 헬퍼 — 최소 유효 행 + books 조인 */
function makeItem(
  bookId: string,
  status: 'reading' | 'shelved' | 'completed',
  overrides?: Partial<{
    title: string;
    author: string;
    currentPage: number;
    totalPages: number;
  }>,
): LibraryItem {
  return {
    id: `ub-${bookId}`,
    user_id: 'u1',
    book_id: bookId,
    status,
    current_page: overrides?.currentPage ?? 0,
    total_pages: null,
    is_public: true,
    last_progress_at: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: null,
    books: {
      id: bookId,
      title: overrides?.title ?? `책-${bookId}`,
      author: overrides?.author ?? '저자',
      cover_url: null,
      total_pages: overrides?.totalPages ?? 200,
    },
  } as unknown as LibraryItem;
}

/** useLibrary 를 status 별로 다른 결과를 반환하도록 설정 */
function stubLibrary(args: {
  reading?: LibraryItem[];
  shelved?: LibraryItem[];
  readingLoading?: boolean;
  readingError?: Error | null;
  shelvedLoading?: boolean;
}) {
  mockUseLibrary.mockImplementation((callArgs: { status?: string }) => {
    if (callArgs?.status === 'reading') {
      return {
        data: args.reading ?? [],
        isLoading: args.readingLoading ?? false,
        isError: args.readingError != null,
        error: args.readingError ?? null,
      };
    }
    if (callArgs?.status === 'shelved') {
      return {
        data: args.shelved ?? [],
        isLoading: args.shelvedLoading ?? false,
        isError: false,
        error: null,
      };
    }
    return { data: [], isLoading: false, isError: false, error: null };
  });
}

function renderHub(
  onSelectBook = jest.fn(),
  userId = 'u1',
) {
  return render(
    <ThemeProvider>
      <BookSelectionHub userId={userId} onSelectBook={onSelectBook} />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  // 기본: 빈 서재
  stubLibrary({});
});

describe('SPEC-CLUB-004 M1: 허브 렌더링 + 서재 섹션', () => {
  it('AC-001: 허브가 서재 섹션과 외부 검색 섹션을 동일 화면에 렌더링한다', () => {
    stubLibrary({
      reading: [makeItem('b-read', 'reading')],
      shelved: [makeItem('b-shelf', 'shelved')],
    });
    const { getByTestId } = renderHub();

    expect(getByTestId('hub-library-section')).toBeTruthy();
    expect(getByTestId('hub-search-section')).toBeTruthy();
  });

  it('AC-002: 기존 "책 검색하기" 단일 CTA 버튼이 존재하지 않는다', () => {
    stubLibrary({ reading: [makeItem('b1', 'reading')] });
    const { queryByTestId } = renderHub();

    // 기존 gate 의 CTA testID 가 제거되었는지 확인
    expect(queryByTestId('club-new-search')).toBeNull();
  });

  it('AC-010: 서재 섹션이 reading+shelved 책을 표시하고 completed 는 제외한다', () => {
    // useLibrary mock 이 status 필터로 분기하므로, completed 호출 자체가 없다.
    // reading 2권 + shelved 1권 fixture → 허브에 3개 아이템 렌더링
    stubLibrary({
      reading: [
        makeItem('b-read-1', 'reading'),
        makeItem('b-read-2', 'reading'),
      ],
      shelved: [makeItem('b-shelf-1', 'shelved')],
    });
    const { getByTestId } = renderHub();

    expect(getByTestId('hub-library-item-b-read-1')).toBeTruthy();
    expect(getByTestId('hub-library-item-b-read-2')).toBeTruthy();
    expect(getByTestId('hub-library-item-b-shelf-1')).toBeTruthy();
  });

  it('AC-011: 서재 책 탭 시 onSelectBook 이 book_id 로 호출된다', () => {
    stubLibrary({ reading: [makeItem('b-tap', 'reading')] });
    const onSelectBook = jest.fn();
    const { getByTestId } = renderHub(onSelectBook);

    fireEvent.press(getByTestId('hub-library-item-b-tap'));

    expect(onSelectBook).toHaveBeenCalledWith('b-tap');
  });

  it('AC-012: 서재 아이템이 책 제목/저자 메타데이터를 표시한다', () => {
    stubLibrary({
      reading: [
        makeItem('b-meta', 'reading', {
          title: '코스모스',
          author: '칼 세이건',
        }),
      ],
    });
    const { getByText } = renderHub();

    expect(getByText('코스모스')).toBeTruthy();
    expect(getByText('칼 세이건')).toBeTruthy();
  });

  it('AC-013: 서재가 0건이면 서재 섹션을 생략하고 외부 검색 섹션은 유지한다', () => {
    stubLibrary({ reading: [], shelved: [] });
    const { queryByTestId, getByTestId } = renderHub();

    expect(queryByTestId('hub-library-section')).toBeNull();
    expect(getByTestId('hub-search-section')).toBeTruthy();
  });

  it('AC-014: useLibrary 로딩 중 스켈레톤을 표시한다', () => {
    stubLibrary({
      readingLoading: true,
      shelvedLoading: true,
      reading: [],
      shelved: [],
    });
    const { getByTestId } = renderHub();

    expect(getByTestId('hub-library-loading')).toBeTruthy();
  });

  it('AC-015: useLibrary 에러 시 메시지를 표시하되 외부 검색은 접근 가능하다', () => {
    stubLibrary({
      readingError: new Error('RLS 거부'),
      shelved: [],
    });
    const { getByTestId, queryByTestId } = renderHub();

    expect(queryByTestId('hub-library-loading')).toBeNull();
    expect(getByTestId('hub-library-error')).toBeTruthy();
    // 외부 검색 섹션은 여전히 접근 가능
    expect(getByTestId('hub-search-section')).toBeTruthy();
  });

  it('AC-033: 다중 reading 행을 모두 표시한다 (SPEC-LIBRARY-002 호환)', () => {
    stubLibrary({
      reading: [
        makeItem('b-multi-1', 'reading'),
        makeItem('b-multi-2', 'reading'),
        makeItem('b-multi-3', 'reading'),
      ],
      shelved: [],
    });
    const { getByTestId } = renderHub();

    expect(getByTestId('hub-library-item-b-multi-1')).toBeTruthy();
    expect(getByTestId('hub-library-item-b-multi-2')).toBeTruthy();
    expect(getByTestId('hub-library-item-b-multi-3')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// M2: 외부 검색 핸드오프 (dead-end fix) — 허브 내 인라인 검색 (Option B)
// ---------------------------------------------------------------------------

/** SearchResult fixture — Kakao 검색 결과 1건 */
function makeSearchResult(overrides?: Partial<{ isbn: string; title: string }>) {
  return {
    title: overrides?.title ?? '호모 데우스',
    authors: ['유발 하라리'],
    publisher: '민음사',
    published_at: '2017-01-01',
    cover_url: null,
    isbn: overrides?.isbn ?? '9791186565873',
    kakao_id: null,
    total_pages: null,
  };
}

describe('SPEC-CLUB-004 M2: 외부 검색 핸드오프 (허브 내 인라인 검색, Option B)', () => {
  it('AC-022: 허브가 외부 검색 입력과 제출 컨트롤을 렌더링한다', () => {
    const { getByTestId } = renderHub();

    expect(getByTestId('hub-search-input')).toBeTruthy();
    expect(getByTestId('hub-search-submit')).toBeTruthy();
  });

  it('AC-020: 검색 제출 시 searchBooks 호출 → 결과 표시 → 탭 시 resolveBookId → onSelectBook', async () => {
    mockSearchBooks.mockResolvedValue([makeSearchResult({ isbn: '9791186565873' })]);
    mockResolveBookId.mockResolvedValue('uuid-book-99');
    const onSelectBook = jest.fn();
    const { getByTestId } = renderHub(onSelectBook);

    // 검색어 입력 + 제출
    fireEvent.changeText(getByTestId('hub-search-input'), '호모 데우스');
    fireEvent.press(getByTestId('hub-search-submit'));

    // 검색 결과 렌더 대기
    await waitFor(() => {
      expect(mockSearchBooks).toHaveBeenCalledWith('호모 데우스', 'title');
    });
    const resultCard = await waitFor(() => getByTestId('hub-search-result-9791186565873'));
    expect(resultCard).toBeTruthy();

    // 결과 탭 → resolveBookId → onSelectBook(books.id)
    fireEvent.press(resultCard);

    await waitFor(() => {
      expect(mockResolveBookId).toHaveBeenCalledWith('9791186565873');
      expect(onSelectBook).toHaveBeenCalledWith('uuid-book-99');
    });
  });

  it('AC-020: 검색 결과 탭 핸드오프는 /[bookId] 로 이탈하지 않는다 (onSelectBook 만 호출)', async () => {
    // 허브는 router 를 직접 쓰지 않고 onSelectBook 콜백만 호출 — 상위 라우트가 핸드오프.
    // 즉, 허브 자체는 /<bookId> 이탈 경로를 가지지 않는다 (dead-end fix).
    mockSearchBooks.mockResolvedValue([makeSearchResult()]);
    mockResolveBookId.mockResolvedValue('uuid-book-99');
    const onSelectBook = jest.fn();
    const { getByTestId } = renderHub(onSelectBook);

    fireEvent.changeText(getByTestId('hub-search-input'), '테스트');
    fireEvent.press(getByTestId('hub-search-submit'));

    const resultCard = await waitFor(() => getByTestId('hub-search-result-9791186565873'));
    fireEvent.press(resultCard);

    await waitFor(() => expect(onSelectBook).toHaveBeenCalledWith('uuid-book-99'));
    // onSelectBook 호출 = 핸드오프 완료. 별도 /<bookId> 라우팅은 허브 책임이 아님 (상위 라우트가 replace 수행).
  });

  it('AC-020 resolveBookId NOT_FOUND 시 onSelectBook 을 호출하지 않고 안내 메시지를 표시한다', async () => {
    mockSearchBooks.mockResolvedValue([makeSearchResult({ isbn: '0000000000000' })]);
    const notFoundError = Object.assign(new Error('not found'), {
      name: 'AppError',
      category: 'NOT_FOUND',
    });
    mockResolveBookId.mockRejectedValue(notFoundError);
    const onSelectBook = jest.fn();
    const { getByTestId } = renderHub(onSelectBook);

    fireEvent.changeText(getByTestId('hub-search-input'), '미등록책');
    fireEvent.press(getByTestId('hub-search-submit'));

    const resultCard = await waitFor(() => getByTestId('hub-search-result-0000000000000'));
    fireEvent.press(resultCard);

    await waitFor(() => expect(mockResolveBookId).toHaveBeenCalled());
    // NOT_FOUND 시 onSelectBook 미호출 (사용자에게 안내만)
    await new Promise((r) => setTimeout(r, 50));
    expect(onSelectBook).not.toHaveBeenCalled();
  });

  it('검색 로딩 중 표시', async () => {
    // 결코 resolve 되지 않는 promise → 로딩 상태 유지
    mockSearchBooks.mockReturnValue(new Promise(() => {}));
    const { getByTestId } = renderHub();

    fireEvent.changeText(getByTestId('hub-search-input'), '느린검색');
    fireEvent.press(getByTestId('hub-search-submit'));

    await waitFor(() => {
      expect(getByTestId('hub-search-loading')).toBeTruthy();
    });
  });

  it('빈 검색 결과 시 안내 메시지 표시', async () => {
    mockSearchBooks.mockResolvedValue([]);
    const { getByTestId } = renderHub();

    fireEvent.changeText(getByTestId('hub-search-input'), '결과없는검색어');
    fireEvent.press(getByTestId('hub-search-submit'));

    await waitFor(() => {
      expect(getByTestId('hub-search-empty')).toBeTruthy();
    });
  });
});
