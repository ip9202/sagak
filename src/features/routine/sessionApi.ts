/**
 * 독서 세션 API (SPEC-ROUTINE-001 REQ-ROUT-001/002)
 *
 * PostgREST RPC 함수(start_reading_session / end_reading_session) 를 통한
 * reading_sessions 시작/종료/조회. duration_seconds 와 ended_at 은 DB 서버 시간
 * 기준(now()) 으로 RPC 본문에서 계산되므로 클라이언트 타이머 오차/조작에 영향받지 않는다.
 *
 * - startSession: start_reading_session RPC 호출 — 기존 활성 세션 자동 종료(R2) 후
 *   새 세션 INSERT(R1). 새 세션 id 반환.
 * - endSession: end_reading_session RPC 호출 — 서버 측 duration 계산(R4) + 선택적
 *   pages_read 갱신(R5).
 * - getActiveSession: ended_at IS NULL 조회(RLS 가 본인 세션만 노출)
 *
 * 가정 2.1.1: duration_seconds 는 서버 측 EXTRACT(EPOCH FROM (now() - started_at))
 * 으로 계산 — 백그라운드 타이머 부정확성 방어.
 *
 * 권한: start/end RPC 는 SECURITY DEFINER + user_id = auth.uid() 검사.
 * getActiveSession 은 RLS(REQ-DB-021) 가 단독 수행.
 *
 * @MX:SPEC SPEC-ROUTINE-001
 */
import { getSupabaseClient } from '../../lib/supabase/client';
import { normalizeError } from '../../lib/api/errors';
import type { ReadingSessionRow } from './types';

/**
 * RPC 응답에서 새 세션 id 추출 — supabase-js 버전에 따라 객체({id}) 또는
 * 배열([{id}]) 형태로 올 수 있어 두 형태 모두 처리한다.
 */
function extractSessionId(data: unknown): string | null {
  if (!data) {
    return null;
  }
  if (Array.isArray(data) && data.length > 0) {
    const first = data[0] as { id?: unknown };
    return typeof first.id === 'string' ? first.id : null;
  }
  if (typeof data === 'object' && 'id' in data) {
    const id = (data as { id: unknown }).id;
    return typeof id === 'string' ? id : null;
  }
  return null;
}

/**
 * 현재 활성 세션(ended_at IS NULL) 을 조회한다.
 * RLS 가 본인 세션만 노출한다. 클라이언트는 user_id 필터를 보내지 않는다(RLS 단독).
 */
export async function getActiveSession(): Promise<ReadingSessionRow | null> {
  const client = getSupabaseClient();
  let result: { data: ReadingSessionRow | null; error: unknown };
  try {
    result = await client
      .from('reading_sessions')
      .select(
        'id, user_id, book_id, started_at, ended_at, duration_seconds, pages_read',
      )
      .is('ended_at', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();
  } catch (error) {
    throw normalizeError(error);
  }
  if (result.error) {
    throw normalizeError(result.error);
  }
  return result.data;
}

/**
 * 독서 세션을 시작한다 (REQ-ROUT-001).
 *
 * start_reading_session RPC 호출 — DB 서버에서 원자적으로:
 *   1) 기존 활성 세션 자동 종료(R2): ended_at=now, duration_seconds 서버 계산
 *   2) 새 세션 INSERT(R1): user_id=auth.uid(), started_at=now()
 *
 * @MX:ANCHOR: [AUTO] 독서 세션 시작 공개 API — TimerScreen 등 타이머 화면 진입점.
 * @MX:REASON: start_reading_session RPC 는 R1(시작)/R2(자동 종료)/R4(서버 측 duration) 를 원자적으로 수행하는 핵심 계약으로, 호출자가 3곳 이상(TimerScreen, useReadingTimer, 향후 통계 동기화) 이 될 수 있다.
 *
 * @MX:NOTE: [AUTO] duration_seconds/ended_at 은 RPC 본문에서 DB now() 기준으로 계산된다 — 클라이언트 시간 의존성 없음(가정 2.1.1).
 *
 * @param bookId 세션을 시작할 책 식별자
 * @returns 새로 생성된 세션 id (RPC 응답에서 추출). 응답에 id 가 없으면 null.
 */
export async function startSession(bookId: string): Promise<string | null> {
  const client = getSupabaseClient();

  let result: { data: unknown; error: unknown };
  try {
    result = await client.rpc('start_reading_session', { p_book_id: bookId });
  } catch (error) {
    throw normalizeError(error);
  }
  if (result.error) {
    throw normalizeError(result.error);
  }
  return extractSessionId(result.data);
}

/**
 * 독서 세션을 종료한다 (REQ-ROUT-002).
 *
 * end_reading_session RPC 호출 — DB 서버에서:
 *   1) ended_at=now, duration_seconds=EXTRACT(EPOCH FROM (now()-started_at)) (R4)
 *   2) pages_read: NULL 이면 기존값 유지, 값이면 덮어쓰기 (R5)
 *   3) user_id = auth.uid() 검사로 본인 세션만 종료 (R3)
 *
 * @MX:ANCHOR: [AUTO] 독서 세션 종료 공개 API — TimerScreen 등 타이머 종료/이탈 시점 호출.
 * @MX:REASON: end_reading_session RPC 는 R3(본인 검사)/R4(서버 duration)/R5(pages_read) 를 원자적으로 수행하는 핵심 계약이며, duration 데이터 무결성의 단일 진입점이다.
 *
 * @MX:NOTE: [AUTO] duration_seconds 는 RPC 본문에서 서버 now() - started_at 으로 계산된다. pagesRead 미전달 시 p_pages_read=null → COALESCE 로 기존값 유지.
 *
 * @param sessionId 종료할 세션 ID
 * @param pagesRead 선택적 — 읽은 페이지 수. 생략 시 기존값 유지.
 */
export async function endSession(
  sessionId: string,
  pagesRead?: number,
): Promise<void> {
  const client = getSupabaseClient();

  // p_pages_read 는 optional — undefined 전달 시 RPC DEFAULT NULL 적용 (gen-types 시그니처 p_pages_read?: number 준수).
  const args: { p_session_id: string; p_pages_read?: number } = {
    p_session_id: sessionId,
    ...(pagesRead !== undefined ? { p_pages_read: pagesRead } : {}),
  };

  let result: { error: unknown };
  try {
    result = await client.rpc('end_reading_session', args);
  } catch (error) {
    throw normalizeError(error);
  }
  if (result.error) {
    throw normalizeError(result.error);
  }
}
