/**
 * Library 도메인 타입 정의 (SPEC-LIBRARY-001)
 *
 * gen-types 기반 user_books + books 조인 결과의 타입을 정의한다.
 * ReadingStatus 등 도메인 리터럴은 DB 의 text 컬럼을 좁은 타입으로 표현한다.
 */
import type { Database } from '../../types/supabase';

// @MX:NOTE: [AUTO] user_books.Row 의 status 는 DB text 컬럼이지만, 도메인에서는 3가지 리터럴만 허용. 스키마 CHECK 제약이 없으므로 앱 단에서 좁힌다.
// @MX:SPEC SPEC-LIBRARY-001
/** 서재 항목의 읽기 상태 (DB status 컬럼과 매핑) */
export type ReadingStatus = 'reading' | 'completed' | 'shelved';

/** user_books.Row (gen-types) */
export type UserBookRow = Database['public']['Tables']['user_books']['Row'];

/** books.Row (gen-types) — 서재 조인용 */
export type BookJoinedRow = Pick<
  Database['public']['Tables']['books']['Row'],
  'id' | 'title' | 'author' | 'cover_url' | 'total_pages'
>;

/**
 * 서재 목록의 단일 항목 — user_books 행 + 중첩 books 정보.
 * PostgREST 조인 결과의 books 필드는 단일 객체(1:1) 이다.
 */
export interface LibraryItem extends UserBookRow {
  books: BookJoinedRow | null;
}

/**
 * getLibrary 호출의 필터 옵션.
 * - userId: 필수 (RLS 보조 필터)
 * - status: 선택 (reading/completed/shelved)
 */
export interface LibraryFilter {
  userId: string;
  status?: ReadingStatus;
}

/** addBook 입력 — book_id 와 user_id 만 필수, status 는 기본 reading */
export interface AddBookInput {
  bookId: string;
  userId: string;
  status?: ReadingStatus;
}

/** updateProgress 입력 — current_page 만 전달 (last_progress_at 은 DB 트리거 관리) */
export interface ProgressUpdate {
  id: string;
  userId: string;
  currentPage: number;
}

/** updateStatus 입력 */
export interface StatusUpdate {
  id: string;
  userId: string;
  status: ReadingStatus;
}

/** updateVisibility 입력 */
export interface VisibilityUpdate {
  id: string;
  userId: string;
  isPublic: boolean;
}

/** deleteBook 입력 — id + userId 복합 조건 (RLS 보조) */
export interface DeleteBookInput {
  id: string;
  userId: string;
}
