/**
 * 알림 센터 도메인 타입 (SPEC-NOTIF-001)
 *
 * notifications 테이블 행 + ENUM 타입 계약.
 * 모든 타입은 src/types/supabase.ts 의 DB 스키마와 일치한다 (gen-types 산출물).
 *
 * @MX:NOTE: [AUTO] NotificationType 은 DB notification_type ENUM 과 동기화 — Edge Function(logic.ts) 및 6종 라우팅과 단일 진실.
 * @MX:SPEC SPEC-NOTIF-001
 */
import type { Database } from '../../types/supabase';

/** notifications.type ENUM 6종 (REQ-NOTIF-011) */
export type NotificationType =
  Database['public']['Enums']['notification_type'];

/**
 * notifications 테이블 Row 형태 (REQ-DB-012 + SPEC-NOTIF-001 data 보완).
 * gen-types 의 Row 타입에서 직접 파생 — data 는 Json | null (스키마와 단일 진실).
 * ROUTINE(ReadingSessionRow) 패턴과 동일: 별도 매핑 없이 Row 형태를 그대로 소비.
 */
export type NotificationRow =
  Database['public']['Tables']['notifications']['Row'];
