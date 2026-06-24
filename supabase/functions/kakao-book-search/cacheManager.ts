/**
 * books 테이블 캐시 관리 (REQ-BOOK-010, REQ-BOOK-011, 시나리오 S13/S14/S18)
 *
 * Supabase 클라이언트를 의존성 주입받아 캐시 히트 조회 및 업서트를 수행한다.
 * 본 모듈은 Deno 글로벌에 의존하지 않으며, index.ts 가 service_role 클라이언트를 주입한다.
 *
 * @MX:NOTE: [AUTO] service_role 클라이언트는 RLS 를 우회한다 — 캐시 쓰기 권한 확보.
 * @MX:NOTE: [AUTO] 업서트는 단일 배치 호출(PostgREST .upsert(rows[]))로 N+1 쿼리를 방지한다.
 */
import type { BookUpsertRow } from './mapper.ts';

/** SELECT 빌더 체인(select → eq → single) */
interface SelectBuilder {
  eq(column: string, value: string): SingleBuilder;
}
/** upsert 빌더 체인(upsert → select → 결과 배열) */
interface UpsertBuilder {
  select(columns?: string): Promise<{ data: BookCacheRow[] | null; error: unknown }>;
}
/** 단일 행 결과(single) 호출 가능한 빌더 */
interface SingleBuilder {
  single(): Promise<{ data: BookCacheRow | null; error: unknown }>;
}

/**
 * Supabase 클라이언트 최소 계약(의존성 주입용).
 * supabase-js 의 전체 타입 대신 사용하는 필수 메서드만 노출한다.
 * 테스트에서 jest.Mocked 로 감싸 검증 가능하다.
 */
export interface SupabaseClientLike {
  from(table: string): {
    select(columns?: string): SelectBuilder;
    upsert(
      rows: BookUpsertRow | BookUpsertRow[],
      opts?: { onConflict?: string }
    ): UpsertBuilder;
  };
}

/** 캐시 조회/업서트 결과 행 타입 (books SELECT 결과) */
export interface BookCacheRow {
  id: string;
  isbn: string;
  title: string;
  author: string;
  publisher: string | null;
  published_at: string | null;
  cover_url: string | null;
  total_pages: number | null;
  kakao_id: string | null;
  created_at: string;
}

/**
 * REQ-BOOK-010: ISBN 으로 캐시된 books 행을 조회한다 (시나리오 S13).
 *
 * 캐시 히트 시 books 행을 반환하고, 미스(0행 또는 에러) 시 null 을 반환한다.
 * 에러는 캐시 미스로 취급해 Kakao API 호출 폴백을 허용한다.
 *
 * @param client - service_role Supabase 클라이언트 (RLS 우회)
 * @param isbn - 조회할 ISBN
 * @returns 캐시된 books 행 또는 null
 */
export async function findCachedBook(
  client: SupabaseClientLike,
  isbn: string
): Promise<BookCacheRow | null> {
  try {
    const builder = client.from('books');
    const result = await builder.select('*').eq('isbn', isbn).single();
    if (result.error || !result.data) {
      return null;
    }
    return result.data;
  } catch {
    // 에러는 캐시 미스로 취급 (Kakao API 폴백 허용)
    return null;
  }
}

/**
 * REQ-BOOK-011: books 테이블에 다수 행을 단일 배치 upsert 한다 (시나리오 S14, S18).
 *
 * ON CONFLICT (isbn) DO UPDATE — UNIQUE isbn 제약으로 동일 도서 중복 등록을 방지한다.
 * PostgREST .upsert(rows[]) 단일 호출로 N+1 순차 쿼리를 방지한다.
 *
 * @MX:WARN: [AUTO] service_role 클라이언트로 RLS 우회 후 쓰기 수행
 * @MX:REASON: Edge Function 만 service_role 키를 가져야 하며, 클라이언트는 anon + SELECT 만 허용된다 (REQ-BOOK-002).
 *
 * @param client - service_role Supabase 클라이언트
 * @param rows - upsert 입력 행 배열 (빈 배열이면 no-op)
 * @returns upsert 된 books 행 배열
 * @throws 업서트 에러 시
 */
export async function upsertBooks(
  client: SupabaseClientLike,
  rows: BookUpsertRow[]
): Promise<BookCacheRow[]> {
  if (rows.length === 0) {
    return [];
  }
  const result = await client
    .from('books')
    .upsert(rows, { onConflict: 'isbn' })
    .select();

  if (result.error || !result.data) {
    const err = result.error as { message?: string } | undefined;
    throw new Error(err?.message ?? 'upsert failed');
  }
  return result.data;
}
