/**
 * queries 단위 테스트 (SPEC-FEED-001 T-A3)
 *
 * 검증 대상:
 * - F1: club_id 필터 적용
 * - F3: visibility='club' 필터 적용
 * - REQ-FEED-003: book_id 필터 적용 (모임 도서 범위)
 * - F4: 커서 페이지네이션 — 다음 페이지 요청 시 .or() 표현식으로 중복/누락 없는 시커서
 * - F5/F6: nextCursor 계산 — limit 미만이면 null, limit 도달 시 마지막 항목 커서
 *
 * 주의: 본 단위 테스트는 PostgREST 쿼리 빌더 체인 구성(필터/정렬/커서) 만 검증한다.
 * RLS(REQ-DB-016) — 비멤버 행 격리(F2/F13) — 은 서버 정책으로 실행되므로
 * 단위 테스트에서 mock 하지 않고 통합/수동 검증 대상이다.
 */
import { fetchClubFeedPage } from '../queries';
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

// 쿼리 응답 원시 형태(RawFeedRow) 흉내 — sticker_reactions 은 집계 전 원시 행.
// 테스트 가독성을 위해 EmotionRecordWithAuthor 처럼 다루되 sticker_reactions 원시 형태 허용.
type RawRow = Record<string, unknown>;

function buildRow(overrides: RawRow = {}): RawRow {
  return {
    id: 'r',
    book_id: 'b1',
    user_id: 'u1',
    page_number: 50,
    content: 'c',
    visibility: 'club',
    club_id: 'c1',
    created_at: '2026-06-19T00:00:00Z',
    updated_at: null,
    users: { nickname: '독자', avatar_url: null },
    sticker_reactions: [],
    ...overrides,
  };
}

describe('SPEC-FEED-001 T-A3: fetchClubFeedPage — 쿼리 구성', () => {
  // 체이닝 mock — emotionApi.list 테스트 패턴과 동일한 PostgREST 빌더 구조
  const selectMock = jest.fn();
  const eqMock = jest.fn();
  const orderMock = jest.fn();
  const orMock = jest.fn();
  const limitMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    // select -> { eq }, eq(각 호출) -> 동일한 체이닝 객체 반환
    // 최종 resolve 지점은 limit 의 반환값
    selectMock.mockReturnValue({ eq: eqMock });
    // eq 는 여러번 체이닝 됨(club_id, visibility, book_id) — 매번 같은 체인 반환
    eqMock.mockReturnValue({
      eq: eqMock,
      order: orderMock,
    });
    orderMock.mockReturnValue({
      order: orderMock,
      or: orMock,
      limit: limitMock,
    });
    orMock.mockReturnValue({ limit: limitMock });
    (getSupabaseClient as jest.Mock).mockReturnValue({
      from: jest.fn().mockReturnValue({ select: selectMock }),
    });
  });

  it('F1/F3/REQ-FEED-003: club_id, visibility=club, book_id 필터를 적용한다', async () => {
    limitMock.mockResolvedValue({ data: [], error: null });

    await fetchClubFeedPage({
      clubId: 'c1',
      bookId: 'b1',
      currentPage: 100,
      userId: 'u1',
    });

    expect(eqMock).toHaveBeenCalledWith('club_id', 'c1');
    expect(eqMock).toHaveBeenCalledWith('visibility', 'club');
    expect(eqMock).toHaveBeenCalledWith('book_id', 'b1');
  });

  it('select 컬럼에 users 조인과 sticker_reactions 집계를 포함한다', async () => {
    limitMock.mockResolvedValue({ data: [], error: null });

    await fetchClubFeedPage({
      clubId: 'c1',
      bookId: 'b1',
      currentPage: 100,
      userId: 'u1',
    });

    const selectArg = selectMock.mock.calls[0][0] as string;
    expect(selectArg).toContain('users');
    expect(selectArg.toLowerCase()).toContain('sticker_reactions');
  });

  it('정렬: created_at DESC 1차, id DESC 2차 (안정 커서용 복합 정렬)', async () => {
    limitMock.mockResolvedValue({ data: [], error: null });

    await fetchClubFeedPage({
      clubId: 'c1',
      bookId: 'b1',
      currentPage: 100,
      userId: 'u1',
    });

    expect(orderMock).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(orderMock).toHaveBeenCalledWith('id', { ascending: false });
  });

  it('limit 기본값 20 을 적용한다', async () => {
    limitMock.mockResolvedValue({ data: [], error: null });

    await fetchClubFeedPage({
      clubId: 'c1',
      bookId: 'b1',
      currentPage: 100,
      userId: 'u1',
    });

    expect(limitMock).toHaveBeenCalledWith(20);
  });

  it('limit 옵션 명시 시 해당 값을 적용한다', async () => {
    limitMock.mockResolvedValue({ data: [], error: null });

    await fetchClubFeedPage({
      clubId: 'c1',
      bookId: 'b1',
      currentPage: 100,
      userId: 'u1',
      limit: 10,
    });

    expect(limitMock).toHaveBeenCalledWith(10);
  });

  it('F4: 커서가 주어지면 .or() 표현식으로 시커서 페이지를 요청한다', async () => {
    limitMock.mockResolvedValue({ data: [], error: null });

    const cursor = { createdAt: '2026-06-18T00:00:00Z', id: 'r100' };
    await fetchClubFeedPage({
      clubId: 'c1',
      bookId: 'b1',
      currentPage: 100,
      userId: 'u1',
      cursor,
    });

    expect(orMock).toHaveBeenCalledTimes(1);
    const orExpr = orMock.mock.calls[0][0] as string;
    // created_at.lt 커서 AND (created_at.eq 커서, id.lt 커서) 복합 표현식
    expect(orExpr).toContain('created_at.lt.2026-06-18T00:00:00Z');
    expect(orExpr).toContain('created_at.eq.2026-06-18T00:00:00Z');
    expect(orExpr).toContain('id.lt.r100');
  });

  it('F4: 커서가 null 이면 .or() 를 호출하지 않는다 (첫 페이지)', async () => {
    limitMock.mockResolvedValue({ data: [], error: null });

    await fetchClubFeedPage({
      clubId: 'c1',
      bookId: 'b1',
      currentPage: 100,
      userId: 'u1',
      // cursor 생략
    });

    expect(orMock).not.toHaveBeenCalled();
  });

  it('F5: limit 미만 결과 → nextCursor = null', async () => {
    const rows = [
      buildRow({ id: 'r1', created_at: '2026-06-19T00:00:00Z' }),
      buildRow({ id: 'r2', created_at: '2026-06-18T00:00:00Z' }),
    ];
    limitMock.mockResolvedValue({ data: rows, error: null });

    const result = await fetchClubFeedPage({
      clubId: 'c1',
      bookId: 'b1',
      currentPage: 100,
      userId: 'u1',
      limit: 20,
    });

    expect(result.items).toHaveLength(2);
    expect(result.nextCursor).toBeNull();
  });

  it('F6: limit 도달(전체 페이지) → nextCursor = 마지막 항목 {created_at, id}', async () => {
    const rows = Array.from({ length: 3 }, (_, i) =>
      buildRow({
        id: `r${i + 1}`,
        created_at: `2026-06-${19 - i}T00:00:00Z`,
      }),
    );
    limitMock.mockResolvedValue({ data: rows, error: null });

    const result = await fetchClubFeedPage({
      clubId: 'c1',
      bookId: 'b1',
      currentPage: 100,
      userId: 'u1',
      limit: 3,
    });

    expect(result.items).toHaveLength(3);
    expect(result.nextCursor).toEqual({
      createdAt: '2026-06-17T00:00:00Z',
      id: 'r3',
    });
  });

  it('빈 결과 → items=[], nextCursor=null', async () => {
    limitMock.mockResolvedValue({ data: [], error: null });

    const result = await fetchClubFeedPage({
      clubId: 'c1',
      bookId: 'b1',
      currentPage: 100,
      userId: 'u1',
    });

    expect(result.items).toEqual([]);
    expect(result.nextCursor).toBeNull();
  });

  it('sticker_reactions 원시 행을 StickerAggregate[] 로 환산한다', async () => {
    limitMock.mockResolvedValue({
      data: [
        buildRow({
          id: 'agg',
          sticker_reactions: [
            { sticker_type: 'empathy' },
            { sticker_type: 'empathy' },
            { sticker_type: 'touching' },
          ],
        }),
      ],
      error: null,
    });

    const result = await fetchClubFeedPage({
      clubId: 'c1',
      bookId: 'b1',
      currentPage: 100,
      userId: 'u1',
      limit: 20,
    });

    const agg = result.items[0].sticker_reactions;
    const empathy = agg.find((a) => a.sticker_type === 'empathy');
    expect(empathy?.count).toBe(2);
  });

  it('RLS 거부(42501) → RLS_DENIED 분류 (단위 테스트는 에러 정규화 경로만)', async () => {
    limitMock.mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'permission denied' },
    });

    await expect(
      fetchClubFeedPage({
        clubId: 'c1',
        bookId: 'b1',
        currentPage: 100,
        userId: 'u1',
      }),
    ).rejects.toMatchObject({ category: 'RLS_DENIED' });
  });
});
