/**
 * SPEC-CLUB-001 Track A 도메인 타입 (T-001)
 *
 * gen-types(src/types/supabase.ts)의 Row/Insert 타입을 재사용하며,
 * Track A 클라이언트 소비용 도메인 타입과 상수를 정의한다.
 *
 * 재사용 근거:
 * - join_requests Row (L284), club_members Row (L59), clubs Row (L105),
 *   user_books_public Row (L626) 모두 gen-types에 존재 (검증 완료)
 * - 중복 정의 금지 — gen-types가 단일 출처
 */
import type { Database } from '../../../types/supabase';

/** join_requests.status 유니온 (DB CHECK + 트리거가 보장) */
export type JoinResponseStatus = 'pending' | 'accepted' | 'declined';

/** host 응답 액션 (accepted/declined 만 허용 — pending 응답 없음) */
export type JoinResponseAction = 'accepted' | 'declined';

/** 런타임 검증용 status 배열 */
export const JOIN_REQUEST_STATUSES: readonly JoinResponseStatus[] = [
  'pending',
  'accepted',
  'declined',
] as const;

/** 런타임 검증용 action 배열 */
export const JOIN_RESPONSE_ACTIONS: readonly JoinResponseAction[] = [
  'accepted',
  'declined',
] as const;

/**
 * E4 이중 방어: message 최대 길이.
 * 클라이언트(T-004)와 Edge Function(T-008) 양쪽에서 동일 기준으로 재검증한다.
 */
// @MX:ANCHOR: [AUTO] Track A message 길이 제약 — 클라이언트와 Edge Function 양쪽이 공유
// @MX:REASON: 이 값을 변경하면 클라이언트 선검증과 Edge Function 재검증이 어긋나 사용자가 "왜 전송됐다가 서버에서 막히나요" 혼란을 겪는다.
export const MESSAGE_MAX_LENGTH = 500;

/** gen-types 기반 테이블 Row 별칭 (단일 출처 재사용) */
export type JoinRequestRow = Database['public']['Tables']['join_requests']['Row'];
export type JoinRequestInsert =
  Database['public']['Tables']['join_requests']['Insert'];
export type ClubMemberRow = Database['public']['Tables']['club_members']['Row'];
export type ClubRow = Database['public']['Tables']['clubs']['Row'];

/** user_books_public 보안 뷰 Row (REQ-DB-013e) */
export type UserBooksPublicRow =
  Database['public']['Views']['user_books_public']['Row'];

/**
 * ActiveReader — user_books_public 행에 club_id 매핑(REQ-CLUBA-003)을 얹은 형태.
 * club_id 는 그룹 미가입 독자의 경우 null (Edge Function lazy 생성 대상).
 */
export interface ActiveReader {
  user_id: string;
  book_id: string;
  current_page: number | null;
  started_reading_at: string | null;
  /** REQ-CLUBA-003: 해당 독자가 속한 group 클럽 id. 없으면 null. */
  club_id: string | null;
}

/**
 * E4 message 길이 검증. null/빈값은 유효(선택 필드).
 * @returns 에러 메시지(초과 시) 또는 null(유효)
 */
export function validateMessageLength(message: string | null): string | null {
  if (message === null) return null;
  if (message.length <= MESSAGE_MAX_LENGTH) return null;
  return `메시지는 ${MESSAGE_MAX_LENGTH}자 이하여야 합니다`;
}
