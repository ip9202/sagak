/**
 * 마이페이지 도메인 타입 정의 (SPEC-PROFILE-001)
 *
 * users.Row 기반 Profile, 통계 집계 결과 UserStats, 포인트 내역 PointLog,
 * 배지 산정용 Badge/BadgeInput/BadgeCategory.
 *
 * SPEC 불일치 (DB 실제 코드 우선):
 * - spec.md REQ-PROF-006 이 point_logs.ref_id 를 언급하나, 실제 point_logs.Row
 *   (src/types/supabase.ts) 는 amount/created_at/id/reason/user_id 만 존재.
 *   → PointLog 에서 ref_id 제거. sync 단계에서 SPEC 정정 예정.
 * - spec.md REQ-PROF-007 이 "감정 종류별 배지" 를 암시하나, emotion_records.Row 에는
 *   감정 종류 컬럼이 없음 → 감정 배지는 총 누적 수 기준만 산정.
 * - auth/types.ts UserProfile (nickname NOT NULL 보장 전용) 은 수정 금지 — 본 Profile 은
 *   마이페이지 전체 컬럼(email/alarm/role 포함) 조회용 별도 타입.
 *
 * @MX:SPEC SPEC-PROFILE-001
 */

/** users 테이블 전체 컬럼 (자기 프로필 조회 결과) */
export interface Profile {
  id: string;
  nickname: string | null;
  avatar_url: string | null;
  bio: string | null;
  email: string;
  provider: string;
  push_token: string | null;
  reading_alarm_time: string | null;
  reading_alarm_enabled: boolean | null;
  role: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * 프로필 수정 입력 (REQ-PROF-002/003).
 * 수정 가능한 필드: nickname, avatar_url, bio.
 * email/provider/role/alarm_* 은 수정 UI 에서 비노출 또는 읽기 전용.
 */
export interface ProfileUpdateInput {
  nickname: string;
  avatar_url: string | null;
  bio: string | null;
}

/**
 * 독서 통계 집계 결과 (REQ-PROF-004).
 * 3개 지표를 클라이언트가 Promise.all 로 병렬 집계.
 */
export interface UserStats {
  /** 완독한 책 수: user_books WHERE status='completed' COUNT */
  completed_books: number;
  /** 누적 독서 시간(초): reading_sessions.duration_seconds SUM */
  total_reading_seconds: number;
  /** 감정 기록 수: emotion_records COUNT (본인 것) */
  emotion_records_count: number;
}

/** point_logs.Row — 포인트 적립/사용 내역. MVP 조회 전용. */
export interface PointLog {
  id: string;
  user_id: string;
  amount: number;
  reason: string;
  created_at: string;
}

/** 배지 카테고리 (미결정 5.1 임시 thresholds) */
export type BadgeCategory = 'completion' | 'streak' | 'emotion' | 'point';

/**
 * 단일 배지 산정 결과.
 * earned=true 면 "획득"(컬러/활성), false 면 "잠김"(그레이스케일/비활성).
 */
export interface Badge {
  id: string;
  category: BadgeCategory;
  label: string;
  threshold: number;
  current: number;
  earned: boolean;
}

/**
 * computeBadges 입력 (REQ-PROF-007 클라이언트 산정).
 * - stats: 완독 수, 감정 기록 수
 * - current_streak: 연속 독서일 (reading_sessions 기반 — streakCalculator 위임)
 * - point_reasons: completion/reaction 횟수 (point_logs reason별 집계)
 */
export interface BadgeInput {
  stats: Pick<UserStats, 'completed_books' | 'emotion_records_count'>;
  current_streak: number;
  point_reasons: {
    completion: number;
    reaction: number;
  };
}
