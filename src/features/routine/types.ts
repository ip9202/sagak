/**
 * 루틴/타이머 도메인 타입 (SPEC-ROUTINE-001)
 *
 * reading_sessions 행 + 알림 설정 + 통계 + 목표 관련 타입 계약.
 * 모든 타입은 src/types/supabase.ts 의 DB 스키마와 일치한다.
 *
 * @MX:NOTE: [AUTO] ReadingSessionRow 는 supabase.ts 의 reading_sessions.Row 와 구조 동일 — 본 도메인은 별도 타입 매핑 없이 Row 형태를 그대로 소비한다.
 * @MX:SPEC SPEC-ROUTINE-001
 */

/**
 * reading_sessions 테이블 Row 형태 (REQ-DB-009).
 * - started_at: 세션 시작 시각 (NOT NULL)
 * - ended_at: 세션 종료 시각 (NULL = 활성 세션, REQ-ROUT-001)
 * - duration_seconds: 서버 측 계산 (ended_at - started_at), 활성 세션은 NULL (REQ-ROUT-002)
 * - pages_read: 선택적, 사용자 입력 시에만 기록 (REQ-ROUT-002)
 */
export interface ReadingSessionRow {
  id: string;
  user_id: string;
  book_id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  pages_read: number | null;
}

/**
 * 독서 통계 응답 (REQ-ROUT-008).
 * - total_duration_seconds: 종료된 세션 duration_seconds 합계
 * - total_sessions: 종료된 세션 수
 * - current_streak: 자정 기준 연속 독서 일수 (미결정 6.1 임시방침)
 * - today_duration_seconds: 오늘 날짜 세션 duration 합계
 */
export interface ReadingStats {
  total_duration_seconds: number;
  total_sessions: number;
  current_streak: number;
  today_duration_seconds: number;
}

/**
 * 알림 설정 (REQ-ROUT-005/006/007).
 * - alarm_time: 'HH:MM:SS' 형식 문자열 (PostgREST time 타입). null = 미설정.
 * - alarm_enabled: 알림 활성화 여부. 서버 기본값 true (REQ-DB-001).
 */
export interface AlarmSettings {
  alarm_time: string | null;
  alarm_enabled: boolean;
}

/**
 * 일일 목표 (초 단위). REQ-ROUT-010 / 미결정 6.2 — 기본값 900(15분).
 */
export type DailyGoalSeconds = number;

/** HH:MM 형식 입력값 (사용자 입력)을 HH:MM:SS time 타입으로 변환 검증한 결과 */
export type AlarmTimeString = string; // 'HH:MM:SS'
