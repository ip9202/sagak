/**
 * SPEC-CLUB-001 T-005: processJoinRequest Edge Function 호출 래퍼 단위 테스트
 *
 * 검증 대상:
 * - processJoinRequestViaEdgeFunction: invokeEdgeFunction('process-join-request') 위임
 * - lazy 그룹 생성 위임: club_id=null 대상도 그대로 호출 (Edge Function이 service_role로 처리)
 * - E4 message 500자 초과 선검증 (client 측 이중 방어)
 * - invokeEdgeFunction 에러 정규화 경로 유지
 */
import { processJoinRequestViaEdgeFunction } from '../processJoinRequest';
import { invokeEdgeFunction } from '../../../../lib/api/edgeFunctions';

jest.mock('../../../../lib/api/edgeFunctions', () => ({
  invokeEdgeFunction: jest.fn(),
}));

describe('SPEC-CLUB-001 T-005: processJoinRequestViaEdgeFunction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('process-join-request Edge Function 을 대상 독자 userId + bookId 로 호출한다 (REQ-CLUBA-006)', async () => {
    (invokeEdgeFunction as jest.Mock).mockResolvedValue({
      ok: true,
      club_id: 'c-lazy-1',
      request_id: 'jr-1',
    });

    const result = await processJoinRequestViaEdgeFunction({
      targetUserId: 'target-u1',
      bookId: 'b1',
      requesterId: 'req-u1',
      message: '같이 읽어요',
    });

    expect(invokeEdgeFunction).toHaveBeenCalledWith('process-join-request', {
      target_user_id: 'target-u1',
      book_id: 'b1',
      requester_id: 'req-u1',
      message: '같이 읽어요',
    });
    expect(result.club_id).toBe('c-lazy-1');
    expect(result.request_id).toBe('jr-1');
  });

  it('message 가 null 이면 body 에 null 로 전달한다 (선택 필드)', async () => {
    (invokeEdgeFunction as jest.Mock).mockResolvedValue({ ok: true, club_id: 'c1', request_id: 'jr-2' });

    await processJoinRequestViaEdgeFunction({
      targetUserId: 'u1',
      bookId: 'b1',
      requesterId: 'req-u1',
      message: null,
    });

    expect(invokeEdgeFunction).toHaveBeenCalledWith('process-join-request', {
      target_user_id: 'u1',
      book_id: 'b1',
      requester_id: 'req-u1',
      message: null,
    });
  });

  it('E4 message 500자 초과 시 Edge Function 호출 전 VALIDATION 에러 throw', async () => {
    await expect(
      processJoinRequestViaEdgeFunction({
        targetUserId: 'u1',
        bookId: 'b1',
        requesterId: 'req-u1',
        message: 'x'.repeat(501),
      }),
    ).rejects.toMatchObject({ name: 'AppError', category: 'VALIDATION' });

    expect(invokeEdgeFunction).not.toHaveBeenCalled();
  });

  it('Edge Function 에러는 normalizeError 를 거쳐 AppError 로 전파된다', async () => {
    const normalizedErr = new (require('../../../../errors').AppError)(
      'server down',
      'SERVER_ERROR',
      500,
    );
    normalizedErr.category = 'SERVER';
    (invokeEdgeFunction as jest.Mock).mockRejectedValue(normalizedErr);

    await expect(
      processJoinRequestViaEdgeFunction({
        targetUserId: 'u1',
        bookId: 'b1',
        requesterId: 'req-u1',
        message: null,
      }),
    ).rejects.toMatchObject({ name: 'AppError', category: 'SERVER' });
  });
});
