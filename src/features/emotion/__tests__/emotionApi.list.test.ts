/**
 * emotionApi.list 단위 테스트 (SPEC-EMOTION-001 T-003)
 *
 * 검증 대상 (시나리오 1.6, 1.7, 4.3, 4.4, EC-7, EC-8):
 * - users 조인 + sticker_reactions 집계 SELECT
 * - page_number <= currentPage → safe, 초과 → spoiler 클라이언트 분할
 * - EC-7: currentPage=0 → 본인 기록 제외 모두 spoiler
 * - EC-8: page_number == currentPage 경계 → safe (블러 없음)
 * - sort=time: created_at DESC; sort=page: page_number ASC, created_at ASC 2차
 * - 본인 기록은 currentPage 와 무관하게 항상 safe (force-safe)
 * - page_number null → 0 취급 (safe 기준)
 */
import { listEmotionRecords } from '../emotionApi';
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

function buildRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'r',
    book_id: 'b1',
    user_id: 'u1',
    page_number: 50,
    content: 'c',
    visibility: 'public',
    club_id: null,
    created_at: '2026-06-17T00:00:00Z',
    updated_at: null,
    users: { nickname: '독자', avatar_url: null },
    sticker_reactions: [],
    ...overrides,
  };
}

describe('SPEC-EMOTION-001 T-003: emotionApi.list', () => {
  const selectMock = jest.fn();
  const eqMock = jest.fn();
  const orderMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    selectMock.mockReturnValue({ eq: eqMock });
    eqMock.mockReturnValue({ order: orderMock });
    (getSupabaseClient as jest.Mock).mockReturnValue({
      from: jest.fn().mockReturnValue({ select: selectMock }),
    });
  });

  it('시나리오 1.7: users 조인 + sticker_reactions 집계를 포함한 SELECT 를 수행한다', async () => {
    orderMock.mockResolvedValue({ data: [], error: null });

    await listEmotionRecords({ bookId: 'b1', userId: 'u1', currentPage: 100 });

    // 집계를 포함한 select 컬럼 검증
    const selectArg = selectMock.mock.calls[0][0] as string;
    expect(selectArg).toContain('users');
    expect(selectArg.toLowerCase()).toContain('sticker_reactions');
    expect(eqMock).toHaveBeenCalledWith('book_id', 'b1');
  });

  it('시나리오 1.6: page_number <= currentPage 는 safe, 초과는 spoiler 로 분할한다', async () => {
    orderMock.mockResolvedValue({
      data: [
        buildRow({ id: 'safe1', user_id: 'u2', page_number: 95 }),
        buildRow({ id: 'spoil1', user_id: 'u3', page_number: 120 }),
      ],
      error: null,
    });

    const result = await listEmotionRecords({
      bookId: 'b1', userId: 'u1', currentPage: 100,
    });

    expect(result.safe.map((r) => r.id)).toEqual(['safe1']);
    expect(result.spoiler.map((r) => r.id)).toEqual(['spoil1']);
  });

  it('EC-8: page_number == currentPage 경계값은 safe (블러 없음)', async () => {
    orderMock.mockResolvedValue({
      data: [buildRow({ id: 'boundary', page_number: 100 })],
      error: null,
    });

    const result = await listEmotionRecords({
      bookId: 'b1', userId: 'u1', currentPage: 100,
    });

    expect(result.safe.map((r) => r.id)).toEqual(['boundary']);
    expect(result.spoiler).toHaveLength(0);
  });

  it('EC-7: currentPage=0 일 때 타인 기록은 모두 spoiler, 본인 기록은 safe', async () => {
    orderMock.mockResolvedValue({
      data: [
        buildRow({ id: 'mine', user_id: 'u1', page_number: 0 }),
        buildRow({ id: 'others', user_id: 'u2', page_number: 0 }),
      ],
      error: null,
    });

    const result = await listEmotionRecords({
      bookId: 'b1', userId: 'u1', currentPage: 0,
    });

    expect(result.safe.map((r) => r.id)).toEqual(['mine']);
    expect(result.spoiler.map((r) => r.id)).toEqual(['others']);
  });

  it('본인 기록은 page_number 가 currentPage 초과여도 항상 safe', async () => {
    orderMock.mockResolvedValue({
      data: [buildRow({ id: 'mine-future', user_id: 'u1', page_number: 500 })],
      error: null,
    });

    const result = await listEmotionRecords({
      bookId: 'b1', userId: 'u1', currentPage: 10,
    });

    expect(result.safe.map((r) => r.id)).toEqual(['mine-future']);
    expect(result.spoiler).toHaveLength(0);
  });

  it('page_number 가 null 인 행은 0 취급하여 분할한다', async () => {
    orderMock.mockResolvedValue({
      data: [
        buildRow({ id: 'null-page-other', user_id: 'u2', page_number: null }),
      ],
      error: null,
    });

    const result = await listEmotionRecords({
      bookId: 'b1', userId: 'u1', currentPage: 50,
    });

    // null → 0 <= 50 이므로 safe
    expect(result.safe.map((r) => r.id)).toEqual(['null-page-other']);
  });

  it('sort=time (기본값) → created_at DESC 정렬을 서버에 위임한다', async () => {
    orderMock.mockResolvedValue({ data: [], error: null });

    await listEmotionRecords({ bookId: 'b1', userId: 'u1', currentPage: 100 });

    // 첫 order 호출이 created_at DESC
    expect(orderMock).toHaveBeenNthCalledWith(1, 'created_at', { ascending: false });
  });

  it('sort=page → page_number ASC 1차, created_at ASC 2차 정렬', async () => {
    // page 정렬은 .order(page_number).order(created_at) 체이닝 — 마지막 order 가 resolve
    const secondOrder = jest.fn().mockResolvedValue({ data: [], error: null });
    const firstOrder = jest.fn().mockReturnValue({ order: secondOrder });
    eqMock.mockReturnValue({ order: firstOrder });

    await listEmotionRecords({
      bookId: 'b1', userId: 'u1', currentPage: 100, sort: 'page',
    });

    expect(firstOrder).toHaveBeenCalledWith('page_number', { ascending: true });
    expect(secondOrder).toHaveBeenCalledWith('created_at', { ascending: true });
  });

  it('sticker_reactions 원시 행 배열을 StickerAggregate[] 로 환산한다', async () => {
    orderMock.mockResolvedValue({
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

    const result = await listEmotionRecords({
      bookId: 'b1', userId: 'u1', currentPage: 100,
    });

    const agg = result.safe[0].sticker_reactions;
    const empathy = agg.find((a) => a.sticker_type === 'empathy');
    expect(empathy?.count).toBe(2);
  });

  it('RLS 거부(42501) → RLS_DENIED 분류', async () => {
    orderMock.mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'permission denied' },
    });

    await expect(
      listEmotionRecords({ bookId: 'b1', userId: 'u1', currentPage: 100 }),
    ).rejects.toMatchObject({ category: 'RLS_DENIED' });
  });
});
