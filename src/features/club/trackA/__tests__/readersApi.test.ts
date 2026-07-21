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
      eq: eqMock,
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

  // @MX:NOTE: [AUTO] 부작용 수정 — fetchActiveReaders 는 "읽는중 독자"(status='reading')만 반환해야 함.
  //            뷰가 status 미노출이었던 gap(user_books_public → status 노출 migration 20240701000001 로 해소).
  it('status=reading 필터로 읽는중 독자만 반환한다 (부작용 수정, REQ-CLUBA-001)', async () => {
    orderMock.mockResolvedValue({ data: [], error: null });

    await fetchActiveReaders('b1');

    expect(eqMock).toHaveBeenCalledWith('status', 'reading');
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

  // @MX:NOTE: [AUTO] 본인(현재 로그인 사용자)은 독자 목록에서 제외되어야 한다. 자기 자신에게 합류 요청을 보낼 수 없기 때문.
  describe('SPEC-CLUB-001 fix: 본인 user_id 제외 (REQ-CLUBA-001 보강)', () => {
    /** neq 지원 체인: from().select().eq(book_id).eq(status).neq(user_id).order() -> {data,error} */
    function buildNeqChain(currentUserId: string | undefined) {
      const final = { data: [] as unknown[], error: null };
      const neqMock = jest.fn();
      const orderMockLocal = jest.fn().mockResolvedValue(final);
      // neq 호출 시 order 단계로 연결
      neqMock.mockReturnValue({ order: orderMockLocal });
      // eq(status) 호출 시: currentUserId 있으면 {neq} 반환, 없으면 {order} 반환
      const eqStatus = jest.fn();
      if (currentUserId && currentUserId.length > 0) {
        eqStatus.mockReturnValue({ neq: neqMock });
      } else {
        eqStatus.mockReturnValue({ order: orderMockLocal });
      }
      // eq(book_id) 호출 시 {eq: eqStatus} 반환 (status 필터 단계로 연결)
      const eqMockLocal = jest.fn().mockReturnValue({ eq: eqStatus });
      const selectMockLocal = jest.fn().mockReturnValue({ eq: eqMockLocal });
      const fromMockLocal = jest.fn().mockReturnValue({ select: selectMockLocal });
      (getSupabaseClient as jest.Mock).mockReturnValue({ from: fromMockLocal });
      return { neqMock, eqMockLocal, orderMockLocal };
    }

    it('currentUserId 제공 시 .neq("user_id", currentUserId) 로 본인을 제외한다', async () => {
      const { neqMock } = buildNeqChain('u-me');

      await fetchActiveReaders('b1', 'u-me');

      expect(neqMock).toHaveBeenCalledWith('user_id', 'u-me');
    });

    it('currentUserId 미제공 시 .neq 를 적용하지 않는다 (미인증 가드)', async () => {
      const { neqMock } = buildNeqChain(undefined);

      await fetchActiveReaders('b1');

      expect(neqMock).not.toHaveBeenCalled();
    });

    it('currentUserId 빈 문자열 시 .neq 를 적용하지 않는다 (미인증 가드)', async () => {
      const { neqMock } = buildNeqChain('');

      await fetchActiveReaders('b1', '');

      expect(neqMock).not.toHaveBeenCalled();
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
