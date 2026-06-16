/**
 * BookDetailScreen 컴포넌트 (SPEC-BOOK-001 M4-3, REQ-BOOK-015)
 *
 * 도서 상세 화면. getBookDetail(bookId) 로 단일 books 행을 조회해 표시.
 *
 * 시나리오:
 * - S19: 성공 → 표지/제목/저자/출판사/출판일 렌더링
 * - S20: NOT_FOUND 에러 메시지
 * - S22: useSession() loading(null) 시 ActivityIndicator, 미인증 시 onRequireAuth
 *
 * useSession 인터페이스(src/auth/useSession.ts 검증):
 * - loading 시 null 반환 → 본 화면도 null 가드 후 ActivityIndicator 표시
 * - 반환값이 있으면 isAuthenticated/isOnboarded 파생값 사용
 *
 * token-only 스타일링 (SPEC-UI-002 FROZEN). useTheme() 사용, 하드코딩 금지.
 */
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTheme } from '../../theme/theme';
import { useSession } from '../../auth/useSession';
import { getBookDetail } from './bookDetailApi';
import type { BookRow } from '../../types/book';

export interface BookDetailScreenProps {
  /** books.id (UUID) — 라우팅 param */
  bookId: string;
  /** 미인증 시 호출 (인증 플로우로 이동) */
  onRequireAuth: () => void;
}

type DetailStatus = 'idle' | 'loading' | 'success' | 'error';

interface DetailState {
  status: DetailStatus;
  book: BookRow | null;
  errorMessage: string | null;
}

const initialState: DetailState = {
  status: 'idle',
  book: null,
  errorMessage: null,
};

/**
 * REQ-BOOK-015: 출판일 ISO(YYYY-MM-DD) → "YYYY.MM" 포맷 (SearchResultCard 와 일관성).
 */
function formatPublishedMonth(iso: string | null): string | null {
  if (!iso || iso.length < 7) return null;
  return iso.slice(0, 7).replace('-', '.');
}

/**
 * 에러 카테고리별 사용자 메시지 매핑 (S20: NOT_FOUND, S22: RLS_DENIED).
 */
function mapErrorMessage(category: string | undefined, fallback: string): string {
  switch (category) {
    case 'NOT_FOUND':
      return '책을 찾을 수 없습니다.';
    case 'RLS_DENIED':
      return '접근 권한이 없습니다.';
    case 'AUTH':
      return '로그인이 필요합니다.';
    default:
      return fallback;
  }
}

/**
 * @MX:ANCHOR: [AUTO] BookDetailScreen — 도서 상세 화면 공개 컴포넌트
 * @MX:REASON: 라우팅([bookId].tsx)이 직접 마운트하며, 세션 가드·NOT_FOUND/RLS 에러 처리·bookId 전달 계약을 위반하면 상세 플로우가 고장난다.
 */
export const BookDetailScreen: React.FC<BookDetailScreenProps> = ({
  bookId,
  onRequireAuth,
}) => {
  const theme = useTheme();
  const tc = theme.colors;
  const session = useSession();
  const [state, setState] = useState<DetailState>(initialState);

  // S22: 세션 로딩(useSession null) 또는 미인증 가드
  const isAuthenticated = session?.isAuthenticated ?? false;

  useEffect(() => {
    // useSession 이 null(loading) 인 경우 — 대기 (API 호출 없음)
    if (session === null) return;

    // 미인증 — onRequireAuth 호출, API 호출 없음
    if (!isAuthenticated) {
      onRequireAuth();
      return;
    }

    // 인증됨 — 상세 조회
    let cancelled = false;
    setState({ status: 'loading', book: null, errorMessage: null });

    (async () => {
      try {
        const book = await getBookDetail(bookId);
        if (!cancelled) {
          setState({ status: 'success', book, errorMessage: null });
        }
      } catch (err) {
        if (cancelled) return;
        const fallback =
          err instanceof Error ? err.message : '상세 조회 중 오류가 발생했습니다.';
        // @MX:NOTE: [AUTO] AppError.category 로 NOT_FOUND/RLS_DENIED 분류 — normalizeError 가 설정
        const category = (err as { category?: string }).category;
        const message = mapErrorMessage(category, fallback);
        setState({ status: 'error', book: null, errorMessage: message });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session, isAuthenticated, bookId, onRequireAuth]);

  // S22: 세션 로딩 또는 상세 로딩 — ActivityIndicator
  if (session === null || state.status === 'loading' || state.status === 'idle') {
    return (
      <View
        testID="book-detail-loading"
        style={[styles.centerContainer, { backgroundColor: tc.bg.base }]}
      >
        <ActivityIndicator size="large" color={tc.brand[500]} />
      </View>
    );
  }

  // 에러 상태 (NOT_FOUND / RLS_DENIED / 네트워크)
  if (state.status === 'error' && state.errorMessage) {
    return (
      <View
        testID="book-detail-error"
        style={[styles.centerContainer, { backgroundColor: tc.bg.base }]}
      >
        <Text
          style={[styles.errorTitle, { color: tc.semantic.error }]}
        >
          {state.errorMessage}
        </Text>
      </View>
    );
  }

  // 성공 — 상세 렌더링
  const book = state.book;
  if (!book) return null;

  const formattedDate = formatPublishedMonth(book.published_at);
  let metaText: string | null = null;
  if (book.publisher && formattedDate) {
    metaText = `${book.publisher} · ${formattedDate}`;
  } else if (book.publisher) {
    metaText = book.publisher;
  } else if (formattedDate) {
    metaText = formattedDate;
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: tc.bg.base }]}
      contentContainerStyle={styles.content}
    >
      {/* 표지 */}
      {book.cover_url ? (
        <Image
          testID="book-detail-cover"
          source={{ uri: book.cover_url }}
          style={styles.cover}
          resizeMode="cover"
        />
      ) : (
        <View
          testID="book-detail-cover-placeholder"
          style={[styles.cover, { backgroundColor: tc.brand[200] }]}
        />
      )}

      {/* 제목 */}
      <Text style={[styles.title, { color: tc.text.primary }]}>
        {book.title}
      </Text>

      {/* 저자 */}
      <Text style={[styles.author, { color: tc.text.secondary }]}>
        {book.author}
      </Text>

      {/* 출판사·출판일 메타 */}
      {metaText && (
        <Text style={[styles.meta, { color: tc.text.tertiary }]}>
          {metaText}
        </Text>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    alignItems: 'center',
    gap: 8,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  cover: {
    width: 160,
    height: 220,
    borderRadius: 8,
    marginBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  author: {
    fontSize: 14,
    textAlign: 'center',
  },
  meta: {
    fontSize: 12,
    textAlign: 'center',
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
