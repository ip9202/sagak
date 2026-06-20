/**
 * goalStorage 단위 테스트 (SPEC-ROUTINE-001 REQ-ROUT-010 / 미결정 6.2)
 *
 * 검증 대상:
 * - R24: 목표 미설정 시 기본값 900초(15분)
 * - getDailyGoal: AsyncStorage 조회
 * - setDailyGoal: AsyncStorage 저장
 * - 잘못된 저장값(숫자 아님/음수) → 기본값 폴백
 */
import { getDailyGoal, setDailyGoal, DEFAULT_DAILY_GOAL_SECONDS } from '../goalStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

const storage = AsyncStorage as unknown as {
  getItem: jest.Mock;
  setItem: jest.Mock;
};

describe('SPEC-ROUTINE-001 REQ-ROUT-010: goalStorage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('R24: 기본 일일 목표 = 900초(15분)', () => {
    expect(DEFAULT_DAILY_GOAL_SECONDS).toBe(900);
  });

  it('R24: AsyncStorage 미설정(null) → 기본값 900', async () => {
    storage.getItem.mockResolvedValue(null);
    const goal = await getDailyGoal();
    expect(goal).toBe(900);
  });

  it('저장된 값이 있으면 해당 값 반환', async () => {
    storage.getItem.mockResolvedValue('1800');
    const goal = await getDailyGoal();
    expect(goal).toBe(1800);
  });

  it('저장값이 숫자가 아니면 기본값 폴백', async () => {
    storage.getItem.mockResolvedValue('abc');
    const goal = await getDailyGoal();
    expect(goal).toBe(900);
  });

  it('저장값이 음수면 기본값 폴백', async () => {
    storage.getItem.mockResolvedValue('-100');
    const goal = await getDailyGoal();
    expect(goal).toBe(900);
  });

  it('setDailyGoal: 양수만 저장, AsyncStorage 에 기록', async () => {
    await setDailyGoal(1200);
    expect(storage.setItem).toHaveBeenCalledWith(
      expect.stringContaining('goal'),
      '1200',
    );
  });

  it('setDailyGoal: 0 이하 거부 (기본값으로 저장하지 않음)', async () => {
    await expect(setDailyGoal(0)).rejects.toThrow();
    await expect(setDailyGoal(-5)).rejects.toThrow();
    expect(storage.setItem).not.toHaveBeenCalled();
  });
});
