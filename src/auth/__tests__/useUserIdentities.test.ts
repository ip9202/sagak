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
  userIdentitiesKey,
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

  it('동일 provider 중복 identity 제거 (Set, 첫 등장 순서 유지)', async () => {
    mockGetUserIdentities.mockResolvedValue({
      data: {
        identities: [{ provider: 'kakao' }, { provider: 'kakao' }, { provider: 'naver' }],
      },
      error: null,
    });
    expect(await fetchUserIdentities()).toEqual(['kakao', 'naver']);
  });
});

describe('userIdentitiesKey', () => {
  it('userId 별 쿼리 키 생성 (캐시 격리)', () => {
    expect(userIdentitiesKey('u-1')).toEqual(['auth', 'userIdentities', 'u-1']);
  });

  it('userId 없을 때도 키 생성 (enabled false 시 미사용)', () => {
    expect(userIdentitiesKey()).toEqual(['auth', 'userIdentities', undefined]);
  });
});
