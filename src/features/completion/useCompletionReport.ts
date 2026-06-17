/**
 * 완독 리포트 조회 훅 (SPEC-COMPLETION-001, REQ-COMP-001/004/005)
 *
 * useState/useEffect 기반 상태 관리. fetchReport 를 감싸 6개 상태를 파생한다.
 *
 * 상태 파생 규칙:
 * - loading: 조회 중
 * - success: total_records >= 1 (차트·리스트 렌더)
 * - empty: total_records === 0 (빈 상태 메시지)
 * - data-error: error.category === 'VALIDATION' (스키마 불일치, "데이터 오류")
 * - auth: error.category === 'AUTH' (401)
 * - error: 그 외 (NETWORK/retriesExhausted, 재시도 버튼)
 *
 * @MX:NOTE: [AUTO] 빈 상태(empty)와 데이터 오류(data-error)를 명시적으로 구분한다 — 빈 상태는 정상 데이터(total_records=0), 데이터 오류는 스키마 불일치. UI 분기와 메시지가 다르다.
 * @MX:SPEC SPEC-COMPLETION-001
 */
import { useCallback, useEffect, useState } from 'react';
import { fetchReport } from './completionApi';
import type { AppError } from '../../errors';
import type { ReportData } from './types';

/** 완독 다이어리 화면 상태 — 6개 분기 */
export type CompletionStatus =
  | 'loading'
  | 'success'
  | 'empty'
  | 'error'
  | 'data-error'
  | 'auth';

export interface UseCompletionReportResult {
  status: CompletionStatus;
  data: ReportData | null;
  error: AppError | null;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

function deriveStatus(
  data: ReportData | null,
  error: AppError | null,
  isLoading: boolean,
): CompletionStatus {
  if (isLoading) return 'loading';
  if (error) {
    if (error.category === 'VALIDATION') return 'data-error';
    if (error.category === 'AUTH') return 'auth';
    return 'error';
  }
  if (data) {
    return data.total_records > 0 ? 'success' : 'empty';
  }
  // 도달 불가 (loading 도 아니고 data/error 도 없으면 초기 fallback)
  return 'loading';
}

/**
 * 완독 리포트를 조회하고 파생 상태를 반환한다.
 * userBookId 가 빈 문자열이면 조회하지 않는다.
 */
export function useCompletionReport(
  userBookId: string,
): UseCompletionReportResult {
  const [data, setData] = useState<ReportData | null>(null);
  const [error, setError] = useState<AppError | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const load = useCallback(async (): Promise<void> => {
    if (!userBookId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const report = await fetchReport(userBookId);
      setData(report);
    } catch (e) {
      setError(e as AppError);
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [userBookId]);

  useEffect(() => {
    let mounted = true;
    if (!userBookId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    fetchReport(userBookId)
      .then((report) => {
        if (mounted) {
          setData(report);
          setError(null);
        }
      })
      .catch((e: AppError) => {
        if (mounted) {
          setError(e);
          setData(null);
        }
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [userBookId]);

  const status = deriveStatus(data, error, isLoading);

  return {
    status,
    data,
    error,
    isLoading,
    refetch: load,
  };
}
