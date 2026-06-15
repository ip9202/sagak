/**
 * Login Screen
 * SPEC-AUTH-001 — REQ-AUTH-002~004
 *
 * M2-B 구현 상태:
 * - M2-B-1 AC-A2: 카카오 버튼 렌더링 — kakao 제공자로 signInWithProvider 호출 (완료)
 * - M2-B-2 AC-A3: 애플 버튼 렌더링 — apple 제공자로 signInWithProvider 호출 (완료)
 * - M2-B-3 AC-A4: OAuth 실패 처리 — 에러 메시지 표시 (완료)
 */
import React, { useState, useContext } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { AuthContext } from './AuthContext';
import type { AuthProvider } from './types';

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
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
  },
  button: {
    width: '100%',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  kakaoButton: {
    backgroundColor: '#FFD400',
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
    color: '#FF0000',
    marginBottom: 20,
  },
});
