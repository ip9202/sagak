/**
 * SPEC-CLUB-002 Track B 개설형 모임 관리 — 도메인 타입
 *
 * gen-types(src/types/supabase.ts)의 clubs/club_members Row 타입을 단일 출처로 재사용.
 * SPEC-CLUB-001 trackA 와 동일 패턴: gen-types 별칭 + 도메인 상수/타입.
 *
 * clubs 진도 계획 컬럼(daily_pages, trigger_page, duration_days)은 본 SPEC 마이그레이션
 * 20240618000006_add_club_reading_plan_columns.sql 로 추가되었으며 gen-types 에 반영됨.
 * 진도 동기화(REQ-CLUBB-009~012)는 progressApi.ts 에서 구현됨.
 */
import type { Database } from '../../../types/supabase';

/** clubs.type 허용값 (DB CHECK — group/instant). Track B 는 'group' 만 강제 (REQ-CLUBB-002). */
export type ClubType = 'group' | 'instant';

/** clubs.status 허용값 (DB CHECK — active/closed). 양방향 전환 허용 (REQ-CLUBB-014/015). */
export type ClubStatus = 'active' | 'closed';

/** club_members.role 허용값 (host 자동 가입 트리거가 'host' 부여, Track A 승인이 'member'). */
export type ClubMemberRole = 'host' | 'member';

/** Track B 모임 생성 시 강제하는 type 값 (REQ-CLUBB-002). */
// @MX:ANCHOR: [AUTO] Track B type 강제값 — createClub 이 이 값을 INSERT 본문에 고정
// @MX:REASON: instant 모임은 MVP 미지원이며, 이 값을 변경하면 Track B/Track A 분기 로직과 SPEC-FEED-001 스포일러 피드 진도 기준이 깨진다.
export const TRACKB_REQUIRED_TYPE: ClubType = 'group';

/** 런타임 검증용 status 배열 */
export const CLUB_STATUSES: readonly ClubStatus[] = ['active', 'closed'] as const;

/** gen-types 기반 테이블 Row 별칭 (단일 출처 재사용) */
export type ClubRow = Database['public']['Tables']['clubs']['Row'];
export type ClubInsert = Database['public']['Tables']['clubs']['Insert'];
export type ClubUpdate = Database['public']['Tables']['clubs']['Update'];
export type ClubMemberRow =
  Database['public']['Tables']['club_members']['Row'];

/**
 * Track B 모임 생성 입력 (REQ-CLUBB-001/004).
 *
 * gen-types clubs.Insert 기준 필드만 노출:
 * - bookId → book_id (NOT NULL FK)
 * - hostId → host_id (NOT NULL, auth.uid() 와 일치해야 RLS 통과)
 * - name → name (NOT NULL, SPEC 의 title 에 해당)
 * - description → description (선택, NULL 허용)
 * - maxMembers → max_members (선택, NULL 허용)
 *
 * 주의: type 은 입력에서 받지 않고 createClub 내부에서 'group' 으로 강제 (REQ-CLUBB-002).
 * status 는 DB 기본값('active')을 사용하므로 입력에서 제외.
 */
export interface CreateClubInput {
  bookId: string;
  hostId: string;
  name: string;
  description?: string | null;
  maxMembers?: number | null;
}
