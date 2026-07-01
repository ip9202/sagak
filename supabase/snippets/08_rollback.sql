-- ============================================================
-- 08_rollback.sql
-- 목적: enforce_single_reading_policy 마이그레이션 롤백.
--       트리거, 함수, 부분 UNIQUE 인덱스를 제거하고 status 기본값을
--       'reading' 으로 되돌린다.
-- MUTATING 여부: MUTATING (DROP TRIGGER / DROP FUNCTION / DROP INDEX / ALTER TABLE)
-- 시나리오: 롤백 (Phase 비상)
-- ============================================================
--
-- ⚠️ 중요 경고:
--   본 스크립트는 객체(트리거/함수/인덱스/기본값)만 제거한다.
--   마이그레이션 Step-1 정리로 인해 'shelved' 로 전환된 행은
--   자동으로 'reading' 으로 복원되지 않는다.
--   행 단위 복원은 01_backup_affected_rows.sql 로 만든
--   public.backup_enforce_single_reading 백업 테이블이 필요하다.
--
--   복원 순서 (행 단위 복원이 필요한 경우):
--     1) 본 08_rollback.sql 을 먼저 실행 (부분 UNIQUE 인덱스 제거)
--     2) 아래 주석 처리된 행 복원 쿼리를 실행
--        (부분 UNIQUE 가 제거된 상태에서만 다중 reading 복원 가능)

-- (1) 트리거 제거
DROP TRIGGER IF EXISTS enforce_single_reading ON public.user_books;

-- (2) 함수 제거
DROP FUNCTION IF EXISTS public.enforce_single_reading();

-- (3) 부분 UNIQUE 인덱스 제거
DROP INDEX IF EXISTS public.user_books_one_reading_per_user;

-- (4) status 기본값을 원래('reading')로 복원
ALTER TABLE public.user_books
    ALTER COLUMN status SET DEFAULT 'reading';

-- ============================================================
-- 행 단위 복원 (선택적 — 백업 테이블이 존재할 때만)
-- 주의: 반드시 위 (1)~(4) 롤백 완료 후 실행할 것.
--       부분 UNIQUE 인덱스가 살아있으면 다중 reading 복원 시 23505 발생.
-- ============================================================
-- W4 런타임 가드 (주석 해제 시 활성화): 부분 UNIQUE 인덱스가 살아있으면 다중 reading 복원이 23505로 폭발·부분 복원된다.
-- 반드시 위 (1)~(4) 롤백(인덱스 제거) 완료 후에만 실행할 것.
/*
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_class c
        WHERE c.relname = 'user_books_one_reading_per_user'
    ) THEN
        RAISE EXCEPTION '부분 UNIQUE 인덱스 user_books_one_reading_per_user 가 아직 존재합니다. 08 (1)~(4) 롤백을 먼저 실행하세요.';
    END IF;
END $$;
*/

/*
UPDATE public.user_books ub
SET status = b.original_status
FROM public.backup_enforce_single_reading b
WHERE ub.id = b.original_id;
*/

-- ============================================================
-- 롤백 확인 (SELECT-only)
-- ============================================================

-- 트리거가 제거되었는지 확인 (0행이어야 함)
SELECT t.tgname
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
WHERE c.relname = 'user_books'
  AND t.tgname = 'enforce_single_reading'
  AND NOT t.tgisinternal;
-- 기대: 0행

-- 함수가 제거되었는지 확인
SELECT proname
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname = 'enforce_single_reading';
-- 기대: 0행

-- 인덱스가 제거되었는지 확인
SELECT indexname
FROM pg_indexes
WHERE tablename = 'user_books'
  AND indexname = 'user_books_one_reading_per_user';
-- 기대: 0행

-- 기본값이 'reading' 으로 복원되었는지 확인
SELECT column_name, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'user_books'
  AND column_name = 'status';
-- 기대: column_default = 'reading'::text
