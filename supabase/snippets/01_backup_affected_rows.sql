-- ============================================================
-- 01_backup_affected_rows.sql
-- 목적: 마이그레이션 Step-1 정리로 인해 shelved 로 전환될 행들의
--       원본 상태를 백업 테이블에 보존한다 (행 단위 복원용).
-- MUTATING 여부: MUTATING (CREATE TABLE + INSERT)
-- 시나리오: Phase 1 백업
-- ============================================================

-- 백업 테이블 생성 (idempotent — 재실행 시 IF NOT EXISTS 유지).
CREATE TABLE IF NOT EXISTS public.backup_enforce_single_reading (
    backup_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    backed_up_at timestamptz NOT NULL DEFAULT now(),
    original_id uuid NOT NULL,
    user_id uuid NOT NULL,
    book_id uuid NOT NULL,
    original_status text NOT NULL,
    updated_at timestamptz
);

-- 정리 대상(rn>1) 행만 백업에 적재.
-- 이미 백업이 존재할 경우 중복 적재를 방지하기 위해 NOT EXISTS 가드 사용.
INSERT INTO public.backup_enforce_single_reading (
    original_id, user_id, book_id, original_status, updated_at
)
WITH ranked AS (
    SELECT id,
           user_id,
           book_id,
           status,
           updated_at,
           ROW_NUMBER() OVER (
               PARTITION BY user_id
               ORDER BY updated_at DESC, id DESC
           ) AS rn
    FROM public.user_books
    WHERE status = 'reading'
)
SELECT r.id, r.user_id, r.book_id, r.status, r.updated_at
FROM ranked r
WHERE r.rn > 1
  AND NOT EXISTS (
      SELECT 1 FROM public.backup_enforce_single_reading b
      WHERE b.original_id = r.id
  );

-- 백업 행 수 확인 (Phase 0 의 cleanup_target_row_count 와 일치해야 함).
SELECT count(*) AS backup_row_count,
       count(DISTINCT user_id) AS affected_user_count
FROM public.backup_enforce_single_reading;
