/**
 * 도서 포맷 공유 유틸 (SPEC-BOOK-001 M4, REQ-BOOK-014/REQ-BOOK-015)
 *
 * 출판일 ISO(YYYY-MM-DD) → "YYYY.MM" 포맷 변환을 SearchResultCard(M4-1) 와
 * BookDetailScreen(M4-3) 이 공유. DRY 원칙에 따라 단일 소스에서 관리.
 *
 * @MX:ANCHOR: [AUTO] formatPublishedMonth — SearchResultCard/BookDetailScreen 공개 의존
 * @MX:REASON: 검색 결과 카드(M4-1, 다중 인스턴스) 와 상세 화면(M4-3) 이 동시에 import 하며, 반환 포맷 계약("YYYY.MM" 또는 null) 을 위반하면 두 화면의 메타 라인이 고장난다.
 */

/**
 * REQ-BOOK-014 / REQ-BOOK-015: 출판일 ISO(YYYY-MM-DD) → "YYYY.MM" 포맷.
 *
 * Kakao datetime → date 변환 결과가 YYYY-MM-DD 형태이므로 앞 7자리를 취해 "-" → "." 치환.
 * null/짧은 문자열(길이 7 미만) 은 null 반환 (메타 라인 생략).
 *
 * @param iso - ISO 날짜 문자열(YYYY-MM-DD) 또는 null
 * @returns "YYYY.MM" 포맷 문자열, 입력이 falsy 하거나 길이 7 미만이면 null
 */
export function formatPublishedMonth(iso: string | null): string | null {
  if (!iso || iso.length < 7) return null;
  // "2021-06-15" → "2021.06"
  return iso.slice(0, 7).replace('-', '.');
}
