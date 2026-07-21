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
import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { typography } from '../../theme/tokens';
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

  // @MX:NOTE: [AUTO] handleSubmit 은 overrideQuery/overrideTarget 인자를 옵션으로 받는다.
  //   자동 검색(useEffect)은 initialQuery/initialTarget 이 마운트 후 갱신되어도 state 의존 없이
  //   prop 으로 직접 검색하기 위함 (expo-router params 지연 갱신 대응, PR #65 후속).
  const handleSubmit = useCallback(
    async (
      overrideQuery?: string,
      overrideTarget?: SearchTarget
    ) => {
      const effectiveQuery = overrideQuery ?? query;
      const effectiveTarget = overrideTarget ?? target;
      // REQ-BOOK-005: 빈/공백 쿼리를 searchApi 호출 전에 선제 차단 (UX: API 호출 방지)
      if (!effectiveQuery || effectiveQuery.trim().length === 0) {
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
        const results = await searchBooks(effectiveQuery, effectiveTarget);
        setState({ status: 'success', results, errorMessage: null });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : '검색 중 오류가 발생했습니다.';
        setState({ status: 'error', results: [], errorMessage: message });
      }
    },
    [query, target]
  );

  // S13: 바코드 스캔 후 라우팅(initialQuery/initialTarget) 으로 진입 시 자동 검색.
  // @MX:REASON: expo-router 가 같은 search 라우트를 재사용하며 params 만 갱신하면
  //   BookSearchScreen 인스턴스가 재마운트되지 않아 useState(initialQuery) 초기값이
  //   첫 마운트(빈 값)에 고정된다. 따라서 initialQuery prop 을 직접 관찰해 query 를
  //   동기화하고 handleSubmit(initialQuery) 로 검색한다. lastSearchedInitialRef 로 이미
  //   검색한 ISBN 의 중복 자동 검색을 막고, 다른 ISBN 은 새 자동 검색을 허용한다.
  const lastSearchedInitialRef = useRef<string | null>(null);
  useEffect(() => {
    const q = initialQuery?.trim() ?? '';
    if (!q) return;
    if (lastSearchedInitialRef.current === q) return;
    lastSearchedInitialRef.current = q;
    setQuery(q); // 입력 필드를 ISBN 으로 동기화 (시각적 일관성)
    void handleSubmit(q, initialTarget); // state 의존 없이 initialQuery/initialTarget 로 직접 검색
  }, [initialQuery, initialTarget, handleSubmit]);

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
            onSubmitEditing={() => handleSubmit()}
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
          onPress={() => handleSubmit()}
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
  // @MX:NOTE: [AUTO] SPEC-UI-002 book-auth-tokenization — displaySm(22/700/30) 토큰 적용. 헤더 타이틀 균일성 FROZEN.
  title: { ...typography.displaySm },
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
  // @MX:NOTE: [AUTO] SPEC-UI-002 book-auth-tokenization — bodyMd(14/400/22) 토큰 적용.
  searchInput: { ...typography.bodyMd, flex: 1, paddingVertical: 0 },
  scanButton: {
    padding: 8,
  },
  // @MX:NOTE: [AUTO] SPEC-UI-002 book-auth-tokenization — headingMd(18/600)에서 fontWeight 400 override. 📖 emoji 글리프(원본 weight 누락=400).
  scanIcon: { ...typography.headingMd, fontWeight: '400' as const },
  submitButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  // @MX:NOTE: [AUTO] SPEC-UI-002 book-auth-tokenization — ctaLabel(14/600/22) 토큰 적용.
  submitText: { ...typography.ctaLabel },
  statusContainer: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  // @MX:NOTE: [AUTO] SPEC-UI-002 book-auth-tokenization — bodyMd(14/400/22) 토큰 적용.
  statusText: { ...typography.bodyMd },
  // @MX:NOTE: [AUTO] SPEC-UI-002 book-auth-tokenization — bodyMd(14/400/22) 토큰 적용.
  errorText: { ...typography.bodyMd, textAlign: 'center' },
  // @MX:NOTE: [AUTO] SPEC-UI-002 book-auth-tokenization — headingSm(16/600/23) 토큰 적용.
  emptyTitle: { ...typography.headingSm },
  // @MX:NOTE: [AUTO] SPEC-UI-002 book-auth-tokenization — bodySm(13/400/20) 토큰 적용. 원본 weight 누락(400)과 일치.
  emptyHint: { ...typography.bodySm, textAlign: 'center' },
  resultsSection: {
    gap: 12,
  },
  // @MX:NOTE: [AUTO] SPEC-UI-002 book-auth-tokenization — sectionLabel(13/600/18) 토큰 적용.
  resultsLabel: { ...typography.sectionLabel },
});
