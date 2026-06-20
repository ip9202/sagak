/**
 * 독서 타이머 포그라운드 훅 (SPEC-ROUTINE-001 REQ-ROUT-003)
 *
 * started_at 기반으로 경과 시간을 표시한다 (R7).
 * - setInterval(1000) 로 1초마다 재계산
 * - 계산은 Date.now() - started_at.getTime() (클라이언트 카운터가 아님)
 * - 백그라운드 복귀 시 AppState 'active' 감지 → started_at 기반 재동기화 (R8)
 * - unmount 시 clearInterval (R6, 메모리 누수 방지)
 *
 * @MX:WARN: [AUTO] setInterval + AppState 리스너를 함께 관리한다 — cleanup 누락 시 메모리 누수. cyclomatic complexity >= 15 영역이므로 WARN 표시.
 * @MX:REASON: 타이머 생명주기(시작/정지/재동기화)가 한 훅에 집중되어 있어, cleanup 경로를 잘못 건드리면 활성 세션 중 타이머가 멈추거나 리스너가 누적된다.
 * @MX:SPEC SPEC-ROUTINE-001
 */
import { useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

/**
 * 경과 초를 HH:MM:SS 포맷으로 변환한다 (R7).
 *
 * @param seconds 경과 시간(초). 음수는 0 처리.
 * @returns 'HH:MM:SS' 형식 문자열
 */
export function formatElapsed(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  const pad = (n: number): string => n.toString().padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/**
 * started_at 기반 경과 시간을 계산한다.
 */
function computeElapsed(startedAt: Date | null): number {
  if (!startedAt) return 0;
  return Math.max(0, Math.floor((Date.now() - startedAt.getTime()) / 1000));
}

export interface UseReadingTimerResult {
  /** 경과 시간(초) */
  elapsedSeconds: number;
  /** HH:MM:SS 표시 문자열 */
  display: string;
}

/**
 * 독서 타이머 훅.
 *
 * @param startedAt 세션 시작 시각. null 이면 타이머 미동작.
 * @returns elapsedSeconds, display(HH:MM:SS)
 */
export function useReadingTimer(
  startedAt: Date | null,
): UseReadingTimerResult {
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(() =>
    computeElapsed(startedAt),
  );
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // started_at null → 타이머 정지, 0 초기화
    if (!startedAt) {
      setElapsedSeconds(0);
      return;
    }

    // 즉시 1회 계산 (R7 — 진입 직후 표시)
    setElapsedSeconds(computeElapsed(startedAt));

    // 1초마다 started_at 기반 재계산 (R7)
    intervalRef.current = setInterval(() => {
      setElapsedSeconds(computeElapsed(startedAt));
    }, 1000);

    // R8: 백그라운드 복귀 시 재동기화
    const handleAppStateChange = (nextState: AppStateStatus): void => {
      if (nextState === 'active') {
        setElapsedSeconds(computeElapsed(startedAt));
      }
    };
    const subscription = AppState.addEventListener(
      'change',
      handleAppStateChange,
    );

    // R6: cleanup — interval + AppState 리스너 해제
    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      subscription.remove();
    };
  }, [startedAt]);

  return {
    elapsedSeconds,
    display: formatElapsed(elapsedSeconds),
  };
}
