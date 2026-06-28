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

/**
 * 연결계정 쿼리 키 팩토리 — userId 별 캐시 격리.
 * enabled: Boolean(userId) 와 세트로 미인증 시 실행·캐시 모두 차단한다.
 */
export const userIdentitiesKey = (userId?: string) =>
  ['auth', 'userIdentities', userId] as const;

/**
 * auth.identities 를 조회해 정규화된 AuthProvider[] 로 변환한다.
 * queryFn — Supabase 외부 시스템 통합점.
 *
 * @MX:NOTE: [AUTO] getSupabaseClient().auth.getUserIdentities() 반환의 provider 값은
 *           커스텀 OIDC(naver)의 경우 'custom:naver' 이므로 normalizeIdentityProvider 로 정규화.
 *           동일 provider 다중 identity(예: kakao 2개)는 Set 으로 중복 제거 — UI "카카오, 카카오" 혼란 방지(순서 유지).
 * @MX:REASON: 미지원 provider(apple 등)는 null 로 필터링되어 UI 가 폴백(profile.provider) 되지 않도록 한다.
 */
export async function fetchUserIdentities(): Promise<AuthProvider[]> {
  const { data, error } = await getSupabaseClient().auth.getUserIdentities();
  if (error) {
    throw error;
  }
  const providers = (data?.identities ?? [])
    .map((identity) => normalizeIdentityProvider(identity.provider))
    .filter((provider): provider is AuthProvider => provider !== null);
  return Array.from(new Set(providers));
}

/**
 * 연결계정 다중 표시용 React Query 훅.
 *
 * @MX:NOTE: [AUTO] useUserStats 패턴 일관 — enabled: Boolean(userId) 로 미인증/loading 시
 *           쿼리를 비활성화한다. 본 훅은 React hooks 규칙(early return 전 호출)을 위해
 *           my.tsx 에서 인증 여부와 무관하게 항상 호출되므로, enabled 가 없으면 미인증
 *           사용자에게도 getUserIdentities() 가 실행되어 불필요한 호출·에러 재시도가 발생한다.
 *           userId 를 queryKey 에 포함해 사용자별 캐시 격리까지 함께 확보한다.
 */
export function useUserIdentities(userId?: string) {
  return useQuery<AuthProvider[], Error>({
    queryKey: userIdentitiesKey(userId),
    queryFn: fetchUserIdentities,
    enabled: Boolean(userId),
  });
}
