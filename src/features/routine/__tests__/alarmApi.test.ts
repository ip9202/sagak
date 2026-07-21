/**
 * alarmApi 단위 테스트 (SPEC-ROUTINE-001 REQ-ROUT-005/006/007)
 *
 * 검증 대상:
 * - R15: getAlarmSettings — reading_alarm_time/enabled 조회
 * - R16: 미설정(alarm_time null) 시 null 반환
 * - R11: updateAlarmTime — 형식 검증(HH:MM) → HH:MM:SS 변환 후 UPDATE
 * - R12: 잘못된 형식 거부 (INVALID_TIME_FORMAT throw)
 * - R13/R14: toggleAlarmEnabled — enabled UPDATE
 *
 * RLS(REQ-DB-014)는 서버 정책 — 본 테스트는 쿼리 구성만 검증.
 */
import {
  getAlarmSettings,
  updateAlarmTime,
  toggleAlarmEnabled,
} from '../alarmApi';
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

function createBuilder(terminal: { data: unknown; error: unknown }): Record<string, jest.Mock> {
  const builder: Record<string, jest.Mock> = {};
  const ret = (): Record<string, jest.Mock> => builder;
  builder.select = jest.fn(ret);
  builder.eq = jest.fn(ret);
  builder.update = jest.fn(ret);
  builder.maybeSingle = jest.fn().mockResolvedValue(terminal);
  builder.eqResolved = jest.fn().mockResolvedValue(terminal);
  return builder;
}

describe('SPEC-ROUTINE-001 REQ-ROUT-005/006/007: alarmApi', () => {
  let fromMock: jest.Mock;
  beforeEach(() => {
    jest.clearAllMocks();
    fromMock = jest.fn();
    (getSupabaseClient as jest.Mock).mockReturnValue({ from: fromMock });
  });

  describe('getAlarmSettings — REQ-ROUT-007', () => {
    it('R15: reading_alarm_time/enabled 조회', async () => {
      const builder = createBuilder({
        data: {
          reading_alarm_time: '21:00:00',
          reading_alarm_enabled: true,
        },
        error: null,
      });
      fromMock.mockReturnValue(builder);

      const result = await getAlarmSettings();
      expect(result.alarm_time).toBe('21:00:00');
      expect(result.alarm_enabled).toBe(true);
    });

    it('R16: alarm_time null → alarm_time null 반환', async () => {
      const builder = createBuilder({
        data: { reading_alarm_time: null, reading_alarm_enabled: true },
        error: null,
      });
      fromMock.mockReturnValue(builder);

      const result = await getAlarmSettings();
      expect(result.alarm_time).toBeNull();
    });

    it('R16: 행 자체가 없으면 기본값(null, true) 반환', async () => {
      const builder = createBuilder({ data: null, error: null });
      fromMock.mockReturnValue(builder);

      const result = await getAlarmSettings();
      expect(result.alarm_time).toBeNull();
      expect(result.alarm_enabled).toBe(true); // REQ-DB-001 기본값
    });
  });

  describe('updateAlarmTime — REQ-ROUT-005', () => {
    it('R11: HH:MM 입력 → HH:MM:SS 변환 후 UPDATE', async () => {
      const builder = createBuilder({ data: null, error: null });
      builder.eq = jest.fn().mockResolvedValue({ data: null, error: null });
      fromMock.mockReturnValue(builder);

      await updateAlarmTime('21:30');

      expect(builder.update).toHaveBeenCalledWith({
        reading_alarm_time: '21:30:00',
      });
    });

    it('R11: HH:MM:SS 입력 → 그대로 UPDATE', async () => {
      const builder = createBuilder({ data: null, error: null });
      builder.eq = jest.fn().mockResolvedValue({ data: null, error: null });
      fromMock.mockReturnValue(builder);

      await updateAlarmTime('21:30:45');

      expect(builder.update).toHaveBeenCalledWith({
        reading_alarm_time: '21:30:45',
      });
    });

    it('R12: 잘못된 형식(25:99) → 거부 (VALIDATION 에러)', async () => {
      const builder = createBuilder({ data: null, error: null });
      fromMock.mockReturnValue(builder);

      await expect(updateAlarmTime('25:99')).rejects.toMatchObject({
        category: 'VALIDATION',
      });
      expect(builder.update).not.toHaveBeenCalled();
    });

    it('R12: 잘못된 형식(abc) → 거부', async () => {
      const builder = createBuilder({ data: null, error: null });
      fromMock.mockReturnValue(builder);

      await expect(updateAlarmTime('abc')).rejects.toMatchObject({
        category: 'VALIDATION',
      });
    });

    it('R12: 빈 문자열 → 거부', async () => {
      const builder = createBuilder({ data: null, error: null });
      fromMock.mockReturnValue(builder);

      await expect(updateAlarmTime('')).rejects.toMatchObject({
        category: 'VALIDATION',
      });
    });
  });

  describe('toggleAlarmEnabled — REQ-ROUT-006', () => {
    it('R13: false 로 변경 → UPDATE reading_alarm_enabled=false', async () => {
      const builder = createBuilder({ data: null, error: null });
      builder.eq = jest.fn().mockResolvedValue({ data: null, error: null });
      fromMock.mockReturnValue(builder);

      await toggleAlarmEnabled(false);

      expect(builder.update).toHaveBeenCalledWith({
        reading_alarm_enabled: false,
      });
    });

    it('R14: true 로 재활성화 → UPDATE reading_alarm_enabled=true', async () => {
      const builder = createBuilder({ data: null, error: null });
      builder.eq = jest.fn().mockResolvedValue({ data: null, error: null });
      fromMock.mockReturnValue(builder);

      await toggleAlarmEnabled(true);

      expect(builder.update).toHaveBeenCalledWith({
        reading_alarm_enabled: true,
      });
    });
  });
});
