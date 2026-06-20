/**
 * queries 단위 테스트 (SPEC-PROFILE-001 REQ-PROF-001/004/006)
 *
 * 검증 대상:
 * - P1: getProfile — users 전체 컬럼 조회 (RLS 자기 행)
 * - P10: getUserStats — 완독 수(COUNT head) + 독서시간(SUM JS) + 감정기록(COUNT) 병렬
 * - P11: getUserStats — 데이터 없을 때 0 반환
 * - P15: getPointLogs — created_at DESC 정렬
 * - P16: getPointLogs — 빈 결과
 * - 에러 정규화 (normalizeError)
 *
 * RLS(REQ-DB-014/021)는 서버 정책 — 본 테스트는 쿼리 구성만 검증.
 */
import { getProfile, getUserStats, getPointLogs } from '../queries';
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

type Builder = Record<string, jest.Mock>;

// (chainBuilder 보조는 각 describe 내에서 inline 으로 정의)

describe('SPEC-PROFILE-001 REQ-PROF-001: getProfile', () => {
  let fromMock: jest.Mock;
  beforeEach(() => {
    jest.clearAllMocks();
    fromMock = jest.fn();
    (getSupabaseClient as jest.Mock).mockReturnValue({ from: fromMock });
  });

  it('P1: users 전체 컬럼 조회 (.maybeSingle)', async () => {
    const b: Builder = {};
    const ret = (): Builder => b;
    b.select = jest.fn(ret);
    b.eq = jest.fn(ret);
    b.maybeSingle = jest.fn().mockResolvedValue({
      data: {
        id: 'u-1',
        nickname: '독서가',
        avatar_url: 'https://x/a.png',
        email: 'u1@e.com',
        provider: 'naver',
        push_token: null,
        reading_alarm_time: '21:00:00',
        reading_alarm_enabled: true,
        role: 'member',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-02T00:00:00Z',
      },
      error: null,
    });
    fromMock.mockReturnValue(b);

    const profile = await getProfile('u-1');
    expect(profile?.nickname).toBe('독서가');
    expect(profile?.email).toBe('u1@e.com');
    expect(profile?.reading_alarm_time).toBe('21:00:00');
    expect(b.eq).toHaveBeenCalledWith('id', 'u-1');
  });

  it('행 없음 → null 반환', async () => {
    const b: Builder = {};
    const ret = (): Builder => b;
    b.select = jest.fn(ret);
    b.eq = jest.fn(ret);
    b.maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
    fromMock.mockReturnValue(b);

    const profile = await getProfile('u-x');
    expect(profile).toBeNull();
  });

  it('Supabase 에러 → normalizeError throw (RLS)', async () => {
    const b: Builder = {};
    const ret = (): Builder => b;
    b.select = jest.fn(ret);
    b.eq = jest.fn(ret);
    b.maybeSingle = jest.fn().mockResolvedValue({
      data: null,
      error: { code: '42501' },
    });
    fromMock.mockReturnValue(b);

    await expect(getProfile('u-1')).rejects.toMatchObject({
      category: 'RLS_DENIED',
    });
  });

  it('await 자체 reject(네트워크 에러) → normalizeError throw', async () => {
    const b: Builder = {};
    const ret = (): Builder => b;
    b.select = jest.fn(ret);
    b.eq = jest.fn(ret);
    b.maybeSingle = jest.fn().mockRejectedValue(new Error('network'));
    fromMock.mockReturnValue(b);

    await expect(getProfile('u-1')).rejects.toThrow();
  });
});

describe('SPEC-PROFILE-001 REQ-PROF-004: getUserStats', () => {
  let fromMock: jest.Mock;
  beforeEach(() => {
    jest.clearAllMocks();
    fromMock = jest.fn();
    (getSupabaseClient as jest.Mock).mockReturnValue({ from: fromMock });
  });

  /** user_books / emotion_records COUNT(head) builder */
  function countBuilder(count: number): Builder {
    const b: Builder = {};
    const ret = (): Builder => b;
    b.select = jest.fn(ret);
    b.eq = jest.fn(ret);
    b.single = jest.fn().mockResolvedValue({ count, error: null });
    return b;
  }

  /** reading_sessions rows builder (limit 후 data 배열) */
  function sessionsBuilder(rows: unknown[]): Builder {
    const b: Builder = {};
    const ret = (): Builder => b;
    b.select = jest.fn(ret);
    b.eq = jest.fn(ret);
    b.not = jest.fn(ret);
    b.order = jest.fn(ret);
    b.limit = jest.fn().mockResolvedValue({ data: rows, error: null });
    return b;
  }

  it('P10: 완독 3 + 독서시간 36000 + 감정 25 집계', async () => {
    // user_books count=3, emotion count=25, sessions SUM=36000
    fromMock.mockImplementation((table: string) => {
      if (table === 'user_books') {
        const b = countBuilder(3);
        return b;
      }
      if (table === 'emotion_records') {
        return countBuilder(25);
      }
      if (table === 'reading_sessions') {
        return sessionsBuilder([
          { duration_seconds: 18000 },
          { duration_seconds: 18000 },
        ]);
      }
      return countBuilder(0);
    });

    const stats = await getUserStats('u-1');
    expect(stats.completed_books).toBe(3);
    expect(stats.total_reading_seconds).toBe(36000);
    expect(stats.emotion_records_count).toBe(25);
  });

  it('P11: 데이터 없을 때 0/0/0', async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === 'user_books') return countBuilder(0);
      if (table === 'emotion_records') return countBuilder(0);
      if (table === 'reading_sessions') return sessionsBuilder([]);
      return countBuilder(0);
    });

    const stats = await getUserStats('u-1');
    expect(stats).toEqual({
      completed_books: 0,
      total_reading_seconds: 0,
      emotion_records_count: 0,
    });
  });

  it('duration_seconds null 은 0 취급', async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === 'user_books') return countBuilder(0);
      if (table === 'emotion_records') return countBuilder(0);
      if (table === 'reading_sessions') {
        return sessionsBuilder([
          { duration_seconds: 600 },
          { duration_seconds: null },
        ]);
      }
      return countBuilder(0);
    });
    const stats = await getUserStats('u-1');
    expect(stats.total_reading_seconds).toBe(600);
  });

  it('에러 발생 시 normalizeError throw', async () => {
    fromMock.mockImplementation((table: string) => {
      const b: Builder = {};
      const ret = (): Builder => b;
      b.select = jest.fn(ret);
      b.eq = jest.fn(ret);
      if (table === 'reading_sessions') {
        b.not = jest.fn(ret);
        b.order = jest.fn(ret);
        b.limit = jest.fn().mockResolvedValue({
          data: null,
          error: { code: '42501' },
        });
      } else {
        b.single = jest.fn().mockResolvedValue({
          count: 0,
          error: { code: '42501' },
        });
      }
      return b;
    });
    await expect(getUserStats('u-1')).rejects.toMatchObject({
      category: 'RLS_DENIED',
    });
  });

  it('Promise.all reject(네트워크 에러) → normalizeError throw', async () => {
    fromMock.mockImplementation((table: string) => {
      const b: Builder = {};
      const ret = (): Builder => b;
      b.select = jest.fn(ret);
      b.eq = jest.fn(ret);
      if (table === 'reading_sessions') {
        b.not = jest.fn(ret);
        b.order = jest.fn(ret);
        b.limit = jest.fn().mockRejectedValue(new Error('network'));
      } else {
        b.single = jest.fn().mockResolvedValue({ count: 0, error: null });
      }
      return b;
    });
    await expect(getUserStats('u-1')).rejects.toThrow();
  });

  it('user_books COUNT 에러(RLS) → completedResult.error throw', async () => {
    fromMock.mockImplementation((table: string) => {
      const b: Builder = {};
      const ret = (): Builder => b;
      b.select = jest.fn(ret);
      b.eq = jest.fn(ret);
      if (table === 'user_books') {
        b.single = jest.fn().mockResolvedValue({ count: 0, error: { code: '42501' } });
      } else if (table === 'emotion_records') {
        b.single = jest.fn().mockResolvedValue({ count: 0, error: null });
      } else {
        b.not = jest.fn(ret);
        b.order = jest.fn(ret);
        b.limit = jest.fn().mockResolvedValue({ data: [], error: null });
      }
      return b;
    });
    await expect(getUserStats('u-1')).rejects.toMatchObject({ category: 'RLS_DENIED' });
  });

  it('emotion_records COUNT 에러(RLS) → emotionResult.error throw', async () => {
    fromMock.mockImplementation((table: string) => {
      const b: Builder = {};
      const ret = (): Builder => b;
      b.select = jest.fn(ret);
      b.eq = jest.fn(ret);
      if (table === 'user_books') {
        b.single = jest.fn().mockResolvedValue({ count: 0, error: null });
      } else if (table === 'emotion_records') {
        b.single = jest.fn().mockResolvedValue({ count: 0, error: { code: '42501' } });
      } else {
        b.not = jest.fn(ret);
        b.order = jest.fn(ret);
        b.limit = jest.fn().mockResolvedValue({ data: [], error: null });
      }
      return b;
    });
    await expect(getUserStats('u-1')).rejects.toMatchObject({ category: 'RLS_DENIED' });
  });
});

describe('SPEC-PROFILE-001 REQ-PROF-006: getPointLogs', () => {
  let fromMock: jest.Mock;
  beforeEach(() => {
    jest.clearAllMocks();
    fromMock = jest.fn();
    (getSupabaseClient as jest.Mock).mockReturnValue({ from: fromMock });
  });

  it('P15: created_at DESC 정렬된 point_logs 반환', async () => {
    const b: Builder = {};
    const ret = (): Builder => b;
    b.select = jest.fn(ret);
    b.eq = jest.fn(ret);
    b.order = jest.fn(ret);
    b.limit = jest.fn().mockResolvedValue({
      data: [
        {
          id: 'p2',
          user_id: 'u-1',
          amount: 10,
          reason: 'reaction',
          created_at: '2026-06-02T00:00:00Z',
        },
        {
          id: 'p1',
          user_id: 'u-1',
          amount: 100,
          reason: 'completion',
          created_at: '2026-06-01T00:00:00Z',
        },
      ],
      error: null,
    });
    fromMock.mockReturnValue(b);

    const logs = await getPointLogs('u-1');
    expect(logs).toHaveLength(2);
    expect(logs[0].reason).toBe('reaction');
    expect(logs[1].reason).toBe('completion');
    expect(b.order).toHaveBeenCalledWith('created_at', { ascending: false });
  });

  it('P16: 빈 결과 → 빈 배열', async () => {
    const b: Builder = {};
    const ret = (): Builder => b;
    b.select = jest.fn(ret);
    b.eq = jest.fn(ret);
    b.order = jest.fn(ret);
    b.limit = jest.fn().mockResolvedValue({ data: [], error: null });
    fromMock.mockReturnValue(b);

    const logs = await getPointLogs('u-1');
    expect(logs).toEqual([]);
  });

  it('에러 → normalizeError throw', async () => {
    const b: Builder = {};
    const ret = (): Builder => b;
    b.select = jest.fn(ret);
    b.eq = jest.fn(ret);
    b.order = jest.fn(ret);
    b.limit = jest.fn().mockResolvedValue({
      data: null,
      error: { code: '42501' },
    });
    fromMock.mockReturnValue(b);
    await expect(getPointLogs('u-1')).rejects.toMatchObject({
      category: 'RLS_DENIED',
    });
  });

  it('await 자체 reject(네트워크 에러) → normalizeError throw', async () => {
    const b: Builder = {};
    const ret = (): Builder => b;
    b.select = jest.fn(ret);
    b.eq = jest.fn(ret);
    b.order = jest.fn(ret);
    b.limit = jest.fn().mockRejectedValue(new Error('network'));
    fromMock.mockReturnValue(b);
    await expect(getPointLogs('u-1')).rejects.toThrow();
  });
});
