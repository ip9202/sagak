/**
 * Authentication Context Provider
 * SPEC-AUTH-001 — REQ-AUTH-010: AuthContext 전역 상태 제공
 *
 * M1-1 범위 (AC-S1):
 * - AuthProvider 컴포넌트가 자식 트리를 감싼다
 * - session/user/profile/loading 상태를 노출한다
 * - signInWithProvider/signOut/refreshProfile 액션 스텁을 노출한다
 *
 * 실제 Supabase 통합(signInWithOAuth/onAuthStateChange/getSession)은
 * M1-2 ~ M1-5 TDD 사이클에서 순차적으로 구현된다.
 */
import React, { createContext, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import type { AuthContextValue, UserProfile } from './types';

// @MX:ANCHOR: [AUTO] AuthContext 단일 진실 원천 — app 전역 세션/프로필/인증 액션 노출
// @MX:REASON: fan_in >= 3 (useSession, login.tsx, onboarding.tsx, 향후 모든 보호 라우트). 세션 동기화 로직이 여기에 집중되어 있으며 분산 시 SIGNED_IN/SIGNED_OUT 이벤트 불일치가 발생한다.
export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // @MX:TODO: [AUTO] M1-2 — signInWithOAuth 호출 + redirectTo(getOAuthRedirectUri) 전달
  const signInWithProvider = async (): Promise<void> => {
    // M1-2 GREEN 단계에서 구현
  };

  // @MX:TODO: [AUTO] M1-3 — supabase.auth.signOut() 호출
  const signOut = async (): Promise<void> => {
    // M1-3 GREEN 단계에서 구현
  };

  // @MX:TODO: [AUTO] M1-5 — public.users 프로필 재조회
  const refreshProfile = async (): Promise<void> => {
    // M1-5 GREEN 단계에서 구현
  };

  const value: AuthContextValue = {
    session,
    user,
    profile,
    loading,
    signInWithProvider,
    signOut,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
