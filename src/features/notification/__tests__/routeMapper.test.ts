/**
 * SPEC-NOTIF-001 REQ-NOTIF-009: 알림 타입별 딥링크 라우팅 매퍼 단위 테스트
 *
 * acceptance N19-N22 검증:
 * - N19: reading_reminder 라우팅 (user_book_id)
 * - N20/N21: sticker_received/completion 은 화면 미구현 → 폴백 (null)
 * - N22: ref_id 없음 또는 미구현 → null (호출자가 알림 센터 폴백)
 */
import { routeForNotification, NOTIFICATION_CENTER_ROUTE } from '../routeMapper';

describe('SPEC-NOTIF-001 REQ-NOTIF-009: routeForNotification', () => {
  const REF = '11111111-1111-1111-1111-111111111111';

  it('reading_reminder → /library?userBookId= (N19)', () => {
    expect(routeForNotification('reading_reminder', REF)).toBe(
      `/library?userBookId=${REF}`,
    );
  });

  it('join_request_received → /host-requests?joinRequestId=', () => {
    expect(routeForNotification('join_request_received', REF)).toBe(
      `/host-requests?joinRequestId=${REF}`,
    );
  });

  it('join_accepted → /clubs/{clubId}', () => {
    expect(routeForNotification('join_accepted', REF)).toBe(`/clubs/${REF}`);
  });

  it('club_signal → /clubs/{clubId}/feed', () => {
    expect(routeForNotification('club_signal', REF)).toBe(
      `/clubs/${REF}/feed`,
    );
  });

  it('sticker_received → null (화면 미구현 폴백, N20/N22)', () => {
    expect(routeForNotification('sticker_received', REF)).toBeNull();
  });

  it('completion → null (화면 미구현 폴백, N21/N22)', () => {
    expect(routeForNotification('completion', REF)).toBeNull();
  });

  it('reading_reminder + ref_id 없음 → null (폴백, N22)', () => {
    expect(routeForNotification('reading_reminder', null)).toBeNull();
  });

  it('join_accepted + ref_id 없음 → null', () => {
    expect(routeForNotification('join_accepted', null)).toBeNull();
  });

  it('club_signal + ref_id 없음 → null', () => {
    expect(routeForNotification('club_signal', null)).toBeNull();
  });

  it('NOTIFICATION_CENTER_ROUTE 상수 정의 (폴백 경로)', () => {
    expect(NOTIFICATION_CENTER_ROUTE).toBe('/my/notifications');
  });
});
