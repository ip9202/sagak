/**
 * 마이 탭
 * SPEC-NAV-001 — REQ-NAV-002 (T6) 골격에서 실제 화면으로 전환.
 *
 * 카카오 account-linking 회귀 테스트를 위한 최소 마이 페이지:
 * - 현재 로그인 사용자 정보 표시 (닉네임, 제공자, 이메일)
 * - 로그아웃 버튼 → useSession().signOut() 호출
 * - 로딩 / 미인증 / 프로필 누락 상태를 안전하게 처리 (crash 없음)
 *
 * SPEC-UI-002 준수:
 * - 3계층 레이아웃 (헤더 타이틀 fontSize 22 / weight 700)
 * - 카드 패턴 (cornerRadius 16 / padding 16-20)
 * - 빈/로딩 상태 패턴
 * - token-only 스타일링 (useTheme + tokens.ts 변수만 사용, 하드코딩 금지)
 *
 * 비과시 원칙(SPEC-UI-002 FROZEN): 좋아요/팔로워/랭킹 표시 없음.
 *
 * @MX:NOTE: [AUTO] 마이 탭 화면 — useSession 컨슘 + signOut 연결. account-linking 회귀용 최소 진입점.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useTheme } from '../../src/theme/theme';
import { useSession } from '../../src/auth/useSession';
import type { AuthProvider } from '../../src/auth/types';

// @MX:NOTE: [AUTO] 제공자 표시 라벨 매핑 — DB 값(naver/kakao/google) → 한국어 표시.
const PROVIDER_LABEL: Record<AuthProvider, string> = {
  naver: '네이버',
  kakao: '카카오',
  google: '구글',
};

export default function MyTab(): React.JSX.Element {
  const theme = useTheme();
  const session = useSession();
  const [isSigningOut, setIsSigningOut] = useState(false);

  // 로딩 상태 (useSession이 null 반환 = AuthContext.loading)
  if (!session) {
    return (
      <View
        testID="my-loading"
        style={[styles.container, { backgroundColor: theme.colors.bg.base }]}
      >
        <View style={styles.header}>
          <Text
            style={[styles.title, { color: theme.colors.text.primary }]}
          >
            마이
          </Text>
        </View>
        <View style={styles.bodyCenter}>
          <ActivityIndicator size="large" color={theme.colors.brand[500]} />
        </View>
      </View>
    );
  }

  const { user, profile, signOut } = session;

  // 미인증 상태 (세션/유저 없음) — 카카오 회귀 테스트 직전 로그아웃 후에도 crash 없어야 함.
  if (!user) {
    return (
      <View
        testID="my-signed-out"
        style={[styles.container, { backgroundColor: theme.colors.bg.base }]}
      >
        <View style={styles.header}>
          <Text
            style={[styles.title, { color: theme.colors.text.primary }]}
          >
            마이
          </Text>
        </View>
        <View style={styles.emptyState}>
          <Text
            style={[styles.emptyTitle, { color: theme.colors.text.primary }]}
          >
            로그인이 필요해요
          </Text>
          <Text
            style={[styles.emptyHint, { color: theme.colors.text.secondary }]}
          >
            로그인 후 다시 만나요.
          </Text>
        </View>
      </View>
    );
  }

  const handleSignOut = (): void => {
    Alert.alert('로그아웃', '로그아웃하시겠어요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '로그아웃',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setIsSigningOut(true);
            try {
              await signOut();
            } finally {
              setIsSigningOut(false);
            }
          })();
        },
      },
    ]);
  };

  const nickname = profile?.nickname ?? '독자';
  const providerLabel = profile
    ? PROVIDER_LABEL[profile.provider]
    : '알 수 없음';
  const email = user.email ?? null;

  return (
    <View
      testID="my-screen"
      style={[styles.container, { backgroundColor: theme.colors.bg.base }]}
    >
      {/* 헤더 (SPEC-UI-002 REQ-SCREEN-HEADER — 타이틀 균일성) */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text.primary }]}>
          마이
        </Text>
      </View>

      <View
        style={[
          styles.content,
          { paddingHorizontal: theme.spacing[5] },
        ]}
      >
        {/* 사용자 정보 카드 (SPEC-UI-002 REQ-SCREEN-CARD — cornerRadius 16 / padding 16-20) */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.bg.surface,
              borderRadius: theme.radius.lg,
              padding: theme.spacing[5],
              borderWidth: 1,
              borderColor: theme.colors.border.default,
            },
          ]}
        >
          <Text
            style={[
              styles.nickname,
              { color: theme.colors.text.primary },
            ]}
            numberOfLines={1}
          >
            {nickname}
          </Text>

          <View style={styles.metaRow}>
            <Text
              style={[styles.metaLabel, { color: theme.colors.text.tertiary }]}
            >
              연결 계정
            </Text>
            <Text
              style={[
                styles.metaValue,
                { color: theme.colors.text.secondary },
              ]}
            >
              {providerLabel}
            </Text>
          </View>

          {email ? (
            <View style={styles.metaRow}>
              <Text
                style={[
                  styles.metaLabel,
                  { color: theme.colors.text.tertiary },
                ]}
              >
                이메일
              </Text>
              <Text
                style={[
                  styles.metaValue,
                  { color: theme.colors.text.secondary },
                ]}
                numberOfLines={1}
              >
                {email}
              </Text>
            </View>
          ) : null}
        </View>

        {/* 로그아웃 버튼 */}
        <Pressable
          testID="my-logout-button"
          onPress={handleSignOut}
          disabled={isSigningOut}
          accessibilityRole="button"
          accessibilityLabel="로그아웃"
          accessibilityHint="현재 연결된 계정에서 로그아웃합니다."
          style={[
            styles.logoutButton,
            {
              backgroundColor: theme.colors.bg.surface,
              borderRadius: theme.radius.md,
              borderWidth: 1,
              borderColor: theme.colors.border.default,
              opacity: isSigningOut ? 0.5 : 1,
            },
          ]}
        >
          {isSigningOut ? (
            <ActivityIndicator
              size="small"
              color={theme.colors.semantic.error}
            />
          ) : (
            <Text
              style={[
                styles.logoutText,
                { color: theme.colors.semantic.error },
              ]}
            >
              로그아웃
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  // SPEC-UI-002 FROZEN: title uniformity (fontSize 22 / weight 700)
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    paddingTop: 12,
    gap: 16,
  },
  card: {
    gap: 12,
  },
  nickname: {
    fontSize: 20,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  metaLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  metaValue: {
    fontSize: 14,
    flexShrink: 1,
    textAlign: 'right',
  },
  logoutButton: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '600',
  },
  bodyCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    padding: 20,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  emptyHint: {
    fontSize: 14,
    textAlign: 'center',
  },
});
