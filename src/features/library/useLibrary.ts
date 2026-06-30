/**
 * useLibrary 훅 (SPEC-LIBRARY-001 TASK-007 + TASK-008)
 *
 * 조회(useLibrary) + mutation(useUpdateProgress/Status/Visibility, useDeleteBook).
 * - userId 가 비어 있으면 쿼리를 비활성화한다 (enabled: false)
 * - status 필터를 getLibrary 에 그대로 전달한다
 * - 정렬(last_progress_at DESC, 정책 5.2) 은 getLibrary 가 DB order 로 담당한다
 *
 * queryKey: ['library', { userId, status }] — status 별로 캐시를 분리한다.
 *
 * mutation (REQ-LIB-013):
 * - onMutate: 캐시 optimistic 갱신 (이전값 스냅샷 저장)
 * - onError: 스냅샷으로 롤백
 * - onSuccess: invalidateQueries 로 서버 정합성 보정
 *
 * @MX:NOTE: [AUTO] 서재 조회/뮤테이션 캐싱/로딩/에러/optimistic 상태의 단일 진입점. LibraryScreen(LIBRARY) 과 BookDetail 의 서재 섹션 확장(BOOK) 이 소비한다.
 * @MX:SPEC SPEC-LIBRARY-001
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addBook,
  deleteBook,
  getLibrary,
  updateProgress,
  updateStatus,
  updateVisibility,
} from './libraryApi';
import type { AddBookInput, LibraryFilter, LibraryItem, ReadingStatus } from './types';

// @MX:ANCHOR: [AUTO] useLibrary 계열 — 서재 목록 조회/뮤테이션 공개 훅 (fan_in >= 2: LibraryScreen, BookDetail 확장)
// @MX:REASON: 서재 탭 화면과 상세 화면의 서재 섹션이 모두 이 훅에 의존하며, queryKey/필터 계약이 바뀌면 두 화면의 캐시 일관성이 깨진다.
export interface UseLibraryArgs {
  userId: string;
  status?: LibraryFilter['status'];
}

/** library 쿼리키 접두부 — status 무관하게 모든 서재 캐시 매칭용 */
function libraryRootKey(userId: string): readonly unknown[] {
  return ['library', { userId }];
}

/**
 * 서재 목록을 조회한다.
 *
 * @param args.userId - 사용자 ID (빈 문자열이면 쿼리 비활성화)
 * @param args.status - 읽기 상태 필터 (reading/completed/shelved). 생략 시 전체.
 */
export function useLibrary(args: UseLibraryArgs) {
  return useQuery<LibraryItem[]>({
    queryKey: ['library', { userId: args.userId, status: args.status }],
    queryFn: () => getLibrary({ userId: args.userId, status: args.status }),
    enabled: args.userId.length > 0,
  });
}

// ---------------------------------------------------------------------------
// TASK-008: Mutation hooks (optimistic update / rollback)
// ---------------------------------------------------------------------------

/**
 * 캐시에서 특정 user_books.id 항목을 발견하면 updater 로 갱신한다.
 * status 무관 매칭을 위해 queryKey prefix 로 순회한다.
 */
function mutateCachedItem(
  qc: ReturnType<typeof useQueryClient>,
  userId: string,
  itemId: string,
  updater: (item: LibraryItem) => LibraryItem,
): { previousSnapshots: Map<string, LibraryItem[]> } {
  const previousSnapshots = new Map<string, LibraryItem[]>();
  const cache = qc.getQueriesData<LibraryItem[]>({
    queryKey: libraryRootKey(userId),
  });
  for (const [key, value] of cache) {
    if (!value) continue;
    const keyStr = JSON.stringify(key);
    previousSnapshots.set(keyStr, value);
    const next = value.map((it) =>
      it.id === itemId ? updater(it) : it,
    );
    qc.setQueryData(key, next);
  }
  return { previousSnapshots };
}

/**
 * 스냅샷을 기반으로 캐시를 복원한다 (onError).
 */
function rollbackSnapshots(
  qc: ReturnType<typeof useQueryClient>,
  userId: string,
  snapshots: Map<string, LibraryItem[]>,
): void {
  const cache = qc.getQueriesData<LibraryItem[]>({
    queryKey: libraryRootKey(userId),
  });
  for (const [key] of cache) {
    const keyStr = JSON.stringify(key);
    const prev = snapshots.get(keyStr);
    if (prev !== undefined) {
      qc.setQueryData(key, prev);
    }
  }
}

/** 서재 캐시 전체를 무효화한다 (onSuccess 정합성 보정). */
function invalidateLibrary(
  qc: ReturnType<typeof useQueryClient>,
  userId: string,
): void {
  // 서재 목록 캐시 (status 무관 전체)
  qc.invalidateQueries({ queryKey: libraryRootKey(userId) });
  // @MX:NOTE: [AUTO] 단일 항목 캐시(useLibraryItem, queryKey ['library-item', ...]) 도 같이
  //           무효화 — BookDetailScreen 의 status/progress/visibility mutation 이 성공한 뒤
  //           libraryItem 이 refetch 되어 chip 활성 전환/진행률 갱신이 즉시 반영되려면 필수.
  //           bookId 무관 prefix 매칭으로 모든 library-item 쿼리를 무효화한다.
  qc.invalidateQueries({ queryKey: ['library-item'] });
}

export interface UseUpdateProgressArgs {
  userId: string;
}

/** useUpdateProgress mutate 입력. totalPages 는 ceiling 검증용 (선택). */
export interface UpdateProgressMutationInput {
  id: string;
  currentPage: number;
  totalPages?: number;
}

/**
 * 현재 페이지 갱신 mutation (REQ-LIB-013).
 * onMutate: current_page optimistic 갱신. onError: 롤백. onSuccess: invalidate.
 */
export function useUpdateProgress(args: UseUpdateProgressArgs) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateProgressMutationInput) =>
      updateProgress({
        id: input.id,
        userId: args.userId,
        currentPage: input.currentPage,
        totalPages: input.totalPages ?? null,
      }),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: libraryRootKey(args.userId) });
      const snapshot = mutateCachedItem(
        qc,
        args.userId,
        input.id,
        (it) => ({ ...it, current_page: input.currentPage }),
      );
      return snapshot;
    },
    onError: (_err, _input, context) => {
      if (context?.previousSnapshots) {
        rollbackSnapshots(qc, args.userId, context.previousSnapshots);
      }
    },
    onSuccess: () => {
      invalidateLibrary(qc, args.userId);
    },
  });
}

export interface UseUpdateStatusArgs {
  userId: string;
}
export interface UpdateStatusMutationInput {
  id: string;
  status: ReadingStatus;
}

/**
 * 읽기 상태 갱신 mutation. optimistic 갱신 + 롤백 + invalidate.
 */
export function useUpdateStatus(args: UseUpdateStatusArgs) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateStatusMutationInput) =>
      updateStatus({
        id: input.id,
        userId: args.userId,
        status: input.status,
      }),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: libraryRootKey(args.userId) });
      const snapshot = mutateCachedItem(
        qc,
        args.userId,
        input.id,
        (it) => ({ ...it, status: input.status }),
      );
      return snapshot;
    },
    onError: (_err, _input, context) => {
      if (context?.previousSnapshots) {
        rollbackSnapshots(qc, args.userId, context.previousSnapshots);
      }
    },
    onSuccess: () => {
      invalidateLibrary(qc, args.userId);
    },
  });
}

export interface UseUpdateVisibilityArgs {
  userId: string;
}
export interface UpdateVisibilityMutationInput {
  id: string;
  isPublic: boolean;
}

/**
 * 공개 여부 갱신 mutation. optimistic 갱신 + 롤백 + invalidate.
 */
export function useUpdateVisibility(args: UseUpdateVisibilityArgs) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateVisibilityMutationInput) =>
      updateVisibility({
        id: input.id,
        userId: args.userId,
        isPublic: input.isPublic,
      }),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: libraryRootKey(args.userId) });
      const snapshot = mutateCachedItem(
        qc,
        args.userId,
        input.id,
        (it) => ({ ...it, is_public: input.isPublic }),
      );
      return snapshot;
    },
    onError: (_err, _input, context) => {
      if (context?.previousSnapshots) {
        rollbackSnapshots(qc, args.userId, context.previousSnapshots);
      }
    },
    onSuccess: () => {
      invalidateLibrary(qc, args.userId);
    },
  });
}

export interface UseAddBookArgs {
  userId: string;
}
export interface AddBookMutationInput {
  bookId: string;
  status?: ReadingStatus;
}

/**
 * 서재에 책 추가 mutation (REQ-LIB-001 / REQ-LIB-002).
 * - 기본 status='shelved' (정책 5.5 — reading 단일), current_page=0, is_public=true (DB default 의존)
 * - UNIQUE(user_id, book_id) 위반 → AppError category='VALIDATION', code='23505'
 *   (libraryApi.addBook → normalizeError → classifyError 경유, HTTP 409 아님에 주의)
 *
 * onSuccess: 서재 목록 + 단일 항목 캐시 모두 무효화.
 * optimistic update 는 신규 항목이라 캐시에 예상 데이터가 없어 생략.
 *
 * @MX:NOTE: [AUTO] invalidate 대상에 ['library-item', { bookId, userId }] 포함 — BookDetailScreen 의 useLibraryItem 이 이 키로 재조회해 미등록 → 등록으로 UI 전환.
 * @MX:SPEC SPEC-LIBRARY-001
 */
export function useAddBook(args: UseAddBookArgs) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AddBookMutationInput) =>
      addBook({
        bookId: input.bookId,
        userId: args.userId,
        status: input.status,
      } satisfies AddBookInput),
    onSuccess: (_data, input) => {
      // 서재 목록 캐시 (status 무관 전체)
      invalidateLibrary(qc, args.userId);
      // 단일 항목 캐시 — useLibraryItem queryKey 와 동일 구조
      qc.invalidateQueries({
        queryKey: ['library-item', { bookId: input.bookId, userId: args.userId }],
      });
    },
  });
}

export interface UseDeleteBookArgs {
  userId: string;
}
export interface DeleteBookMutationInput {
  id: string;
}

/**
 * 서재 항목 삭제 mutation (정책 5.3: 자식 데이터 FK RESTRICT 시 서버가 차단).
 * onMutate: optimistic 으로 캐시에서 항목 제거. onError: 롤백 복원. onSuccess: invalidate.
 */
export function useDeleteBook(args: UseDeleteBookArgs) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: DeleteBookMutationInput) =>
      deleteBook({ id: input.id, userId: args.userId }),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: libraryRootKey(args.userId) });
      const previousSnapshots = new Map<string, LibraryItem[]>();
      const cache = qc.getQueriesData<LibraryItem[]>({
        queryKey: libraryRootKey(args.userId),
      });
      for (const [key, value] of cache) {
        if (!value) continue;
        const keyStr = JSON.stringify(key);
        previousSnapshots.set(keyStr, value);
        qc.setQueryData(
          key,
          value.filter((it) => it.id !== input.id),
        );
      }
      return { previousSnapshots };
    },
    onError: (_err, _input, context) => {
      if (context?.previousSnapshots) {
        rollbackSnapshots(qc, args.userId, context.previousSnapshots);
      }
    },
    onSuccess: () => {
      invalidateLibrary(qc, args.userId);
    },
  });
}
