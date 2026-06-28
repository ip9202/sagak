/**
 * useUserIdentities / fetchUserIdentities 테스트
 * auth.identities 기반 연결계정 다중 표시 — 정규화 + 에러 + 빈 상태 검증.
 */

jest.mock('../../lib/supabase/client', () => ({
  getSupabaseClient: jest.fn(),
}));

import { getSupabaseClient } from '../../lib/supabase/client';
import {
  fetchUserIdentities,
  USER_IDENTITIES_QUERY_KEY,
} from '../useUserIdentities';

const mockGetUserIdentities = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (getSupabaseClient as jest.Mock).mockReturnValue({
    auth: { getUserIdentities: mockGetUserIdentities },
  });
});

describe('fetchUserIdentities', () => {
  it('네이버(custom:naver) + 카카오(kakao) identity → [naver, kakao]', async () => {
    mockGetUserIdentities.mockResolvedValue({
      data: {
        identities: [{ provider: 'custom:naver' }, { provider: 'kakao' }],
      },
      error: null,
    });
    expect(await fetchUserIdentities()).toEqual(['naver', 'kakao']);
  });

  it('Supabase error → throw (UI 폴백 유도)', async () => {
    mockGetUserIdentities.mockResolvedValue({
      data: null,
      error: new Error('session expired'),
    });
    await expect(fetchUserIdentities()).rejects.toThrow('session expired');
  });

  it('identities 빈 배열 → [] (연결된 계정 없음)', async () => {
    mockGetUserIdentities.mockResolvedValue({
      data: { identities: [] },
      error: null,
    });
    expect(await fetchUserIdentities()).toEqual([]);
  });

  it('data null → [] (안전 폴백)', async () => {
    mockGetUserIdentities.mockResolvedValue({ data: null, error: null });
    expect(await fetchUserIdentities()).toEqual([]);
  });

  it('미지원 provider(apple) 필터링, kakao 만 반환', async () => {
    mockGetUserIdentities.mockResolvedValue({
      data: { identities: [{ provider: 'apple' }, { provider: 'kakao' }] },
      error: null,
    });
    expect(await fetchUserIdentities()).toEqual(['kakao']);
  });

  it('중복 provider 도 그대로 유지 (동일 provider 다중 identity 가능)', async () => {
    mockGetUserIdentities.mockResolvedValue({
      data: {
        identities: [{ provider: 'kakao' }, { provider: 'kakao' }],
      },
      error: null,
    });
    expect(await fetchUserIdentities()).toEqual(['kakao', 'kakao']);
  });
});

describe('USER_IDENTITIES_QUERY_KEY', () => {
  it('안정적 query key', () => {
    expect(USER_IDENTITIES_QUERY_KEY).toEqual(['auth', 'identities']);
  });
});
