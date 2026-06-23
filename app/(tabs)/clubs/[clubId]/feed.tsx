/**
 * 모임 피드 라우트 — clubs/[clubId]/feed
 * SPEC-FEED-001 T-B2
 *
 * clubId param 을 읽어 ClubFeedScreen 에 필요한 prop 들을 주입한다:
 * - useSession → userId
 * - useClubDetail(clubId) → book_id (loading/null 가드)
 * - useLibraryItem({bookId, userId}) → current_page (서재 미등록 시 0)
 *
 * 모임 상세 로딩 중에는 로딩 인디케이터를, book_id 가 없으면 에러 메시지를 렌더한다.
 *
 * P1-C completion 패턴 준용: useEffect 미인증 가드
 */
import React, { useEffect } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ClubFeedScreen } from '../../../../src/features/feed/components/ClubFeedScreen';
import { useSession } from '../../../../src/auth/useSession';
import { useClubDetail } from '../../../../src/features/club/trackB/hooks';
import { useLibraryItem } from '../../../../src/features/library/useLibraryItem';
import { useTheme } from '../../../../src/theme/theme';

export default function ClubFeedRoute() {
  const { clubId } = useLocalSearchParams<{ clubId: string }>();
  const router = useRouter();
  const theme = useTheme();
  const session = useSession();
  const userId = session?.user?.id ?? '';

  const sessionLoading = session === null;
  const isAuthenticated = session?.isAuthenticated ?? false;

  const detail = useClubDetail(clubId);
  const club = detail.data;
  const bookId = club?.book_id ?? '';

  // bookId/userId 가 확정된 후에만 서재 항목 조회 (빈 값이면 훅이 비활성화)
  const libraryItem = useLibraryItem({ bookId, userId });
  const currentPage = libraryItem.data?.current_page ?? 0;

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
        testID="club-feed-loading"
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

  if (detail.isLoading) {
    return (
      <View
        style={[styles.center, { backgroundColor: theme.colors.bg.base }]}
      >
        <ActivityIndicator size="large" color={theme.colors.brand[500]} />
      </View>
    );
  }

  if (!club || !bookId) {
    return (
      <View
        style={[styles.center, { backgroundColor: theme.colors.bg.base }]}
      >
        <Text style={{ color: theme.colors.semantic.error }}>
          모임 정보를 불러올 수 없어요.
        </Text>
      </View>
    );
  }

  return (
    <ClubFeedScreen
      clubId={clubId}
      bookId={bookId}
      currentPage={currentPage}
      userId={userId}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
