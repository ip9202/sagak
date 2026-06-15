/**
 * Custom Error Types Tests
 * REQ-API-011: Common error class/type definitions
 * REQ-API-012: Error code system
 * REQ-API-011: Error handling middleware/utilities
 * REQ-API-012: User-defined error types
 */
import {
  AppError,
  AuthenticationError,
  ValidationError,
  NotFoundError,
  ConflictError,
  NetworkError,
  DatabaseError,
  TimeoutError,
} from '../index';

describe('Custom Error Types (REQ-API-011, REQ-API-012)', () => {
  describe('AppError (base class)', () => {
    it('should create an instance with message, code, and statusCode', () => {
      const error = new AppError('Something went wrong', 'CUSTOM_CODE', 400);

      expect(error.message).toBe('Something went wrong');
      expect(error.code).toBe('CUSTOM_CODE');
      expect(error.statusCode).toBe(400);
    });

    it('should use default code and statusCode when not provided', () => {
      const error = new AppError('Default error');

      expect(error.code).toBe('UNKNOWN_ERROR');
      expect(error.statusCode).toBe(500);
    });

    it('should be an instance of Error', () => {
      const error = new AppError('test');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
    });

    it('should have name property set to AppError', () => {
      const error = new AppError('test');

      expect(error.name).toBe('AppError');
    });

    it('should allow overriding code while keeping default statusCode', () => {
      const error = new AppError('msg', 'MY_CODE');

      expect(error.code).toBe('MY_CODE');
      expect(error.statusCode).toBe(500);
    });
  });

  describe('AuthenticationError (REQ-API-012)', () => {
    it('should have statusCode 401', () => {
      const error = new AuthenticationError();

      expect(error.statusCode).toBe(401);
    });

    it('should use default message and code', () => {
      const error = new AuthenticationError();

      expect(error.message).toBe('Authentication failed');
      expect(error.code).toBe('AUTH_ERROR');
    });

    it('should allow custom message and code', () => {
      const error = new AuthenticationError('Invalid token', 'INVALID_TOKEN');

      expect(error.message).toBe('Invalid token');
      expect(error.code).toBe('INVALID_TOKEN');
    });

    it('should have name AuthenticationError', () => {
      const error = new AuthenticationError();

      expect(error.name).toBe('AuthenticationError');
    });

    it('should be an instance of AppError', () => {
      const error = new AuthenticationError();

      expect(error).toBeInstanceOf(AppError);
    });
  });

  describe('ValidationError (REQ-API-012)', () => {
    it('should have statusCode 400', () => {
      const error = new ValidationError();

      expect(error.statusCode).toBe(400);
    });

    it('should use default message and code', () => {
      const error = new ValidationError();

      expect(error.message).toBe('Validation failed');
      expect(error.code).toBe('VALIDATION_ERROR');
    });

    it('should allow custom message and code', () => {
      const error = new ValidationError('Email is invalid', 'INVALID_EMAIL');

      expect(error.message).toBe('Email is invalid');
      expect(error.code).toBe('INVALID_EMAIL');
    });

    it('should have name ValidationError', () => {
      const error = new ValidationError();

      expect(error.name).toBe('ValidationError');
    });

    it('should be an instance of AppError', () => {
      const error = new ValidationError();

      expect(error).toBeInstanceOf(AppError);
    });
  });

  describe('NotFoundError (REQ-API-012)', () => {
    it('should have statusCode 404', () => {
      const error = new NotFoundError();

      expect(error.statusCode).toBe(404);
    });

    it('should use default message and code', () => {
      const error = new NotFoundError();

      expect(error.message).toBe('Resource not found');
      expect(error.code).toBe('NOT_FOUND');
    });

    it('should allow custom message and code', () => {
      const error = new NotFoundError('User not found', 'USER_NOT_FOUND');

      expect(error.message).toBe('User not found');
      expect(error.code).toBe('USER_NOT_FOUND');
    });

    it('should have name NotFoundError', () => {
      const error = new NotFoundError();

      expect(error.name).toBe('NotFoundError');
    });

    it('should be an instance of AppError', () => {
      const error = new NotFoundError();

      expect(error).toBeInstanceOf(AppError);
    });
  });

  describe('ConflictError (REQ-API-012)', () => {
    it('should have statusCode 409', () => {
      const error = new ConflictError();

      expect(error.statusCode).toBe(409);
    });

    it('should use default message and code', () => {
      const error = new ConflictError();

      expect(error.message).toBe('Resource conflict');
      expect(error.code).toBe('CONFLICT');
    });

    it('should allow custom message and code', () => {
      const error = new ConflictError('Email already exists', 'DUPLICATE_EMAIL');

      expect(error.message).toBe('Email already exists');
      expect(error.code).toBe('DUPLICATE_EMAIL');
    });

    it('should have name ConflictError', () => {
      const error = new ConflictError();

      expect(error.name).toBe('ConflictError');
    });

    it('should be an instance of AppError', () => {
      const error = new ConflictError();

      expect(error).toBeInstanceOf(AppError);
    });
  });

  describe('NetworkError (REQ-API-012)', () => {
    it('should have statusCode 0 (no HTTP status)', () => {
      const error = new NetworkError();

      expect(error.statusCode).toBe(0);
    });

    it('should use default message and code', () => {
      const error = new NetworkError();

      expect(error.message).toBe('Network request failed');
      expect(error.code).toBe('NETWORK_ERROR');
    });

    it('should allow custom message and code', () => {
      const error = new NetworkError('Connection refused', 'CONN_REFUSED');

      expect(error.message).toBe('Connection refused');
      expect(error.code).toBe('CONN_REFUSED');
    });

    it('should have name NetworkError', () => {
      const error = new NetworkError();

      expect(error.name).toBe('NetworkError');
    });

    it('should be an instance of AppError', () => {
      const error = new NetworkError();

      expect(error).toBeInstanceOf(AppError);
    });
  });

  describe('DatabaseError (REQ-API-012)', () => {
    it('should have statusCode 500', () => {
      const error = new DatabaseError();

      expect(error.statusCode).toBe(500);
    });

    it('should use default message and code', () => {
      const error = new DatabaseError();

      expect(error.message).toBe('Database operation failed');
      expect(error.code).toBe('DATABASE_ERROR');
    });

    it('should allow custom message and code', () => {
      const error = new DatabaseError('Unique constraint violated', 'UNIQUE_VIOLATION');

      expect(error.message).toBe('Unique constraint violated');
      expect(error.code).toBe('UNIQUE_VIOLATION');
    });

    it('should have name DatabaseError', () => {
      const error = new DatabaseError();

      expect(error.name).toBe('DatabaseError');
    });

    it('should be an instance of AppError', () => {
      const error = new DatabaseError();

      expect(error).toBeInstanceOf(AppError);
    });
  });

  describe('TimeoutError (REQ-API-012)', () => {
    it('should have statusCode 408', () => {
      const error = new TimeoutError();

      expect(error.statusCode).toBe(408);
    });

    it('should use default message and code', () => {
      const error = new TimeoutError();

      expect(error.message).toBe('Operation timed out');
      expect(error.code).toBe('TIMEOUT');
    });

    it('should allow custom message and code', () => {
      const error = new TimeoutError('Request timeout', 'REQUEST_TIMEOUT');

      expect(error.message).toBe('Request timeout');
      expect(error.code).toBe('REQUEST_TIMEOUT');
    });

    it('should have name TimeoutError', () => {
      const error = new TimeoutError();

      expect(error.name).toBe('TimeoutError');
    });

    it('should be an instance of AppError', () => {
      const error = new TimeoutError();

      expect(error).toBeInstanceOf(AppError);
    });
  });

  describe('Error code system (REQ-API-012)', () => {
    it('should preserve distinct error codes across types', () => {
      const errors = [
        new AppError('base error'),
        new AuthenticationError(),
        new ValidationError(),
        new NotFoundError(),
        new ConflictError(),
        new NetworkError(),
        new DatabaseError(),
        new TimeoutError(),
      ];

      const codes = errors.map((e) => e.code);
      const uniqueCodes = new Set(codes);

      expect(uniqueCodes.size).toBe(codes.length);
    });

    it('should preserve distinct names across types', () => {
      const errors = {
        app: new AppError('base error'),
        auth: new AuthenticationError(),
        validation: new ValidationError(),
        notFound: new NotFoundError(),
        conflict: new ConflictError(),
        network: new NetworkError(),
        database: new DatabaseError(),
        timeout: new TimeoutError(),
      };

      expect(errors.app.name).toBe('AppError');
      expect(errors.auth.name).toBe('AuthenticationError');
      expect(errors.validation.name).toBe('ValidationError');
      expect(errors.notFound.name).toBe('NotFoundError');
      expect(errors.conflict.name).toBe('ConflictError');
      expect(errors.network.name).toBe('NetworkError');
      expect(errors.database.name).toBe('DatabaseError');
      expect(errors.timeout.name).toBe('TimeoutError');
    });
  });

  describe('Error throwing and catching (REQ-API-011)', () => {
    it('should be throwable and catchable as AppError', () => {
      const throwAppError = (): never => {
        throw new NotFoundError('Item missing');
      };

      try {
        throwAppError();
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect(error).toBeInstanceOf(NotFoundError);
        expect((error as AppError).statusCode).toBe(404);
        expect((error as AppError).message).toBe('Item missing');
      }
    });

    it('should be catchable as generic Error', () => {
      const throwError = (): never => {
        throw new ValidationError('Bad input');
      };

      try {
        throwError();
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Bad input');
      }
    });
  });
});
