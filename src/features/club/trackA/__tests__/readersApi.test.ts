/**
 * SPEC-CLUB-001 T-002/T-003: readersApi 단위 테스트
 *
 * 검증 대상:
 * - fetchActiveReaders: user_books_public 뷰 SELECT, book_id 필터, started_reading_at DESC 정렬
 * - resolveClubIdsForUsers: club_members JOIN으로 user_id → club_id 매핑 (그룹 없으면 null)
 * - 에러 정규화: RLS 42501 → RLS_DENIED
 *
 * RLS 모킹 금지 정책: 본 테스트는 supabase-js 호출 형태(쿼리 빌더 체인)와
 * 에러 정규화 경로만 검증한다. 실제 RLS 격리는 SPEC-DB-001 pgTAP(272 테스트)가 담당.
 */
import { fetchActiveReaders, resolveClubIdsForUsers } from '../readersApi';
import { getSupabaseClient } from '../../../../lib/supabase/client';

jest.mock('../../../../lib/supabase/client', () => ({
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

type Chain = Record<string, jest.Mock>;

/** 쿼리 빌더 체인을 생성하는 헬퍼. 최종 resolve 값(또는 throw)을 인자로 받는다. */
function buildChain(final: { data: unknown; error: unknown }): Chain {
  const chain: Chain = {};
  const mock = jest.fn().mockReturnValue(final);
  chain.order = jest.fn().mockReturnValue({ then: mock as never } as never);
  chain.eq = jest.fn().mockReturnValue(chain);
  chain.select = jest.fn().mockReturnValue(chain);
  chain.from = jest.fn().mockReturnValue(chain);
  // order 가 반환하는 thenable 객체
  return chain;
}

describe('SPEC-CLUB-001 T-002: fetchActiveReaders', () => {
  let fromMock: jest.Mock;
  let selectMock: jest.Mock;
  let eqMock: jest.Mock;
  let orderMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    selectMock = jest.fn();
    eqMock = jest.fn();
    orderMock = jest.fn();

    // 체인: from(view).select().eq(book_id).order(started_reading_at,desc) → {data,error}
    eqMock.mockReturnValue({
      order: orderMock,
    });
    selectMock.mockReturnValue({
      eq: eqMock,
    });
    fromMock = jest.fn().mockReturnValue({
      select: selectMock,
    });
    (getSupabaseClient as jest.Mock).mockReturnValue({ from: fromMock });
  });

  it('user_books_public 뷰에서 book_id 로 필터링한다 (REQ-CLUBA-001)', async () => {
    orderMock.mockResolvedValue({
      data: [
        { user_id: 'u1', book_id: 'b1', current_page: 50, started_reading_at: '2026-06-01' },
      ],
      error: null,
    });

    await fetchActiveReaders('b1');

    expect(fromMock).toHaveBeenCalledWith('user_books_public');
    expect(selectMock).toHaveBeenCalledWith(
      'user_id, book_id, current_page, started_reading_at',
    );
    expect(eqMock).toHaveBeenCalledWith('book_id', 'b1');
  });

  it('started_reading_at DESC 정렬을 적용한다 (REQ-CLUBA-002, 결정 5.3)', async () => {
    orderMock.mockResolvedValue({ data: [], error: null });

    await fetchActiveReaders('b1');

    expect(orderMock).toHaveBeenCalledWith('started_reading_at', {
      ascending: false,
      nullsFirst: false,
    });
  });

  it('조회 성공 시 뷰 Row 배열을 반환한다', async () => {
    const rows = [
      { user_id: 'u1', book_id: 'b1', current_page: 50, started_reading_at: '2026-06-01' },
      { user_id: 'u2', book_id: 'b1', current_page: 10, started_reading_at: null },
    ];
    orderMock.mockResolvedValue({ data: rows, error: null });

    const result = await fetchActiveReaders('b1');
    expect(result).toHaveLength(2);
    expect(result[0].user_id).toBe('u1');
  });

  it('RLS 거부(42501) 시 RLS_DENIED AppError 를 throw 한다', async () => {
    orderMock.mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'permission denied' },
    });

    await expect(fetchActiveReaders('b1')).rejects.toMatchObject({
      name: 'AppError',
      category: 'RLS_DENIED',
    });
  });

  it('빈 결과는 빈 배열을 반환한다 (에러 아님)', async () => {
    orderMock.mockResolvedValue({ data: null, error: null });
    const result = await fetchActiveReaders('b1');
    expect(result).toEqual([]);
  });

  it('쿼리 throw(네트워크) 시 normalizeError 를 거쳐 AppError throw', async () => {
    orderMock.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(fetchActiveReaders('b1')).rejects.toMatchObject({
      name: 'AppError',
      category: 'NETWORK',
    });
  });
});

describe('SPEC-CLUB-001 T-003: resolveClubIdsForUsers', () => {
  /** club_members 쿼리 체인 빌더: from().select().eq(type).eq(status).in(user_id) -> {data,error} */
  function mockChain(data: unknown, error: unknown) {
    const inMock = jest.fn().mockResolvedValue({ data, error });
    const eqStatus = jest.fn().mockReturnValue({ in: inMock });
    const eqType = jest.fn().mockReturnValue({ eq: eqStatus });
    const joinSelect = jest.fn().mockReturnValue({ eq: eqType });
    const fromMock2 = jest.fn().mockReturnValue({ select: joinSelect });
    (getSupabaseClient as jest.Mock).mockReturnValue({ from: fromMock2 });
    return { inMock, eqType, eqStatus, joinSelect };
  }

  it('각 user_id 의 활성 group 클럽 id 를 매핑한다 (REQ-CLUBA-003)', async () => {
    mockChain(
      [
        { user_id: 'u1', club_id: { id: 'c1' } },
        { user_id: 'u2', club_id: { id: 'c2' } },
      ],
      null,
    );

    const result = await resolveClubIdsForUsers(['u1', 'u2']);

    expect(result).toEqual({ u1: 'c1', u2: 'c2' });
  });

  it('클럽이 없는 독자는 맵에 포함되지 않는다 (호출부가 null 처리)', async () => {
    mockChain([{ user_id: 'u1', club_id: { id: 'c1' } }], null);

    const result = await resolveClubIdsForUsers(['u1', 'u2']);
    expect(result).toEqual({ u1: 'c1' });
    expect(result.u2).toBeUndefined();
  });

  it('에러 시 AppError 를 throw 한다', async () => {
    mockChain(null, { code: '42501', message: 'denied' });

    await expect(resolveClubIdsForUsers(['u1'])).rejects.toMatchObject({
      name: 'AppError',
    });
  });

  it('빈 user_id 배열은 빈 맵을 반환한다 (쿼리 미수행)', async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({ from: jest.fn() });
    const result = await resolveClubIdsForUsers([]);
    expect(result).toEqual({});
  });

  it('쿼리 throw(네트워크) 시 normalizeError 를 거쳐 AppError throw', async () => {
    const inMock = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const eqStatus = jest.fn().mockReturnValue({ in: inMock });
    const eqType = jest.fn().mockReturnValue({ eq: eqStatus });
    const joinSelect = jest.fn().mockReturnValue({ eq: eqType });
    const fromMock2 = jest.fn().mockReturnValue({ select: joinSelect });
    (getSupabaseClient as jest.Mock).mockReturnValue({ from: fromMock2 });

    await expect(resolveClubIdsForUsers(['u1'])).rejects.toMatchObject({
      name: 'AppError',
      category: 'NETWORK',
    });
  });
});
