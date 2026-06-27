/**
 * 마이페이지 PostgREST 쿼리 함수 (SPEC-PROFILE-001 REQ-PROF-001/004/006)
 *
 * - getProfile: users 전체 컬럼 조회 (RLS 자기 행 — REQ-DB-014)
 * - getUserStats: 완독 수(COUNT head) + 독서시간(JS SUM) + 감정기록(COUNT) 병렬
 * - getPointLogs: point_logs created_at DESC (RLS 본인 — REQ-DB-021, MVP 조회 전용)
 *
 * 패턴: routine/statsApi.ts (클라이언트 집계) + routine/alarmApi.ts (UPDATE) 참조.
 * RLS 가 자기 행만 노출 — 클라이언트 권한 로직 없음.
 *
 * @MX:SPEC SPEC-PROFILE-001
 */
import { getSupabaseClient } from '../../lib/supabase/client';
import { normalizeError } from '../../lib/api/errors';
import type { Profile, UserStats, PointLog } from './types';

/** reading_sessions row 부분 (집계에 필요한 컬럼만) */
interface SessionDurationRow {
  duration_seconds: number | null;
}

/**
 * 자기 프로필을 조회한다 (REQ-PROF-001).
 * users 전체 컬럼 SELECT where id=eq.userId. RLS 가 본인 행만 노출.
 *
 * @param userId auth.uid()
 * @returns Profile 또는 행 없으면 null
 */
export async function getProfile(userId: string): Promise<Profile | null> {
  const client = getSupabaseClient();
  let result: {
    data: Profile | null;
    error: unknown;
  };
  try {
    result = await client
      .from('users')
      .select(
        'id, nickname, avatar_url, bio, email, provider, push_token, reading_alarm_time, reading_alarm_enabled, role, created_at, updated_at',
      )
      .eq('id', userId)
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
 * 독서 통계 3개 지표를 집계한다 (REQ-PROF-004).
 * Promise.all 병렬:
 * - completed_books: user_books COUNT(head) where status='completed'
 * - total_reading_seconds: reading_sessions rows JS SUM (routine 패턴)
 * - emotion_records_count: emotion_records COUNT(head)
 *
 * RLS 가 본인 데이터만 집계. userId 명시적 필터는 성능/명확성용.
 *
 * @MX:NOTE: [AUTO] JS SUM 은 대량 데이터에서 성능 저하 가능 — MVP 니치 규모 허용. 확장 시 RPC.
 */
export async function getUserStats(userId: string): Promise<UserStats> {
  const client = getSupabaseClient();

  // 3개 쿼리를 동시 실행
  const [completedResult, emotionResult, sessionsResult] = await Promise.all([
    client
      .from('user_books')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'completed')
      .single(),
    client
      .from('emotion_records')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .single(),
    client
      .from('reading_sessions')
      .select('duration_seconds')
      .eq('user_id', userId)
      .not('ended_at', 'is', null)
      .order('ended_at', { ascending: false })
      .limit(1000),
  ]).catch((error: unknown) => {
    throw normalizeError(error);
  });

  if (completedResult.error) throw normalizeError(completedResult.error);
  if (emotionResult.error) throw normalizeError(emotionResult.error);
  if (sessionsResult.error) throw normalizeError(sessionsResult.error);

  const rows: SessionDurationRow[] = (sessionsResult.data ?? []) as SessionDurationRow[];
  const totalSeconds = rows.reduce(
    (sum, r) => sum + (r.duration_seconds ?? 0),
    0,
  );

  return {
    completed_books: completedResult.count ?? 0,
    total_reading_seconds: totalSeconds,
    emotion_records_count: emotionResult.count ?? 0,
  };
}

/**
 * 포인트 내역을 created_at DESC 로 조회한다 (REQ-PROF-006, MVP 조회 전용).
 * RLS(REQ-DB-021) 가 본인 행만 노출. limit 으로 대량 데이터 방지.
 *
 * @MX:NOTE: [AUTO] MVP 조회 전용 — 클라이언트 INSERT 정책 없음 (서버 service_role 만).
 */
export async function getPointLogs(userId: string): Promise<PointLog[]> {
  const client = getSupabaseClient();
  let result: { data: PointLog[] | null; error: unknown };
  try {
    result = await client
      .from('point_logs')
      .select('id, user_id, amount, reason, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(200);
  } catch (error) {
    throw normalizeError(error);
  }
  if (result.error) {
    throw normalizeError(result.error);
  }
  return result.data ?? [];
}
