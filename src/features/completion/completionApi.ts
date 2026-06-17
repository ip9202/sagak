/**
 * 완독 리포트 클라이언트 API (SPEC-COMPLETION-001, REQ-COMP-001/003/004/005)
 *
 * completion_reports 테이블(report_data jsonb) 에 대한 PostgREST 읽기 전용 래퍼.
 * 모든 호출은 getSupabaseClient 를 경유하며, 에러는 normalizeError 로 정규화한다.
 *
 * 정책 (plan.md 결정):
 * - Edge Function 없이 PostgREST 직접 호출
 * - user_id 는 RLS(auth.uid()) 가 자동 주입 — 클라이언트에서 전송하지 않는다 (시나리오 4, RLS 신뢰)
 * - DB 트리거가 동일 트랜잭션에서 report_data 를 생성하지만, 전파 타이밍 대비 재시도 수행
 *
 * 재시도 정책 (REQ-COMP-001):
 * - NETWORK 에러 또는 빈 응답(data==null) → 최대 3회, 점진 백오프
 * - VALIDATION(스키마 불일치) / AUTH(401) → 즉시 throw, 재시도 없음
 * - 3회 초과 시 retriesExhausted=true 설정 후 throw
 *
 * @MX:SPEC SPEC-COMPLETION-001
 */
import { getSupabaseClient } from '../../lib/supabase/client';
import { normalizeError } from '../../lib/api/errors';
import { AppError } from '../../errors';
import { isReportData, type ReportData } from './types';

/** 최대 시도 횟수 (REQ-COMP-001: 최대 3회 재시도) */
const MAX_ATTEMPTS = 3;
/** 백오프 기본 간격(ms) — 시도 횟수에 비례하여 증가 */
const BACKOFF_BASE_MS = 50;

/** 빈 응답(리포트 없음) 에러 코드 */
const REPORT_NOT_FOUND_CODE = 'COMPLETION_REPORT_NOT_FOUND';
/** 스키마 불일치 에러 코드 */
const SCHEMA_MISMATCH_CODE = 'COMPLETION_REPORT_SCHEMA_MISMATCH';

/**
 * 점진 백오프 대기. attempt 는 1부터 시작하며, 첫 시도는 대기 없이 즉시 진행한다.
 */
function backoffDelay(attempt: number): number {
  // attempt 1 → 0ms(즉시), attempt 2 → BACKOFF_BASE_MS, attempt 3 → 2*BACKOFF_BASE_MS
  if (attempt <= 1) return 0;
  return BACKOFF_BASE_MS * (attempt - 1);
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 단일 PostgREST 조회를 수행하고 정규화된 결과를 반환한다.
 * - 반환값이 null 이면 "빈 응답" (리포트 없음) 으로 간주한다.
 * - 네트워크/서버 에러는 throw 되어 상위 재시도 루프에서 분류된다.
 */
async function fetchOnce(userBookId: string): Promise<ReportData | null> {
  const client = getSupabaseClient();
  let result: { data: { report_data: unknown } | null; error: unknown };
  try {
    result = await client
      .from('completion_reports')
      .select('report_data')
      .eq('user_book_id', userBookId)
      .maybeSingle();
  } catch (error) {
    throw normalizeError(error);
  }

  if (result.error) {
    throw normalizeError(result.error);
  }

  if (!result.data) {
    // RLS 로 타인 행이거나 아직 생성 전 — 빈 응답 (재시도 대상)
    return null;
  }

  const reportData = result.data.report_data;
  if (!isReportData(reportData)) {
    // @MX:NOTE: [AUTO] 스키마 불일치는 즉시 VALIDATION throw — 빈 상태와 구분되는 "데이터 오류".
    const err = new AppError(
      '완독 리포트 데이터 형식이 올바르지 않습니다',
      SCHEMA_MISMATCH_CODE,
      400,
    );
    err.category = 'VALIDATION';
    throw err;
  }
  return reportData;
}

/**
 * 완독 리포트를 조회한다 (REQ-COMP-001/003/004/005, 시나리오 1/2/4/6/16/17).
 *
 * user_id 는 전송하지 않는다 — RLS SELECT 정책(auth.uid() = user_id) 이 자동 필터링한다.
 * NETWORK 에러 또는 빈 응답 시 최대 3회 재시도(점진 백오프). VALIDATION/AUTH 는 즉시 throw.
 * 3회 초과 시 retriesExhausted=true AppError throw.
 *
 * @returns 검증된 ReportData (빈 상태 total_records=0 포함)
 */
export async function fetchReport(userBookId: string): Promise<ReportData> {
  let lastError: AppError | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    await sleep(backoffDelay(attempt));
    try {
      const data = await fetchOnce(userBookId);
      if (data !== null) {
        return data;
      }
      // 빈 응답 — lastError 갱신 후 재시도 계속
      lastError = new AppError(
        '완독 리포트를 찾을 수 없습니다',
        REPORT_NOT_FOUND_CODE,
        404,
      );
      lastError.category = 'NOT_FOUND';
    } catch (error) {
      const normalized = normalizeError(error);
      // VALIDATION(스키마 불일치) / AUTH(401) 는 재시도하지 않고 즉시 전파
      if (normalized.category === 'VALIDATION' || normalized.category === 'AUTH') {
        throw normalized;
      }
      lastError = normalized;
    }
  }

  // 재시도 한계 초과
  if (lastError) {
    lastError.retriesExhausted = true;
    throw lastError;
  }
  // 안전망 (도달 불가): lastError 가 설정되지 않은 케이스
  const fallback = new AppError(
    '완독 리포트를 불러올 수 없어요',
    REPORT_NOT_FOUND_CODE,
    500,
  );
  fallback.retriesExhausted = true;
  throw fallback;
}
