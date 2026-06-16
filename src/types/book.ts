/**
 * Book 도메인 타입 (SPEC-BOOK-001)
 *
 * REQ-BOOK-003: Kakao 응답 정규화 스키마 → SearchResult
 * REQ-BOOK-012: books 테이블 컬럼 매핑 → BookRow
 * REQ-BOOK-015: 검색 타겟 → SearchTarget
 *
 * 주의: src/types/index.ts 의 기존 Book 타입은 다른 도메인(emotion record) 소속이며
 * 본 SPEC 범위 밖이므로 수정하지 않는다 (scope discipline).
 * 본 파일은 books 마이그레이션(20240614000002_create_books.sql) 컬럼을 직접 미러링한다.
 */

/**
 * REQ-BOOK-003: Kakao 응답 정규화 스키마 (Edge Function → 클라이언트 계약)
 *
 * Edge Function(kakao-book-search)이 Kakao documents[] 를 정규화해 반환하는 형태.
 * - title, authors, isbn: 필수 (누락 시 Edge Function 에서 제외)
 * - 나머지: null 허용
 *
 * @MX:NOTE: [AUTO] authors 는 배열을 유지한다 — 클라이언트 UI(저자 목록 렌더링) 계약.
 */
export interface SearchResult {
  /** 도서 제목 (필수) */
  title: string;
  /** 저자 배열 (필수, 배열 유지) */
  authors: string[];
  /** 출판사 (null 허용) */
  publisher: string | null;
  /** 출판일 ISO 날짜(YYYY-MM-DD, null 허용) — Kakao datetime → date 변환 */
  published_at: string | null;
  /** 표지 URL (null 허용) */
  cover_url: string | null;
  /** ISBN (필수) — Kakao isbn 필드는 공백 구분일 수 있어 첫 값 사용 */
  isbn: string;
  /** Kakao 도서 ID (null 허용) */
  kakao_id: string | null;
  /** 총 페이지 수 (null 허용) */
  total_pages: number | null;
}

/**
 * REQ-BOOK-012: books 테이블 Row 타입 (마이그레이션 20240614000002 미러링)
 *
 * 클라이언트가 PostgREST SELECT 로 읽는 books 행 형태.
 * 주의: author 는 단일 문자열(authors 를 ', ' 로 join 한 값)이다.
 * Edge Function mapper 에서만 authors → author join 이 일어난다.
 */
export interface BookRow {
  /** PK UUID */
  id: string;
  /** ISBN (UNIQUE, NOT NULL) */
  isbn: string;
  /** 제목 (NOT NULL) */
  title: string;
  /** 저자 (NOT NULL, 단일 문자열 — authors join 결과) */
  author: string;
  /** 출판사 (nullable) */
  publisher: string | null;
  /** 출판일 date (nullable, YYYY-MM-DD) */
  published_at: string | null;
  /** 표지 URL (nullable) */
  cover_url: string | null;
  /** 총 페이지 수 (nullable) */
  total_pages: number | null;
  /** Kakao 도서 ID (nullable) */
  kakao_id: string | null;
  /** 생성 시각 timestamptz (NOT NULL) */
  created_at: string;
}

/**
 * REQ-BOOK-015: 도서 검색 타겟
 * - title: 제목 검색
 * - author: 저자 검색
 * - isbn: ISBN 검색 (바코드 스캔 자동 전환)
 */
export type SearchTarget = 'title' | 'author' | 'isbn';

// --- 런타임 타입 가드 (defensive parsing, Zod 미사용) ---

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

/**
 * SearchResult 타입 가드 (REQ-BOOK-003)
 * 필수 필드 title(string), authors(string[]), isbn(string) 검증.
 */
export function isSearchResult(value: unknown): value is SearchResult {
  if (!isObject(value)) return false;
  return (
    typeof value.title === 'string' &&
    isStringArray(value.authors) &&
    typeof value.isbn === 'string'
  );
}

/**
 * BookRow 타입 가드 (REQ-BOOK-012)
 * 필수 필드 id, isbn, title, author, created_at 검증.
 */
export function isBookRow(value: unknown): value is BookRow {
  if (!isObject(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.isbn === 'string' &&
    typeof value.title === 'string' &&
    typeof value.author === 'string' &&
    typeof value.created_at === 'string'
  );
}

/**
 * SearchTarget 타입 가드 (REQ-BOOK-015)
 */
export function isSearchTarget(value: unknown): value is SearchTarget {
  return value === 'title' || value === 'author' || value === 'isbn';
}
