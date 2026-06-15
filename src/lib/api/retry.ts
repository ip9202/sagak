/**
 * 재시도 로직 모듈
 * REQ-API-013: 지수 백오프 재시도 (retryWithBackoff)
 *
 * 정책:
 * - 재시도 대상 카테고리: NETWORK, SERVER 만
 * - 최대 3회 재시도 (초기 호출 + 3회 = 최대 4회 호출)
 * - 백오프 간격: 1초, 2초, 4초 (지수)
 * - AUTH/RLS_DENIED/VALIDATION/NOT_FOUND/UNKNOWN 은 즉시 throw
 * - 3회 재시도 후에도 실패하면 최종 에러에 retriesExhausted=true 표식 후 throw
 */
import { AppError } from '../../errors';
import { normalizeError } from './errors';

/**
 * 백오프 간격 (ms) — 지수: 1000, 2000, 4000
 */
const BACKOFF_INTERVALS_MS: readonly number[] = [1000, 2000, 4000];

/**
 * 최대 재시도 횟수
 */
const MAX_RETRIES = 3;

/**
 * 재시도 가능한 카테고리 (REQ-API-013)
 */
const RETRYABLE_CATEGORIES: ReadonlySet<string> = new Set([
  'NETWORK',
  'SERVER',
]);

/**
 * 지정된 ms 후에 resolve 되는 Promise (테스트에서 jest.useFakeTimers 로 제어 가능)
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * 카테고리가 재시도 대상인지 확인
 */
function isRetryable(category: string | undefined): boolean {
  return category !== undefined && RETRYABLE_CATEGORIES.has(category);
}

/**
 * REQ-API-013: 지수 백오프 재시도 래퍼
 *
 * @param fn - 재시도할 비동기 함수
 * @returns fn의 반환값 (성공 시) 또는 throw (최종 실패 시)
 *
 * 동작:
 * 1. fn 호출
 * 2. 실패 시 normalizeError 로 AppError 변환 후 classifyError 카테고리 판별
 * 3. NETWORK/SERVER 카테고리면 BACKOFF_INTERVALS_MS 간격으로 최대 3회 재시도
 * 4. 그 외 카테고리는 즉시 throw (재시도 무의미)
 * 5. 3회 재시도 후에도 실패면 최종 에러에 retriesExhausted=true 설정 후 throw
 *
 * 재시도 소진 에러는 REQ-API-015 에 따라 logToSentry 로깅 대상이 된다.
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>
): Promise<T> {
  let lastError: AppError;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      // normalizeError 가 이미 AppError인 경우 동일 인스턴스 반환하므로 안전
      lastError = normalizeError(error);

      // 마지막 시도이거나 재시도 불가 카테고리면 즉시 throw
      const isLastAttempt = attempt >= MAX_RETRIES;
      const canRetry = !isLastAttempt && isRetryable(lastError.category);

      if (!canRetry) {
        // 재시도를 전부 소진한 경우에만 표식 (REQ-API-015 로깅 대상)
        if (isLastAttempt && isRetryable(lastError.category)) {
          lastError.retriesExhausted = true;
        }
        throw lastError;
      }

      // 백오프 대기 후 다음 시도
      const delayMs = BACKOFF_INTERVALS_MS[attempt];
      await sleep(delayMs);
    }
  }

  // 이 지점에는 도달하지 않지만 타입 안전성을 위해 최종 throw
  throw lastError!;
}
