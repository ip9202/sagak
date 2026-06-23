/**
 * 홈 탭 (SPEC-NAV-001 — F03-Home)
 *
 * 3계층 레이아웃 (SPEC-UI-002 REQ-SCREEN-LAYOUT):
 *  1. 헤더 — "오늘의 독서" 타이틀 + 알림종 아이콘
 *  2. 본문 — AlarmCard(따뜻한 리마인더) + SectionLabel + CurrentBook(BookCard/빈상태) + CTA
 *
 * 데이터 흐름:
 *  - useSession: 미인증/로딩(null) 시 빈 userId → 쿼리 비활성화
 *  - useLibrary({status:'reading'}): 첫 항목을 CurrentBook 으로 표시
 *  - useAlarmSettings: alarm_enabled && alarm_time 시 동적 카피("매일 HH:MM에 알려드릴게요")
 *
 * SPEC-UI-002 준수:
 *  - 헤더 타이틀 균일성 (fontSize 22 / weight 700)
 *  - 카드 패턴 (cornerRadius 16 / padding 16-20)
 *  - 빈/로딩 상태 패턴 (REQ-SCREEN-STATE)
 *  - token-only 스타일링 (useTheme + tokens 변수만 사용, 하드코딩 금지)
 *
 * 비과시 원칙(SPEC-UI-002 FROZEN): 좋아요/팔로워/랭킹 표시 없음.
 *
 * @MX:NOTE: [AUTO] 홈 탭 화면 — session/library/alarmSettings 훅 결합. 읽는중 책 유무에 따라 CurrentBook/EmptyState 분기.
 * @MX:SPEC SPEC-NAV-001
 */
import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../src/theme/theme';
import { useSession } from '../../src/auth/useSession';
import { useLibrary } from '../../src/features/library/useLibrary';
import { useAlarmSettings } from '../../src/features/routine/useAlarmSettings';
import { BookCard } from '../../src/components/BookCard';
import { Button } from '../../src/components/Button';
import { AlarmCard } from '../../src/components/AlarmCard';

// 알림 미설정 시 기본 따뜻한 카피 (브랜드 보이스: 다정하고 위압 없는 톤).
const DEFAULT_ALARM_SUBTITLE =
  '5분만 읽어도 충분해요. 작은 시작이 큰 여정이 될 거예요.';
const ALARM_CARD_TITLE = '오늘의 첫 페이지가 당신을 기다리고 있어요';

/**
 * 'HH:MM:SS'(PostgREST time) 를 'HH:MM' 로 변환.
 * @MX:NOTE: [AUTO] 알림 시간 표시용 변환 — 초(seconds) 절삭. alarm_time 이 null/비정형이면 null 반환.
 */
function formatAlarmTime(time: string | null): string | null {
  if (!time) return null;
  const parts = time.split(':');
  if (parts.length < 2) return null;
  return `${parts[0]}:${parts[1]}`;
}

export default function HomeTab(): React.JSX.Element {
  const theme = useTheme();
  const router = useRouter();
  const session = useSession();

  const userId = session?.user?.id ?? '';
  const { data: readingList, isLoading } = useLibrary({
    userId,
    status: 'reading',
  });
  const { data: alarmSettings } = useAlarmSettings();

  // @MX:NOTE: [AUTO] 미인증/세션 로딩(useSession null) 시 빈 userId → 쿼리 비활성화. 인증 복구 후 자동 활성화.
  const currentBook = readingList?.[0];
  const hasCurrentBook = Boolean(currentBook);

  // 알림 설정 동적 카피 — alarm_enabled && alarm_time 일 때만 시간 표시.
  const alarmTime = alarmSettings?.alarm_enabled
    ? formatAlarmTime(alarmSettings.alarm_time ?? null)
    : null;
  const alarmSubtitle = alarmTime
    ? `매일 ${alarmTime}에 알려드릴게요`
    : DEFAULT_ALARM_SUBTITLE;

  // 세션 로딩(useSession null) — 헤더는 유지한 채 로딩 인디케이터.
  if (!session) {
    return (
      <View
        testID="home-loading"
        style={[styles.container, { backgroundColor: theme.colors.bg.base }]}
      >
        <View style={styles.header}>
          <Text
            style={[styles.title, { color: theme.colors.text.primary }]}
          >
            오늘의 독서
          </Text>
        </View>
        <View style={styles.bodyCenter}>
          <ActivityIndicator size="large" color={theme.colors.brand[500]} />
        </View>
      </View>
    );
  }

  return (
    <View
      testID="home-screen"
      style={[styles.container, { backgroundColor: theme.colors.bg.base }]}
    >
      {/* 헤더 (SPEC-UI-002 REQ-SCREEN-HEADER — 타이틀 균일성) */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text.primary }]}>
          오늘의 독서
        </Text>
        <View testID="home-bell-icon">
          <Feather name="bell" size={22} color={theme.colors.text.primary} />
        </View>
      </View>

      {/* 본문 */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          {
            gap: theme.spacing[6],
            paddingHorizontal: theme.spacing[5],
            paddingTop: theme.spacing[2],
            paddingBottom: theme.spacing[5],
          },
        ]}
      >
        {/* 따뜻한 리마인더 카드 */}
        <AlarmCard
          testID="home-alarm-card"
          title={ALARM_CARD_TITLE}
          subtitle={alarmSubtitle}
        />

        {/* 지금 읽는 책 섹션 */}
        <View style={styles.section}>
          <Text
            style={[
              styles.sectionLabel,
              { color: theme.colors.text.tertiary },
            ]}
          >
            지금 읽는 책
          </Text>

          {isLoading ? (
            <View style={styles.bookSlot}>
              <ActivityIndicator color={theme.colors.brand[500]} />
            </View>
          ) : hasCurrentBook && currentBook?.books ? (
            <BookCard
              testID="home-current-book"
              title={currentBook.books.title}
              author={currentBook.books.author}
              currentPage={currentBook.current_page ?? 0}
              totalPages={currentBook.books.total_pages ?? 0}
              coverUri={currentBook.books.cover_url ?? undefined}
            />
          ) : (
            <View
              style={[
                styles.emptyState,
                {
                  backgroundColor: theme.colors.bg.surface,
                  borderRadius: theme.radius.lg,
                  padding: theme.spacing[5],
                },
              ]}
            >
              <Text
                style={[
                  styles.emptyTitle,
                  { color: theme.colors.text.primary },
                ]}
              >
                읽고 있는 책이 없어요
              </Text>
              <Text
                style={[
                  styles.emptyHint,
                  { color: theme.colors.text.secondary },
                ]}
              >
                검색에서 먼저 책을 추가해 보세요.
              </Text>
              <Pressable
                testID="home-empty-search-cta"
                onPress={() => router.push('/search')}
                accessibilityRole="button"
                accessibilityLabel="책 검색하기"
                style={[
                  styles.emptyCta,
                  {
                    backgroundColor: theme.colors.brand[500],
                    borderRadius: theme.radius.md,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.emptyCtaText,
                    { color: theme.colors.text.inverse },
                  ]}
                >
                  책 검색하기
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* CTA — 읽는중 책이 있으면 책 상세, 없으면 검색으로 이동 */}
        {/* @MX:NOTE: [AUTO] Button 컴포넌트가 testID prop 을 지원하지 않아(하드코딩 "button") 텍스트로 식별. */}
        <Button
          variant="primary"
          accessibilityLabel="오늘의 감정 기록하기"
          onPress={() => {
            if (hasCurrentBook && currentBook?.books) {
              // @MX:TODO: P1-B — 직접 감정 입력 라우트 연결 예정
              router.push({
                pathname: '/[bookId]',
                params: { bookId: currentBook.books.id },
              });
            } else {
              // 읽는중 책이 없으면 먼저 책을 추가하도록 검색으로 안내.
              router.push('/search');
            }
          }}
        >
          오늘의 감정 기록하기
        </Button>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  // SPEC-UI-002 FROZEN: title uniformity (fontSize 22 / weight 700) + 헤더 레이아웃
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 0,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  scrollView: { flex: 1 },
  content: {
    flexDirection: 'column',
  },
  section: {
    flexDirection: 'column',
    gap: 8,
  },
  // SPEC-UI-002 섹션 라벨 (my.tsx 패턴 — fontSize 13 / weight 600 / text.tertiary)
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  bookSlot: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyState: {
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  emptyHint: {
    fontSize: 14,
  },
  emptyCta: {
    alignSelf: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 8,
  },
  emptyCtaText: {
    fontSize: 14,
    fontWeight: '600',
  },
  bodyCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    padding: 20,
  },
});
