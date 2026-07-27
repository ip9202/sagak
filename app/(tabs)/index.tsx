/**
 * 홈 탭 (SPEC-NAV-001 — F03-Home)
 *
 * 3계층 레이아웃 (SPEC-UI-002 REQ-SCREEN-LAYOUT):
 *  1. 헤더 — "오늘의 독서" 타이틀 + 알림종 아이콘
 *  2. 본문 — AlarmCard(따뜻한 리마인더) + SectionLabel + 다중 reading BookCard 목록(빈 상태 분기)
 *
 * 데이터 흐름:
 *  - useSession: 미인증/로딩(null) 시 빈 userId → 쿼리 비활성화
 *  - useLibrary({status:'reading'}): 다중 reading 목록 전체 표시 (SPEC-LIBRARY-002 M2).
 *    정렬(last_progress_at DESC)은 libraryApi.getLibrary 가 서버 쿼리에서 담당하므로
 *    본 화면은 반환된 배열 순서를 그대로 렌더링한다.
 *  - useAlarmSettings: alarm_enabled && alarm_time 시 동적 카피("매일 HH:MM에 알려드릴게요")
 *
 * SPEC-UI-002 준수:
 *  - 헤더 타이틀 균일성 (theme.typography.displaySm — 22/700)
 *  - 카드 패턴 (cornerRadius 16 / padding 16-20)
 *  - 빈/로딩 상태 패턴 (REQ-SCREEN-STATE)
 *  - token-only 스타일링 (useTheme + tokens 변수만 사용, 하드코딩 금지)
 *
 * 비과시 원칙(SPEC-UI-002 FROZEN): 좋아요/팔로워/랭킹 표시 없음.
 *
 * SPEC-LIBRARY-002 M2 (다중 reading 지원, 사용자 합의 #2):
 *  - 기존 단일 전체폭 감정 기록 CTA 제거 — 각 BookCard 의 "기록하기" 버튼으로 일원화.
 *  - reading 목록은 0/1/N 권 모두 다중 표시. 각 항목의 "기록하기" 버튼은
 *    /emotion/[bookId] 로 bookId 를 개별 전달한다.
 *
 * @MX:NOTE: [AUTO] 홈 탭 화면 — session/library/alarmSettings 훅 결합. reading 다중 표시 + 로딩/빈 상태 분기.
 * @MX:ANCHOR: [AUTO] 다중 reading "기록하기" 버튼 → /emotion/[bookId] 진입 — fan_in 다수(각 읽는 책마다 1개).
 * @MX:REASON: 각 BookCard 의 감정 기록 진입이 단일 CTA 가 아닌 카드 단위로 분산되며, bookId 격리가 UI 계약이 된다.
 * @MX:SPEC SPEC-NAV-001
 * @MX:SPEC SPEC-LIBRARY-002
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
// @MX:NOTE: [AUTO] SPEC-UI-002 — 아이콘 라이브러리를 Feather(@expo/vector-icons)에서
//           lucide-react-native 로 이관 (.pen library: "lucide" 준거).
import { Bell } from 'lucide-react-native';
import { useTheme } from '../../src/theme/theme';
import { useSession } from '../../src/auth/useSession';
import { useLibrary } from '../../src/features/library/useLibrary';
import { useAlarmSettings } from '../../src/features/routine/useAlarmSettings';
import { BookCard } from '../../src/components/BookCard';
import { AlarmCard } from '../../src/components/AlarmCard';

// 알림 미설정 시 기본 따뜻한 카피 (브랜드 보이스: 다정하고 위압 없는 톤).
const DEFAULT_ALARM_SUBTITLE =
  '5분만 읽어도 충분해요. 작은 시작이 큰 여정이 될 거예요.';
const ALARM_CARD_TITLE = '오늘의 첫 페이지가 당신을 기다리고 있어요';

/**
 * 'HH:MM:SS'(PostgREST time) 를 'HH:MM' 로 변환.
 * @MX:NOTE: [AUTO] 알림 시간 표시용 변환 — 초(seconds) 절삭. alarm_time 이 null/비정형이면 null 반환.
 * 비정형 입력(시 0-23 / 분 0-59 범위 위반, 형식 불일치) 방어 — 폴백으로 null 반환.
 */
function formatAlarmTime(time: string | null): string | null {
  if (!time) return null;
  // 형식 검증: 'HH:MM' 또는 'HH:MM:SS' (1-2자리 시, 2자리 분).
  const match = /^(\d{1,2}):(\d{2})(?::\d{1,2})?$/.exec(time);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return `${match[1]}:${match[2]}`;
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
  // readingList 는 libraryApi.getLibrary 가 last_progress_at DESC 로 서버 정렬해 반환 — 본 화면은 배열 순서 그대로 다중 표시.
  const hasReadings = Boolean(readingList && readingList.length > 0);

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
        <View
          style={[
            styles.header,
            {
              paddingHorizontal: theme.spacing[5],
              paddingTop: theme.spacing[2],
              paddingBottom: 0,
            },
          ]}
        >
          <Text
            style={[
              theme.typography.displaySm,
              { color: theme.colors.text.primary },
            ]}
          >
            오늘의 독서
          </Text>
        </View>
        <View
          style={[
            styles.bodyCenter,
            {
              gap: theme.spacing[3],
              padding: theme.spacing[5],
            },
          ]}
        >
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
      <View
        style={[
          styles.header,
          {
            paddingHorizontal: theme.spacing[5],
            paddingTop: theme.spacing[2],
            paddingBottom: 0,
          },
        ]}
      >
        <Text
          style={[
            theme.typography.displaySm,
            { color: theme.colors.text.primary },
          ]}
        >
          오늘의 독서
        </Text>
        <View testID="home-bell-icon">
          {/* @MX:NOTE: [AUTO] 아이콘 크기 22는 F03-Home 디자인 고정값 — iconSizes 스케일(sm16/md20/lg24)에 22 없음. lucide-react-native 사용. */}
          <Bell size={22} color={theme.colors.text.primary} />
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

        {/* 지금 읽는 책 섹션 — SPEC-LIBRARY-002 M2: 0/1/N 권 다중 표시 */}
        <View style={[styles.section, { gap: theme.spacing[2] }]}>
          <Text
            style={[
              theme.typography.sectionLabel,
              { color: theme.colors.text.tertiary },
            ]}
          >
            지금 읽는 책
          </Text>

          {isLoading ? (
            // AC-LIB2-UI-008: 로딩 중 스켈레톤/스피너 — 빈 상태 UI 와 분기 분리.
            <View
              testID="home-reading-loading"
              style={[styles.bookSlot, { paddingVertical: theme.spacing[6] }]}
            >
              <ActivityIndicator color={theme.colors.brand[500]} />
            </View>
          ) : hasReadings && readingList ? (
            // 다중 reading BookCard 목록 — last_progress_at DESC(서버 정렬) 배열 순서대로 표시.
            // 각 카드의 "기록하기" 버튼은 /emotion/[bookId] 로 bookId 개별 전달 (사용자 합의 #2).
            <View style={[styles.readingList, { gap: theme.spacing[3] }]}>
              {readingList.map((item) => {
                if (!item.books) return null;
                const bookId = item.books.id;
                return (
                  <BookCard
                    key={item.id}
                    testID={`home-reading-card-${bookId}`}
                    title={item.books.title}
                    author={item.books.author}
                    currentPage={item.current_page ?? 0}
                    totalPages={item.books.total_pages ?? 0}
                    coverUri={item.books.cover_url ?? undefined}
                    rightAccessory={
                      <Pressable
                        testID={`home-reading-record-${bookId}`}
                        onPress={() =>
                          router.push({
                            pathname: '/emotion/[bookId]',
                            params: { bookId },
                          })
                        }
                        accessibilityRole="button"
                        accessibilityLabel={`'${item.books.title}' 감정 기록하기`}
                        style={[
                          styles.recordCta,
                          {
                            backgroundColor: theme.colors.brand[500],
                            borderRadius: theme.radius.md,
                            paddingVertical: theme.spacing[2],
                            paddingHorizontal: theme.spacing[4],
                          },
                        ]}
                      >
                        <Text
                          style={[
                            theme.typography.label,
                            { color: theme.colors.text.inverse },
                          ]}
                        >
                          기록하기
                        </Text>
                      </Pressable>
                    }
                  />
                );
              })}
            </View>
          ) : (
            <View
              style={[
                styles.emptyState,
                {
                  backgroundColor: theme.colors.bg.surface,
                  borderRadius: theme.radius.lg,
                  padding: theme.spacing[5],
                  gap: theme.spacing[2],
                },
              ]}
            >
              <Text
                style={[
                  theme.typography.headingMd,
                  { color: theme.colors.text.primary },
                ]}
              >
                읽고 있는 책이 없어요
              </Text>
              <Text
                style={[
                  theme.typography.bodyMd,
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
                    paddingVertical: theme.spacing[3],
                    paddingHorizontal: theme.spacing[6],
                    marginTop: theme.spacing[2],
                  },
                ]}
              >
                <Text
                  style={[
                    theme.typography.ctaLabel,
                    { color: theme.colors.text.inverse },
                  ]}
                >
                  책 검색하기
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  // SPEC-UI-002 FROZEN: 헤더 레이아웃 — 타이틀 균일성은 theme.typography.displaySm 로 인라인 적용.
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scrollView: { flex: 1 },
  content: {
    flexDirection: 'column',
  },
  section: {
    flexDirection: 'column',
  },
  // 다중 reading 카드 목록 컨테이너 — FlatList 대신 ScrollView + map 패턴 (메모리 #36 회피).
  readingList: {
    flexDirection: 'column',
  },
  // 각 BookCard 우측 "기록하기" 버튼 — rightAccessory 슬롯에 배치.
  recordCta: {
    alignSelf: 'center',
  },
  bookSlot: {
    alignItems: 'center',
  },
  emptyState: {},
  emptyCta: {
    alignSelf: 'flex-start',
  },
  bodyCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
