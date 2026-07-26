/**
 * 감정 입력/타임라인 통합 라우트 — emotion/[bookId]
 * SPEC-EMOTION-001 P1-B conformance — T-009/T-010 컴포넌트를 한 화면에 통합.
 *
 * HOME CTA "오늘의 감정 기록하기" 가 이 라우트로 직접 진입한다.
 * clubs 는 빈 배열(미전달)로 public-only MVP — SPEC-EMOTION-001 line 202 기준
 * 모임 감정 표시는 SPEC-FEED-001 영역.
 *
 * 데이터 흐름:
 * - useSession: 세션 로딩/미인증 가드
 * - useLocalSearchParams: bookId
 * - useLibraryItem: current_page → currentPage
 * - getBookDetail: total_pages → totalPages
 * - useEmotionRecords: 타임라인 조회 (sort state 제어)
 * - useCreateEmotionRecord: EmotionInputScreen.onSubmit 연결
 *
 * @MX:SPEC SPEC-EMOTION-001
 */
import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSession } from '../../../src/auth/useSession';
import { useLibraryItem } from '../../../src/features/library/useLibraryItem';
import { useUpdateProgress } from '../../../src/features/library/useLibrary';
import { getBookDetail } from '../../../src/features/book/bookDetailApi';
import {
  useEmotionRecords,
  useCreateEmotionRecord,
} from '../../../src/features/emotion/useEmotionRecords';
import type { EmotionSortOption, Visibility } from '../../../src/features/emotion/types';
import { useTheme } from '../../../src/theme/theme';
import { EmotionInputScreen } from '../../../src/features/emotion/EmotionInputScreen';
import { TimelineScreen } from '../../../src/features/emotion/TimelineScreen';
import { StatusBar } from '../../../src/components/StatusBar';

export default function EmotionBookRoute() {
  const { bookId } = useLocalSearchParams<{ bookId: string }>();
  const session = useSession();
  const router = useRouter();
  const theme = useTheme();

  const [sort, setSort] = useState<EmotionSortOption>('time');
  const [totalPages, setTotalPages] = useState(0);

  const sessionLoading = session === null;
  const userId = session?.user?.id ?? '';
  const isAuthenticated = session?.isAuthenticated ?? false;

  const libraryQuery = useLibraryItem({ bookId, userId });
  // F1: libraryQuery 해결 전까지 EmotionInputScreen 마운트를 게이트
  // (defaultVisibility race 방지 — is_public 미확정 시 'public'으로 마운트되어
  //  비공개 책 감정 기록이 public으로 저장되는 프라이버시 회귀 차단)
  const libraryLoading = libraryQuery.isLoading;
  const currentPage = libraryQuery.data?.current_page ?? 0;
  // 서재 책 비공개(is_public=false) 시 감정 기록 기본값도 'private' (사용자 기대 연동)
  const defaultVisibility: Visibility =
    libraryQuery.data?.is_public === false ? 'private' : 'public';

  const recordsQuery = useEmotionRecords({
    bookId,
    userId,
    currentPage,
    sort,
  });

  const createMutation = useCreateEmotionRecord({ bookId, userId });
  // 감정 기록 저장 시 서재 진도(current_page)도 함께 업데이트 (사용자가 읽은 페이지 = 진도)
  const updateProgressMutation = useUpdateProgress({ userId });

  // totalPages 보조 조회 — BookDetailScreen 패턴 준수 (세션 가드 후 호출)
  useEffect(() => {
    if (sessionLoading || !isAuthenticated) return;
    let cancelled = false;
    (async () => {
      try {
        const book = await getBookDetail(bookId);
        if (!cancelled) setTotalPages(book.total_pages ?? 0);
      } catch {
        // totalPages 보조값 — 조회 실패 시 0 유지, 입력 화면은 정상 동작
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionLoading, isAuthenticated, bookId]);

  // 미인증 — 로그인으로 replace. BookDetailScreen onRequireAuth(useEffect) 패턴 준수 —
  // 렌더 본문에서 직접 router.replace 호출(렌더 중 사이드 이펙트, StrictMode 이중 호출 위험)을 피한다.
  useEffect(() => {
    if (!sessionLoading && !isAuthenticated) {
      router.replace('/(auth)/login');
    }
  }, [sessionLoading, isAuthenticated, router]);

  // 세션 로딩 — ActivityIndicator
  if (sessionLoading) {
    return (
      <View
        testID="emotion-route-loading"
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
    <View
      style={{ flex: 1, backgroundColor: theme.colors.bg.base }}
      testID="emotion-route-screen"
    >
      <StatusBar />
      <TimelineScreen
        bookId={bookId}
        userId={userId}
        currentPage={currentPage}
        data={recordsQuery.data ?? { safe: [], spoiler: [] }}
        isLoading={recordsQuery.isLoading}
        error={recordsQuery.error}
        sort={sort}
        onSortChange={setSort}
        listHeader={
          libraryLoading ? null : (
            <EmotionInputScreen
              bookId={bookId}
              userId={userId}
              currentPage={currentPage}
              totalPages={totalPages}
              defaultVisibility={defaultVisibility}
              onSubmit={async (input) => {
                await createMutation.mutateAsync(input);
                // F2: 진도 업데이트 — 실패해도 감정 기록 저장은 유지 (비차단).
                // createMutation 성공 후 updateProgress 실패 시 에러가 사용자에게
                // "저장 실패"로 오도되는 것을 방지 (중복 저장 회귀 차단).
                const libraryItem = libraryQuery.data;
                const pageNumber = input.pageNumber;
                if (libraryItem && pageNumber !== null && pageNumber > currentPage) {
                  try {
                    await updateProgressMutation.mutateAsync({
                      id: libraryItem.id,
                      currentPage: pageNumber,
                    });
                  } catch (progressErr) {
                    // 비차단 — 감정 기록은 이미 저장됨
                    console.warn('진도 업데이트 실패 (감정 기록은 저장됨):', progressErr);
                  }
                }
              }}
            />
          )
        }
      />
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
