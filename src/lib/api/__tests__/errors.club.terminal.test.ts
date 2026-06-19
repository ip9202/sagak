/**
 * SPEC-CLUB-001 숨은 의존성: terminal 예외 한국어 메시지 매핑 (REQ-CLUBA-008)
 *
 * guard_join_request_status_trigger 가 RAISE EXCEPTION 한 예외는 PostgREST 를 통해
 * HTTP 400 으로 전달되며 classifyError 는 이를 VALIDATION 으로 분류한다.
 * getUserFriendlyMessage 는 이 경우 기본 "입력값을 확인해 주세요" 대신
 * "이미 처리된 요청입니다" 를 반환해야 한다 (사용자가 승인 버튼 반복 클릭 혼란 방지).
 *
 * 트리거 예외의 식별 근거: PostgREST 는 DB 예외를 { code, message } 로 전달하며,
 * guard_join_request_status_trigger 의 메시지 키워드("이미 처리된" / "terminal") 로 매핑한다.
 */
import { getUserFriendlyMessage, normalizeError } from '../errors';
import { AppError } from '../../../errors';

describe('SPEC-CLUB-001: terminal 예외 한국어 메시지 매핑', () => {
  it('VALIDATION + 트리거 terminal 키워드 포함 시 "이미 처리된 요청입니다"', () => {
    const raw = {
      code: 'P0001',
      message: '이미 처리된 요청입니다 (terminal status)',
      status: 400,
    };
    const err = normalizeError(raw);
    expect(getUserFriendlyMessage(err)).toBe('이미 처리된 요청입니다');
  });

  it('VALIDATION + "terminal" 영문 키워드 포함 시 동일 메시지', () => {
    const raw = {
      code: 'P0001',
      message: 'cannot reset terminal status',
      status: 400,
    };
    const err = normalizeError(raw);
    expect(getUserFriendlyMessage(err)).toBe('이미 처리된 요청입니다');
  });

  it('UNIQUE 위반(23505) 은 기존 "이미 등록된 항목입니다" 유지 (회귀 방지)', () => {
    const err = normalizeError({
      code: '23505',
      message: 'duplicate key',
    });
    expect(getUserFriendlyMessage(err)).toBe('이미 등록된 항목입니다');
  });

  it('일반 VALIDATION(키워드 없음) 은 기본 메시지 유지', () => {
    const err = new AppError('some validation', 'VALIDATION_ERROR', 400);
    err.category = 'VALIDATION';
    expect(getUserFriendlyMessage(err)).toBe('입력값을 확인해 주세요');
  });
});
