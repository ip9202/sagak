/**
 * Kakao Book Search API 클라이언트 (REQ-BOOK-001, REQ-BOOK-002, REQ-BOOK-004)
 *
 * Kakao dapi.kakao.com/v3/search/book 엔드포인트 호출 래퍼.
 * 본 모듈은 Deno 글로벌에 의존하지 않는다 — API 키는 파라미터로 주입받아
 * index.ts 만 Deno.env 를 읽도록 한다 (테스트 가능성).
 *
 * @MX:WARN: [AUTO] Kakao REST API 키는 Edge Function 환경 변수로만 존재한다.
 * @MX:REASON: 클라이언트 번들에 키가 노출되면 REQ-BOOK-002 위반 — 반드시 index.ts 에서 Deno.env 로 읽어 주입.
 */
import type { KakaoDocument } from './normalizer';

/** Kakao Book Search API 엔드포인트 */
const KAKAO_BOOK_SEARCH_URL = 'https://dapi.kakao.com/v3/search/book';

/** 기본 타임아웃 (ms) */
const DEFAULT_TIMEOUT_MS = 8000;

/**
 * Kakao Book Search API 응답 형태 (사용 필드만).
 */
export interface KakaoSearchResponse {
  documents: KakaoDocument[];
  meta?: {
    total_count?: number;
    pageable_count?: number;
    is_end?: boolean;
  };
}

/**
 * kakaoClient 구조화 에러. index.ts 가 { error, code } 응답으로 변환한다.
 */
export class KakaoClientError extends Error {
  code: string;
  statusCode: number;
  constructor(message: string, code: string, statusCode: number) {
    super(message);
    this.name = 'KakaoClientError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

/** searchKakaoBooks 입력 파라미터 */
export interface SearchKakaoBooksParams {
  query: string;
  target: 'title' | 'author' | 'isbn';
  apiKey: string;
  timeoutMs?: number;
}

/**
 * REQ-BOOK-001/002: Kakao Book Search API 호출.
 *
 * Authorization: KakaoAK <key> 헤더로 인증하며, 4xx/5xx/타임아웃/네트워크 에러를
 * 구조화 KakaoClientError 로 변환한다 (REQ-BOOK-004, 시나리오 S4).
 *
 * @MX:NOTE: [AUTO] timeout 은 AbortController 로 구현 — fetch hang 방지.
 *
 * @returns Kakao API 응답(documents 포함)
 * @throws {KakaoClientError} API/타임아웃/네트워크 에러
 */
export async function searchKakaoBooks(
  params: SearchKakaoBooksParams
): Promise<KakaoSearchResponse> {
  const { query, target, apiKey, timeoutMs = DEFAULT_TIMEOUT_MS } = params;

  const url = new URL(KAKAO_BOOK_SEARCH_URL);
  url.searchParams.set('query', query);
  url.searchParams.set('target', target);

  // AbortController 로 타임아웃 구현
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `KakaoAK ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timeoutId);
    // AbortError → 타임아웃
    if (error instanceof Error && error.name === 'AbortError') {
      throw new KakaoClientError(
        'Kakao API 요청 시간 초과',
        'KAKAO_TIMEOUT',
        408
      );
    }
    // 그외 네트워크 장애
    throw new KakaoClientError(
      'Kakao API 네트워크 오류',
      'KAKAO_NETWORK_ERROR',
      0
    );
  }
  clearTimeout(timeoutId);

  // 4xx/5xx 에러 처리
  if (!response.ok) {
    let apiMessage = `Kakao API 에러 (status ${response.status})`;
    try {
      const body = (await response.json()) as { message?: string };
      if (body?.message) apiMessage = body.message;
    } catch {
      // JSON 파싱 실패 시 기본 메시지 유지
    }
    throw new KakaoClientError(apiMessage, 'KAKAO_API_ERROR', response.status);
  }

  const data = (await response.json()) as KakaoSearchResponse;
  return data;
}
