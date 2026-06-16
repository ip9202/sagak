/**
 * BookSearchScreen 컴포넌트 (SPEC-BOOK-001 M4-2, REQ-BOOK-005, REQ-BOOK-016)
 *
 * 도서 검색 메인 화면. Pencil 디자인 기준: F06-Search (node E44G9).
 * - 3계층: StatusBar → Header(Title "책 찾기") → Content
 * - Content: SearchBar(입력 + ScanButton) → 결과 리스트
 *
 * 시나리오:
 * - S5 / REQ-BOOK-005: 빈 쿼리 제출 시 VALIDATION 에러 메시지
 * - S21: 빈 결과 "도서를 찾을 수 없습니다"
 * - 로딩/에러 상태 UI
 *
 * token-only 스타일링 (SPEC-UI-002 FROZEN). useTheme() 사용, 하드코딩 금지.
 */
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTheme } from '../../theme/theme';
import { SearchResultCard } from '../../components/SearchResultCard';
import { searchBooks } from './searchApi';
import type { SearchResult, SearchTarget } from '../../types/book';

export interface BookSearchScreenProps {
  /** 스캔 화면으로 이동 */
  onNavigateScan: () => void;
  /** 결과 선택 → 상세/등록 플로우 */
  onSelectBook: (result: SearchResult) => void;
  /** 라우팅에서 ISBN 자동 전환 시 전달 (초기 검색어) */
  initialQuery?: string;
  /** 초기 검색 타겟 (ISBN 스캔 후 'isbn' 전달) */
  initialTarget?: SearchTarget;
}

type SearchStatus = 'idle' | 'loading' | 'success' | 'error';

interface SearchState {
  status: SearchStatus;
  results: SearchResult[];
  errorMessage: string | null;
}

const initialState: SearchState = {
  status: 'idle',
  results: [],
  errorMessage: null,
};

/**
 * @MX:ANCHOR: [AUTO] BookSearchScreen — 검색 메인 화면 공개 컴포넌트
 * @MX:REASON: 라우팅(search.tsx)이 직접 마운트하며, 빈 쿼리 차단·빈 결과 안내·스캔 전환 계약을 위반하면 검색 플로우 전체가 고장난다.
 */
export const BookSearchScreen: React.FC<BookSearchScreenProps> = ({
  onNavigateScan,
  onSelectBook,
  initialQuery = '',
  initialTarget = 'title',
}) => {
  const theme = useTheme();
  const tc = theme.colors;

  const [query, setQuery] = useState(initialQuery);
  const [target] = useState<SearchTarget>(initialTarget);
  const [state, setState] = useState<SearchState>(initialState);

  const handleSubmit = useCallback(async () => {
    // REQ-BOOK-005: 빈/공백 쿼리를 searchApi 호출 전에 선제 차단 (UX: API 호출 방지)
    if (!query || query.trim().length === 0) {
      setState({
        status: 'error',
        results: [],
        errorMessage: '검색어를 입력해 주세요',
      });
      return;
    }

    // 유효 쿼리 — searchApi 호출 (빈 결과/네트워크 에러는 catch 에서 처리)
    setState({ status: 'loading', results: [], errorMessage: null });
    try {
      const results = await searchBooks(query, target);
      setState({ status: 'success', results, errorMessage: null });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : '검색 중 오류가 발생했습니다.';
      setState({ status: 'error', results: [], errorMessage: message });
    }
  }, [query, target]);

  return (
    <View style={[styles.container, { backgroundColor: tc.bg.base }]}>
      {/* Header — Pencil F06/Header: Title "책 찾기" 22/700 */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: tc.text.primary }]}>책 찾기</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* SearchBar — Pencil F06/SearchBar: $bg-muted, padding[12,16], cornerRadius $radius-lg */}
        <View
          style={[
            styles.searchBar,
            {
              backgroundColor: tc.bg.muted,
              borderRadius: theme.radius.lg,
            },
          ]}
        >
          <TextInput
            testID="search-input"
            value={query}
            onChangeText={setQuery}
            placeholder="제목, 저자 검색"
            placeholderTextColor={tc.text.tertiary}
            style={[styles.searchInput, { color: tc.text.primary }]}
            onSubmitEditing={handleSubmit}
            returnKeyType="search"
            accessibilityLabel="검색어 입력"
          />

          {/* ScanButton — Pencil F06/ScanButton: $brand-50, scan-line 아이콘 */}
          <Pressable
            testID="search-scan-button"
            onPress={onNavigateScan}
            style={[
              styles.scanButton,
              { backgroundColor: tc.brand[50], borderRadius: theme.radius.md },
            ]}
            accessibilityRole="button"
            accessibilityLabel="바코드 스캔"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.scanIcon}>📖</Text>
          </Pressable>
        </View>

        {/* 검색 제출 버튼 (접근성 — onSubmitEditing 외에 명시적 버튼) */}
        <Pressable
          testID="search-submit-button"
          onPress={handleSubmit}
          style={[
            styles.submitButton,
            { backgroundColor: tc.brand[500], borderRadius: theme.radius.md },
          ]}
          accessibilityRole="button"
          accessibilityLabel="검색"
        >
          <Text style={[styles.submitText, { color: tc.text.inverse }]}>
            검색
          </Text>
        </Pressable>

        {/* 상태별 콘텐츠 */}
        {state.status === 'loading' && (
          <View testID="search-loading" style={styles.statusContainer}>
            <ActivityIndicator size="large" color={tc.brand[500]} />
            <Text style={[styles.statusText, { color: tc.text.secondary }]}>
              검색 중...
            </Text>
          </View>
        )}

        {state.status === 'error' && state.errorMessage && (
          <View testID="search-error" style={styles.statusContainer}>
            <Text style={[styles.errorText, { color: tc.semantic.error }]}>
              {state.errorMessage}
            </Text>
          </View>
        )}

        {state.status === 'success' && state.results.length === 0 && (
          // S21: 빈 결과 안내
          <View testID="search-empty" style={styles.statusContainer}>
            <Text style={[styles.emptyTitle, { color: tc.text.primary }]}>
              도서를 찾을 수 없습니다
            </Text>
            <Text style={[styles.emptyHint, { color: tc.text.secondary }]}>
              바코드 스캔 또는 ISBN 직접 입력으로 찾아보세요.
            </Text>
          </View>
        )}

        {state.status === 'success' && state.results.length > 0 && (
          <View style={styles.resultsSection}>
            <Text
              style={[styles.resultsLabel, { color: tc.text.secondary }]}
            >
              검색 결과
            </Text>
            {state.results.map((result, index) => (
              <SearchResultCard
                key={`${result.isbn}-${index}`}
                result={result}
                onPress={onSelectBook}
                testID={`search-result-card-${index}`}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  scanButton: {
    padding: 8,
  },
  scanIcon: {
    fontSize: 18,
  },
  submitButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  submitText: {
    fontSize: 14,
    fontWeight: '600',
  },
  statusContainer: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  statusText: {
    fontSize: 14,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptyHint: {
    fontSize: 13,
    textAlign: 'center',
  },
  resultsSection: {
    gap: 12,
  },
  resultsLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
});
