/**
 * SPEC-NOTIF-001: send-notification Edge Function 순수 로직 단위 테스트
 *
 * Deno entry(index.ts)는 tsconfig exclude 대상이므로 type-check/커버리지에서 제외된다.
 * 본 테스트는 Deno 글로벌에 의존하지 않는 순수 로직 모듈(logic.ts)을 jest 로 검증한다:
 * - isValidNotificationType / isUuid: 검증 헬퍼
 * - parseRequestBody: JSON 파싱 + 필수 필드/ENUM 검증 (acceptance N26)
 * - buildErrorResponse / buildSuccessResponse: 표준 응답 빌더
 */
import {
  NOTIFICATION_TYPES,
  isValidNotificationType,
  isUuid,
  parseRequestBody,
  buildErrorResponse,
  buildSuccessResponse,
} from '../logic';

describe('SPEC-NOTIF-001: send-notification logic', () => {
  describe('NOTIFICATION_TYPES (ENUM 6종)', () => {
    it('6종으로 정의된다 (REQ-NOTIF-011)', () => {
      expect(NOTIFICATION_TYPES).toEqual([
        'reading_reminder',
        'join_request_received',
        'join_accepted',
        'sticker_received',
        'completion',
        'club_signal',
      ]);
    });
  });

  describe('isValidNotificationType', () => {
    it.each(NOTIFICATION_TYPES)('%s 은 유효', (t) => {
      expect(isValidNotificationType(t)).toBe(true);
    });
    it('ENUM 외 값은 무효 (acceptance N26)', () => {
      expect(isValidNotificationType('invalid_type')).toBe(false);
      expect(isValidNotificationType('club_invite')).toBe(false); // 구형 placeholder
      expect(isValidNotificationType(undefined)).toBe(false);
      expect(isValidNotificationType(123)).toBe(false);
    });
  });

  describe('isUuid', () => {
    it('유효 UUID 통과', () => {
      expect(isUuid('11111111-1111-1111-1111-111111111111')).toBe(true);
    });
    it('잘못된 형식 거부', () => {
      expect(isUuid('not-a-uuid')).toBe(false);
      expect(isUuid('')).toBe(false);
      expect(isUuid(null)).toBe(false);
    });
  });

  describe('parseRequestBody', () => {
    const VALID_BODY = {
      user_id: '11111111-1111-1111-1111-111111111111',
      type: 'sticker_received',
      ref_id: '22222222-2222-2222-2222-222222222222',
      data: { reactor_nickname: '책벌레' },
    };

    it('유효 본문 파싱 성공 (모든 필드)', () => {
      const r = parseRequestBody(JSON.stringify(VALID_BODY));
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.value.user_id).toBe(VALID_BODY.user_id);
        expect(r.value.type).toBe('sticker_received');
        expect(r.value.ref_id).toBe(VALID_BODY.ref_id);
        expect(r.value.data).toEqual({ reactor_nickname: '책벌레' });
      }
    });

    it('ref_id/data 생략 시 null 처리', () => {
      const r = parseRequestBody(
        JSON.stringify({ user_id: VALID_BODY.user_id, type: 'completion' }),
      );
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.value.ref_id).toBeNull();
        expect(r.value.data).toBeNull();
      }
    });

    it('잘못된 JSON → 400 invalid_json', () => {
      const r = parseRequestBody('{not json');
      expect(r).toEqual({ ok: false, status: 400, error: 'invalid_json' });
    });

    it('user_id 누락 → 400', () => {
      const r = parseRequestBody(JSON.stringify({ type: 'completion' }));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.status).toBe(400);
    });

    it('user_id 가 uuid 아님 → 400', () => {
      const r = parseRequestBody(
        JSON.stringify({ user_id: 'no', type: 'completion' }),
      );
      expect(r.ok).toBe(false);
    });

    it('잘못된 type → 400 + detail "Invalid notification type: X" (acceptance N26)', () => {
      const r = parseRequestBody(
        JSON.stringify({ user_id: VALID_BODY.user_id, type: 'invalid_type' }),
      );
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.status).toBe(400);
        expect(r.error).toBe('invalid_notification_type');
        expect(r.detail).toBe('Invalid notification type: invalid_type');
      }
    });

    it('잘못된 ref_id 형식 → 400 invalid_ref_id', () => {
      const r = parseRequestBody(
        JSON.stringify({
          user_id: VALID_BODY.user_id,
          type: 'completion',
          ref_id: 'not-uuid',
        }),
      );
      expect(r).toMatchObject({ ok: false, error: 'invalid_ref_id' });
    });

    it('data 가 배열 → 400 invalid_data (템플릿 변수는 키-값)', () => {
      const r = parseRequestBody(
        JSON.stringify({
          user_id: VALID_BODY.user_id,
          type: 'completion',
          data: ['a', 'b'],
        }),
      );
      expect(r).toMatchObject({ ok: false, error: 'invalid_data' });
    });
  });

  describe('buildErrorResponse / buildSuccessResponse', () => {
    it('에러 응답은 success:false 본문 + 상태코드', async () => {
      const res = buildErrorResponse(400, 'bad', 'detail-x');
      expect(res.status).toBe(400);
      expect(res.headers.get('Content-Type')).toBe('application/json');
      expect(JSON.parse(await res.text())).toEqual({
        success: false,
        error: 'bad',
        detail: 'detail-x',
      });
    });

    it('성공 응답은 success:true + notification_id + push_sent (REQ-NOTIF-012)', async () => {
      const res = buildSuccessResponse({
        success: true,
        notification_id: 'nid-1',
        push_sent: true,
      });
      expect(res.status).toBe(200);
      expect(JSON.parse(await res.text())).toEqual({
        success: true,
        notification_id: 'nid-1',
        push_sent: true,
      });
    });
  });
});
