/**
 * SPEC-CLUB-001 T-001: trackA 도메인 타입 컨트랙트 테스트
 *
 * 검증 대상:
 * - JoinResponseStatus 유니온이 pending|accepted|declined 만 허용
 * - JoinResponseAction 유니온이 accepted|declined 만 허용
 * - ActiveReader 가 user_books_public 뷰 Row 의 부분집합
 * - MESSAGE_MAX_LENGTH 상수가 500 (이중 방어, E4)
 * - createJoinRequest 입력 message 초과 시 거부 (validateMessageLength)
 */
import {
  JOIN_REQUEST_STATUSES,
  JOIN_RESPONSE_ACTIONS,
  MESSAGE_MAX_LENGTH,
  validateMessageLength,
  type JoinResponseStatus,
  type JoinResponseAction,
  type ActiveReader,
} from '../types';

describe('SPEC-CLUB-001 T-001: trackA 도메인 타입', () => {
  describe('JoinResponseStatus', () => {
    it('pending, accepted, declined 만 값으로 갖는다', () => {
      const statuses: readonly JoinResponseStatus[] = JOIN_REQUEST_STATUSES;
      expect(statuses).toEqual(['pending', 'accepted', 'declined']);
    });
  });

  describe('JoinResponseAction', () => {
    it('accepted, declined 만 값으로 갖는다', () => {
      const actions: readonly JoinResponseAction[] = JOIN_RESPONSE_ACTIONS;
      expect(actions).toEqual(['accepted', 'declined']);
    });
  });

  describe('MESSAGE_MAX_LENGTH (E4 이중 방어)', () => {
    it('500 자로 정의된다', () => {
      expect(MESSAGE_MAX_LENGTH).toBe(500);
    });
  });

  describe('validateMessageLength', () => {
    it('null 은 유효하다 (message 선택 필드)', () => {
      expect(validateMessageLength(null)).toBeNull();
    });

    it('빈 문자열은 유효하다', () => {
      expect(validateMessageLength('')).toBeNull();
    });

    it('500 자 이하는 유효하다', () => {
      expect(validateMessageLength('a'.repeat(500))).toBeNull();
    });

    it('501 자 이상은 에러 메시지를 반환한다', () => {
      const err = validateMessageLength('a'.repeat(501));
      expect(err).not.toBeNull();
      expect(typeof err).toBe('string');
    });
  });

  describe('ActiveReader (user_books_public 뷰 소비)', () => {
    it('user_books_public Row 의 부분집합 필드를 갖는다', () => {
      const reader: ActiveReader = {
        user_id: 'user-uuid-1',
        book_id: 'book-uuid-1',
        current_page: 42,
        started_reading_at: '2026-06-01T00:00:00Z',
        club_id: 'club-uuid-1',
      };
      expect(reader.user_id).toBe('user-uuid-1');
      // club_id 는 그룹 미가입 독자의 경우 null
      const noGroup: ActiveReader = {
        user_id: 'user-uuid-2',
        book_id: 'book-uuid-1',
        current_page: 10,
        started_reading_at: null,
        club_id: null,
      };
      expect(noGroup.club_id).toBeNull();
    });
  });
});
