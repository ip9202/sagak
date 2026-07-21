/**
 * useLibraryItem 훅 (SPEC-LIBRARY-001 TASK-010)
 *
 * bookId 로 단일 user_books 항목을 조회한다. BookDetailScreen 확장이 소비한다.
 * - 서재 미등록 책(0행): data = null (에러 아님 — UI 에서 "서재에 추가" CTA)
 * - queryKey: ['library-item', { bookId, userId }]
 *
 * @MX:NOTE: [AUTO] 상세 화면 서재 섹션 단일 항목 조회 진입점. 직접 진입 경로(search → /book/<id>) 지원.
 * @MX:SPEC SPEC-LIBRARY-001
 */
import { useQuery } from '@tanstack/react-query';
import { getLibraryItem } from './libraryApi';
import type { LibraryItem } from './types';

export interface UseLibraryItemArgs {
  bookId: string;
  userId: string;
}

/**
 * bookId 로 서재 항목을 조회한다.
 *
 * @param args.bookId - books.id (UUID)
 * @param args.userId - 사용자 ID (빈 문자열/빈 bookId 시 비활성화)
 * @returns LibraryItem | null (null = 서재 미등록)
 */
export function useLibraryItem(args: UseLibraryItemArgs) {
  return useQuery<LibraryItem | null>({
    queryKey: ['library-item', { bookId: args.bookId, userId: args.userId }],
    queryFn: () => getLibraryItem(args.bookId, args.userId),
    enabled: args.userId.length > 0 && args.bookId.length > 0,
  });
}
