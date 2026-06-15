/**
 * Custom Error Types
 * REQ-API-011: Common error class/type definitions
 * REQ-API-012: Error code system
 * REQ-API-011: Error handling middleware/utilities
 * REQ-API-012: User-defined error types
 */

/**
 * Base application error class
 * All custom errors should extend this class
 * REQ-API-011, REQ-API-012
 */
export class AppError extends Error {
  code: string;
  statusCode: number;
  name: string = 'AppError'; // Class property declaration

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
