/**
 * 모임 상세 동적 라우트 — clubs/[clubId]
 * SPEC-CLUB-002 M4 — ClubDetailScreen 통합
 * SPEC-FEED-001 T-B2 — "피드 보기" CTA 추가 (./feed 로 이동)
 *
 * clubId param 을 ClubDetailScreen 에 전달. host 진도 동기화, 상태 전환,
 * 탈퇴 액션은 ClubDetailScreen 내부 훅이 담당한다.
 */
import React from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
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
  wrap: { flex: 1 },
  feedCta: { paddingVertical: 12, alignItems: 'center' },
  feedCtaText: { fontSize: 14, fontWeight: '700' },
});
