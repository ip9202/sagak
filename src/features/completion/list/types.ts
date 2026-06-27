/**
 * 완독 다이어리 리스트 도메인 타입 (SPEC-COMPLETION-002, REQ-COMP2-002)
 *
 * 리스트(아카이브) 화면의 단일 항목 타입. PostgREST 조인 결과
 * (user_books + books + completion_reports.report_data) 를 클라이언트 도메인 모델로 평탄화.
 *
 * report_data 파싱은 SPEC-COMPLETION-001 의 isReportData() 타입 가드를 재사용한다 (재정의 금지).
 * 리스트는 단일 행의 bad report 로 전체가 break 되지 않아야 하므로 lenient 폴백을 적용한다.
 *
 * @MX:SPEC SPEC-COMPLETION-002
 */

/**
 * 완독 다이어리 리스트 단일 항목 (REQ-COMP2-002 데이터 셰이프).
 * - userBookId: user_books.id (상세 라우트 변환 키)
 * - bookId: books.id (상세 라우트 파라미터)
 * - title/author/coverUrl: books 메타데이터 (null 가능)
 * - completedAt: user_books.completed_at ISO 문자열 (null 가능 — 트리거 지연)
 * - totalRecords: report_data.total_records (리포트 없으면 0)
 * - recentHighlight: report_data.highlights[0].content (가장 최근 기록, 없으면 null)
 */
export interface CompletionDiaryListItem {
  userBookId: string;
  bookId: string;
  title: string;
  author: string | null;
  coverUrl: string | null;
  completedAt: string | null;
  totalRecords: number;
  recentHighlight: string | null;
}
