/**
 * SPEC-CLUB-001 Track A Edge Function 호출 래퍼 (T-005)
 *
 * 그룹이 없는 독자에게 합류 요청 시 Edge Function `process-join-request` 를 호출한다.
 * Edge Function 은 service_role 키로 다음을 원자적 수행한다 (lazy 그룹 생성 — 결정 5.4):
 *   1. 대상 독자의 1인 group 클럽이 없으면 생성 (handle_new_club_host 트리거가 host 자동 가입)
 *   2. 생성/기존 club_id 로 join_requests INSERT (status=pending)
 *   3. (TODO SPEC-NOTIF-001) host 에게 알림 발송 훅
 *
 * 클라이언트는 이 트랜잭션을 관리하지 않고 단일 Edge Function 호출로 위임한다.
 * 멱등성 비재시도 정책(invokeEdgeFunction 기본값)을 준수한다.
 */
import { invokeEdgeFunction } from '../../../lib/api/edgeFunctions';
import { AppError } from '../../../errors';
import { validateMessageLength } from './types';

/** Edge Function 입력 (snake_case — Deno 측와 계약) */
export interface ProcessJoinRequestInput {
  /** 합류 대상 독자 (그룹이 없으면 lazy 생성 대상) */
  targetUserId: string;
  /** 책 컨텍스트 — lazy 그룹 생성 시 clubs.book_id 로 사용 */
  bookId: string;
  /**
   * 요청자 = auth.uid().
   * TODO(skeleton): Edge Function 구현 시 Authorization 헤더의 JWT sub 로
   * requester_id 를 검증·덮어써야 함. 현재 skeleton 이므로 client-supplied 값을
   * 그대로 신뢰하지 않도록 — service_role 이 RLS 를 우회하므로 인가 로직 필수 (PR #21 보안 리뷰 M-1).
   */
  requesterId: string;
  /** 선택 메시지 (E4: 500자 이중 방어) */
  message: string | null;
}

/** Edge Function 정상 응답 */
export interface ProcessJoinRequestResponse {
  ok: boolean;
  /** lazy 생성 또는 기존 club id */
  club_id: string;
  /** 생성된 join_requests.id */
  request_id: string;
}

/**
 * process-join-request Edge Function 을 호출해 lazy 그룹 생성 + 요청 INSERT 를 위임한다.
 *
 * - E4 이중 방어: message 500자 초과 시 호출 전 선검증
 * - 멱등성 비재시도: invokeEdgeFunction 기본 정책 준수
 * - 에러는 normalizeError 를 거쳐 AppError 로 전파 (RLS/AUTH/SERVER 등 자동 분류)
 *
 * @returns { club_id, request_id }
 */
export async function processJoinRequestViaEdgeFunction(
  input: ProcessJoinRequestInput,
): Promise<ProcessJoinRequestResponse> {
  // E4 선검증 (client 측 이중 방어 — Edge Function 이 동일 기준으로 재검증)
  const lengthError = validateMessageLength(input.message);
  if (lengthError) {
    const err = new AppError(lengthError, 'MESSAGE_TOO_LONG', 400);
    err.category = 'VALIDATION';
    throw err;
  }

  return invokeEdgeFunction<ProcessJoinRequestResponse>('process-join-request', {
    target_user_id: input.targetUserId,
    book_id: input.bookId,
    requester_id: input.requesterId,
    message: input.message,
  });
}
