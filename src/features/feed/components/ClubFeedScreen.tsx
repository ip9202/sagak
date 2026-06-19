/**
 * ClubFeedScreen 컴포넌트 (SPEC-FEED-001 T-B1)
 *
 * 모임 단위 감정 기록 피드 화면. 무한 스크롤 + 스포일러 블러 + 진도 재평가를 담당한다.
 *
 * 핵심 동작:
 * - F9: currentPage prop 변경 시 캐시된 items 에 spoilerFilter 만 재적용 (queryFn 재호출 없음)
 *       useClubFeed 의 queryKey 는 currentPage 를 포함하지 않으므로 동일 캐시를 재사용한다.
 * - F10: 블러 카드 탭 시 컴포넌트 로컬 revealed Set 에 id 추가 → isSpoiler 최종값 false 전환
 * - F11: revealed 는 useState 이므로 언마운트 시 자동 소멸 (화면 이탈 시 블러 자동 복원)
 *
 * SPEC-UI-002 (FROZEN) 준수:
 * - 3계층 레이아웃 (Header / Content)
 * - 헤더 타이틀 균일성: fontSize 22 / weight 700 (REQ-SCREEN-010)
 * - 카드 밀도: cornerRadius 16 / padding 16-20 (REQ-SCREEN-020)
 * - 카드 간격 16 (REQ-SCREEN-021)
 * - 빈/로딩/에러 상태 (REQ-SCREEN-030/031/032)
 * - token-only 스타일링 (REQ-SCREEN-005)
 * - 비과시 원칙: 좋아요/팔로워/랭킹 표시 없음 (REQ-SCREEN-014)
 *
 * @MX:SPEC SPEC-FEED-001
 */
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { EmotionRecordCard } from '../../../components/EmotionRecordCard';
import { useTheme } from '../../../theme/theme';
import { useClubFeed } from '../useClubFeed';
import { useClubFeedRealtime } from '../useClubFeedRealtime';
import { mapFeedItems } from '../spoilerFilter';
import { getUserFriendlyMessage } from '../../../lib/api/errors';
import { AppError } from '../../../errors';
import type { FeedItemWithSpoiler } from '../types';
import type { EmotionRecordWithAuthor } from '../../emotion/types';

export interface ClubFeedScreenProps {
  /** clubs.id */
  clubId: string;
  /** clubs.book_id — 모임 도서 범위 필터 (REQ-FEED-003) */
  bookId: string;
  /** 시청자의 현재 독서 페이지 (스포일러 기준, F7/F8/F9) */
  currentPage: number;
  /** auth.uid() — 본인 기록 판정 */
  userId: string;
  /** 도서 제목 — 카드의 bookTitle prop */
  bookTitle?: string;
}

/** EmotionRecordCard stickers prop 형태로 변환 */
type CardSticker = {
  type: 'empathy' | 'touching' | 'comforted';
  count: number;
};

/**
 * 단일 FeedItemWithSpoiler 를 EmotionRecordCard props 로 매핑한다.
 * created_at(ISO) 로부터 daysAgo 를 일 단위로 계산한다.
 */
function toCardProps(
  item: FeedItemWithSpoiler,
  bookTitle: string,
): {
  nickname: string;
  page: number;
  daysAgo: number;
  content: string;
  bookTitle: string;
  stickers: CardSticker[];
} {
  const stickers: CardSticker[] = item.sticker_reactions.map((s) => ({
    type: s.sticker_type,
    count: s.count,
  }));
  const createdMs = Date.parse(item.created_at);
  const daysAgo = Number.isNaN(createdMs)
    ? 0
    : Math.max(
        0,
        Math.floor((Date.now() - createdMs) / (1000 * 60 * 60 * 24)),
      );
  return {
    nickname: item.users?.nickname ?? '독자',
    page: item.page_number ?? 0,
    daysAgo,
    content: item.content,
    bookTitle,
    stickers,
  };
}

/**
 * 모임 피드 화면. 라우트(app/(tabs)/clubs/[clubId]/feed) 가 마운트하며,
 * clubId/bookId/currentPage/userId 를 prop 으로 주입받는다.
 *
 * @MX:ANCHOR: [AUTO] 모임 피드 화면(SPEC-FEED-001 Phase B/C) 의 단일 진입점 — fan_in >= 3 예상 (feed 라우트, 부모 모임 상세 CTA, 향후 푸시 딥링크)
 * @MX:REASON: F9/F10/F11 계약(진도 재평가, 블러 토글, 언마운트 복원)이 깨지면 스포일러 UX 일관성이 무너진다.
 */
/**
 * F16: Realtime 연결 끊김 안내 바.
 * 피드 데이터는 유지된 채 작은 안내 텍스트만 표시한다 (비간섭).
 * tokens.ts 의 semantic.error 색만 사용 — 하드코딩 금지 (REQ-SCREEN-005).
 */
const RealtimeErrorBar: React.FC = () => {
  const theme = useTheme();
  return (
    <View
      testID="club-feed-realtime-error"
      style={[
        styles.realtimeBar,
        { backgroundColor: theme.colors.bg.base },
      ]}
    >
      <Text
        style={[
          styles.realtimeText,
          { color: theme.colors.semantic.error },
        ]}
      >
        실시간 연결 끊김 — 재연결 중
      </Text>
    </View>
  );
};

export const ClubFeedScreen: React.FC<ClubFeedScreenProps> = ({
  clubId,
  bookId,
  currentPage,
  userId,
  bookTitle = '',
}) => {
  const theme = useTheme();
  const query = useClubFeed({ clubId, bookId, currentPage, userId });
  // T-C2: Realtime 구독 — emotion/sticker INSERT 이벤트로 피드 invalidate.
  // status='error' 시 사용자에게 연결 끊김 안내 (F16).
  const realtime = useClubFeedRealtime({ clubId, userId });
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  // 평탄화된 원본 아이템 (currentPage 와 무관 — 캐시 고정값)
  const flatItems: EmotionRecordWithAuthor[] = useMemo(() => {
    const pages = query.data?.pages ?? [];
    return pages.flatMap((page) => page.items);
  }, [query.data?.pages]);

  // F9: currentPage 변경 시 동일 flatItems 에 대해 spoilerFilter 만 재적용.
  // queryKey 가 currentPage 를 포함하지 않으므로 queryFn 은 재호출되지 않는다.
  const items: FeedItemWithSpoiler[] = useMemo(
    () => mapFeedItems(flatItems, currentPage, userId),
    [flatItems, currentPage, userId],
  );

  const handleCardPress = (recordId: string, isSpoiler: boolean) => {
    if (!isSpoiler) return;
    setRevealed((prev) => {
      const next = new Set(prev);
      next.add(recordId);
      return next;
    });
  };

  // --- 상태 분기 ---

  if (query.isPending) {
    return (
      <View
        style={[styles.container, { backgroundColor: theme.colors.bg.base }]}
      >
        <View
          testID="club-feed-loading"
          style={[styles.bodyCenter, { gap: theme.spacing[3] }]}
        >
          <ActivityIndicator size="large" color={theme.colors.brand[500]} />
        </View>
      </View>
    );
  }

  if (query.isError) {
    return (
      <View
        style={[styles.container, { backgroundColor: theme.colors.bg.base }]}
      >
        <View
          testID="club-feed-error"
          style={[styles.bodyCenter, { gap: theme.spacing[3] }]}
        >
          <Text
            style={[
              styles.errorText,
              { color: theme.colors.semantic.error },
            ]}
          >
            {query.error
              ? getUserFriendlyMessage(query.error as AppError)
              : '피드를 불러올 수 없어요.'}
          </Text>
          <Pressable
            testID="club-feed-retry"
            onPress={() => query.refetch()}
            accessibilityRole="button"
            accessibilityLabel="재시도"
            style={[
              styles.retryButton,
              {
                backgroundColor: theme.colors.brand[50],
                borderRadius: theme.radius.md,
              },
            ]}
          >
            <Text
              style={[
                styles.retryText,
                { color: theme.colors.text.brand },
              ]}
            >
              다시 불러오기
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View
        style={[styles.container, { backgroundColor: theme.colors.bg.base }]}
      >
        {realtime.status === 'error' ? <RealtimeErrorBar /> : null}
        <View
          testID="club-feed-empty"
          style={[styles.bodyCenter, { gap: theme.spacing[3] }]}
        >
          <Text
            style={[
              styles.emptyText,
              { color: theme.colors.text.secondary },
            ]}
          >
            아직 피드에 기록이 없어요. 첫 감정을 남겨볼까요?
          </Text>
        </View>
      </View>
    );
  }

  // --- 정상 렌더 ---
  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg.base }]}>
      {realtime.status === 'error' ? <RealtimeErrorBar /> : null}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingHorizontal: theme.spacing[5],
            paddingVertical: theme.spacing[4],
          },
        ]}
        ItemSeparatorComponent={() => (
          <View style={{ height: theme.spacing[4] }} />
        )}
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) {
            query.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.5}
        renderItem={({ item }) => {
          // F10/F11: 최종 isSpoiler = spoilerFilter 결과 && !revealed
          const isSpoiler = item.isSpoiler && !revealed.has(item.id);
          const card = toCardProps(item, bookTitle);
          return (
            <Pressable
              testID={`club-feed-card-${item.id}`}
              onPress={() => handleCardPress(item.id, isSpoiler)}
              disabled={!isSpoiler}
            >
              <EmotionRecordCard
                nickname={card.nickname}
                page={card.page}
                daysAgo={card.daysAgo}
                content={card.content}
                bookTitle={card.bookTitle}
                stickers={card.stickers}
                isSpoiler={isSpoiler}
              />
            </Pressable>
          );
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  // SPEC-UI-002 FROZEN: title uniformity 는 헤더에서 사용. 본 화면은 FlatList 단일 화면.
  bodyCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
  emptyText: { fontSize: 14, textAlign: 'center' },
  retryButton: { paddingVertical: 12, paddingHorizontal: 20, alignItems: 'center' },
  retryText: { fontSize: 14, fontWeight: '700' },
  listContent: { gap: 0 },
  // F16: realtime 연결 끊김 안내 바 — 비간섭, semantic-error 토큰 사용
  realtimeBar: { paddingVertical: 8, alignItems: 'center' },
  realtimeText: { fontSize: 12, fontWeight: '500' },
});
