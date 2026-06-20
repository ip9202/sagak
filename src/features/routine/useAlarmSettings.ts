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
 */
export function useInvalidateAlarmSettings(): () => void {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ALARM_SETTINGS_QUERY_KEY });
  };
}

export { updateAlarmTime, toggleAlarmEnabled };
