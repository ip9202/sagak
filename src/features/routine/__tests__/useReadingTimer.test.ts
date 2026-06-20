/**
 * useReadingTimer 단위 테스트 (SPEC-ROUTINE-001 REQ-ROUT-003)
 *
 * 검증 대상:
 * - R7: started_at 기반 경과 시간 표시 (setInterval 1초)
 * - R6: cleanup — unmount 시 interval 해제
 * - formatElapsed helper — HH:MM:SS 포맷팅
 * - started_at null 시 타이머 미동작
 *
 * @jest-environment jsdom
 */
import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { useReadingTimer, formatElapsed } from '../useReadingTimer';

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

describe('SPEC-ROUTINE-001 REQ-ROUT-003: formatElapsed (pure)', () => {
  it('0초 → 00:00:00', () => {
    expect(formatElapsed(0)).toBe('00:00:00');
  });

  it('120초 → 00:02:00', () => {
    expect(formatElapsed(120)).toBe('00:02:00');
  });

  it('3661초 → 01:01:01', () => {
    expect(formatElapsed(3661)).toBe('01:01:01');
  });

  it('36000초(10시간) → 10:00:00', () => {
    expect(formatElapsed(36000)).toBe('10:00:00');
  });
});

describe('SPEC-ROUTINE-001 REQ-ROUT-003: useReadingTimer', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('started_at null → elapsedSeconds 0, interval 미시작', () => {
    const { result } = renderHook(() => useReadingTimer(null));
    expect(result.current.elapsedSeconds).toBe(0);
    expect(result.current.display).toBe('00:00:00');
  });

  it('R7: started_at 주어지면 Date.now() 기반 경과 시간 표시', () => {
    const now = Date.now();
    const startedAt = new Date(now - 120_000); // 120초 전
    jest.spyOn(Date, 'now').mockReturnValue(now);

    const { result } = renderHook(() => useReadingTimer(startedAt));
    expect(result.current.elapsedSeconds).toBe(120);
    expect(result.current.display).toBe('00:02:00');
  });

  it('R7: 1초마다 elapsed 가 증가한다 (setInterval)', () => {
    const startedAt = new Date(Date.now() - 1000);
    const dateNowSpy = jest.spyOn(Date, 'now');

    // 초기 1초 경과 상태
    dateNowSpy.mockReturnValue(startedAt.getTime() + 1000);

    const { result } = renderHook(() => useReadingTimer(startedAt));
    expect(result.current.elapsedSeconds).toBe(1);

    // 1초 경과 시뮬레이션
    dateNowSpy.mockReturnValue(startedAt.getTime() + 2000);
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(result.current.elapsedSeconds).toBe(2);
  });

  it('R6: unmount 시 interval 이 해제된다 (clearInterval)', () => {
    const startedAt = new Date(Date.now() - 1000);
    const clearSpy = jest.spyOn(global, 'clearInterval');

    const { unmount } = renderHook(() => useReadingTimer(startedAt));
    unmount();

    expect(clearSpy).toHaveBeenCalled();
  });
});
