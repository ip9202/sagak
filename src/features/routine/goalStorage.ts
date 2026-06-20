/**
 * 일일 독서 목표 AsyncStorage 저장 (SPEC-ROUTINE-001 REQ-ROUT-010 / 미결정 6.2)
 *
 * 서버 스키마 변경 없이 클라이언트 측에서 일일 목표(초) 관리.
 * 기본값 900초(15분).
 *
 * @MX:NOTE: [AUTO] 기본값 900초(15분) 은 미결정 6.2 MVP 임시값 — v1.1.0 온보딩 목표 설정 검토.
 * @MX:SPEC SPEC-ROUTINE-001
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

/** 기본 일일 목표 (미결정 6.2 임시값) — 15분 = 900초 */
export const DEFAULT_DAILY_GOAL_SECONDS = 900;

const STORAGE_KEY = 'routine.daily_goal_seconds';

/**
 * 일일 목표(초) 를 조회한다.
 * - 저장값이 없거나 숫자가 아니거나 0 이하이면 기본값(900) 폴백.
 */
export async function getDailyGoal(): Promise<number> {
  let raw: string | null;
  try {
    raw = await AsyncStorage.getItem(STORAGE_KEY);
  } catch {
    return DEFAULT_DAILY_GOAL_SECONDS;
  }
  if (raw === null || raw === undefined) return DEFAULT_DAILY_GOAL_SECONDS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_DAILY_GOAL_SECONDS;
  }
  return parsed;
}

/**
 * 일일 목표(초) 를 저장한다.
 * @throws Error 0 이하 값 거부
 */
export async function setDailyGoal(seconds: number): Promise<void> {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new Error('일일 목표는 0보다 커야 해요');
  }
  await AsyncStorage.setItem(STORAGE_KEY, String(seconds));
}
