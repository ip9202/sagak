/**
 * 알림 설정 React Query 훅 (SPEC-ROUTINE-001 REQ-ROUT-007)
 *
 * @MX:SPEC SPEC-ROUTINE-001
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getAlarmSettings,
  updateAlarmTime,
  toggleAlarmEnabled,
} from './alarmApi';
import type { AlarmSettings } from './types';

export const ALARM_SETTINGS_QUERY_KEY = ['routine', 'alarmSettings'] as const;

export function useAlarmSettings(): ReturnType<
  typeof useQuery<AlarmSettings, Error>
> {
  return useQuery<AlarmSettings, Error>({
    queryKey: ALARM_SETTINGS_QUERY_KEY,
    queryFn: getAlarmSettings,
  });
}

/**
 * 알림 시간/토글 변경 후 캐시를 무효화한다.
 *
 * @MX:NOTE: [AUTO] Promise<void> 반환 — AlarmScreen 의 await 가 실제로 refetch 스케줄링을 기다리도록 void 래퍼 제거. 이전엔 void 로 감싸 "await has no effect" 경고가 발생했다.
 */
export function useInvalidateAlarmSettings(): () => Promise<void> {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ALARM_SETTINGS_QUERY_KEY });
}

export { updateAlarmTime, toggleAlarmEnabled };
