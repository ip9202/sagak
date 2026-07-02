/**
 * SPEC-CLUB-001 T-008: process-join-request Edge Function 순수 로직 단위 테스트
 *
 * Deno entry(index.ts)는 tsconfig exclude 대상이므로 type-check/커버리지에서 제외된다.
 * 본 테스트는 Deno 글로벌에 의존하지 않는 순수 로직 모듈(logic.ts)을 검증한다:
 * - parseRequestBody: JSON 파싱 + 필수 필드 검증
 * - validateMessage: E4 500자 이중 방어 (Edge Function 측)
 * - errorResponse / successResponse: 표준 응답 빌더
 * - resolveAllowedOrigin: CORS Origin 화이트리스트 검증 (운영 배포 보안 요구사항)
 * - buildSendNotificationPayload: SPEC-NOTIF-001 연동 바디 빌더 (join_request_received)
 * - isUniqueViolation: 23505 UNIQUE 위반 감지 (join_requests 멱등성)
 * - buildLazyClubName: lazy group 클럽 name 생성
 * - buildCorsPreflightHeaders / buildJsonHeaders: CORS 헤더 빌더
 * - extractJwtSub: JWT sub(user_id) 추출 전용 (서명 검증은 게이트웨이 범위, 본 함수는 payload 디코딩만)
 */
import {
  parseRequestBody,
  validateMessage,
  buildErrorResponse,
  buildSuccessResponse,
  MESSAGE_MAX_LENGTH,
  resolveAllowedOrigin,
  buildSendNotificationPayload,
  isUniqueViolation,
  buildLazyClubName,
  buildCorsPreflightHeaders,
  buildJsonHeaders,
  extractJwtSub,
} from '../logic';

describe('SPEC-CLUB-001 T-008: process-join-request logic', () => {
  describe('MESSAGE_MAX_LENGTH (E4 이중 방어, Edge Function 측)', () => {
    it('500 으로 정의된다 (client 와 동일)', () => {
      expect(MESSAGE_MAX_LENGTH).toBe(500);
    });
  });

  describe('validateMessage', () => {
    it('null 은 유효', () => {
      expect(validateMessage(null)).toBeNull();
    });
    it('500자 이하는 유효', () => {
      expect(validateMessage('a'.repeat(500))).toBeNull();
    });
    it('501자 이상은 에러 메시지 반환', () => {
      expect(validateMessage('a'.repeat(501))).not.toBeNull();
    });
  });

  describe('parseRequestBody', () => {
    it('필수 필드 모두 있으면 파싱 성공', () => {
      const result = parseRequestBody(
        JSON.stringify({
          target_user_id: 'u1',
          book_id: 'b1',
          requester_id: 'req-u1',
          message: 'hi',
        }),
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.target_user_id).toBe('u1');
        expect(result.value.book_id).toBe('b1');
      }
    });

    it('잘못된 JSON 은 에러', () => {
      const result = parseRequestBody('not json{');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.status).toBe(400);
      }
    });

    it('JSON 이 객체가 아닌 경우(예: 숫자 리터럴) 400 invalid_body', () => {
      const result = parseRequestBody(JSON.stringify(42));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe('invalid_body');
    });

    it('message 가 문자열도 null 도 아닌 타입이면 400 invalid_message_type', () => {
      const result = parseRequestBody(
        JSON.stringify({
          target_user_id: 'u1',
          book_id: 'b1',
          requester_id: 'r1',
          message: 12345,
        }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe('invalid_message_type');
    });

    it('target_user_id 누락 시 400', () => {
      const result = parseRequestBody(
        JSON.stringify({ book_id: 'b1', requester_id: 'r1', message: null }),
      );
      expect(result.ok).toBe(false);
    });

    it('book_id 누락 시 400', () => {
      const result = parseRequestBody(
        JSON.stringify({ target_user_id: 'u1', requester_id: 'r1', message: null }),
      );
      expect(result.ok).toBe(false);
    });

    it('requester_id 누락 시 400 (Edge Function 은 JWT 로 재검증하지만 입력 계약도 강제)', () => {
      const result = parseRequestBody(
        JSON.stringify({ target_user_id: 'u1', book_id: 'b1', message: null }),
      );
      expect(result.ok).toBe(false);
    });

    it('message 500자 초과 시 400 (E4 이중 방어)', () => {
      const result = parseRequestBody(
        JSON.stringify({
          target_user_id: 'u1',
          book_id: 'b1',
          requester_id: 'r1',
          message: 'x'.repeat(501),
        }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.status).toBe(400);
      }
    });
  });

  describe('buildErrorResponse / buildSuccessResponse', () => {
    it('errorResponse 는 JSON Response with status', () => {
      const resp = buildErrorResponse(400, 'invalid_input', 'detail');
      expect(resp.status).toBe(400);
      expect(resp.headers.get('Content-Type')).toBe('application/json');
    });

    it('successResponse 는 200 JSON', () => {
      const resp = buildSuccessResponse({
        ok: true,
        club_id: 'c1',
        request_id: 'jr-1',
      });
      expect(resp.status).toBe(200);
    });
  });

  // --- 운영 배포 보안 요구사항 (SPEC-CLUB-001 progress.md) ---

  describe('resolveAllowedOrigin (CORS Origin 화이트리스트)', () => {
    it('허용 목록에 포함된 origin 은 그대로 반환', () => {
      const allow = ['https://sagak.app', 'https://dev.sagak.app'];
      expect(resolveAllowedOrigin('https://sagak.app', allow)).toBe(
        'https://sagak.app',
      );
    });

    it('허용 목록에 없는 origin 은 null 반환 (preflight 거부용)', () => {
      const allow = ['https://sagak.app'];
      expect(resolveAllowedOrigin('https://evil.example', allow)).toBeNull();
    });

    it('origin 헤더가 null 이면 null 반환', () => {
      expect(resolveAllowedOrigin(null, ['https://sagak.app'])).toBeNull();
    });

    it('빈 문자열 origin 은 null 반환', () => {
      expect(resolveAllowedOrigin('', ['https://sagak.app'])).toBeNull();
    });

    it('허용 목록이 비어 있으면 항상 null 반환 (폐쇄 정책)', () => {
      expect(
        resolveAllowedOrigin('https://sagak.app', []),
      ).toBeNull();
    });
  });

  describe('buildCorsPreflightHeaders / buildJsonHeaders (Origin 반영)', () => {
    it('preflight 헤더는 허용된 origin 을 Access-Control-Allow-Origin 에 반영', () => {
      const h = buildCorsPreflightHeaders('https://sagak.app');
      expect(h['Access-Control-Allow-Origin']).toBe('https://sagak.app');
      expect(h['Access-Control-Allow-Methods']).toContain('POST');
      expect(h['Access-Control-Allow-Headers']).toContain('authorization');
    });

    it('JSON 헤더도 허용된 origin 을 반영한다', () => {
      const h = buildJsonHeaders('https://sagak.app');
      expect(h['Access-Control-Allow-Origin']).toBe('https://sagak.app');
      expect(h['Content-Type']).toBe('application/json');
    });
  });

  describe('isUniqueViolation (23505 감지, join_requests 멱등성)', () => {
    it('code 23505 + message 에 unique 포함 시 true', () => {
      const err = {
        code: '23505',
        message: 'duplicate key value violates unique constraint',
      };
      expect(isUniqueViolation(err)).toBe(true);
    });

    it('code 23505 만으로도 true (메시지 폼 무관)', () => {
      expect(isUniqueViolation({ code: '23505' })).toBe(true);
    });

    it('다른 code 는 false', () => {
      expect(isUniqueViolation({ code: '42501', message: 'rls denied' })).toBe(
        false,
      );
    });

    it('code 필드가 없으면 false', () => {
      expect(isUniqueViolation({ message: 'some error' })).toBe(false);
    });

    it('null/undefined 입력 시 false', () => {
      expect(isUniqueViolation(null)).toBe(false);
      expect(isUniqueViolation(undefined)).toBe(false);
    });
  });

  describe('buildLazyClubName (lazy group 클럽 name 생성)', () => {
    it('형식: "group-{bookId 앞 8자}" — clubs.name NOT NULL 대응', () => {
      const name = buildLazyClubName('12345678-90ab-cdef-1234-567890abcdef');
      expect(name).toBe('group-12345678');
      // clubs.name NOT NULL 제약 만족
      expect(name.length).toBeGreaterThan(0);
    });

    it('bookId 가 짧아도 접두사는 유지', () => {
      const name = buildLazyClubName('abc');
      expect(name).toBe('group-abc');
    });
  });

  describe('buildSendNotificationPayload (SPEC-NOTIF-001 연동)', () => {
    it('join_request_received 타입 + host_id + data{requester_nickname, club_title} + ref_id=request_id', () => {
      const payload = buildSendNotificationPayload({
        hostUserId: 'host-uuid',
        requestId: 'jr-uuid',
        requesterNickname: '독자함께',
        clubTitle: 'group-12345678',
      });

      expect(payload.user_id).toBe('host-uuid');
      expect(payload.type).toBe('join_request_received');
      expect(payload.ref_id).toBe('jr-uuid');
      expect(payload.data).toEqual({
        requester_nickname: '독자함께',
        club_title: 'group-12345678',
      });
    });

    it('requesterNickname 이 null 이면 빈 문자열로 graceful degradation (acceptance N33)', () => {
      const payload = buildSendNotificationPayload({
        hostUserId: 'host-uuid',
        requestId: 'jr-uuid',
        requesterNickname: null,
        clubTitle: 'group-12345678',
      });
      expect(payload.data?.requester_nickname).toBe('');
    });
  });

  describe('extractJwtSub (JWT sub 추출 전용 — 서명 검증은 게이트웨이 범위)', () => {
    // 테스트용 JWT payload 를 base64url 로 인코딩한다.
    // 실제 디코딩 경로(payload.replace(/-/g,'+').replace(/_/g,'/') + pad + atob)를
    // 정확히 거치도록 표준 base64 → base64url 변환(-/_ 패딩 제거)을 적용한다.
    function b64urlPayload(obj: unknown): string {
      const json = JSON.stringify(obj);
      // UTF-8 안전 base64 인코딩 (unescape/encodeURIComponent 레거시 대신 Node Buffer 사용)
      const b64 = Buffer.from(json, 'utf-8').toString('base64');
      return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }
    function makeJwt(payload: unknown): string {
      return `${b64urlPayload({ alg: 'none' })}.${b64urlPayload(payload)}.dummy-signature`;
    }

    it('정상 Bearer JWT 의 sub 를 반환한다 (happy path)', () => {
      const token = makeJwt({ sub: 'user-uuid-123' });
      expect(extractJwtSub(`Bearer ${token}`)).toBe('user-uuid-123');
    });

    it('payload 에 추가 필드가 있어도 sub 만 반환한다', () => {
      const token = makeJwt({ sub: 'user-uuid-123', iat: 1700000000, exp: 1800000000 });
      expect(extractJwtSub(`Bearer ${token}`)).toBe('user-uuid-123');
    });

    it('Authorization 헤더가 null 이면 null 반환', () => {
      expect(extractJwtSub(null)).toBeNull();
    });

    it('Authorization 헤더가 빈 문자열이면 null 반환 (falsy)', () => {
      expect(extractJwtSub('')).toBeNull();
    });

    it('스킴이 Bearer 가 아니면 null 반환 (예: Token)', () => {
      const token = makeJwt({ sub: 'user-uuid-123' });
      expect(extractJwtSub(`Token ${token}`)).toBeNull();
    });

    it('스킴이 소문자 bearer 이면 null 반환 (대소문자 구분)', () => {
      const token = makeJwt({ sub: 'user-uuid-123' });
      expect(extractJwtSub(`bearer ${token}`)).toBeNull();
    });

    it('공백이 없는 단일 토큰이면 null 반환 (parts.length !== 2)', () => {
      expect(extractJwtSub('Bearer')).toBeNull();
      expect(extractJwtSub('abc.def.ghi')).toBeNull();
    });

    it('공백이 2개 이상이면 null 반환 (parts.length === 3)', () => {
      expect(extractJwtSub('Bearer a b')).toBeNull();
    });

    it('토큰이 점 2개(3파트 아님)면 null 반환', () => {
      expect(extractJwtSub('Bearer abc.def')).toBeNull();
    });

    it('토큰은 3파트지만 payload 가 base64 디코딩 불가능하면 null 반환 (catch)', () => {
      // base64url 이 아닌 잘못된 문자열이 들어가도 atob 실패 → catch
      expect(extractJwtSub('Bearer !!!!!!.@@@@@@.######')).toBeNull();
    });

    it('payload 가 유효 base64 이지만 JSON 객체가 아니면 null 반환 (배열)', () => {
      // JSON 배열 → typeof object 이지만 'sub' in [] 은 false
      const token = makeJwt([1, 2, 3]);
      expect(extractJwtSub(`Bearer ${token}`)).toBeNull();
    });

    it('payload 가 JSON 문자열 리터럴이면 null 반환 (typeof !== object)', () => {
      const token = makeJwt('plain-string');
      expect(extractJwtSub(`Bearer ${token}`)).toBeNull();
    });

    it('payload 객체에 sub 가 없으면 null 반환', () => {
      const token = makeJwt({ foo: 'bar', iat: 123 });
      expect(extractJwtSub(`Bearer ${token}`)).toBeNull();
    });

    it('sub 가 문자열이 아니면 null 반환 (숫자 타입)', () => {
      const token = makeJwt({ sub: 12345 });
      expect(extractJwtSub(`Bearer ${token}`)).toBeNull();
    });

    // --- 프로토타입 오염 회귀테스트 (방어 테스트) ---
    // extractJwtSub 은 JSON.parse 결과를 안전하게 소비해야 한다.
    // 악의적 payload 가 __proto__ / constructor 경로로 Object.prototype 을
    // 오염시키려 시도할 때, (1) sub 는 정상 추출되며 (2) 전역 프로토타입은 미오염임을 검증.
    // 리팩터 시 실수로 JSON.parse 결과를 Object.assign 등으로 병합하면 회귀 발생.

    it('payload 에 __proto__ 오염 시도가 있어도 sub 정상 추출 + 프로토타입 미오염', () => {
      // 오염 전 베이스라인: 전역 Object.prototype 에 isAdmin 없음 확인
      expect(({} as { isAdmin?: unknown }).isAdmin).toBeUndefined();

      const maliciousPayload = {
        __proto__: { isAdmin: true },
        sub: 'user-uuid-prototype',
      };
      const token = makeJwt(maliciousPayload);

      // (1) sub 는 정상적으로 추출된다
      expect(extractJwtSub(`Bearer ${token}`)).toBe('user-uuid-prototype');

      // (2) __proto__ 경로 프로토타입 오염 미발생 — JSON.parse 결과를 안전하게 소비함
      //     (리터럴 __proto__ 키는 JSON.stringify 단계에서 자체 프로퍼티로 직렬화되며,
      //      JSON.parse 도 __proto__ 를 자체 키로 복원하지 Object.prototype 에 쓰지 않음)
      expect(({} as { isAdmin?: unknown }).isAdmin).toBeUndefined();
      expect((Object.prototype as Record<string, unknown>).isAdmin).toBeUndefined();
    });

    it('payload 에 constructor.prototype 경로 오염 시도가 있어도 sub 정상 추출 + 프로토타입 미오염', () => {
      // 오염 전 베이스라인
      expect(({} as { evil?: unknown }).evil).toBeUndefined();

      const maliciousPayload = {
        constructor: { prototype: { evil: true } },
        sub: 'user-uuid-constructor',
      };
      const token = makeJwt(maliciousPayload);

      // (1) sub 정상 추출
      expect(extractJwtSub(`Bearer ${token}`)).toBe('user-uuid-constructor');

      // (2) constructor 경로 프로토타입 오염 미발생
      //     (extractJwtSub 은 payloadObj 의 어떤 프로퍼티도 호출/실행하지 않고
      //      sub 문자열만 읽으므로 constructor 접근도 부작용 없음)
      expect(({} as { evil?: unknown }).evil).toBeUndefined();
      expect((Object.prototype as Record<string, unknown>).evil).toBeUndefined();
    });
  });
});
