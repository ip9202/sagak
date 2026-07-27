-- enforce_single_reading 정책 철회 for SPEC-LIBRARY-002 (병행 독서 지원)
-- Migration: drop_enforce_single_reading
-- Entity: user_books (서재)
-- Requirements: REQ-LIB2-001, REQ-LIB2-002, REQ-LIB2-003 (정책 철회)
--
-- 배경: SPEC-LIBRARY-001 정책 5.5(reading 단일 보장)이 제품 가정 오류로 판명되어
--       SPEC-LIBRARY-002에서 철회한다. 한 사용자가 0/1/N개의 reading 행을 보유할 수 있다.
--       기존 자동 배타 전환(enforce_single_reading 트리거/함수)과
--       동시성 최종 방어선(부분 UNIQUE 인덱스)을 모두 제거한다.
--
-- 구성 (순서 무관 — IF EXISTS 가드로 idempotent):
--   1. DROP TRIGGER enforce_single_reading        (REQ-LIB2-001)
--   2. DROP FUNCTION enforce_single_reading()     (REQ-LIB2-002)
--   3. DROP INDEX user_books_one_reading_per_user  (REQ-LIB2-003)
--   4. CREATE INDEX idx_user_books_user_status     (D11 — 성능 회귀 대응)
--
-- 비고:
--   - status 기본값 'shelved' 유지 (migration 20240630000001 에서 'reading'→'shelved' 로
--     변경된 값 그대로). 서재 추가(addBook)는 보관 상태로 시작하는 기존 UX 유지.
--   - 과거 enforce_single_reading 정책으로 자동 shelved 전환된 이력은 복구하지 않는다
--     (SPEC-LIBRARY-002 spec.md 본문: 사용자가 명시적으로 다시 "읽기 시작"해야 reading).
--   - UNIQUE(user_id, book_id) 복합 제약은 유지 — 동일 책 중복 등록은 여전히 409 Conflict.
--   - rollback 시 본 migration 의 idx_user_books_user_status DROP 이 선행되어야 한다
--     (가역성 — plan.md M1 리스크 기록).
--
-- @MX:NOTE: [AUTO] enforce_single_reading 정책 철회 per SPEC-LIBRARY-002
-- @MX:REASON: 한 사용자가 다중 reading 을 보유하는 병행 독서 지원. 자동 배타 전환 트리거/함수와
--   다중 reading 봉쇄 핵심인 부분 UNIQUE 인덱스를 함께 제거해야 의미가 있다 (단일 제거 시 잔여 방어선 동작).
-- @MX:SPEC SPEC-LIBRARY-002

-- ============================================================
-- 1. enforce_single_reading 트리거 제거 (REQ-LIB2-001)
--    BEFORE INSERT OR UPDATE OF status 트리거 — 알파벳순 최초 실행되던 배타 전환 트리거.
--    제거 후 잔여 BEFORE ROW 트리거(on_user_books_update, trg_user_books_updated_at)만 남는다.
-- ============================================================
DROP TRIGGER IF EXISTS enforce_single_reading ON public.user_books;

-- ============================================================
-- 2. enforce_single_reading 함수 제거 (REQ-LIB2-002)
--    함수 본문에 남은 의존성 없음 (트리거 먼저 제거됨).
-- ============================================================
DROP FUNCTION IF EXISTS public.enforce_single_reading();

-- ============================================================
-- 3. 부분 UNIQUE 인덱스 제거 (REQ-LIB2-003)
--    "동시성 최종 방어선"이자 다중 reading 봉쇄의 핵심 메커니즘.
--    제거 전에는 한 user_id 의 reading 행을 물리적으로 1개로 강제(23505).
--    제거 후 한 user_id 의 여러 reading 행이 허용된다.
-- ============================================================
DROP INDEX IF EXISTS public.user_books_one_reading_per_user;

-- ============================================================
-- 4. 조건부 일반 인덱스 신설 (D11 — 쿼리 성능 회귀 대응)
--    부분 UNIQUE 인덱스(user_id WHERE status='reading') 제거로
--    "WHERE user_id = ? AND status = 'reading'" 쿼리가 Seq Scan 으로 회귀할 수 있다.
--    다중 reading 도입으로 reading 행 수가 증가하므로 (user_id, status) 복합 인덱스로
--    다중 status 필터 쿼리(reading/completed/shelved)를 커버한다.
--    비-부분 인덱스이므로 모든 status 값의 user_id 조회를 커버 — 부분 인덱스보다 범용.
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_user_books_user_status
    ON public.user_books (user_id, status);

-- ============================================================
-- 문서화 갱신
--    함수/인덱스 COMMENT 는 객체 DROP 시 자동 삭제되므로 별도 조치 불필요.
-- ============================================================
