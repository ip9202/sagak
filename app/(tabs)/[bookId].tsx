/**
 * 도서 상세 동적 라우트 — [bookId]
 * SPEC-BOOK-001 M4-6 — SPEC-NAV-001 stub 에서 BookDetailScreen 통합으로 교체
 *
 * bookId param 을 BookDetailScreen 에 전달.
 * 미인증 감지 시(onRequireAuth) 로그인 플로우로 이동.
 *
 * 주의: SPEC-NAV-001 은 bookId 파라미터 수신까지만 보증했으나,
 * SPEC-BOOK-001 M4-3 의 BookDetailScreen 구현체를 연결한다.
 */
import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BookDetailScreen } from '../../src/features/book/BookDetailScreen';

export default function BookDetailRoute() {
  const { bookId } = useLocalSearchParams<{ bookId: string }>();
  const router = useRouter();

  return (
    <BookDetailScreen
      bookId={bookId}
      onRequireAuth={() => router.replace('/(auth)/login')}
      // SPEC-LIBRARY-001 evaluator FINDING-1: 삭제 성공 시 이전 화면(검색/서재)으로 복귀 (AC-LIB-007/008)
      onDeleted={() => router.back()}
    />
  );
}
