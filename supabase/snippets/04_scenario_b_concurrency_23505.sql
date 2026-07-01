-- ============================================================
-- 04_scenario_b_concurrency_23505.sql
-- 목적: 시나리오 B (동시성 23505) 검증.
--       진정한 동시성은 단일 SQL Editor 세션에서 재현 불가하므로,
--       단일 연결 시뮬레이션으로 부분 UNIQUE 인덱스가 두 번째 reading
--       INSERT 를 unique_violation(23505) 로 거부하는지 확인한다.
-- MUTATING 여부: MUTATING (테스트 INSERT + cleanup)
-- 시나리오: B (concurrency 23505)
-- ============================================================
--
-- 중요: 본 스니펫은 "단일 연결 시뮬레이션"이다.
--   - 트리거가 첫 reading INSERT 시 이미 존재하던 다른 reading 행을 shelved 로
--     전환하므로, 직렬 실행에서는 부분 UNIQUE 위반이 발생하지 않는다.
--   - 진정한 동시성 경쟁(두 트랜잭션이 동시에 같은 user_id 에 reading 삽입)은
--     psql 의 BEGIN + 두 세션 으로만 재현 가능하며, SQL Editor 단일 세션으로는 불가.
--   - 따라서 부분 UNIQUE 인덱스가 존재하고 valid 하며 올바른 WHERE 절을 가지는지
--     확인하는 것으로 동시성 방어선 존재 여부를 검증한다.
--     (트리거는 best-effort single-winner 최적화이며,
--      부분 UNIQUE 인덱스가 동시성의 권위 있는 최종 방어선이다.)
--
-- 준비: :test_user_id, :test_book_id 자리를 실제 uuid 리터럴로 치환.

-- ====================================================================
-- STEP B-1: 첫 reading 행을 강제로 준비 (트리거 통한 정상 경로).
-- ====================================================================
INSERT INTO public.user_books (user_id, book_id, status, current_page)
VALUES (
    :'test_user_id'::uuid,
    :'test_book_id'::uuid,
    'reading',
    3
)
ON CONFLICT (user_id, book_id) DO UPDATE
SET status = 'reading', current_page = 3;

-- ====================================================================
-- STEP B-2: 부분 UNIQUE 인덱스 존재/valid/WHERE 절 확인 (권위 있는 방어선).
-- ====================================================================
SELECT
    i.indexname,
    i.indexdef,
    ix.indisvalid,
    ix.indisunique,
    pg_get_expr(ix.indpred, ix.indrelid) AS partial_predicate
FROM pg_indexes i
JOIN pg_class c ON c.relname = i.tablename
JOIN pg_index ix ON ix.indexrelid = c.oid
JOIN pg_class ic ON ic.oid = ix.indexrelid
JOIN pg_namespace n ON n.oid = ic.relnamespace
WHERE i.tablename = 'user_books'
  AND ic.relname = 'user_books_one_reading_per_user';
-- 기대:
--   indisvalid = true, indisunique = true
--   partial_predicate = ((status)::text = 'reading'::text)

-- ====================================================================
-- STEP B-3: 동시성 시뮬레이션 설명 (psql 두 세션 시나리오 — 참고용).
--   SQL Editor 에서는 실행하지 말 것. 아래는 절차 설명 전용 주석.
-- ====================================================================
-- 세션 1:  BEGIN;
--          INSERT INTO user_books(user_id, book_id, status)
--          VALUES (:test_user_id, :book_a, 'reading');  -- 아직 커밋 안 함
-- 세션 2:  INSERT INTO user_books(user_id, book_id, status)
--          VALUES (:test_user_id, :book_b, 'reading');
--          -> 세션1이 커밋한 후 부분 UNIQUE 가 위반을 감지하여
--             ERROR: duplicate key value violates unique constraint
--             "user_books_one_reading_per_user" (SQLSTATE 23505) 발생
-- 세션 1:  COMMIT;
-- 결론: 정확히 한쪽만 성공, 다른 쪽은 23505 롤백. 클라이언트는 23505를
--       AppError(VALIDATION) 로 분류한다.

-- ====================================================================
-- STEP B-4: cleanup — 테스트 행 삭제.
-- ====================================================================
DELETE FROM public.user_books
WHERE user_id = :'test_user_id'::uuid
  AND book_id = :'test_book_id'::uuid;
