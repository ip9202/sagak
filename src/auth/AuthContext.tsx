/**
 * Authentication Context Provider
 * SPEC-AUTH-001 — REQ-AUTH-010: AuthContext 전역 상태 제공
 *
 * 구현 상태 (M1 마일스톤):
 * - M1-1 AC-S1: AuthProvider 배치 + 상태/액션 노출 (완료)
 * - M1-2 AC-S1: signInWithProvider 구현 — signInWithOAuth + redirectTo (완료)
 * - M1-3 AC-S5/S6/S9: signOut 구현 — supabase.auth.signOut() (대기)
 * - M1-4 AC-S2/S3/S4: getSession + onAuthStateChange 구독 (대기)
 * - M1-5 AC-S7/S8: fetchProfile + refreshProfile (대기)
 */
import React, { createContext, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import type { AuthContextValue, AuthProvider, UserProfile } from './types';
import { getSupabaseClient } from '../lib/supabase/client';
import { getOAuthRedirectUri } from './oauth';

// @MX:ANCHOR: [AUTO] AuthContext 단일 진실 원천 — app 전역 세션/프로필/인증 액션 노출
// @MX:REASON: fan_in >= 3 (useSession, login.tsx, onboarding.tsx, 향후 모든 보호 라우트). 세션 동기화 로직이 여기에 집중되어 있으며 분산 시 SIGNED_IN/SIGNED_OUT 이벤트 불일치가 발생한다.
export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  /**
   * OAuth 로그인 액션
   * REQ-AUTH-010: signInWithProvider(provider) — OAuth 로그인 액션
   * REQ-AUTH-002: redirectTo에 getOAuthRedirectUri() 결과 전달 (딥링크 콜백)
   *
   * 세 제공자(kakao/apple/google)를 동일 경로로 처리한다.
   */
  const signInWithProvider = async (provider: AuthProvider): Promise<void> => {
    await getSupabaseClient().auth.signInWithOAuth({
      provider,
      options: { redirectTo: getOAuthRedirectUri() },
    });
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
