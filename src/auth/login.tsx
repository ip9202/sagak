/**
 * Login Screen
 * SPEC-AUTH-001 — REQ-AUTH-002~004
 *
 * 구현 상태:
 * - AC-A1: 카카오 버튼 — kakao 제공자로 signInWithProvider 호출
 * - AC-A2: 구글 버튼 — google 제공자로 signInWithProvider 호출 (M4 추가)
 * - AC-A3: 애플 버튼 — apple 제공자로 signInWithProvider 호출
 * - AC-A4/A5: OAuth 실패 처리 — 에러 메시지 표시
 */
import React, { useState, useContext } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { AuthContext } from './AuthContext';
import type { AuthProvider } from './types';
import { colors, spacing, typography, radius } from '../theme/tokens';

/**
 * 로그인 화면 컴포넌트
 *
 * 카카오, 애플 OAuth 로그인 버튼을 제공하고,
 * OAuth 실패 시 에러 메시지를 표시한다.
 */
export function LoginScreen() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('LoginScreen must be used within AuthProvider');
  }

  const { signInWithProvider } = context;
  const [loading, setLoading] = useState<AuthProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * OAuth 로그인 핸들러
   *
   * @param provider - OAuth 제공자 (kakao, apple, google)
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
        apple: 'Apple',
        google: 'Google',
      };
      setError(`${providerNames[provider]} 로그인에 실패했습니다`);
      // 프로덕션 환경에서는 에러 타입/메시지만 로깅
      if (__DEV__) {
        console.error(`OAuth ${providerNames[provider]} 로그인 실패:`, err);
      } else {
        console.error(`OAuth ${providerNames[provider]} 로그인 실패:`, err instanceof Error ? err.message : 'Unknown error');
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
        style={[styles.button, styles.appleButton]}
        onPress={() => handleSignIn('apple')}
        disabled={loading !== null}
      >
        <Text style={styles.buttonText}>
          {loading === 'apple' ? 'Apple 로그인 중...' : 'Apple로 시작하기'}
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
  kakaoButton: {
    backgroundColor: '#FFD400',
  },
  // AC-A2: Google 버튼 — tokens 기반 스타일 (M4 추가)
  googleButton: {
    backgroundColor: colors.bg.surface,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  googleButtonText: {
    ...typography.headingSm,
    color: colors.text.primary,
  },
  appleButton: {
    backgroundColor: '#000000',
  },
  buttonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '600',
  },
  error: {
    ...typography.bodySm,
    color: colors.semantic.error,
    marginBottom: spacing[5],
  },
});
