/**
 * useLibraryItem 훅 (SPEC-LIBRARY-001 TASK-010)
 *
 * bookId 로 단일 user_books 항목을 조회한다. BookDetailScreen 확장이 소비한다.
 * - 서재 미등록 책(0행): data = null (에러 아님 — UI 에서 "서재에 추가" CTA)
 * - queryKey: libraryRootKey(userId) 하위 ['library', { userId }, 'item', bookId]
 *
 * @MX:NOTE: [AUTO] libraryRootKey 접두사 공유 — mutateCachedItem(optimistic)과
 *           invalidateLibrary 가 목록 + 단일 항목 캐시를 동일 경로로 갱신/무효화.
 *           SPEC-LIBRARY-002 regression: 접두사 불일치 시 stale 단일 항목 캐시로
 *           감정 기록 페이지가 0 으로 리셋되는 버그 방지.
 * @MX:SPEC SPEC-LIBRARY-001
 */
import { useQuery } from '@tanstack/react-query';
import { getLibraryItem } from './libraryApi';
import { libraryRootKey } from './useLibrary';
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
    // libraryRootKey(userId) 접두사 공유 — 서재 뮤테이션의 optimistic/invalidate 대상에 포함.
    // 구조: ['library', { userId }, 'item', bookId]
    queryKey: [...libraryRootKey(args.userId), 'item', args.bookId],
    queryFn: () => getLibraryItem(args.bookId, args.userId),
    enabled: args.userId.length > 0 && args.bookId.length > 0,
  });
}
