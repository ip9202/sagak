/**
 * 공통 에러 처리 모듈
 * REQ-API-011: 에러 정규화 (normalizeError)
 * REQ-API-012: 7개 에러 카테고리 분류 (classifyError)
 * REQ-API-014: 한국어 사용자 친화적 메시지 매핑 (getUserFriendlyMessage)
 * REQ-API-015: Sentry 호환 구조화 로깅 (logToSentry)
 *
 * 본 모듈은 src/errors/index.ts 의 AppError 를 타입 기반으로 재사용한다.
 * @sentry/react-native 의존성은 추가하지 않으며, SPEC-DEPLOY-001 에서 실제
 * Sentry SDK 로 전환 가능한 로거 인터페이스만 제공한다.
 */
import { AppError, type ErrorCategory } from '../../errors';

/**
 * REQ-API-012: 7개 에러 카테고리 (정규화된 순서)
 */
export const ERROR_CATEGORIES: readonly ErrorCategory[] = [
  'NETWORK',
  'AUTH',
  'RLS_DENIED',
  'VALIDATION',
  'NOT_FOUND',
  'SERVER',
  'UNKNOWN',
] as const;

export type { ErrorCategory };

// --- PostgREST / Postgres SQLSTATE 상수 (REQ-API-012 분류 근거) ---
// 42501: insufficient_privilege / RLS 정책 거부
const CODE_RLS_DENIED = '42501';
// 23505: unique_violation
const CODE_UNIQUE_VIOLATION = '23505';
// 23502: not_null_violation
const CODE_NOT_NULL_VIOLATION = '23502';
// 23514: check_violation
const CODE_CHECK_VIOLATION = '23514';
// PGRST116: 0개 또는 다중 행 반환 (단일 행 요청)
const CODE_PGRST116 = 'PGRST116';

/**
 * 알려진 네트워크 장애 메시지 키워드 (REQ-API-012 NETWORK 분류 근거)
 */
const NETWORK_MESSAGE_PATTERNS: readonly RegExp[] = [
  /failed to fetch/i,
  /network request failed/i,
  /networkerror/i,
  /econnaborted/i,
  /etimedout/i,
  /request timeout/i,
  /network connection timed out/i,
];

/**
 * 인증 관련 메시지 키워드 (REQ-API-012 AUTH 분류 근거)
 */
const AUTH_MESSAGE_PATTERNS: readonly RegExp[] = [
  /jwt expired/i,
  /jwt invalid/i,
  /invalid (jwt|token)/i,
  /session.*(expired|not found|missing)/i,
  /not authenticated/i,
  /unauthorized/i,
];

/**
 * Supabase Auth 에러 코드 (REQ-API-012 AUTH 분류 근거)
 */
const AUTH_ERROR_CODES: readonly string[] = [
  'invalid_credentials',
  'session_not_found',
  'session_expired',
  'session_missing',
  'jwt_expired',
  'user_not_found',
];

// @MX:ANCHOR: [AUTO] 에러 분류 핵심 — normalizeError/classifyError/retryWithBackoff 모두 의존
// @MX:REASON: 모든 Supabase API 호출의 단일 진입점이며, 잘못된 분류는 재시도/로깅/사용자 메시지 전반을 오염시킨다.

/**
 * unknown 값을 안전하게 객체로 다루기 위한 타입 가드
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * 에러에서 문자열 코드 추출 (PostgREST code / Supabase Auth code)
 */
function extractCode(error: unknown): string | undefined {
  if (isRecord(error) && typeof error.code === 'string') {
    return error.code;
  }
  return undefined;
}

/**
 * 에러에서 HTTP 상태 코드 추출
 */
function extractStatus(error: unknown): number | undefined {
  if (isRecord(error)) {
    if (typeof error.status === 'number') return error.status;
    if (typeof error.statusCode === 'number') return error.statusCode;
  }
  return undefined;
}

/**
 * 에러에서 메시지 추출
 */
function extractMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (isRecord(error) && typeof error.message === 'string') {
    return error.message;
  }
  return 'Unknown error';
}

/**
 * REQ-API-012: 단일 에러 분류 함수
 *
 * 분류 우선순위:
 * 1. NETWORK — fetch 거부/타임아웃 (HTTP 응답 도달 전)
 * 2. RLS_DENIED — PostgREST code 42501
 * 3. AUTH — HTTP 401 / Auth 에러 코드 / JWT 관련 메시지
 * 4. VALIDATION — 23505/23502/23514 또는 HTTP 400
 * 5. NOT_FOUND — PGRST116 또는 HTTP 404
 * 6. SERVER — HTTP 5xx
 * 7. UNKNOWN — 분류 불가 (항상 마지막)
 *
 * @param error - 임의의 throw 된 값
 * @returns 7개 카테고리 중 하나
 */
export function classifyError(error: unknown): ErrorCategory {
  // 이미 AppError이고 카테고리가 찍혀 있으면 보존
  if (error instanceof AppError && error.category) {
    return error.category;
  }

  const message = extractMessage(error);
  const code = extractCode(error);
  const status = extractStatus(error);

  // 1. NETWORK: HTTP 응답 도달 전 연결 실패/타임아웃
  if (status === undefined) {
    // 상태 코드가 없는 TypeError(fetch 거부) 또는 네트워크 메시지
    if (
      error instanceof TypeError ||
      NETWORK_MESSAGE_PATTERNS.some((re) => re.test(message))
    ) {
      // 단, Auth 관련 메시지가 아닐 때만 NETWORK
      if (!AUTH_MESSAGE_PATTERNS.some((re) => re.test(message))) {
        return 'NETWORK';
      }
    }
  }

  // 2. RLS_DENIED: PostgREST 42501
  if (code === CODE_RLS_DENIED) {
    return 'RLS_DENIED';
  }

  // 3. AUTH: HTTP 401 / Auth 에러 코드 / JWT 메시지
  if (
    status === 401 ||
    (code !== undefined && AUTH_ERROR_CODES.includes(code)) ||
    AUTH_MESSAGE_PATTERNS.some((re) => re.test(message))
  ) {
    return 'AUTH';
  }

  // 4. VALIDATION: UNIQUE/NOT NULL/CHECK 위반 또는 HTTP 400
  if (
    code === CODE_UNIQUE_VIOLATION ||
    code === CODE_NOT_NULL_VIOLATION ||
    code === CODE_CHECK_VIOLATION ||
    status === 400
  ) {
    return 'VALIDATION';
  }

  // 5. NOT_FOUND: PGRST116 또는 HTTP 404
  if (code === CODE_PGRST116 || status === 404) {
    return 'NOT_FOUND';
  }

  // 6. SERVER: HTTP 5xx
  if (status !== undefined && status >= 500 && status < 600) {
    return 'SERVER';
  }

  // 7. UNKNOWN: 분류 불가 (항상 마지막)
  return 'UNKNOWN';
}

// @MX:ANCHOR: [AUTO] 모든 API 호출 에러가 이 함수를 거치는 단일 정규화 지점
// @MX:REASON: fan_in >= 3 예상 (모든 도메인 SPEC 호출 — Books/Library/Clubs/Feed 등 — 이 이 함수에 의존하며, 잘못된 정규화는 재시도/로깅/사용자 메시지 전반을 오염시킨다).
/**
 * REQ-API-011: 에러 정규화 함수
 *
 * 임의의 throw 된 값을 구조화된 AppError 인스턴스로 변환한다.
 * - category 필드에 7개 카테고리 중 하나를 설정한다 (REQ-API-012)
 * - originalError 필드에 원본 에러를 보존한다
 * - 이미 AppError인 경우 동일 인스턴스를 반환한다 (재정규화 방지)
 *
 * @param error - 임의의 throw 된 값 (Supabase 에러, Error, 문자열, unknown)
 * @returns category/originalError가 설정된 AppError 인스턴스
 */
export function normalizeError(error: unknown): AppError {
  // 이미 AppError인 경우 동일 인스턴스 보존
  if (error instanceof AppError) {
    if (!error.category) {
      error.category = classifyError(error);
    }
    return error;
  }

  const message = extractMessage(error);
  const category = classifyError(error);
  const code = extractCode(error) ?? mapCategoryToCode(category);
  const statusCode = mapCategoryToStatusCode(category, extractStatus(error));

  const normalized = new AppError(message, code, statusCode);
  normalized.category = category;
  normalized.originalError = error;
  return normalized;
}

/**
 * 카테고리 → 기본 에러 코드 매핑
 */
function mapCategoryToCode(category: ErrorCategory): string {
  switch (category) {
    case 'NETWORK':
      return 'NETWORK_ERROR';
    case 'AUTH':
      return 'AUTH_ERROR';
    case 'RLS_DENIED':
      return 'RLS_DENIED';
    case 'VALIDATION':
      return 'VALIDATION_ERROR';
    case 'NOT_FOUND':
      return 'NOT_FOUND';
    case 'SERVER':
      return 'SERVER_ERROR';
    case 'UNKNOWN':
    default:
      return 'UNKNOWN_ERROR';
  }
}

/**
 * 카테고리 → 기본 HTTP 상태 코드 매핑
 */
function mapCategoryToStatusCode(
  category: ErrorCategory,
  originalStatus?: number
): number {
  if (originalStatus !== undefined) return originalStatus;
  switch (category) {
    case 'NETWORK':
      return 0;
    case 'AUTH':
      return 401;
    case 'RLS_DENIED':
      return 403;
    case 'VALIDATION':
      return 400;
    case 'NOT_FOUND':
      return 404;
    case 'SERVER':
      return 500;
    case 'UNKNOWN':
    default:
      return 500;
  }
}

/**
 * REQ-API-014: 한국어 사용자 친화적 에러 메시지
 *
 * 각 카테고리별 기본 메시지 (인수 시나리오 E7 기준):
 * - NETWORK → "네트워크 연결을 확인해 주세요"
 * - AUTH → "로그인이 필요합니다"
 * - RLS_DENIED → "접근 권한이 없습니다"
 * - VALIDATION → "입력값을 확인해 주세요"
 * - NOT_FOUND → "요청한 항목을 찾을 수 없습니다"
 * - SERVER → "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요"
 * - UNKNOWN → "알 수 없는 오류가 발생했습니다"
 *
 * VALIDATION + UNIQUE 위반(23505)은 구체적 메시지로 덮어쓴다 (시나리오 E5).
 */
const FRIENDLY_MESSAGES: Record<ErrorCategory, string> = {
  NETWORK: '네트워크 연결을 확인해 주세요',
  AUTH: '로그인이 필요합니다',
  RLS_DENIED: '접근 권한이 없습니다',
  VALIDATION: '입력값을 확인해 주세요',
  NOT_FOUND: '요청한 항목을 찾을 수 없습니다',
  SERVER: '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요',
  UNKNOWN: '알 수 없는 오류가 발생했습니다',
};

/**
 * UNIQUE 제약 위반 전용 메시지 (시나리오 E5)
 */
const UNIQUE_VIOLATION_MESSAGE = '이미 등록된 항목입니다';

/**
 * SPEC-CLUB-001 REQ-CLUBA-008: terminal 상태 재설정 트리거 예외 전용 메시지.
 * guard_join_request_status_trigger(BEFORE UPDATE) 가 RAISE EXCEPTION 한 예외는
 * PostgREST 를 통해 HTTP 400(VALIDATION) 으로 전달된다. 키워드로 식별해 별도 메시지를 반환한다.
 */
const TERMINAL_STATE_MESSAGE = '이미 처리된 요청입니다';
const TERMINAL_KEYWORDS: readonly RegExp[] = [
  /이미 처리된/i,
  /\bterminal\b/i,
];

/**
 * REQ-API-014: 카테고리 기반 사용자 친화적 메시지 반환
 *
 * @param error - 정규화된 AppError (category 필드 필요)
 * @returns 한국어 사용자 메시지
 */
export function getUserFriendlyMessage(error: AppError): string {
  const category = error.category ?? 'UNKNOWN';

  // 시나리오 E5: VALIDATION + UNIQUE 위반은 구체적 메시지
  if (category === 'VALIDATION' && error.code === CODE_UNIQUE_VIOLATION) {
    return UNIQUE_VIOLATION_MESSAGE;
  }

  // SPEC-CLUB-001 REQ-CLUBA-008: VALIDATION + terminal 키워드
  if (
    category === 'VALIDATION' &&
    TERMINAL_KEYWORDS.some((re) => re.test(error.message))
  ) {
    return TERMINAL_STATE_MESSAGE;
  }

  return FRIENDLY_MESSAGES[category];
}

/**
 * Sentry captureException 호환 로그 구조 (REQ-API-015)
 *
 * SPEC-DEPLOY-001 에서 @sentry/react-native 의 captureException 으로
 * 교체 가능한 형태. name/message/stack 은 Error 표준 필드, extra 에
 * 카테고리/코드/상태/원본/타임스탬프/재시도소진 메타데이터를 담는다.
 */
export interface SentryLogPayload {
  name: string;
  message: string;
  stack?: string;
  extra: {
    category: ErrorCategory;
    code: string;
    statusCode: number;
    originalError: unknown;
    timestamp: string;
    retriesExhausted?: boolean;
  };
}

/**
 * REQ-API-015: Sentry 호환 구조화 로깅
 *
 * 로깅 대상 (REQ 명시):
 * - UNKNOWN 카테고리 에러
 * - 3회 재시도 후 실패한 에러 (retriesExhausted === true)
 *
 * 그 외 카테고리(NETWORK/AUTH/RLS_DENIED/VALIDATION/NOT_FOUND/SERVER)는
 * 사용자에게 일회성으로 노출되는 예상 에러이므로 로깅하지 않는다.
 *
 * 기본 싱크는 console.error 이며, SentryLogPayload 구조를 그대로 전달한다.
 * SPEC-DEPLOY-001 에서 실제 Sentry captureException 호출로 교체 가능하다.
 */
export function logToSentry(error: AppError): void {
  const category = error.category ?? 'UNKNOWN';
  const shouldLog = category === 'UNKNOWN' || error.retriesExhausted === true;

  if (!shouldLog) {
    return;
  }

  const payload: SentryLogPayload = {
    name: error.name,
    message: error.message,
    stack: error.stack,
    extra: {
      category,
      code: error.code,
      statusCode: error.statusCode,
      originalError: error.originalError,
      timestamp: new Date().toISOString(),
      retriesExhausted: error.retriesExhausted,
    },
  };

  // 기본 싱크: console.error (SPEC-DEPLOY-001에서 Sentry captureException으로 전환 예정)
  console.error(payload);
}
