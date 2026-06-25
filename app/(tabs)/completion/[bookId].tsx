/**
 * 완독 다이어리 라우트 — completion/[bookId]
 * SPEC-COMPLETION-001 P1-C conformance — CompletionDiaryScreen 을 라우트에 연결.
 *
 * 데이터 흐름:
 * - useSession: 세션 로딩/미인증 가드
 * - useLocalSearchParams: bookId (books.id)
 * - useLibraryItem: bookId/userId 로 user_books.id (userBookId) 조회
 * - CompletionDiaryScreen: userBookId 를 받아 useCompletionReport 호출
 *
 * bookId → userBookId 매핑이 핵심: CompletionDiaryScreen props 는 userBookId 이고,
 * 라우트 param 은 bookId 이다. useLibraryItem.data.id 로 변환한다.
 * 빈 userBookId(로딩 중/미등록) 시 useCompletionReport 는 조회하지 않는다(빈값 가드).
 *
 * @MX:SPEC SPEC-COMPLETION-001
 */
import React, { useEffect } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSession } from '../../../src/auth/useSession';
import { useLibraryItem } from '../../../src/features/library/useLibraryItem';
import { useTheme } from '../../../src/theme/theme';
import { CompletionDiaryScreen } from '../../../src/features/completion/CompletionDiaryScreen';
import { StatusBar } from '../../../src/components/StatusBar';

export default function CompletionBookRoute(): React.ReactElement | null {
  const { bookId } = useLocalSearchParams<{ bookId: string }>();
  const session = useSession();
  const router = useRouter();
  const theme = useTheme();

  const sessionLoading = session === null;
  const userId = session?.user?.id ?? '';
  const isAuthenticated = session?.isAuthenticated ?? false;

  const libraryQuery = useLibraryItem({ bookId, userId });
  // @MX:NOTE: [AUTO] bookId → userBookId 매핑. useLibraryItem.data.id = user_books.id.
  //           로딩 중이거나 서재 미등록이면 빈 문자열 → useCompletionReport 는 조회 안 함(빈값 가드).
  const userBookId = libraryQuery.data?.id ?? '';

  // 미인증 — 로그인으로 replace. emotion/[bookId].tsx 의 useEffect 패턴 준수 —
  // 렌더 본문에서 직접 router.replace 호출(렌더 중 사이드 이펙트)을 피한다.
  useEffect(() => {
    if (!sessionLoading && !isAuthenticated) {
      router.replace('/(auth)/login');
    }
  }, [sessionLoading, isAuthenticated, router]);

  // 세션 로딩 — ActivityIndicator
  if (sessionLoading) {
    return (
      <View
        testID="completion-route-loading"
        style={[styles.center, { backgroundColor: theme.colors.bg.base }]}
      >
        {/* @MX:NOTE: [AUTO] SPEC-UI-002 REQ-SCREEN-001 — 로딩 상태도 상단 상태바 영역 일관 처리 */}
        <StatusBar />
        <ActivityIndicator size="large" color={theme.colors.brand[500]} />
      </View>
    );
  }

  // 미인증 — useEffect 에서 로그인으로 replace 중 (렌더 중 사이드 이펙트 방지).
  if (!isAuthenticated) {
    return null;
  }

  // @MX:NOTE: [AUTO] SPEC-UI-002 REQ-SCREEN-001 — 비탭 화면 상단 상태바/노치 영역 처리.
  //           (tabs)/_layout.tsx 와 동일한 3계층 레이아웃: StatusBar → ScrollView(content).
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg.base }}>
      <StatusBar />
      <ScrollView
        testID="completion-route-screen"
        style={[styles.container, { backgroundColor: theme.colors.bg.base }]}
      >
        <CompletionDiaryScreen userBookId={userBookId} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
