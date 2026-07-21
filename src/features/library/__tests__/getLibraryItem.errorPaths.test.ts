/**
 * getLibraryItem 에러 경로 단위 테스트 (SPEC-LIBRARY-001 evaluator FINDING-2)
 *
 * BookDetailScreen 의 직접 진입 경로(search → /book/<id>)가 의존하는
 * getLibraryItem 의 에러 분류를 검증한다. 이전에는 happy path 외 3개
 * 에러 경로(null=미등록, RLS_DENIED, NETWORK)가 전혀 테스트되지 않았다.
 *
 * 검증 대상:
 * - null 행(서재 미등록) → null 반환 (에러 아님 — UI "서재에 추가" CTA)
 * - RLS 거부(42501) → RLS_DENIED AppError throw
 * - 네트워크 에러(TypeError / network message) → NETWORK AppError throw
 * - happy path → LibraryItem(books 조인 포함) 반환
 *
 * @MX:SPEC SPEC-LIBRARY-001
 */
import { getLibraryItem } from '../libraryApi';
import { getSupabaseClient } from '../../../lib/supabase/client';

jest.mock('../../../lib/supabase/client', () => ({
  getSupabaseClient: jest.fn(),
}));

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
  WHEN_UNLOCKED: 'WHEN_UNLOCKED',
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
}));

describe('SPEC-LIBRARY-001 FINDING-2: getLibraryItem 에러 경로 분류', () => {
  // 체인: select() → eq(book_id) → eq(user_id) → maybeSingle()
  const maybeSingleMock = jest.fn();
  const eqMock = jest.fn();
  const selectMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    // 체인: select() → eq(book_id) → eq(user_id) → maybeSingle()
    // eq 는 자기 자신을 반환해 체인을 유지하고, maybeSingle 가 종단 결괏값을 낸다.
    selectMock.mockReturnValue({ eq: eqMock });
    eqMock.mockReturnValue({ eq: eqMock, maybeSingle: maybeSingleMock });
    (getSupabaseClient as jest.Mock).mockReturnValue({
      from: jest.fn().mockReturnValue({ select: selectMock }),
    });
  });

  it('happy path: books 조인된 LibraryItem 을 반환한다', async () => {
    const row = {
      id: 'ub-1',
      book_id: 'b-1',
      user_id: 'u-1',
      status: 'reading',
      current_page: 120,
      is_public: false,
      last_progress_at: '2026-06-15T00:00:00Z',
      created_at: '2026-06-01T00:00:00Z',
      books: { id: 'b-1', title: '미드나잇 라이브러리', author: '매트 헤이그', cover_url: null, total_pages: 400 },
    };
    maybeSingleMock.mockResolvedValue({ data: row, error: null });

    const result = await getLibraryItem('b-1', 'u-1');

    expect(result).toMatchObject({ id: 'ub-1', status: 'reading' });
    expect(result?.books).toMatchObject({ title: '미드나잇 라이브러리' });
    // book_id + user_id 필터 확인
    expect(eqMock).toHaveBeenCalledWith('book_id', 'b-1');
    expect(eqMock).toHaveBeenCalledWith('user_id', 'u-1');
  });

  it('null 행(서재 미등록 책) → null 반환 (에러 아님 — UI "서재에 추가" CTA)', async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null });

    const result = await getLibraryItem('b-notadded', 'u-1');

    expect(result).toBeNull();
  });

  it('RLS 거부(42501) → RLS_DENIED 로 분류해 throw 한다', async () => {
    maybeSingleMock.mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'permission denied' },
    });

    await expect(getLibraryItem('b-1', 'u-1')).rejects.toMatchObject({
      name: 'AppError',
      category: 'RLS_DENIED',
    });
  });

  it('네트워크 에러(TypeError) → NETWORK 로 분류해 throw 한다', async () => {
    // fetch 거부 시 supabase-js 가 TypeError 를 throw — classifyError 는 NETWORK 분류
    maybeSingleMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(getLibraryItem('b-1', 'u-1')).rejects.toMatchObject({
      name: 'AppError',
      category: 'NETWORK',
    });
  });
});
