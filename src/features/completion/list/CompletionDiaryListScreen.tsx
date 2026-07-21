/**
 * CompletionDiaryListScreen (SPEC-COMPLETION-002, REQ-COMP2-001/003~007/014/015/016)
 *
 * 완독 다이어리 아카이브(리스트) 메인 화면. `.pen` F08-CompletionDiaryList /
 * F08-CompletionDiaryList-Empty 프레임과 정합.
 *
 * 3계층 레이아웃 (SPEC-UI-002 FROZEN):
 * 1. StatusBar
 * 2. Header — Back(chevron-left) + Title("완독 다이어리", 22/700)
 * 3. Content (ScrollView, gap 20, padding [8,20,20,20]):
 *    - Loading: ActivityIndicator (Header 유지)
 *    - Error: 에러 메시지 + 재시도 버튼 (REQ-COMP2-015)
 *    - Empty (isEmpty): EmptyState inline — sparkles + 타이틀 + 서브 + CTA "읽으러 가기" → 서재
 *    - Success: SummaryStat("지금까지 N권 완독") + DiaryList(DiaryCard×N, 카드 탭 → /completion/{bookId})
 *
 * 비과시 원칙 (constitution FROZEN, REQ-COMP2-004/016): 좋아요/팔로워/랭킹 없음.
 *
 * @MX:SPEC SPEC-COMPLETION-002
 */
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ChevronLeft, Sparkles } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from '../../../components/StatusBar';
import { useTheme } from '../../../theme/theme';
import { radius, spacing, typography } from '../../../theme/tokens';
import { DiaryCard } from './DiaryCard';
import { useCompletionDiaryList } from './useCompletionDiaryList';

/**
 * 완독 다이어리 리스트 화면. F08 정합.
 *
 * @MX:NOTE: [AUTO] 비과시 원칙(REQ-COMP2-016) — SummaryStat 은 개인 완독 권수만 표시. 좋아요/팔로워/랭킹 없음.
 */
export function CompletionDiaryListScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { data, isLoading, isError, isEmpty, refetch } = useCompletionDiaryList(
    // 리스트 쿼리는 RLS 가 본인 항목만 자동 필터하므로 userId 가 불필요하다.
    // useCompletionDiaryList 는 enabled 제어용으로 빈 문자열을 비활성화 트리거로 쓰지 않는 루트에서
    // 항상 활성화하기 위해 더미 값 'me' 를 전달한다 (RLS 가 진짜 사용자 식별).
    'me',
  );

  const handleCardPress = (bookId: string) => {
    router.push(`/completion/${bookId}`);
  };

  const handleEmptyCta = () => {
    router.push('/(tabs)/library');
  };

  return (
    <View
      testID="completion-list-screen"
      style={{ flex: 1, backgroundColor: theme.colors.bg.base }}
    >
      <StatusBar />

      {/* Header — Back(chevron-left) + Title "완독 다이어리" (22/700) */}
      <View
        style={[
          styles.header,
          { backgroundColor: theme.colors.bg.base },
        ]}
      >
        <Pressable
          testID="completion-list-back"
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="뒤로"
          hitSlop={8}
        >
          <ChevronLeft size={24} color={theme.colors.text.primary} />
        </Pressable>
        <Text
          style={[typography.displaySm, { color: theme.colors.text.primary }]}
        >
          완독 다이어리
        </Text>
        {/* Right 영역 (F08: 24×24 빈) — 균형용 spacer */}
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={{ flex: 1, backgroundColor: theme.colors.bg.base }}
        contentContainerStyle={styles.content}
      >
        {isLoading ? (
          <View testID="completion-list-loading" style={styles.loading}>
            <ActivityIndicator size="large" color={theme.colors.brand[500]} />
          </View>
        ) : isError ? (
          <View style={styles.stateWrap}>
            <Text
              style={[typography.bodyMd, { color: theme.colors.text.secondary }]}
            >
              완독 다이어리를 불러올 수 없어요.
            </Text>
            <Pressable
              testID="completion-list-retry"
              onPress={() => refetch()}
              accessibilityRole="button"
              accessibilityLabel="다시 시도"
              style={[
                styles.retryBtn,
                {
                  backgroundColor: theme.colors.brand[500],
                  borderRadius: radius.md,
                },
              ]}
            >
              <Text
                style={[
                  typography.ctaLabel,
                  { color: theme.colors.text.inverse },
                ]}
              >
                다시 시도
              </Text>
            </Pressable>
          </View>
        ) : isEmpty ? (
          <View style={styles.emptyWrap}>
            <Sparkles size={48} color={theme.colors.text.tertiary} />
            <Text
              style={[
                typography.headingMd,
                { color: theme.colors.text.primary },
              ]}
            >
              완독한 책이 아직 없어요
            </Text>
            <Text
              style={[
                typography.bodyMd,
                { color: theme.colors.text.secondary },
              ]}
            >
              첫 책을 끝까지 읽어보세요
            </Text>
            <Pressable
              testID="completion-list-empty-cta"
              onPress={handleEmptyCta}
              accessibilityRole="button"
              accessibilityLabel="읽으러 가기"
              style={[
                styles.emptyCta,
                {
                  backgroundColor: theme.colors.brand[500],
                  borderRadius: radius.md,
                },
              ]}
            >
              <Text
                style={[
                  typography.ctaLabel,
                  { color: theme.colors.text.inverse },
                ]}
              >
                읽으러 가기
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.listWrap}>
            {/* SummaryStat — "지금까지 N권 완독" (비경쟁, 13/500, 중앙 정렬) */}
            <Text
              style={[
                typography.bodySm,
                { color: theme.colors.text.secondary },
                styles.summary,
              ]}
            >
              {`지금까지 ${data?.length ?? 0}권 완독`}
            </Text>

            {/* DiaryList — DiaryCard×N, gap 12 */}
            <View style={styles.diaryList}>
              {(data ?? []).map((item) => (
                <DiaryCard
                  key={item.userBookId}
                  item={item}
                  onPress={handleCardPress}
                />
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  headerRight: {
    width: 24,
    height: 24,
  },
  content: {
    gap: spacing[5],
    padding: spacing[5],
  },
  loading: {
    paddingVertical: spacing[12],
    alignItems: 'center',
  },
  stateWrap: {
    gap: spacing[3],
    alignItems: 'center',
    paddingVertical: spacing[12],
  },
  retryBtn: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  emptyWrap: {
    gap: spacing[2],
    alignItems: 'center',
    paddingVertical: spacing[12],
  },
  emptyCta: {
    marginTop: spacing[3],
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3],
  },
  listWrap: {
    gap: spacing[5],
  },
  summary: {
    textAlign: 'center',
  },
  diaryList: {
    gap: spacing[3],
  },
});
