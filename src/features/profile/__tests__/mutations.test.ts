/**
 * updateProfile 단위 테스트 (SPEC-PROFILE-001 REQ-PROF-002/003)
 *
 * 검증 대상:
 * - P3: nickname 정상 수정 → users UPDATE (RLS 자기 행)
 * - P4: avatar_url 수정 → users UPDATE
 * - P7: nickname 빈 값 → VALIDATION 거부 (UPDATE 미전송)
 * - P8: nickname 21자 → VALIDATION 거부
 * - P6: email/provider/role 은 입력에 없음 (수정 불가)
 * - 에러 정규화
 */
import { updateProfile, validateProfileInput, NICKNAME_MAX_LENGTH } from '../mutations';
import { getSupabaseClient } from '../../../lib/supabase/client';

jest.mock('../../../lib/supabase/client', () => ({
  getSupabaseClient: jest.fn(),
}));
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
  WHEN_UNLOCKED: 'WHEN_UNLOCKED',
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
}));

describe('SPEC-PROFILE-001 REQ-PROF-003: validateProfileInput', () => {
  it('정상 nickname + avatar_url → 유효', () => {
    const result = validateProfileInput({ nickname: '책벌레', avatar_url: 'https://x/a.png' });
    expect(result.valid).toBe(true);
  });

  it('P7: 빈 nickname → VALIDATION 무효', () => {
    const result = validateProfileInput({ nickname: '', avatar_url: null });
    expect(result.valid).toBe(false);
  });

  it('P7: 공백만 nickname → 무효', () => {
    const result = validateProfileInput({ nickname: '   ', avatar_url: null });
    expect(result.valid).toBe(false);
  });

  it('P8: 21자 nickname → 무효', () => {
    const result = validateProfileInput({
      nickname: '가'.repeat(NICKNAME_MAX_LENGTH + 1),
      avatar_url: null,
    });
    expect(result.valid).toBe(false);
  });

  it('P8: 20자 nickname → 유효 (경계값)', () => {
    const result = validateProfileInput({
      nickname: '가'.repeat(NICKNAME_MAX_LENGTH),
      avatar_url: null,
    });
    expect(result.valid).toBe(true);
  });
});

describe('SPEC-PROFILE-001 REQ-PROF-002: updateProfile', () => {
  let fromMock: jest.Mock;
  beforeEach(() => {
    jest.clearAllMocks();
    fromMock = jest.fn();
    (getSupabaseClient as jest.Mock).mockReturnValue({ from: fromMock });
  });

  function updateBuilder(): Record<string, jest.Mock> {
    const b: Record<string, jest.Mock> = {};
    const ret = () => b;
    b.update = jest.fn(ret);
    b.eq = jest.fn().mockResolvedValue({ data: null, error: null });
    return b;
  }

  it('P3: nickname 정상 → users UPDATE where id=userId', async () => {
    const b = updateBuilder();
    fromMock.mockReturnValue(b);

    await updateProfile('u-1', { nickname: '책벌레', avatar_url: null });

    expect(b.update).toHaveBeenCalledWith({
      nickname: '책벌레',
      avatar_url: null,
    });
    expect(b.eq).toHaveBeenCalledWith('id', 'u-1');
  });

  it('P4: avatar_url 수정 → UPDATE 에 avatar_url 포함', async () => {
    const b = updateBuilder();
    fromMock.mockReturnValue(b);

    await updateProfile('u-1', {
      nickname: '독서가',
      avatar_url: 'https://x/new.png',
    });

    expect(b.update).toHaveBeenCalledWith({
      nickname: '독서가',
      avatar_url: 'https://x/new.png',
    });
  });

  it('P7: 빈 nickname → UPDATE 미전송 (VALIDATION throw)', async () => {
    const b = updateBuilder();
    fromMock.mockReturnValue(b);

    await expect(
      updateProfile('u-1', { nickname: '', avatar_url: null }),
    ).rejects.toMatchObject({ category: 'VALIDATION' });
    expect(b.update).not.toHaveBeenCalled();
  });

  it('P8: 21자 nickname → UPDATE 미전송', async () => {
    const b = updateBuilder();
    fromMock.mockReturnValue(b);

    await expect(
      updateProfile('u-1', {
        nickname: '가'.repeat(NICKNAME_MAX_LENGTH + 1),
        avatar_url: null,
      }),
    ).rejects.toMatchObject({ category: 'VALIDATION' });
    expect(b.update).not.toHaveBeenCalled();
  });

  it('Supabase 에러 → normalizeError throw (RLS)', async () => {
    const b: Record<string, jest.Mock> = {};
    const ret = () => b;
    b.update = jest.fn(ret);
    b.eq = jest.fn().mockResolvedValue({
      data: null,
      error: { code: '42501' },
    });
    fromMock.mockReturnValue(b);

    await expect(
      updateProfile('u-1', { nickname: '책벌레', avatar_url: null }),
    ).rejects.toMatchObject({ category: 'RLS_DENIED' });
  });
});
