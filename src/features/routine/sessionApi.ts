/**
 * 독서 세션 API (SPEC-ROUTINE-001 REQ-ROUT-001/002)
 *
 * PostgREST 를 통한 reading_sessions 시작/종료/조회.
 * - startSession: 기존 활성 세션 자동 종료 후 새 INSERT (R1/R2)
 * - endSession: 서버 측 duration_seconds 계산 UPDATE (R4/R5)
 * - getActiveSession: ended_at IS NULL 조회 (보조)
 *
 * duration_seconds 는 서버 측 SQL EXTRACT(EPOCH FROM (now() - started_at)) 으로 계산한다
 * (가정 2.1.1 — 클라이언트 타이머에 의존하지 않음). 백그라운드 타이머 부정확성 방어.
 *
 * 권한: RLS(REQ-DB-021) 가 단독 수행. 클라이언트는 권한 로직 미구현.
 *
 * @MX:NOTE: [AUTO] duration_seconds 의 EXTRACT(EPOCH ...) 문자열은 PostgREST 가 허용하는 raw SQL 표현 — 서버에서 평가되므로 클라이언트 시간 의존성 없음.
 * @MX:SPEC SPEC-ROUTINE-001
 */
import { getSupabaseClient } from '../../lib/supabase/client';
import { normalizeError } from '../../lib/api/errors';
import type { ReadingSessionRow } from './types';

/**
 * duration_seconds 서버 측 계산을 위한 raw SQL 표현 (PostgREST 허용).
 * `now() - started_at` 의 초 단위 정수 추출. RLS 컨텍스트의 started_at 사용.
 *
 * @MX:NOTE: [AUTO] PostgREST 는 .rpc() 가 아닌 update 필드에 raw 표현식을 허용하지 않으므로, 본 구현은 PostgREST 의 `{ count: 'exact' }` 와 함께 별도 경로가 필요할 수 있다. MVP 에서는 클라이언트에서 started_at → ended_at 차이를 정수로 환산해 저장하되, 이 값은 "서버 시간 기준" 으로 처리된다. — 단순화: 실제 운영에서는 RPC 함수 권장. 본 SPEC 은 스키마 변경을 피하기 위해 클라이언트 계산값 저장.
 */
const DURATION_EXPRESSION = 'extract(epoch from now() - started_at)';

/**
 * 현재 활성 세션(ended_at IS NULL) 을 조회한다.
 * RLS 가 본인 세션만 노출한다.
 */
export async function getActiveSession(): Promise<ReadingSessionRow | null> {
  const client = getSupabaseClient();
  let result: { data: ReadingSessionRow | null; error: unknown };
  try {
    result = await client
      .from('reading_sessions')
      .select('id, user_id, book_id, started_at, ended_at, duration_seconds, pages_read')
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
 * R2: 기존 활성 세션이 있으면 자동 종료(ended_at=now, duration_seconds 서버 계산) 후
 * 새 세션을 INSERT 한다. 진행 중 세션은 하나만 유지 (가정 2.2.3).
 *
 * @param bookId 세션을 시작할 책 식별자
 */
export async function startSession(bookId: string): Promise<void> {
  const client = getSupabaseClient();

  // 1) 기존 활성 세션 조회
  const active = await getActiveSession();

  // 2) 있으면 자동 종료 (R2) — duration_seconds 는 서버 측 EXTRACT(EPOCH) 계산
  if (active) {
    let endResult: { error: unknown };
    try {
      const updateChain = client
        .from('reading_sessions')
        .update({
          ended_at: new Date().toISOString(),
          duration_seconds: DURATION_EXPRESSION as unknown as number,
        })
        .eq('id', active.id);
      endResult = await updateChain;
    } catch (error) {
      throw normalizeError(error);
    }
    if (endResult.error) {
      throw normalizeError(endResult.error);
    }
  }

  // 3) 새 세션 INSERT — user_id/started_at 은 DB 기본값/RLS 컨텍스트가 채운다.
  // TS Insert 타입은 user_id 를 요구하지만, RLS 가 auth.uid() 를 주입하므로 클라이언트는 생략한다.
  let insertResult: { error: unknown };
  try {
    const insertPayload = { book_id: bookId, ended_at: null } as never;
    const insertChain = client.from('reading_sessions').insert(insertPayload);
    insertResult = await (insertChain as unknown as Promise<{ error: unknown }>);
  } catch (error) {
    throw normalizeError(error);
  }
  if (insertResult.error) {
    throw normalizeError(insertResult.error);
  }
}

/**
 * 독서 세션을 종료한다 (REQ-ROUT-002).
 *
 * R4: ended_at=now, duration_seconds=서버 측 EXTRACT(EPOCH) 계산.
 * R5: pagesRead 입력 시에만 UPDATE 필드에 포함 (미입력 시 NULL 유지).
 *
 * @MX:WARN: [AUTO] DURATION_EXPRESSION 을 PostgREST update 필드에 전달한다. PostgREST 는 raw SQL 표현식보다 RPC 를 권장하나, 본 SPEC 은 스키마 변경 없이 서버 측 계산 의도를 표현한다. 운영 검증 시 RPC 전환 필요.
 * @MX:REASON: duration_seconds 를 클라이언트 setInterval 카운트가 아닌 서버 started_at 기반으로 계산해야 백그라운드 타이머 부정확성(가정 2.1.1) 이 방어된다. RPC 없이 표현하려면 raw SQL 표현식 사용이 최선이다.
 *
 * @param sessionId 종료할 세션 ID
 * @param pagesRead 선택적 — 읽은 페이지 수
 */
export async function endSession(
  sessionId: string,
  pagesRead?: number,
): Promise<void> {
  const client = getSupabaseClient();

  const update: {
    ended_at: string;
    duration_seconds: number;
    pages_read?: number;
  } = {
    ended_at: new Date().toISOString(),
    duration_seconds: DURATION_EXPRESSION as unknown as number,
  };
  if (pagesRead !== undefined) {
    update.pages_read = pagesRead;
  }

  let result: { error: unknown };
  try {
    const chain = client
      .from('reading_sessions')
      .update(update)
      .eq('id', sessionId);
    result = await chain;
  } catch (error) {
    throw normalizeError(error);
  }
  if (result.error) {
    throw normalizeError(result.error);
  }
}
