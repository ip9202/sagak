/**
 * Kakao 도서 응답 정규화 (REQ-BOOK-003, 시나리오 S3)
 *
 * Kakao Book Search API 의 documents[] 를 클라이언트 계약(SearchResult)으로 정규화한다.
 * 본 모듈은 Deno 글로벌(Deno.env 등)에 의존하지 않는 순수 함수 모듈이므로
 * jest 로 단위 테스트할 수 있다.
 */

/**
 * Kakao Book Search API 응답의 단일 document 원본 형태 (부분 — 사용 필드만).
 * Kakao API 스펙: https://developers.kakao.com/docs/latest/ko/daum-search/dev-guide#search-book
 */
export interface KakaoDocument {
  title: string;
  authors: string[];
  contents?: string;
  url?: string;
  isbn?: string;
  datetime?: string;
  publishers?: string[];
  price?: number;
  sale_price?: number;
  thumbnail?: string;
  status?: string;
  translators?: string[];
}

/**
 * Edge Function → 클라이언트 계약 (src/types/book.ts SearchResult 와 동일 형태).
 * Deno 환경에서 클라이언트 타입을 import 할 수 없으므로 로컬 정의한다.
 */
export interface NormalizedBook {
  title: string;
  authors: string[];
  publisher: string | null;
  published_at: string | null;
  cover_url: string | null;
  isbn: string;
  kakao_id: string | null;
  total_pages: number | null;
}

/**
 * Kakao datetime(ISO 8601 datetime) → ISO date(YYYY-MM-DD) 변환.
 * @MX:NOTE: [AUTO] Kakao datetime 예: "2017-01-20T00:00:00.000+09:00" → "2017-01-20"
 */
function toDateOnly(datetime: string | undefined): string | null {
  if (!datetime) return null;
  // 날짜부만 추출 (시간대 오프셋은 날짜 자체에 영향을 주지 않으므로 단순 자름).
  const match = datetime.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

/**
 * ISBN 필드 파싱 — Kakao 는 "ISBN13 ISBN10" 형태로 공백 구분 반환 가능.
 * 첫 값을 사용한다 (REQ-BOOK-003 계약).
 */
function parseFirstIsbn(raw: string | undefined): string {
  if (!raw) return '';
  return raw.trim().split(/\s+/)[0] ?? '';
}

/**
 * REQ-BOOK-003: Kakao documents[] → NormalizedBook[] 변환.
 *
 * 필수 필드(title, authors 비-빈 배열, isbn)가 누락된 도서는 제외한다.
 *
 * @param documents - Kakao API 응답의 documents 배열
 * @returns 정규화된 도서 배열 (빈 결과 허용)
 */
export function normalizeKakaoDocuments(
  documents: KakaoDocument[]
): NormalizedBook[] {
  const results: NormalizedBook[] = [];

  for (const doc of documents) {
    // 필수 필드 검증
    if (!doc || typeof doc.title !== 'string' || doc.title.length === 0) {
      continue;
    }
    if (!Array.isArray(doc.authors) || doc.authors.length === 0) {
      continue;
    }
    const isbn = parseFirstIsbn(doc.isbn);
    if (isbn.length === 0) {
      continue;
    }

    const publishers = Array.isArray(doc.publishers)
      ? doc.publishers
      : [];
    const publisher =
      publishers.length > 0 && typeof publishers[0] === 'string'
        ? publishers[0]
        : null;

    results.push({
      title: doc.title,
      authors: doc.authors,
      publisher,
      published_at: toDateOnly(doc.datetime),
      cover_url: typeof doc.thumbnail === 'string' ? doc.thumbnail : null,
      isbn,
      // kakao_id: Kakao document 에 별도 id 필드가 없으므로 null (books.kakao_id nullable)
      kakao_id: null,
      // total_pages: Kakao API 응답에 페이지 수가 없으므로 null
      total_pages: null,
    });
  }

  return results;
}
