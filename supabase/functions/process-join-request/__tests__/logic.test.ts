/**
 * SPEC-CLUB-001 T-008: process-join-request Edge Function 순수 로직 단위 테스트
 *
 * Deno entry(index.ts)는 tsconfig exclude 대상이므로 type-check/커버리지에서 제외된다.
 * 본 테스트는 Deno 글로벌에 의존하지 않는 순수 로직 모듈(logic.ts)을 검증한다:
 * - parseRequestBody: JSON 파싱 + 필수 필드 검증
 * - validateMessage: E4 500자 이중 방어 (Edge Function 측)
 * - errorResponse / successResponse: 표준 응답 빌더
 */
import {
  parseRequestBody,
  validateMessage,
  buildErrorResponse,
  buildSuccessResponse,
  MESSAGE_MAX_LENGTH,
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
});
