/**
 * Authentication Context Provider
 * SPEC-AUTH-001 — REQ-AUTH-010: AuthContext 전역 상태 제공
 *
 * 구현 상태 (M1 마일스톤):
 * - M1-1 AC-S1: AuthProvider 배치 + 상태/액션 노출 (완료)
 * - M1-2 AC-S1: signInWithProvider 구현 — signInWithOAuth + redirectTo (완료)
 * - M1-3 AC-S6/S9: signOut 구현 — supabase.auth.signOut() + 상태 클리어 (완료)
 * - M1-4 AC-S2/S3/S4: getSession 자동 로그인 + onAuthStateChange 구독 + fetchProfile (완료)
 * - M1-5 AC-S7/S8: refreshProfile 외부 노출 — 온보딩 후 수동 프로필 재조회 (완료)
 */
import React, { createContext, useEffect, useState, useCallback, useRef } from 'react';
import type { Session, User, Provider } from '@supabase/supabase-js';
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

  // profileRef: onAuthStateChange 리스너(mount-once)가 항상 최신 profile을 읽도록 하는 ref.
  // WHY: useEffect([], ...)로 한 번만 등록된 리스너가 fetchProfile을 클로저로 캡처한다.
  //      fetchProfile이 [profile] 의존성을 가지면 매 렌더마다 새 함수가 생성되어도
  //      리스너는 최초의 stale 버전(캡처 시점 profile === null)을 계속 사용하게 된다.
  //      ref 패턴으로 fetchProfile을 안정화(deps [])하면 리스너가 캡처한 함수는
  //      단 하나지만, 매 호출마다 profileRef.current를 통해 렌더 최신 profile을 읽는다.
  //      결과: 캐시 의도(동일 userId 재조회 생략)가 보존되고 DB/RLS 중복 호출이 사라진다.
  const profileRef = useRef<UserProfile | null>(null);
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  /**
   * REQ-AUTH-013/AC-S4: public.users 프로필 조회
   * SIGNED_IN 이벤트 및 마운트 getSession 복원 시 호출된다.
   *
   * 실패 시에도 인증 흐름을 차단하지 않는다 — profile만 null로 유지하고
   * session/user는 유지한다. 사용자가 인증된 상태로 빈 프로필 UI를 볼 수 있도록 한다.
   *
   * @MX:NOTE: [CACHE] userId별 프로필 캐싱으로 중복 조회 방지 (force 옵션으로 캐시 우회 가능).
   *           캐시 판독은 profileRef.current를 사용하여 stale closure를 회피한다.
   */
  const fetchProfile = useCallback(async (userId: string, force = false): Promise<void> => {
    // 캐시된 프로필 확인 (force가 true면 캐시 무시)
    // ref에서 최신 profile을 읽는다 — 상세 이유는 profileRef 선언부 주석 참조.
    if (!force && profileRef.current?.id === userId) {
      return; // 이미 캐시된 프로필이 있으면 재사용
    }

    const { data, error } = await getSupabaseClient()
      .from('users')
      .select('id, nickname, avatar_url, provider, created_at, updated_at')
      .eq('id', userId)
      .single();

    if (error || !data) {
      setProfile(null);
      return;
    }
    setProfile(data as UserProfile);
  }, []);

  /**
   * REQ-AUTH-012: 자동 로그인 — 앱 시작 시 getSession()으로 저장된 세션 복원
   * REQ-AUTH-011: onAuthStateChange 구독 — 4개 이벤트 처리
   *
   * 두 진입점이 동일한 상태로 수렴한다:
   * - getSession이 세션을 반환하면 즉시 session/user/profile을 설정
   * - onAuthStateChange INITIAL_SESSION 이벤트가 동일한 세션을 다시 전달할 수 있으나 멱등
   */
  useEffect(() => {
    const supabase = getSupabaseClient();

    // AC-S3: 마운트 시 getSession() 호출 — 저장된 세션 복원
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setSession(data.session);
        setUser(data.session.user);
        // @MX:NOTE: [AUTO] fetchProfile은 user.id 필요 — getSession 복원 시에도 호출
        void fetchProfile(data.session.user.id);
      }
      // session이 없으면 INITIAL_SESSION 이벤트가 loading을 해제한다
    });

    // AC-S2: onAuthStateChange 구독 — 4개 이벤트 처리
    // @MX:ANCHOR: [AUTO] 인증 상태 동기화 — 앱 전역 세션/프로필 상태의 단일 갱신 지점
    // @MX:REASON: 이 리스너가 누락되면 SIGNED_IN/SIGNED_OUT/TOKEN_REFRESHED 이벤트가 AuthContext에 반영되지 않아 모든 보호 라우트의 인증 게이트가 고장난다. fan_in >= 3 (useSession, 보호 라우트, 프로필 화면).
    const { data: subscriptionData } = supabase.auth.onAuthStateChange((event, nextSession) => {
      switch (event) {
        case 'INITIAL_SESSION':
          // 앱 시작 시 저장된 세션 복원 완료 — loading 해제
          if (nextSession) {
            setSession(nextSession);
            setUser(nextSession.user);
            void fetchProfile(nextSession.user.id);
          }
          setLoading(false);
          break;
        case 'SIGNED_IN':
          // AC-S4: 세션 설정 + 프로필 조회 트리거
          if (nextSession) {
            setSession(nextSession);
            setUser(nextSession.user);
            void fetchProfile(nextSession.user.id);
          }
          break;
        case 'TOKEN_REFRESHED':
          // 갱신된 토큰으로 session/user 업데이트 (profile은 변경 없음)
          if (nextSession) {
            setSession(nextSession);
            setUser(nextSession.user);
          }
          break;
        case 'SIGNED_OUT':
          // 로컬 상태 전체 클리어 (signOut 액션과 동일 효과)
          setSession(null);
          setUser(null);
          setProfile(null);
          break;
        default:
          // 알 수 없는 이벤트 — 무시 (SPEC에 명시된 4개 외)
          break;
      }
    });

    // @MX:WARN: [AUTO] 구독 해제 누락 시 메모리 누수 및 stale closure 발생
    // @MX:REASON: AuthProvider가 언마운트되어도 리스너가 남으면 세션 이벤트가 해제된 컴포넌트의 setState를 호출하여 React 경고/누수를 유발한다.
    return () => {
      subscriptionData?.subscription?.unsubscribe();
    };
  }, []);

  /**
   * OAuth 로그인 액션
   * REQ-AUTH-010: signInWithProvider(provider) — OAuth 로그인 액션
   * REQ-AUTH-002: redirectTo에 getOAuthRedirectUri() 결과 전달 (딥링크 콜백)
   *
   * 세 제공자(kakao/naver/google)를 동일 경로로 처리한다.
   */
  const signInWithProvider = async (provider: AuthProvider): Promise<void> => {
    // naver는 Supabase 네이티브 Provider 타입에 없음 — DEPLOY에서 Custom OIDC provider 'naver'로
    // 등록하면 동일 signInWithOAuth 경로로 동작. 타입은 Supabase가 모르므로 Provider로 캐스팅.
    await getSupabaseClient().auth.signInWithOAuth({
      provider: provider as Provider,
      options: { redirectTo: getOAuthRedirectUri() },
    });
  };

  /**
   * 로그아웃 액션
   * REQ-AUTH-014: signOut() — 로컬 세션 폐기 (제공자 토큰 취소는 MVP 밖)
   *
   * 두 가지 경로가 상태를 null로 클리어한다:
   * 1. 이 액션이 능동적으로 호출 (아래 setSession/setUser/setProfile) —
   *    onAuthStateChange SIGNED_OUT 이벤트 도착 전에 UI가 즉시 갱신되도록 한다.
   * 2. onAuthStateChange 구독이 SIGNED_OUT 이벤트를 수신 (이중 클리어, 안전망).
   */
  const signOut = async (): Promise<void> => {
    await getSupabaseClient().auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
  };

  /**
   * 프로필 재조회 액션
   * REQ-AUTH-013: public.users 재조회 — 온보딩 프로필 업데이트 이후 수동 갱신용
   *
   * 현재 인증된 사용자가 있을 때만 fetchProfile()을 재호출한다.
   * force=true로 전달하여 캐시를 무시하고 항상 최신 프로필을 가져온다.
   * 미인증 상태에서는 no-op이며, 조회 에러 시에도 reject하지 않는다
   * (fetchProfile이 내부적으로 에러를 처리하여 profile을 null로 설정한다).
   */
  const refreshProfile = async (): Promise<void> => {
    if (!user) return;
    await fetchProfile(user.id, true); // force=true로 캐시 무시
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
