/**
 * 완독 다이어리 리스트 클라이언트 API (SPEC-COMPLETION-002, REQ-COMP2-002)
 *
 * user_books(status='completed') + books + completion_reports.report_data 를
 * 단일 PostgREST GET 으로 조인 조회한다 (N+1 회피).
 *
 * 정책:
 * - user_id 미전송 — RLS(auth.uid() = user_id) 가 자동 필터 (SPEC-COMPLETION-001 결정 4 일관)
 * - completed_at DESC 정렬
 * - report_data 파싱: SPEC-COMPLETION-001 isReportData() 재사용
 * - lenient: 단일 행의 bad report/missing book 이 리스트 전체를 break 하지 않는다
 *   (totalRecords=0, recentHighlight=null, title='(제목 없음)' 폴백)
 *
 * @MX:SPEC SPEC-COMPLETION-002
 */
import { getSupabaseClient } from '../../../lib/supabase/client';
import { normalizeError } from '../../../lib/api/errors';
import { isReportData } from '../types';
import type { CompletionDiaryListItem } from './types';

// @MX:NOTE: [AUTO] PostgREST 리소스 임베딩 select — user_books 본문 + books(1:1 FK) + completion_reports(1:1 FK, UNIQUE user_book_id).
//           RLS 가 본인 completed 항목만 자동 필터하므로 user_id 는 쿼리에서 제외한다.
const DIARY_LIST_SELECT =
  'id,book_id,completed_at,books(id,title,author,cover_url),completion_reports(report_data)';

/** books 행 모양 (조인 결과 원시 타입) */
interface BookJoinRow {
  id: string;
  title: string | null;
  author: string | null;
  cover_url: string | null;
}

/** completion_reports 행 모양 (report_data 만 선택) */
interface ReportJoinRow {
  report_data: unknown;
}

/** user_books 조인 결과 원시 행 타입 */
interface UserBookJoinRow {
  id: string;
  book_id: string;
  completed_at: string | null;
  books: BookJoinRow | null;
  // PostgREST embedded: 1:1 관계(UNIQUE user_book_id) 이므로 단일 객체 또는 null.
  // (배열이 아님 — PostgREST 는 unique FK 를 단일 객체로 반환)
  completion_reports: ReportJoinRow | null;
}

/**
 * 단일 조인 행을 CompletionDiaryListItem 으로 평탄화한다.
 * - book null → title='(제목 없음)', author/coverUrl null
 * - report_data 누락/불일치 → totalRecords=0, recentHighlight=null (lenient)
 */
function parseItem(row: UserBookJoinRow): CompletionDiaryListItem {
  const book = row.books;
  // report_data 추출 — 1:1 관계(PostgREST 단일 객체) 이므로 직접 참조.
  const reportRow = row.completion_reports ?? null;
  const rawReport = reportRow?.report_data ?? null;

  let totalRecords = 0;
  let recentHighlight: string | null = null;

  if (isReportData(rawReport)) {
    totalRecords = rawReport.total_records;
    // highlights 는 DB 트리거가 ORDER BY created_at DESC 로 정렬하므로 [0] 이 가장 최근 기록.
    const first = rawReport.highlights[0];
    if (first && typeof first.content === 'string') {
      recentHighlight = first.content;
    }
  }
  // isReportData false → lenient 폴백 (totalRecords=0, recentHighlight=null). throw 안 함.

  return {
    userBookId: row.id,
    bookId: row.book_id,
    title: book?.title ?? '(제목 없음)',
    author: book?.author ?? null,
    coverUrl: book?.cover_url ?? null,
    completedAt: row.completed_at,
    totalRecords,
    recentHighlight,
  };
}

/**
 * 완독 다이어리 리스트를 조회한다 (REQ-COMP2-002).
 *
 * user_books status='completed' 항목을 books + completion_reports 와 조인하여
 * 최근 완독 순(completed_at DESC) 으로 반환한다. RLS 가 본인 항목만 자동 필터.
 *
 * @returns CompletionDiaryListItem[] (빈 응답 시 [])
 */
export async function fetchCompletionDiaryList(): Promise<CompletionDiaryListItem[]> {
  const client = getSupabaseClient();
  let result: { data: UserBookJoinRow[] | null; error: unknown };
  try {
    result = await client
      .from('user_books')
      .select(DIARY_LIST_SELECT)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false });
  } catch (error) {
    throw normalizeError(error);
  }

  if (result.error) {
    throw normalizeError(result.error);
  }

  const rows = result.data ?? [];
  return rows.map(parseItem);
}
