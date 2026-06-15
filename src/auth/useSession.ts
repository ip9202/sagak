/**
 * Authentication session guard hook
 * SPEC-AUTH-001 — REQ-AUTH-030~033
 *
 * M2-A 구현 상태:
 * - M2-A-1 AC-G1: AuthContext 컨슘 및 값 반환 (완료)
 * - M2-A-2 AC-G2: 인증 상태 파생값 — isAuthenticated, isOnboarded (완료)
 * - M2-A-3 AC-G3: 로딩 상태 가드 — loading 시 null 반환 (완료)
 * - M2-A-4 AC-G4: 컨텍스트 미배치 방어 — 에러 발생 (완료)
 */
import { useContext } from 'react';
import { AuthContext } from './AuthContext';

export function useSession() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useSession must be used within AuthProvider');
  }

  const { session, user, profile, loading, signInWithProvider, signOut, refreshProfile } = context;

  // AC-G3: 로딩 상태 가드 — loading 시 null 반환
  // 세션 복원 중에는 파생값도 신뢰할 수 없으므로 전체를 null로 반환한다.
  if (loading) {
    return null;
  }

  // AC-G2: 인증 상태 파생값
  // - isAuthenticated: session과 user가 모두 존재해야 인증됨
  // - isOnboarded: profile이 존재하고 nickname이 null이 아니어야 온보딩 완료
  const isAuthenticated = session !== null && user !== null;
  const isOnboarded = profile !== null && Boolean(profile.nickname);

  return {
    session,
    user,
    profile,
    loading,
    isAuthenticated,
    isOnboarded,
    signInWithProvider,
    signOut,
    refreshProfile,
  };
}
