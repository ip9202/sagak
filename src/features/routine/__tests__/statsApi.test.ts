/**
 * statsApi 단위 테스트 (SPEC-ROUTINE-001 REQ-ROUT-008)
 *
 * 검증 대상:
 * - R17: total_duration_seconds / total_sessions 집계
 * - R18: today_duration_seconds (오늘 날짜만)
 * - current_streak: streakCalculator 호출 결과 반영
 * - 활성 세션(ended_at null/duration null) 은 통계에서 제외
 * - 에러 정규화
 */
import { getReadingStats } from '../statsApi';
import { getSupabaseClient } from '../../../lib/supabase/client';
import * as streakCalc from '../streakCalculator';

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

describe('SPEC-ROUTINE-001 REQ-ROUT-008: statsApi.getReadingStats', () => {
  let fromMock: jest.Mock;
  beforeEach(() => {
    jest.clearAllMocks();
    fromMock = jest.fn();
    (getSupabaseClient as jest.Mock).mockReturnValue({ from: fromMock });
    jest.spyOn(streakCalc, 'calculateStreak').mockReturnValue(2);
  });

  function setRows(rows: unknown[]): void {
    const builder: Record<string, jest.Mock> = {};
    const ret = (): Record<string, jest.Mock> => builder;
    builder.select = jest.fn(ret);
    builder.not = jest.fn(ret);
    builder.order = jest.fn(ret);
    builder.limit = jest.fn().mockResolvedValue({ data: rows, error: null });
    fromMock.mockReturnValue(builder);
  }

  it('R17: total_duration_seconds + total_sessions 집계', async () => {
    setRows([
      { ended_at: '2026-06-15T10:00:00Z', duration_seconds: 1800 },
      { ended_at: '2026-06-14T10:00:00Z', duration_seconds: 900 },
    ]);

    const stats = await getReadingStats();
    expect(stats.total_duration_seconds).toBe(2700);
    expect(stats.total_sessions).toBe(2);
  });

  it('R18: today_duration_seconds — 오늘 날짜 세션만 합산', async () => {
    // 오늘을 고정하기 어려우므로, 오늘과 아닌 것을 섞어 두고
    // 구현이 오늘을 동적으로 계산한다고 가정. 여기서는 "최근 날짜 1개가 오늘" 임을
    // 보장하도록 오늘 Date 를 만든다.
    const todayIso = new Date().toISOString();
    setRows([
      { ended_at: todayIso, duration_seconds: 600 },
      { ended_at: '2020-01-01T00:00:00Z', duration_seconds: 9999 },
    ]);

    const stats = await getReadingStats();
    expect(stats.today_duration_seconds).toBe(600);
  });

  it('duration_seconds null 인 종료 세션은 합계에서 0 취급', async () => {
    setRows([
      { ended_at: '2026-06-15T10:00:00Z', duration_seconds: 1000 },
      { ended_at: '2026-06-14T10:00:00Z', duration_seconds: null },
    ]);

    const stats = await getReadingStats();
    expect(stats.total_duration_seconds).toBe(1000);
    expect(stats.total_sessions).toBe(2);
  });

  it('current_streak 은 streakCalculator 결과를 반영한다', async () => {
    setRows([{ ended_at: '2026-06-15T10:00:00Z', duration_seconds: 60 }]);
    (streakCalc.calculateStreak as jest.Mock).mockReturnValue(7);

    const stats = await getReadingStats();
    expect(stats.current_streak).toBe(7);
  });

  it('세션이 없으면 모두 0', async () => {
    setRows([]);
    const stats = await getReadingStats();
    expect(stats.total_duration_seconds).toBe(0);
    expect(stats.total_sessions).toBe(0);
    expect(stats.today_duration_seconds).toBe(0);
    expect(stats.current_streak).toBe(0);
  });

  it('Supabase 에러 → normalizeError throw', async () => {
    const builder: Record<string, jest.Mock> = {};
    const ret = (): Record<string, jest.Mock> => builder;
    builder.select = jest.fn(ret);
    builder.not = jest.fn(ret);
    builder.order = jest.fn(ret);
    builder.limit = jest
      .fn()
      .mockResolvedValue({ data: null, error: { code: '42501' } });
    fromMock.mockReturnValue(builder);

    await expect(getReadingStats()).rejects.toMatchObject({
      category: 'RLS_DENIED',
    });
  });
});
