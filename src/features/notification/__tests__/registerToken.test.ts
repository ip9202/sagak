/**
 * SPEC-NOTIF-001 REQ-NOTIF-003: 푸시 토큰 서버 등록 단위 테스트
 *
 * acceptance N5 검증:
 * - 성공 시 users.push_token UPDATE (RLS users_update_own_row 가 본인 행 제한)
 * - 에러 시 normalizeError throw (호출자가 catch 해 알림 센터 unaffected)
 * - 명시적 user_id 필터 금지 (RLS 단일 진실 — PR #34 리뷰 m4와 동일)
 *
 * @MX:SPEC SPEC-NOTIF-001
 */

// jest.mock 팩토리는 out-of-scope 변수 참조 불가. mock prefix 가 있는 이름만 허용.
// 모든 모듈 레벨 mock 변수는 mock 접두어 사용.
const mockUpdateResult: { data: unknown; error: unknown } = { data: null, error: null };
const mockUpdateImpl = jest.fn();
const mockFrom = jest.fn();
const mockRejectNextTime = { value: false };

jest.mock('../../../lib/supabase/client', () => ({
  getSupabaseClient: () => ({
    from: (...args: unknown[]) => mockFrom(...args),
  }),
}));

import { registerPushToken } from '../registerToken';
import { AppError } from '../../../errors';

describe('SPEC-NOTIF-001 REQ-NOTIF-003: registerPushToken', () => {
  const TOKEN = 'ExponentPushToken[abc123]';

  beforeEach(() => {
    mockUpdateResult.data = null;
    mockUpdateResult.error = null;
    mockRejectNextTime.value = false;
    mockFrom.mockReset();
    mockUpdateImpl.mockReset();

    // 기본 체인: from('users') -> { update: (patch) => Promise<result> }
    // registerPushToken 은 eq 를 호출하지 않으므로 update() 자체가 Promise 를 반환한다.
    mockFrom.mockImplementation((table: string) => ({
      table,
      update: mockUpdateImpl,
    }));
    mockUpdateImpl.mockImplementation((patch: unknown) => {
      if (mockRejectNextTime.value) {
        return Promise.reject(new Error('network'));
      }
      return Promise.resolve(mockUpdateResult);
    });
  });

  it('성공 시 users.push_token 으로 UPDATE 하고 Promise<void> 해결', async () => {
    await expect(registerPushToken(TOKEN)).resolves.toBeUndefined();

    // from('users') 호출 검증
    expect(mockFrom).toHaveBeenCalledWith('users');
    // update 가 { push_token: TOKEN } 인자로 호출되었는지 검증 (REQ-NOTIF-003 계약)
    expect(mockUpdateImpl).toHaveBeenCalledWith({ push_token: TOKEN });
  });

  it('UPDATE 호출에 user_id 필터(eq)를 사용하지 않는다 (RLS 단일 진실)', async () => {
    // registerPushToken 구현이 .eq('user_id', ...) 를 포함하지 않음을 단언.
    // RLS(users_update_own_row)가 본인 행 갱신을 보장하므로 user_id 필터는 중복이다.
    await registerPushToken(TOKEN);

    // update 는 호출되었지만 반환값이 then-able 체인(eq) 으로 이어지지 않는다.
    // updateImpl 이 받은 인자는 단일 patch 객체여야 한다 (eq 호출 없음).
    expect(mockUpdateImpl).toHaveBeenCalledTimes(1);
    const [call] = mockUpdateImpl.mock.calls;
    expect(call).toEqual([{ push_token: TOKEN }]);
  });

  it('result.error 발생 시 normalizeError 로 래핑된 AppError throw', async () => {
    mockUpdateResult.error = { message: 'RLS denied', code: '42501' };

    await expect(registerPushToken(TOKEN)).rejects.toBeInstanceOf(AppError);
  });

  it('체인 throw 시 normalizeError 로 래핑 후 throw', async () => {
    mockRejectNextTime.value = true;

    await expect(registerPushToken(TOKEN)).rejects.toBeInstanceOf(AppError);
  });
});
