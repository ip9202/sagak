-- ============================================================
-- 07_post_verify.sql
-- 목적: 마이그레이션 적용 후 객체 무결성 최종 점검.
--       부분 UNIQUE 인덱스, 트리거, 함수, status 기본값, 트리거 실행 순서 확인.
-- MUTATING 여부: SELECT-only (쓰기 없음)
-- 시나리오: 사후 검증 (Phase 5)
-- ============================================================

-- (1) 부분 UNIQUE 인덱스 존재 + valid + unique + WHERE 절 확인
SELECT
    ic.relname AS index_name,
    ix.indisvalid AS is_valid,
    ix.indisunique AS is_unique,
    pg_get_expr(ix.indpred, ix.indrelid) AS partial_predicate,
    n.nspname AS schema_name
FROM pg_index ix
JOIN pg_class ic ON ic.oid = ix.indexrelid
JOIN pg_class tc ON tc.oid = ix.indrelid
JOIN pg_namespace n ON n.oid = ic.relnamespace
WHERE ic.relname = 'user_books_one_reading_per_user'
  AND tc.relname = 'user_books';
-- 기대:
--   is_valid = true, is_unique = true
--   partial_predicate = ((status)::text = 'reading'::text)
--   schema_name = public

-- (2) enforce_single_reading 트리거 존재 + enabled
SELECT
    t.tgname,
    t.tgenabled,            -- O = enabled origin
    pg_get_triggerdef(t.oid) AS trigger_def
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
WHERE c.relname = 'user_books'
  AND t.tgname = 'enforce_single_reading'
  AND NOT t.tgisinternal;
-- 기대: 1행 반환, tgenabled = 'O'
--   trigger_def 에 BEFORE INSERT OR UPDATE OF status ... FOR EACH ROW 포함

-- (3) enforce_single_reading() 함수 존재
SELECT
    n.nspname AS schema_name,
    p.proname AS function_name,
    l.lanname AS language,
    pg_get_functiondef(p.oid) AS function_def
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
JOIN pg_language l ON l.oid = p.prolang
WHERE p.proname = 'enforce_single_reading';
-- 기대: 1행 반환, language = plpgsql

-- (4) status 컬럼 기본값 'shelved'
SELECT
    column_name,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'user_books'
  AND column_name = 'status';
-- 기대: column_default = 'shelved'::text (또는 'shelved'::character varying 등)

-- (5) 트리거 실행 순서 검증 (알파벳순 BEFORE ROW)
--     enforce_single_reading 이 on_user_books_update, trg_user_books_updated_at 보다
--     알파벳 기준으로 먼저 와야 함 (같은 timing(before row) + 같은 event 내에서).
SELECT
    t.tgname,
    (t.tgtype & 2) <> 0 AS is_before,
    (t.tgtype & 1) = 0  AS is_row_level
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
WHERE c.relname = 'user_books'
  AND NOT t.tgisinternal
ORDER BY t.tgname;
-- 기대 순서(알파벳):
--   enforce_single_reading    (before, row)
--   generate_completion_report_trigger
--   on_user_books_update
--   trg_user_books_updated_at
-- enforce_single_reading 가 on_user_books_update / trg_user_books_updated_at 보다
-- 알파벳 선행해야 함 — 이름 불변 원칙의 효과 확인.

-- (6) post-cleanup 불변조건 재확인: 모든 사용자 reading 행 <= 1
WITH reading_per_user AS (
    SELECT user_id, count(*) AS reading_count
    FROM public.user_books
    WHERE status = 'reading'
    GROUP BY user_id
)
SELECT count(*) AS users_with_multiple_reading
FROM reading_per_user
WHERE reading_count > 1;
-- 기대: 0
