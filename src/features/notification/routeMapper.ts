/**
 * 알림 타입별 딥링크 라우팅 매퍼 (SPEC-NOTIF-001 REQ-NOTIF-009)
 *
 * 알림(알림 센터 항목 또는 푸시) 탭 시 type + ref_id 기반 화면 전환.
 * 라우팅 대상이 미구현되거나 ref_id 가 없으면 null 반환 → 호출자가 알림 센터로 폴백 (acceptance N22).
 *
 * @MX:ANCHOR: [AUTO] 6종 라우팅 테이블 — ENUM 추가 시 본 switch 도 동기화 필요
 * @MX:REASON: type↔라우트 불일치는 알림 탭 시 빈 화면/크래시를 유발한다.
 * @MX:SPEC SPEC-NOTIF-001
 */
import type { NotificationType } from './types';

/**
 * type + ref_id 로 딥링크 대상 경로를 반환한다.
 * - ref_id 필수인 type 은 ref_id 없을 시 null (폴백)
 * - 대상 화면 미구현 type(sticker_received/completion 상세)은 null (폴백)
 *
 * 라우팅 테이블 (REQ-NOTIF-009):
 * | type                  | 경로                          | ref_id 의미        |
 * |-----------------------|-------------------------------|--------------------|
 * | reading_reminder      | /library (user_book 강조 후속) | user_book_id       |
 * | join_request_received | /host-requests?joinRequestId= | join_request_id    |
 * | join_accepted         | /clubs/{clubId}               | club_id            |
 * | sticker_received      | (미구현 → 폴백)               | emotion_record_id  |
 * | completion            | (미구현 → 폴백)               | completion_report  |
 * | club_signal           | /clubs/{clubId}/feed          | club_id            |
 *
 * @MX:NOTE: [AUTO] reading_reminder ref_id(user_book_id) 기반 강조 라우트는 아직 미구현 —
 *   library.tsx 가 userBookId param 을 소비하지 않는다 (PR #34 리뷰 M1).
 *   MVP는 /library 진입만 보장하고, user_book 강조는 library param 지원 후 연결 (ROUTINE 핸드오프 bookId 딥링크 대기 항목과 동일).
 */
export function routeForNotification(
  type: NotificationType,
  refId: string | null,
): string | null {
  switch (type) {
    case 'reading_reminder':
      // 현재 읽는 책 서재로 진입. ref_id(user_book_id) 강조는 후속 (library param 미지원).
      return refId ? '/library' : null;

    case 'join_request_received':
      // 호스트 모임 관리 — ref_id(join_request_id)
      return refId
        ? `/host-requests?joinRequestId=${encodeURIComponent(refId)}`
        : '/host-requests';

    case 'join_accepted':
      // 모임 상세 — ref_id(club_id)
      return refId ? `/clubs/${encodeURIComponent(refId)}` : null;

    case 'club_signal':
      // 모임 피드 — ref_id(club_id)
      return refId ? `/clubs/${encodeURIComponent(refId)}/feed` : null;

    case 'sticker_received':
    case 'completion':
      // 감정 기록 상세 / 완독 다이어리 화면 미구현 → 폴백 (acceptance N22)
      return null;

    default:
      // exhaustive guard — 새 ENUM 값 추가 시 컴파일 에러로 유도
      return null;
  }
}

/** 알림 센터 폴백 경로 (라우팅 불가 시) */
export const NOTIFICATION_CENTER_ROUTE = '/my/notifications';
