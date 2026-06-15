/**
 * API 레이어 barrel export
 * REQ-API-011 ~ REQ-API-015 공통 에러 처리 모듈
 * REQ-API-004 Edge Function 호출 래퍼
 */
export {
  normalizeError,
  classifyError,
  getUserFriendlyMessage,
  logToSentry,
  ERROR_CATEGORIES,
  type ErrorCategory,
  type SentryLogPayload,
} from './errors';

export { retryWithBackoff } from './retry';

export { invokeEdgeFunction } from './edgeFunctions';
