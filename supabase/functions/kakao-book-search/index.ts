// @MX:NOTE: [AUTO] 본 파일만 Deno 글로벌(Deno.env, Deno.serve)을 사용한다.
//           순수 모듈(normalizer/mapper/cacheManager/kakaoClient)은 Deno 글로벌 프리.
/**
 * kakao-book-search Edge Function 엔트리 (REQ-BOOK-001~005, 010~012)
 *
 * 흐름:
 *  1. 요청 본문 파싱(query/target) → 빈 쿼리 차단 (REQ-BOOK-005)
 *  2. KAKAO_REST_API_KEY 검증 (REQ-BOOK-002)
 *  3. 캐시 히트 조회(REQ-BOOK-010) → 히트 시 Kakao API 생략
 *  4. 캐시 미스 시 Kakao API 호출(REQ-BOOK-001) + 업서트(REQ-BOOK-011)
 *  5. 정규화(REQ-BOOK-003) 후 { data } 또는 { error, code }(REQ-BOOK-004) 응답
 */
import { normalizeKakaoDocuments, type NormalizedBook } from './normalizer.ts';
import { mapToBookRow } from './mapper.ts';
import {
  findCachedBook,
  upsertBooks,
  type SupabaseClientLike,
  type BookCacheRow,
} from './cacheManager.ts';
import { searchKakaoBooks, type KakaoSearchResponse } from './kakaoClient.ts';

/**
 * handleSearchRequest 의존성 주입 인터페이스 (테스트 가능성).
 * index.ts Deno 셸이 구현체를 주입한다.
 */
export interface SearchDeps {
  getEnv(key: string): string | undefined;
  // @MX:NOTE: [AUTO] createServiceClient 는 async — supabase-js 동적 import 로 인해 Promise 반환.
  createServiceClient(): Promise<SupabaseClientLike>;
  searchKakao(params: {
    query: string;
    target: 'title' | 'author' | 'isbn';
    apiKey: string;
  }): Promise<KakaoSearchResponse>;
  findCachedBook(
    client: SupabaseClientLike,
    isbn: string
  ): Promise<BookCacheRow | null>;
  upsertBooks(
    client: SupabaseClientLike,
    rows: ReturnType<typeof mapToBookRow>[]
  ): Promise<BookCacheRow[]>;
}

/** 성공 응답 형태 (REQ-BOOK-003 계약) */
interface SearchSuccessResponse {
  ok: true;
  body: { data: NormalizedBook[] };
}

/** 에러 응답 형태 (REQ-BOOK-004 계약) */
interface SearchErrorResponse {
  ok: false;
  body: { error: string; code: string };
}

/** 핸들러 반환 타입 */
type SearchHandlerResult = SearchSuccessResponse | SearchErrorResponse;

/** 요청 본문 형태 */
export interface SearchRequestBody {
  query: string;
  target: 'title' | 'author' | 'isbn';
}

/**
 * 캐시 행을 클라이언트 SearchResult(NormalizedBook) 형태로 역변환.
 * books.author(단일 문자열) → authors(배열) 분할.
 * @MX:NOTE: [AUTO] author 문자열을 ', ' 로 분할해 authors 배열로 복원 — 클라이언트 계약 유지.
 */
function cacheRowToSearchResult(row: BookCacheRow): NormalizedBook {
  return {
    title: row.title,
    authors: row.author.split(', '),
    publisher: row.publisher,
    published_at: row.published_at,
    cover_url: row.cover_url,
    isbn: row.isbn,
    kakao_id: row.kakao_id,
    total_pages: row.total_pages,
  };
}

/**
 * REQ-BOOK-001~005, 010~012: 검색 요청 핵심 핸들러 (Deno 글로벌 프리, 의존성 주입).
 *
 * 본 함수는 index.ts Deno 셸과 단위 테스트 양쪽에서 호출된다.
 *
 * @param requestBody - { query, target }
 * @param deps - 주입된 의존성 (env, 클라이언트, Kakao 호출, 캐시)
 * @returns 성공 시 { ok: true, body: { data } }, 에러 시 { ok: false, body: { error, code } }
 */
export async function handleSearchRequest(
  requestBody: SearchRequestBody,
  deps: SearchDeps
): Promise<SearchHandlerResult> {
  const query = (requestBody?.query ?? '').trim();
  const target = requestBody?.target ?? 'title';

  // REQ-BOOK-005: 빈/공백 쿼리 차단
  if (query.length === 0) {
    return {
      ok: false,
      body: {
        error: '검색어를 입력해 주세요',
        code: 'VALIDATION_ERROR',
      },
    };
  }

  // REQ-BOOK-002: API 키 검증
  const apiKey = deps.getEnv('KAKAO_REST_API_KEY');
  if (!apiKey) {
    return {
      ok: false,
      body: {
        error: '서버 설정 오류: API 키가 누락되었습니다',
        code: 'MISSING_API_KEY',
      },
    };
  }

  // @MX:NOTE: [AUTO] createServiceClient 는 동적 import(supabase-js)를 수반해 async — await 필요.
  const client = await deps.createServiceClient();

  // target=isbn 인 경우 캐시 히트 우선 조회 (REQ-BOOK-010)
  if (target === 'isbn') {
    const cached = await deps.findCachedBook(client, query);
    if (cached) {
      // @MX:NOTE: [AUTO] 캐시 히트 — Kakao API 호출 생략 (시나리오 S13)
      return {
        ok: true,
        body: { data: [cacheRowToSearchResult(cached)] },
      };
    }
  }

  // 캐시 미스 → Kakao API 호출 (REQ-BOOK-001)
  let kakaoResponse: KakaoSearchResponse;
  try {
    kakaoResponse = await deps.searchKakao({ query, target, apiKey });
  } catch (error) {
    // REQ-BOOK-004: 구조화 에러 응답 (시나리오 S4)
    const errCode =
      (error as { code?: string })?.code ?? 'KAKAO_API_ERROR';
    const errMsg =
      (error as { message?: string })?.message ??
      '도서 검색 중 오류가 발생했습니다';
    return {
      ok: false,
      body: { error: errMsg, code: errCode },
    };
  }

  // 정규화 (REQ-BOOK-003)
  const normalized = normalizeKakaoDocuments(kakaoResponse.documents);

  // 빈 결과 허용 (REQ-BOOK-016, 시나리오 S21)
  if (normalized.length === 0) {
    return { ok: true, body: { data: [] } };
  }

  // 캐시 미스 시 업서트 (REQ-BOOK-011) — service_role, 단일 배치, ON CONFLICT (isbn)
  try {
    const rows = normalized.map(mapToBookRow);
    await deps.upsertBooks(client, rows);
  } catch {
    // 업서트 실패는 검색 결과 반환에 영향을 주지 않는다 (캐시 쓰기는 베스트에포트).
    // 사용자에게는 정규화된 검색 결과를 그대로 반환한다.
  }

  return { ok: true, body: { data: normalized } };
}

// ---------------------------------------------------------------------------
// Deno 서빙 셸 (Deno 환경에서만 활성화, jest 에서는 no-op)
// ---------------------------------------------------------------------------

/**
 * Deno 글로벌 존재 여부 확인 (jest 환경 분기용).
 */
function isDenoEnvironment(): boolean {
  return typeof (globalThis as { Deno?: unknown }).Deno !== 'undefined';
}

/**
 * Deno 환경에서만 Edge Function 서빙을 시작한다.
 * jest 환경에서는 Deno 글로벌이 없으므로 no-op.
 */
if (isDenoEnvironment()) {
  // Deno 글로벌을 unknown → 타겟 타입으로 안전 캐스팅 (jest 환경에서는 미실행)
  const DenoGlobal = (globalThis as unknown as {
    Deno: {
      env: { get(key: string): string | undefined };
      serve(handler: (req: Request) => Promise<Response>): void;
    };
  }).Deno;

  DenoGlobal.serve(async (req: Request): Promise<Response> => {
    const deps: SearchDeps = {
      getEnv: (key: string) => DenoGlobal.env.get(key),
      createServiceClient: async () => {
        // service_role 클라이언트 생성 (RLS 우회)
        // @MX:WARN: [AUTO] SUPABASE_SERVICE_ROLE_KEY 사용 — 클라이언트 노출 금지 (REQ-BOOK-002)
        // @MX:REASON: 캐시 쓰기(upsert)는 RLS 를 우회해야 하므로 service_role 필수. anon 키로는 INSERT 권한 없음.
        const supabaseUrl = DenoGlobal.env.get('SUPABASE_URL') ?? '';
        const serviceRoleKey = DenoGlobal.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
        return createServiceRoleClient(supabaseUrl, serviceRoleKey);
      },
      searchKakao: searchKakaoBooks,
      findCachedBook,
      upsertBooks,
    };

    let body: SearchRequestBody;
    try {
      body = (await req.json()) as SearchRequestBody;
    } catch {
      return new Response(
        JSON.stringify({ error: '잘못된 요청 본문', code: 'BAD_REQUEST' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const result = await handleSearchRequest(body, deps);

    if (result.ok) {
      return new Response(JSON.stringify(result.body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify(result.body), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  });
}

/**
 * service_role Supabase 클라이언트 생성 (Deno 환경 전용).
 *
 * supabase-js 를 동적 import 해 클라이언트 번들에 포함되지 않도록 한다 (memory lesson #16).
 * jest 환경에서는 호출되지 않는다 — Deno.serve 셸 내에서만 실행.
 *
 * @MX:WARN: [AUTO] service_role 키로 RLS 우회 클라이언트 생성 — 키 절대 로깅 금지.
 * @MX:REASON: anon 키로는 books INSERT 권한이 없다 (REQ-DB-013b). Edge Function 만 service_role 키를 보유해야 한다.
 *
 * @param url - Supabase 프로젝트 URL
 * @param serviceRoleKey - service_role 키 (RLS 우회)
 * @returns supabase-js 클라이언트 (SupabaseClientLike 로 캐스팅)
 * @throws URL 또는 키가 비어 있을 때
 */
async function createServiceRoleClient(
  url: string,
  serviceRoleKey: string
): Promise<SupabaseClientLike> {
  if (!url || !serviceRoleKey) {
    throw new Error(
      'SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 가 설정되지 않았습니다'
    );
  }

  // 동적 import — 정적 import 시 클라이언트 번들에 supabase-js 가 포함된다 (lesson #16).
  // deno.json importMap 이 @supabase/supabase-js → esm.sh 매핑을 제공한다.
  const { createClient } = await import('@supabase/supabase-js');

  // supabase-js 클라이언트를 최소 계약(SupabaseClientLike)으로 안전 캐스팅.
  // 전체 타입을 캐시 매니저에 노출하지 않기 위해 SupabaseClientLike 사용.
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  }) as unknown as SupabaseClientLike;
}
