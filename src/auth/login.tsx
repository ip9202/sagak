/**
 * Login Screen
 * SPEC-AUTH-001 — REQ-AUTH-002~004
 *
 * 구현 상태:
 * - AC-A1: 카카오 버튼 — kakao 제공자로 signInWithProvider 호출
 * - AC-A2: 구글 버튼 — google 제공자로 signInWithProvider 호출 (M4 추가)
 * - AC-A3: 네이버 버튼 — naver 제공자로 signInWithProvider 호출
 * - AC-A4/A5: OAuth 실패 처리 — 에러 메시지 표시
 */
import React, { useState, useContext, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { AuthContext } from './AuthContext';
import type { AuthProvider } from './types';
import { colors, spacing, typography, radius, borderWidth } from '../theme/tokens';

/**
 * 로그인 화면 컴포넌트
 *
 * 카카오, 네이버 OAuth 로그인 버튼을 제공하고,
 * OAuth 실패 시 에러 메시지를 표시한다.
 */
export function LoginScreen() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('LoginScreen must be used within AuthProvider');
  }

  const { signInWithProvider, session, user, profile } = context;
  const router = useRouter();
  const [loading, setLoading] = useState<AuthProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  // RN OAuth 타이밍 보완 (SPEC-AUTH-001): callback 라우트가 SIGNED_IN 도착 전에
  // !isAuthenticated 로 login 으로 replace 해버린 경우, SIGNED_IN 이 이 컴포넌트에
  // 도달하면 인증된 사용자를 onboarding/tabs 로 보낸다.
  // React 19 호환 — replace 는 useEffect 내에서만 호출 (app/index.tsx 동일 패턴).
  useEffect(() => {
    if (session && user) {
      router.replace(profile?.nickname ? '/(tabs)/' : '/(auth)/onboarding');
    }
  }, [session, user, profile, router]);

  /**
   * OAuth 로그인 핸들러
   *
   * @param provider - OAuth 제공자 (kakao, naver, google)
   */
  const handleSignIn = async (provider: AuthProvider): Promise<void> => {
    try {
      setLoading(provider);
      setError(null);
      await signInWithProvider(provider);
    } catch (err) {
      // 제공자별 구체적 에러 메시지
      const providerNames: Record<AuthProvider, string> = {
        kakao: '카카오',
        naver: '네이버',
        google: 'Google',
      };
      setError(`${providerNames[provider]} 로그인에 실패했습니다`);
      // 프로덕션 환경에서는 에러 타입/메시지만 로깅
      if (__DEV__) {
        console.error(`OAuth ${providerNames[provider]} 로그인 실패:`, err);
      } else {
        // prod: err.message 대신 err.name만 로깅 (RLS 정책명 등 정보 노출 방지)
        console.error(`OAuth ${providerNames[provider]} 로그인 실패:`, err instanceof Error ? err.name : 'Unknown');
      }
    } finally {
      setLoading(null);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>로그인</Text>

      {error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity
        style={[styles.button, styles.kakaoButton]}
        onPress={() => handleSignIn('kakao')}
        disabled={loading !== null}
        accessibilityLabel="카카오로 시작하기"
        accessibilityRole="button"
      >
        <Text style={styles.buttonText}>
          {loading === 'kakao' ? '카카오 로그인 중...' : '카카오로 시작하기'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.googleButton]}
        onPress={() => handleSignIn('google')}
        disabled={loading !== null}
        accessibilityLabel="Google로 시작하기"
        accessibilityRole="button"
      >
        <Text style={styles.googleButtonText}>
          {loading === 'google' ? 'Google 로그인 중...' : 'Google로 시작하기'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.naverButton]}
        onPress={() => handleSignIn('naver')}
        disabled={loading !== null}
        accessibilityLabel="네이버로 시작하기"
        accessibilityRole="button"
      >
        <Text style={styles.naverButtonText}>
          {loading === 'naver' ? '네이버 로그인 중...' : '네이버로 시작하기'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[5],
  },
  title: {
    ...typography.displayMd,
    color: colors.text.primary,
    marginBottom: spacing[8],
  },
  button: {
    width: '100%',
    paddingVertical: spacing[4],
    borderRadius: radius.md,
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  // @MX:NOTE: [AUTO] SPEC-UI-002 PR-2 — 카카오 브랜드색 #FFD400 은 OAuth 공식 가이드라인 색상으로 토큰화 금지(브랜드 정책 예외).
  kakaoButton: {
    backgroundColor: '#FFD400',
  },
  // AC-A2: Google 버튼 — tokens 기반 스타일 (M4 추가)
  googleButton: {
    backgroundColor: colors.bg.surface,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border.default,
  },
  googleButtonText: {
    ...typography.headingSm,
    color: colors.text.primary,
  },
  // @MX:NOTE: [AUTO] SPEC-UI-002 PR-2 — 네이버 브랜드색 #03C75A / 흰색 텍스트 #FFFFFF 는 OAuth 공식 가이드라인 색상으로 토큰화 금지(브랜드 정책 예외).
  naverButton: {
    backgroundColor: '#03C75A',
  },
  // @MX:NOTE: [AUTO] SPEC-UI-002 book-auth-tokenization — headingSm(16/600/23) 토큰 적용.
  naverButtonText: {
    ...typography.headingSm,
    color: '#FFFFFF',
  },
  // @MX:NOTE: [AUTO] SPEC-UI-002 book-auth-tokenization — headingSm(16/600/23) 토큰 적용.
  buttonText: {
    ...typography.headingSm,
    color: '#000000',
  },
  error: {
    ...typography.bodySm,
    color: colors.semantic.error,
    marginBottom: spacing[5],
  },
});
