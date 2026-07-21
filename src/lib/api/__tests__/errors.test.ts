/**
 * 에러 처리 모듈 테스트
 * REQ-API-011: normalizeError
 * REQ-API-012: 7개 카테고리 분류
 * REQ-API-014: 한국어 사용자 친화적 메시지
 * REQ-API-015: Sentry 호환 구조화 로깅
 *
 * 인수 시나리오 E1, E3, E4, E5, E7, E8 커버
 */
import {
  normalizeError,
  classifyError,
  getUserFriendlyMessage,
  logToSentry,
  ERROR_CATEGORIES,
  type ErrorCategory,
} from '../errors';
import { AppError } from '../../../errors';

describe('normalizeError (REQ-API-011) — 시나리오 E1', () => {
  it('Supabase PostgREST 에러를 AppError로 정규화한다', () => {
    const supabaseError = {
      message: 'permission denied',
      code: '42501',
      details: 'policy violation',
      hint: null,
    };

    const normalized = normalizeError(supabaseError);

    expect(normalized).toBeInstanceOf(AppError);
    expect(normalized.category).toBeDefined();
    expect(normalized.message).toBe('permission denied');
    expect(normalized.originalError).toBe(supabaseError);
  });

  it('일반 Error 객체를 정규화한다', () => {
    const err = new Error('boom');
    const normalized = normalizeError(err);

    expect(normalized).toBeInstanceOf(AppError);
    expect(normalized.message).toBe('boom');
    expect(normalized.originalError).toBe(err);
    expect(normalized.category).toBeDefined();
  });

  it('문자열을 정규화한다', () => {
    const normalized = normalizeError('something broke');

    expect(normalized).toBeInstanceOf(AppError);
    expect(normalized.message).toBe('something broke');
    expect(normalized.originalError).toBe('something broke');
    expect(normalized.category).toBe('UNKNOWN');
  });

  it('이미 AppError인 경우 동일한 인스턴스를 보존한다', () => {
    const existing = new AppError('already classified', 'CUSTOM', 500);
    existing.category = 'SERVER';
    const normalized = normalizeError(existing);

    expect(normalized).toBe(existing);
    expect(normalized.category).toBe('SERVER');
  });

  it('null/undefined 입력을 UNKNOWN으로 정규화한다', () => {
    expect(normalizeError(null).category).toBe('UNKNOWN');
    expect(normalizeError(undefined).category).toBe('UNKNOWN');
  });
});

describe('classifyError (REQ-API-012) — 7개 카테고리 분류', () => {
  it('네트워크 연결 실패를 NETWORK로 분류한다', () => {
    expect(classifyError(new TypeError('Failed to fetch'))).toBe('NETWORK');
    expect(classifyError(new Error('Network request failed'))).toBe('NETWORK');
  });

  it('RLS 정책 거부(42501)를 RLS_DENIED로 분류한다', () => {
    const err = { message: 'permission denied', code: '42501' };
    expect(classifyError(err)).toBe('RLS_DENIED');
  });

  it('세션 만료/401을 AUTH로 분류한다 (재시도 없음)', () => {
    expect(classifyError({ message: 'JWT expired', status: 401 })).toBe('AUTH');
    expect(
      classifyError({ message: 'Invalid token', code: 'invalid_credentials' })
    ).toBe('AUTH');
  });

  it('UNIQUE 제약 위반(23505)을 VALIDATION으로 분류한다', () => {
    const err = {
      message: 'duplicate key value violates unique constraint',
      code: '23505',
    };
    expect(classifyError(err)).toBe('VALIDATION');
  });

  it('CHECK 제약 위반(23514)을 VALIDATION으로 분류한다', () => {
    expect(classifyError({ message: 'check', code: '23514' })).toBe(
      'VALIDATION'
    );
  });

  it('NOT NULL 위반(23502)을 VALIDATION으로 분류한다', () => {
    expect(classifyError({ message: 'not null', code: '23502' })).toBe(
      'VALIDATION'
    );
  });

  it('400 상태를 VALIDATION으로 분류한다', () => {
    expect(classifyError({ message: 'bad request', status: 400 })).toBe(
      'VALIDATION'
    );
  });

  it('PGRST116(0/multiple rows)을 NOT_FOUND로 분류한다', () => {
    expect(
      classifyError({
        message: 'JSON object requested, multiple (or no) rows returned',
        code: 'PGRST116',
      })
    ).toBe('NOT_FOUND');
  });

  it('404 상태를 NOT_FOUND로 분류한다', () => {
    expect(classifyError({ message: 'not found', status: 404 })).toBe(
      'NOT_FOUND'
    );
  });

  it('500 서버 에러를 SERVER로 분류한다', () => {
    expect(classifyError({ message: 'internal', status: 500 })).toBe('SERVER');
    expect(classifyError({ message: 'bad gateway', status: 502 })).toBe(
      'SERVER'
    );
  });

  it('분류 불가 에러를 UNKNOWN으로 분류한다', () => {
    expect(classifyError({ message: 'weird', foo: 'bar' })).toBe('UNKNOWN');
    expect(classifyError(42)).toBe('UNKNOWN');
  });

  it('ERROR_CATEGORIES가 정확히 7개 카테고리를 노출한다', () => {
    expect(ERROR_CATEGORIES).toEqual([
      'NETWORK',
      'AUTH',
      'RLS_DENIED',
      'VALIDATION',
      'NOT_FOUND',
      'SERVER',
      'UNKNOWN',
    ]);
  });
});

describe('getUserFriendlyMessage (REQ-API-014) — 시나리오 E7', () => {
  const make = (category: ErrorCategory, code?: string): AppError => {
    const e = new AppError('msg', code ?? 'CODE');
    e.category = category;
    return e;
  };

  it('NETWORK → "네트워크 연결을 확인해 주세요"', () => {
    expect(getUserFriendlyMessage(make('NETWORK'))).toBe(
      '네트워크 연결을 확인해 주세요'
    );
  });

  it('AUTH → "로그인이 필요합니다"', () => {
    expect(getUserFriendlyMessage(make('AUTH'))).toBe('로그인이 필요합니다');
  });

  it('RLS_DENIED → "접근 권한이 없습니다"', () => {
    expect(getUserFriendlyMessage(make('RLS_DENIED'))).toBe(
      '접근 권한이 없습니다'
    );
  });

  it('VALIDATION → "입력값을 확인해 주세요"', () => {
    expect(getUserFriendlyMessage(make('VALIDATION'))).toBe(
      '입력값을 확인해 주세요'
    );
  });

  it('NOT_FOUND → "요청한 항목을 찾을 수 없습니다"', () => {
    expect(getUserFriendlyMessage(make('NOT_FOUND'))).toBe(
      '요청한 항목을 찾을 수 없습니다'
    );
  });

  it('SERVER → "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요"', () => {
    expect(getUserFriendlyMessage(make('SERVER'))).toBe(
      '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요'
    );
  });

  it('UNKNOWN → "알 수 없는 오류가 발생했습니다"', () => {
    expect(getUserFriendlyMessage(make('UNKNOWN'))).toBe(
      '알 수 없는 오류가 발생했습니다'
    );
  });

  it('VALIDATION + UNIQUE 위반(23505) → "이미 등록된 항목입니다" (시나리오 E5)', () => {
    expect(getUserFriendlyMessage(make('VALIDATION', '23505'))).toBe(
      '이미 등록된 항목입니다'
    );
  });
});

describe('logToSentry (REQ-API-015) — 시나리오 E8', () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('UNKNOWN 카테고리 에러를 Sentry 호환 포맷으로 로깅한다', () => {
    const originalErr = new Error('mystery');
    const err = normalizeError(originalErr); // UNKNOWN

    logToSentry(err);

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const logged = consoleSpy.mock.calls[0][0] as Record<string, unknown>;
    expect(logged.name).toBe('AppError');
    expect(logged.message).toBe('mystery');
    expect(logged.stack).toBeDefined();
    expect(logged.extra).toBeDefined();
    const extra = logged.extra as Record<string, unknown>;
    expect(extra.category).toBe('UNKNOWN');
    expect(extra.timestamp).toBeDefined();
  });

  it('재시도 소진 에러를 로깅한다', () => {
    const err = new AppError('network down', 'NETWORK_ERROR', 0);
    err.category = 'NETWORK';
    err.retriesExhausted = true;

    logToSentry(err);

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const logged = consoleSpy.mock.calls[0][0] as Record<string, unknown>;
    const extra = logged.extra as Record<string, unknown>;
    expect(extra.retriesExhausted).toBe(true);
  });

  it('UNKNOWN이 아니고 재시도 소간이 아닌 에러는 로깅하지 않는다', () => {
    const err = new AppError('validation', 'VALIDATION_ERROR', 400);
    err.category = 'VALIDATION';

    logToSentry(err);

    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('로그 구조가 Sentry captureException 호환 형태다 (name/message/stack/extra)', () => {
    const err = normalizeError(new Error('x'));

    logToSentry(err);

    const logged = consoleSpy.mock.calls[0][0] as Record<string, unknown>;
    expect(logged).toHaveProperty('name');
    expect(logged).toHaveProperty('message');
    expect(logged).toHaveProperty('stack');
    expect(logged).toHaveProperty('extra');
    expect(typeof logged.extra).toBe('object');
  });
});
