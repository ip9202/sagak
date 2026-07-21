-- clubs 테이블에 진도 계획 컬럼 추가 (SPEC-CLUB-002)
-- Migration: 0006_add_club_reading_plan_columns
-- Entity: clubs (독서 모임)
-- Requirements: REQ-CLUBB-004, REQ-CLUBB-009, REQ-CLUBB-010, REQ-CLUBB-011
--
-- 배경:
--   SPEC-CLUB-002 plan/spec가 가정한 진도 계획 컬럼(daily_pages, trigger_page,
--   duration_days)이 SPEC-DB-001 gen-types(src/types/supabase.ts)에 누락되어 있음.
--   1:1 모임 속성이므로 별도 테이블 대신 clubs에 직접 추가.
--
-- 설계 원칙:
--   - 모임 생성 시 선택적(NULL 허용) — 0명 출발 정책(REQ-CLUBB-003)과 일관되게
--     모임 개설 즉시 활성화되며, 진도 계획은 host가 추후 설정 가능
--   - daily_pages / trigger_page / duration_days 모두 음이 아닌 정수(CHECK 제약)
--   - SPEC-CLUB-002 진도 동기화(REQ-CLUBB-PROGRESS)에서 host만 UPDATE(기존
--     clubs RLS UPDATE 정책 auth.uid()=host_id 가 자동 커버, 정책 추가 불필요)
--
-- RLS 영향:
--   기존 clubs RLS 정책(0014_enable_rls.sql Step 9)은 테이블 수준으로 신규
--   컬럼을 자동 커버. 추가 정책 없음.
--
-- 트리거 영향:
--   handle_new_club_host(0004_create_clubs.sql)는 club_members INSERT만 수행하므로
--   신규 컬럼 영향 없음.

-- ============================================================================
-- Step 1: 진도 계획 컬럼 추가
-- ============================================================================

-- 일일 권장 페이지 수 (REQ-CLUBB-004, REQ-CLUBB-009)
-- host가 모임원 읽기 속도에 맞춰 설정. SPEC-FEED-001 진도 기준으로 사용.
ALTER TABLE public.clubs
    ADD COLUMN IF NOT EXISTS daily_pages integer
    CHECK (daily_pages IS NULL OR daily_pages >= 0);

-- 트리거 페이지 (REQ-CLUBB-004, REQ-CLUBB-010)
-- 특정 페이지 도달 시 이벤트 기준. 진도 동기화 시 host만 업데이트.
ALTER TABLE public.clubs
    ADD COLUMN IF NOT EXISTS trigger_page integer
    CHECK (trigger_page IS NULL OR trigger_page >= 0);

-- 목표 완독 기간(일 단위) (REQ-CLUBB-004)
ALTER TABLE public.clubs
    ADD COLUMN IF NOT EXISTS duration_days integer
    CHECK (duration_days IS NULL OR duration_days >= 0);

-- ============================================================================
-- Step 2: 컬럼 주석
-- ============================================================================
COMMENT ON COLUMN public.clubs.daily_pages IS '일일 권장 페이지 수 (host 설정, 진도 동기화 기준, NULL 허용)';
COMMENT ON COLUMN public.clubs.trigger_page IS '트리거 페이지 — 특정 페이지 도달 시 이벤트 기준 (host 설정, NULL 허용)';
COMMENT ON COLUMN public.clubs.duration_days IS '목표 완독 기간(일 단위, host 설정, NULL 허용)';

-- ============================================================================
-- 검증 쿼리 (개발 중 수동 점검용)
-- ============================================================================
-- \d+ public.clubs
-- SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--   WHERE table_schema='public' AND table_name='clubs'
--   ORDER BY ordinal_position;
