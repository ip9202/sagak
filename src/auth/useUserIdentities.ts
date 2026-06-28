/**
 * 연결된 인증 identity(계정) 조회 React Query 훅
 * auth.identities(Supabase 진실 원천) 기반 연결계정 다중 표시 지원.
 *
 * 배경: users.provider 는 가입 시 단일 provider 만 저장하므로, 동일 이메일로
 * 네이버+카카오톡을 연결(linking)한 경우 실제 연결 상태를 반영하지 못한다.
 * 본 훅은 auth.getUserIdentities() 로 모든 연결 identity 를 조회해 UI 가
 * "네이버, 카카오" 처럼 다중 표시할 수 있도록 AuthProvider[] 로 정규화해 반환한다.
 *
 * @MX:SPEC SPEC-AUTH-001 (연결계정 표시)
 */
import { useQuery } from '@tanstack/react-query';
import { getSupabaseClient } from '../lib/supabase/client';
import { normalizeIdentityProvider, type AuthProvider } from './types';

export const USER_IDENTITIES_QUERY_KEY = ['auth', 'identities'] as const;

/**
 * auth.identities 를 조회해 정규화된 AuthProvider[] 로 변환한다.
 * queryFn — Supabase 외부 시스템 통합점.
 *
 * @MX:NOTE: [AUTO] getSupabaseClient().auth.getUserIdentities() 반환의 provider 값은
 *           커스텀 OIDC(naver)의 경우 'custom:naver' 이므로 normalizeIdentityProvider 로 정규화.
 * @MX:REASON: 미지원 provider(apple 등)는 null 로 필터링되어 UI 가 폴백(profile.provider) 되지 않도록 한다.
 */
export async function fetchUserIdentities(): Promise<AuthProvider[]> {
  const { data, error } = await getSupabaseClient().auth.getUserIdentities();
  if (error) {
    throw error;
  }
  return (data?.identities ?? [])
    .map((identity) => normalizeIdentityProvider(identity.provider))
    .filter((provider): provider is AuthProvider => provider !== null);
}

export function useUserIdentities(): ReturnType<
  typeof useQuery<AuthProvider[], Error>
> {
  return useQuery<AuthProvider[], Error>({
    queryKey: USER_IDENTITIES_QUERY_KEY,
    queryFn: fetchUserIdentities,
  });
}
