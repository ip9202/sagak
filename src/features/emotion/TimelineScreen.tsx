/**
 * 감정 기록 타임라인 화면 (SPEC-EMOTION-001 T-010)
 *
 * REQ-EMO-002 (조회), REQ-EMO-008 (스포일러 블러), REQ-EMO-009 (정렬 토글).
 *
 * 기능:
 * - safe 기록: EmotionRecordCard (isSpoiler=false) 로 렌더링
 * - spoiler 기록: EmotionRecordCard (isSpoiler=true) 로 렌더링 — 12px blur
 * - sort 토글 (시간순 기본 / 페이지순) — onSortChange 로 부모에 전달
 * - 빈 상태 UI (EC-5), 로딩 상태, 에러 상태
 *
 * 부모가 useEmotionRecords 를 소유하고 data/isLoading/error 를 props 로 주입한다.
 * FROZEN 규칙: tokens.ts 변수만 사용.
 *
 * @MX:SPEC SPEC-EMOTION-001
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useTheme } from '../../theme/theme';
import { spacing, radius, borderWidth } from '../../theme/tokens';
import { EmotionRecordCard } from '../../components/EmotionRecordCard';
import { getBookDetail } from '../book/bookDetailApi';
import type {
  EmotionListResult,
  EmotionRecordWithAuthor,
  EmotionSortOption,
} from './types';

export interface TimelineScreenProps {
  bookId: string;
  userId: string;
  currentPage: number;
  /** useEmotionRecords 의 조회 결과 (부모가 주입) */
  data: EmotionListResult;
  isLoading: boolean;
  /** 정규화된 AppError 또는 null */
  error: unknown;
  sort: EmotionSortOption;
  onSortChange: (sort: EmotionSortOption) => void;
  /** FlatList 상단에 렌더링할 헤더(EmotionInputScreen). 단일 스크롤 구조 유지용. */
  listHeader?: React.ReactNode;
}

/**
 * @MX:NOTE: [AUTO] 감정 기록 타임라인. safe + spoiler 를 모두 렌더링하되 spoiler 는 isSpoiler=true 로 블러 처리. 부모가 쿼리 상태를 주입해 테스트 격리가 쉽다.
 */
export const TimelineScreen: React.FC<TimelineScreenProps> = ({
  bookId,
  data,
  isLoading,
  error,
  sort,
  onSortChange,
  listHeader,
}) => {
  const theme = useTheme();
  const [bookTitle, setBookTitle] = useState('');

  // 책 제목 보조 조회 — TimelineScreen 은 단일 bookId 컨텍스트이므로 emotionApi.list 에 books 조인 대신
  // 한 번만 조회해 모든 카드에 동일 bookTitle 을 전달한다 (bookTitle 빈값 수정).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const book = await getBookDetail(bookId);
        if (!cancelled) setBookTitle(book.title ?? '');
      } catch {
        // bookTitle 은 보조 표시 — 조회 실패 시 빈값 유지, emotion 데이터는 정상 동작
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bookId]);

  // 로딩 상태
  if (isLoading) {
    return (
      <View
        style={[styles.center, { backgroundColor: theme.colors.bg.base }]}
        testID="timeline-loading"
      >
        <Text style={{ color: theme.colors.text.secondary }}>
          불러오는 중...
        </Text>
      </View>
    );
  }

  // 에러 상태
  if (error) {
    return (
      <View
        style={[styles.center, { backgroundColor: theme.colors.bg.base }]}
        testID="timeline-error"
      >
        <Text style={{ color: theme.colors.semantic.error }}>
          기록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
        </Text>
      </View>
    );
  }

  // safe + spoiler 순으로 합친 렌더링 목록 (spoiler 는 isSpoiler=true).
  // 빈 상태는 ListEmptyComponent 로 처리 — 헤더(입력 폼)는 항상 표시.
  const items: { record: EmotionRecordWithAuthor; isSpoiler: boolean }[] = [
    ...data.safe.map((record) => ({ record, isSpoiler: false })),
    ...data.spoiler.map((record) => ({ record, isSpoiler: true })),
  ];

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.record.id}
      renderItem={({ item }) => (
        <EmotionRecordCard
          nickname={item.record.users?.nickname ?? '익명'}
          page={item.record.page_number ?? 0}
          daysAgo={0}
          content={item.record.content}
          bookTitle={bookTitle}
          stickers={item.record.sticker_reactions.map((s) => ({
            type: s.sticker_type,
            count: s.count,
          }))}
          isSpoiler={item.isSpoiler}
        />
      )}
      ListHeaderComponent={
        <>
          {listHeader}
          {/* 정렬 토글 (REQ-EMO-009, 시나리오 4.3/4.4) */}
          <View style={styles.sortRow}>
            <TouchableOpacity
              testID="sort-time"
              onPress={() => onSortChange('time')}
              style={[
                styles.sortBtn,
                {
                  backgroundColor:
                    sort === 'time'
                      ? theme.colors.brand[200]
                      : theme.colors.bg.surface,
                  borderColor: theme.colors.border.default,
                },
              ]}
            >
              <Text style={{ color: theme.colors.text.primary }}>시간순</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="sort-page"
              onPress={() => onSortChange('page')}
              style={[
                styles.sortBtn,
                {
                  backgroundColor:
                    sort === 'page'
                      ? theme.colors.brand[200]
                      : theme.colors.bg.surface,
                  borderColor: theme.colors.border.default,
                },
              ]}
            >
              <Text style={{ color: theme.colors.text.primary }}>페이지순</Text>
            </TouchableOpacity>
          </View>
        </>
      }
      ListEmptyComponent={
        <View
          style={[styles.center, { backgroundColor: theme.colors.bg.base }]}
          testID="timeline-empty"
        >
          <Text style={{ color: theme.colors.text.secondary }}>
            아직 감정 기록이 없습니다. 첫 기록을 남겨보세요.
          </Text>
        </View>
      }
      ItemSeparatorComponent={() => <View style={{ height: spacing[3] }} />}
      contentContainerStyle={[
        styles.container,
        { backgroundColor: theme.colors.bg.base },
      ]}
      style={{ backgroundColor: theme.colors.bg.base }}
      testID="timeline-screen"
    />
  );
};

const styles = StyleSheet.create({
  container: {
    // flex:1 제거 — FlatList contentContainerStyle 에 flex:1 은 콘텐츠를 뷰포트 높이로
    // 고정해 스크롤을 차단한다. padding 만으로 콘텐츠 높이만큼 늘어나 스크롤이 가능.
    padding: spacing[4],
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[6],
  },
  sortRow: {
    flexDirection: 'row',
    gap: spacing[2],
    marginBottom: spacing[3],
  },
  sortBtn: {
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[4],
    borderRadius: radius.md,
    borderWidth: borderWidth.hairline,
  },
});
