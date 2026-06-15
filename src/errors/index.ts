/**
 * Custom Error Types
 * REQ-API-011: Common error class/type definitions
 * REQ-API-012: Error code system
 * REQ-API-011: Error handling middleware/utilities
 * REQ-API-012: User-defined error types
 */

/**
 * 에러 카테고리 (REQ-API-012)
 * 7개 카테고리로 모든 에러를 분류한다.
 */
export type ErrorCategory =
  | 'NETWORK'
  | 'AUTH'
  | 'RLS_DENIED'
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'SERVER'
  | 'UNKNOWN';

/**
 * Base application error class
 * All custom errors should extend this class
 * REQ-API-011, REQ-API-012
 *
 * category / originalError / retriesExhausted 필드는 REQ-API-012 ~ 015 에러 처리 모듈에서
 * 사용하기 위해 추가된 선택적 메타데이터이다. 기존 서브클래스와 테스트는 영향받지 않는다.
 */
export class AppError extends Error {
  code: string;
  statusCode: number;
  name: string = 'AppError'; // Class property declaration

  // REQ-API-012: 에러 카테고리 (선택 — normalizeError가 설정)
  category?: ErrorCategory;
  // REQ-API-011: 원본 에러 객체 보존 (선택)
  originalError?: unknown;
  // REQ-API-013/015: 재시도 3회 소진 표식 (선택)
  retriesExhausted?: boolean;

  constructor(
    message: string,
    code: string = 'UNKNOWN_ERROR',
    statusCode: number = 500
  ) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;

    // Maintains proper stack trace (V8 engine requirement)
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Authentication errors (400, 401)
 * REQ-API-012
 */
export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed', code: string = 'AUTH_ERROR') {
    super(message, code, 401);
    this.name = 'AuthenticationError';
  }
}

/**
 * Validation errors (400)
 * REQ-API-012
 */
export class ValidationError extends AppError {
  constructor(message: string = 'Validation failed', code: string = 'VALIDATION_ERROR') {
    super(message, code, 400);
    this.name = 'ValidationError';
  }
}

/**
 * Not found errors (404)
 * REQ-API-012
 */
export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found', code: string = 'NOT_FOUND') {
    super(message, code, 404);
    this.name = 'NotFoundError';
  }
}

/**
 * Conflict errors (409)
 * REQ-API-012
 */
export class ConflictError extends AppError {
  constructor(message: string = 'Resource conflict', code: string = 'CONFLICT') {
    super(message, code, 409);
    this.name = 'ConflictError';
  }
}

/**
 * Network errors
 * REQ-API-012
 */
export class NetworkError extends AppError {
  constructor(message: string = 'Network request failed', code: string = 'NETWORK_ERROR') {
    super(message, code, 0); // Network errors often don't have HTTP status
    this.name = 'NetworkError';
  }
}

/**
 * Database errors
 * REQ-API-012
 */
export class DatabaseError extends AppError {
  constructor(message: string = 'Database operation failed', code: string = 'DATABASE_ERROR') {
    super(message, code, 500);
    this.name = 'DatabaseError';
  }
}

/**
 * Timeout errors
 * REQ-API-012
 */
export class TimeoutError extends AppError {
  constructor(message: string = 'Operation timed out', code: string = 'TIMEOUT') {
    super(message, code, 408);
    this.name = 'TimeoutError';
  }
}
