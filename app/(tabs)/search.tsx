/**
 * 검색 화면 라우트 — search (href:null, 탭바 미표시)
 * SPEC-BOOK-001 M4-4
 *
 * BookSearchScreen 을 라우팅과 연결:
 * - onNavigateScan → router.push('/scan')
 * - onSelectBook(result) → router.push(`/book/${isbn}`) (또는 기존 bookId 상세)
 *
 * 라우팅 param 으로 ISBN 자동 전환(initialQuery/initialTarget) 지원:
 * scan.tsx 에서 router.replace('/search', { initialQuery: isbn, initialTarget: 'isbn' }).
 */
import React from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { BookSearchScreen } from '../../src/features/book/BookSearchScreen';
import type { SearchTarget } from '../../src/types/book';

export default function SearchRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    initialQuery?: string;
    initialTarget?: SearchTarget;
  }>();

  return (
    <BookSearchScreen
      initialQuery={params.initialQuery}
      initialTarget={params.initialTarget}
      onNavigateScan={() => router.push('/scan')}
      onSelectBook={(result) => {
        // REQ-BOOK-014: 결과 선택 → ISBN 기반 상세/등록 플로우.
        // ISBN 으로 라우팅 (추후 bookId 역할할 — 현재는 /book/[isbn] 동적 라우트 활용).
        router.push(`/book/${result.isbn}`);
      }}
    />
  );
}
