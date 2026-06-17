/**
 * Authentication type definitions
 * REQ-AUTH-001: AuthProvider union type ('kakao' | 'naver' | 'google')
 * REQ-AUTH-030: AuthContextValue exposes session, user, profile, loading + 3 actions
 */
import type { Session, User } from '@supabase/supabase-js';

// @MX:ANCHOR: [AUTO] AuthProvider 유니온 — users.provider CHECK(SPEC-DB-001 REQ-DB-001)와 컴파일 타임 일치
// @MX:REASON: 잘못된 provider 문자열은 OAuth 호출 실패 및 DB CHECK 위반을 유발한다. 세 제공자 값은 DB 스키마와 단일 진실 원천을 공유해야 한다.
export type AuthProvider = 'kakao' | 'naver' | 'google';

/**
 * public.users 테이블 행 스키마
 * nickname/avatar_url은 nullable (온보딩 미완료 상태)
 * 향후 gen-types 결과물(Database)로 교체 예정
 */
export interface UserProfile {
  id: string;
  nickname: string | null;
  avatar_url: string | null;
  provider: AuthProvider;
  created_at: string;
  updated_at: string;
}

/**
 * REQ-AUTH-010: AuthContext가 노출하는 상태 + 액션 인터페이스
 * session/user는 nullable (미인증 상태)
 */
export interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signInWithProvider: (provider: AuthProvider) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}
