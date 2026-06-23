/**
 * 모임 상세 동적 라우트 — clubs/[clubId]
 * SPEC-CLUB-002 M4 — ClubDetailScreen 통합
 * SPEC-FEED-001 T-B2 — "피드 보기" CTA 추가 (./feed 로 이동)
 *
 * clubId param 을 ClubDetailScreen 에 전달. host 진도 동기화, 상태 전환,
 * 탈퇴 액션은 ClubDetailScreen 내부 훅이 담당한다.
 *
 * P1-C completion 패턴 준용: useEffect 미인증 가드
 */
import React, { useEffect } from 'react';
import { Pressable, Text, View, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ClubDetailScreen } from '../../../src/features/club/trackB/components/ClubDetailScreen';
import { useSession } from '../../../src/auth/useSession';
import { useTheme } from '../../../src/theme/theme';

export default function ClubDetailRoute() {
  const { clubId } = useLocalSearchParams<{ clubId: string }>();
  const session = useSession();
  const userId = session?.user?.id ?? '';
  const router = useRouter();
  const theme = useTheme();

  const sessionLoading = session === null;
  const isAuthenticated = session?.isAuthenticated ?? false;

  // 미인증 — 로그인으로 replace (P1-C completion 패턴 준용)
  useEffect(() => {
    if (!sessionLoading && !isAuthenticated) {
      router.replace('/(auth)/login');
    }
  }, [sessionLoading, isAuthenticated, router]);

  // 세션 로딩 — ActivityIndicator
  if (sessionLoading) {
    return (
      <View
        testID="club-detail-loading"
        style={[styles.center, { backgroundColor: theme.colors.bg.base }]}
      >
        <ActivityIndicator size="large" color={theme.colors.brand[500]} />
      </View>
    );
  }

  // 미인증 — useEffect 에서 로그인으로 replace 중
  if (!isAuthenticated) {
    return null;
  }

  return (
    <View style={styles.wrap}>
      <ClubDetailScreen clubId={clubId} userId={userId} />
      <Pressable
        testID="club-detail-go-feed"
        onPress={() => router.push(`/(tabs)/clubs/${clubId}/feed`)}
        accessibilityRole="button"
        accessibilityLabel="피드 보기"
        style={[
          styles.feedCta,
          {
            backgroundColor: theme.colors.brand[50],
            borderRadius: theme.radius.md,
          },
        ]}
      >
        <Text style={[styles.feedCtaText, { color: theme.colors.text.brand }]}>
          피드 보기
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  wrap: { flex: 1 },
  feedCta: { paddingVertical: 12, alignItems: 'center' },
  feedCtaText: { fontSize: 14, fontWeight: '700' },
});
