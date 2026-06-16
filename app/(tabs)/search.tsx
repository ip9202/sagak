/**
 * 검색 화면 라우트 — search (href:null, 탭바 미표시)
 * SPEC-BOOK-001 M4-4
 * SPEC-LIBRARY-001 — TASK-003 (ISBN→UUID 라우팅 통합, blocker B 해소)
 *
 * BookSearchScreen 을 라우팅과 연결:
 * - onNavigateScan → router.push('/scan')
 * - onSelectBook(result) → resolveBookId(isbn) 로 UUID 획득 후 router.push(`/book/${UUID}`)
 *
 * SPEC-LIBRARY-001 변경점: 검색 결과의 ISBN 을 직접 라우팅하지 않고,
 * books.id(UUID) 로 해소한 뒤 /book/<UUID> 로 이동한다. 미등록 ISBN 인 경우
 * NOT_FOUND 가 발생하며, 사용자에게 책 등록 플로우 안내 메시지를 노출한다.
 *
 * 라우팅 param 으로 ISBN 자동 전환(initialQuery/initialTarget) 지원:
 * scan.tsx 에서 router.replace('/search', { initialQuery: isbn, initialTarget: 'isbn' }).
 */
import React, { useCallback } from 'react';
import { Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { BookSearchScreen } from '../../src/features/book/BookSearchScreen';
import { resolveBookId } from '../../src/features/book/resolveBookId';
import { getUserFriendlyMessage } from '../../src/lib/api/errors';
import type { SearchTarget } from '../../src/types/book';

export default function SearchRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    initialQuery?: string;
    initialTarget?: SearchTarget;
  }>();

  const handleSelectBook = useCallback(
    async (result: { isbn: string; title: string }) => {
      try {
        // REQ-BOOK-014 + SPEC-LIBRARY-001: ISBN → UUID 매핑 후 상세 진입.
        const id = await resolveBookId(result.isbn);
        router.push(`/book/${id}`);
      } catch (error) {
        // @MX:NOTE: [AUTO] NOT_FOUND(미등록 ISBN) 등 실패 시 라우팅 중단. SPEC-LIBRARY-001 TASK-010: getUserFriendlyMessage 로 사용자 친화적 메시지 노출. 미등록 ISBN(책 미등록) 시 등록 플로우 안내.
        const appError = error as { category?: string; code?: string };
        const friendly = getUserFriendlyMessage(error as never);
        const isNotFound = appError?.category === 'NOT_FOUND';
        const title = isNotFound ? '등록되지 않은 책이에요' : '이동할 수 없어요';
        const body = isNotFound
          ? '이 책은 아직 서비스에 등록되지 않았어요. 다른 책을 검색해 보세요.'
          : friendly;
        Alert.alert(title, body);
      }
    },
    [router],
  );

  return (
    <BookSearchScreen
      initialQuery={params.initialQuery}
      initialTarget={params.initialTarget}
      onNavigateScan={() => router.push('/scan')}
      onSelectBook={handleSelectBook}
    />
  );
}
