/**
 * SPEC-NOTIF-001 REQ-NOTIF-003: 푸시 토큰 서버 등록 단위 테스트
 *
 * acceptance N5 검증:
 * - 성공 시 users.push_token UPDATE (eq('id', userId) WHERE + RLS users_update_own_row 이중 보장)
 * - 에러 시 normalizeError throw (호출자가 catch 해 알림 센터 unaffected)
 * - eq('id', userId) WHERE 필수 (PostgREST 21000 회피 — RLS만으로는 UPDATE 구문 차단 불가)
 *
 * @MX:SPEC SPEC-NOTIF-001
 */

// jest.mock 팩토리는 out-of-scope 변수 참조 불가. mock prefix 가 있는 이름만 허용.
// 모든 모듈 레벨 mock 변수는 mock 접두어 사용.
const mockUpdateResult: { data: unknown; error: unknown } = { data: null, error: null };
const mockUpdateImpl = jest.fn();
const mockEqImpl = jest.fn();
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
  const USER_ID = 'user-uuid-1';

  beforeEach(() => {
    mockUpdateResult.data = null;
    mockUpdateResult.error = null;
    mockRejectNextTime.value = false;
    mockFrom.mockReset();
    mockUpdateImpl.mockReset();
    mockEqImpl.mockReset();

    // 체인: from('users') -> update(patch) -> eq(col, val) -> Promise<result>
    mockFrom.mockImplementation((table: string) => ({
      table,
      update: mockUpdateImpl,
    }));
    mockUpdateImpl.mockImplementation(() => ({ eq: mockEqImpl }));
    mockEqImpl.mockImplementation(() => {
      if (mockRejectNextTime.value) {
        return Promise.reject(new Error('network'));
      }
      return Promise.resolve(mockUpdateResult);
    });
  });

  it('성공 시 users.push_token 으로 UPDATE(eq 포함)하고 Promise<void> 해결', async () => {
    await expect(registerPushToken(TOKEN, USER_ID)).resolves.toBeUndefined();

    // from('users') 호출 검증
    expect(mockFrom).toHaveBeenCalledWith('users');
    // update 가 { push_token: TOKEN } 인자로 호출되었는지 검증 (REQ-NOTIF-003 계약)
    expect(mockUpdateImpl).toHaveBeenCalledWith({ push_token: TOKEN });
    // eq('id', userId) WHERE 호출 검증 (PostgREST 21000 회피)
    expect(mockEqImpl).toHaveBeenCalledWith('id', USER_ID);
  });

  it('UPDATE 호출에 eq("id", userId) WHERE 를 사용한다 (PostgREST 21000 회피)', async () => {
    // registerPushToken 구현이 .eq('id', userId) 를 포함해야 한다.
    // PostgREST 는 WHERE 없는 UPDATE 를 21000 으로 구문 차단하므로, RLS 와 무관하게 WHERE 필수.
    // RLS(users_update_own_row)는 이중 안전망 — auth.uid() !== id 면 0행 갱신.
    await registerPushToken(TOKEN, USER_ID);

    expect(mockUpdateImpl).toHaveBeenCalledTimes(1);
    expect(mockEqImpl).toHaveBeenCalledTimes(1);
    expect(mockEqImpl).toHaveBeenCalledWith('id', USER_ID);
  });

  it('result.error 발생 시 normalizeError 로 래핑된 AppError throw', async () => {
    mockUpdateResult.error = { message: 'RLS denied', code: '42501' };

    await expect(registerPushToken(TOKEN, USER_ID)).rejects.toBeInstanceOf(AppError);
  });

  it('체인 throw 시 normalizeError 로 래핑 후 throw', async () => {
    mockRejectNextTime.value = true;

    await expect(registerPushToken(TOKEN, USER_ID)).rejects.toBeInstanceOf(AppError);
  });
});
