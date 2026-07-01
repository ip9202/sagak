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
});
