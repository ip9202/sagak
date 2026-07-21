/**
 * 독서 통계 집계 API (SPEC-ROUTINE-001 REQ-ROUT-008/009)
 *
 * reading_sessions 에서 클라이언트 집계:
 * - total_duration_seconds / total_sessions (종료된 세션)
 * - today_duration_seconds (오늘 날짜)
 * - current_streak (streakCalculator 위임)
 *
 * 인덱스 (user_id, book_id) 로 사용자별 필터 최적화. RLS 가 본인 세션만 집계.
 * RPC 대신 클라이언트 집계 — 스키마 변경 회피 (plan.md §2.4 옵션 B).
 *
 * @MX:NOTE: [AUTO] 클라이언트 집계는 대량 데이터에서 성능 저하 가능 — MVP 니치 규모에서는 허용. 확장 시 RPC 전환.
 * @MX:SPEC SPEC-ROUTINE-001
 */
import { getSupabaseClient } from '../../lib/supabase/client';
import { normalizeError } from '../../lib/api/errors';
import { calculateStreak } from './streakCalculator';
import type { ReadingStats } from './types';

interface SessionRow {
  ended_at: string | null;
  duration_seconds: number | null;
}

/**
 * 오늘 날짜(로컬 tz) 의 YYYY-MM-DD.
 */
function todayLocalDateString(date = new Date()): string {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function toLocalDateString(iso: string): string {
  const date = new Date(iso);
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * 독서 통계를 집계하여 반환한다.
 * 종료된 세션(ended_at NOT NULL) 만 집계. duration_seconds null 은 0 취급.
 */
export async function getReadingStats(): Promise<ReadingStats> {
  const client = getSupabaseClient();

  let result: { data: SessionRow[] | null; error: unknown };
  try {
    result = await client
      .from('reading_sessions')
      .select('ended_at, duration_seconds')
      .not('ended_at', 'is', null)
      .order('ended_at', { ascending: false })
      .limit(1000);
  } catch (error) {
    throw normalizeError(error);
  }
  if (result.error) {
    throw normalizeError(result.error);
  }

  const rows = result.data ?? [];
  const todayKey = todayLocalDateString();

  let totalDuration = 0;
  let totalSessions = 0;
  let todayDuration = 0;
  const endedAts: string[] = [];

  for (const row of rows) {
    if (!row.ended_at) continue;
    totalSessions += 1;
    totalDuration += row.duration_seconds ?? 0;
    endedAts.push(row.ended_at);
    if (toLocalDateString(row.ended_at) === todayKey) {
      todayDuration += row.duration_seconds ?? 0;
    }
  }

  const currentStreak = endedAts.length > 0 ? calculateStreak(endedAts) : 0;

  return {
    total_duration_seconds: totalDuration,
    total_sessions: totalSessions,
    current_streak: currentStreak,
    today_duration_seconds: todayDuration,
  };
}
