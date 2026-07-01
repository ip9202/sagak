-- ============================================================
-- 02_scenario_e_cleanup_determinism.sql
-- 목적: 마이그레이션 Step-1 정리 후, 모든 사용자가 reading 행을
--       최대 1개만 가지며, 보존된 행이 updated_at DESC, id DESC 기준
--       최신인지 검증한다 (Phase 3 시나리오 E).
-- MUTATING 여부: SELECT-only (쓰기 없음)
-- 시나리오: E (정리 결정성)
-- 전제: 01_backup_affected_rows.sql 이 먼저 실행되어 백업 테이블이 존재.
-- ============================================================

-- (1) post-cleanup 불변조건: 다중 reading 사용자가 0명이어야 함.
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

-- (2) 결정성 교차 검증: 백업 테이블에 기록된 영향 사용자별로,
--     현재 reading 으로 잔류한 행이 [원본 updated_at DESC, id DESC] 기준 최신인지 확인.
--     abnormal_users = 0 이어야 한다.
--
-- ⚠️ 핵심: 정렬 키는 반드시 '원본 updated_at' 이어야 한다.
--   마이그레이션 Step-1 정리로 shelved 로 전환된 행들은 trg_user_books_updated_at
--   트리거에 의해 updated_at 이 갱신된다. 반면 보존된 rn=1 reading 행은 갱신되지 않는다.
--   따라서 현재 user_books.updated_at 으로 정렬하면 전환된 행이 더 최신으로 잘못 집계되어
--   rn=1 이 전환 행으로 뒤바뀐다 (정상 케이스를 abnormal 로 오판 = 거짓 양성).
--   해결: 정렬 키를 원본 updated_at 으로 통일한다.
--     - 전환 행(rn>1 이었음) -> 백업 테이블의 원본 updated_at
--     - 보존 reading 행(rn=1 이었음) -> 정리 시 갱신되지 않았으므로 현재 updated_at = 원본
WITH affected_users AS (
    SELECT DISTINCT user_id
    FROM public.backup_enforce_single_reading
),
current_reading AS (
    SELECT ub.id, ub.user_id, ub.book_id, ub.updated_at
    FROM public.user_books ub
    JOIN affected_users au ON au.user_id = ub.user_id
    WHERE ub.status = 'reading'
),
candidates AS (
    -- 전환된 행(rn>1): 백업 원본 updated_at
    SELECT original_id AS id, user_id, updated_at AS orig_updated_at
    FROM public.backup_enforce_single_reading
    UNION ALL
    -- 보존 reading 행(rn=1): 정리 시 갱신 안 됨 = 원본 updated_at
    SELECT ub.id, ub.user_id, ub.updated_at AS orig_updated_at
    FROM public.user_books ub
    JOIN affected_users au ON au.user_id = ub.user_id
    WHERE ub.status = 'reading'
),
expected_latest AS (
    -- 마이그레이션 정리 기준과 동일: [원본 updated_at DESC, id DESC] 의 rn=1 행
    SELECT id, user_id
    FROM (
        SELECT id,
               user_id,
               ROW_NUMBER() OVER (
                   PARTITION BY user_id
                   ORDER BY orig_updated_at DESC, id DESC
               ) AS rn
        FROM candidates
    ) ranked
    WHERE rn = 1
)
SELECT
    cr.user_id,
    count(*) FILTER (WHERE NOT EXISTS (
        SELECT 1 FROM expected_latest el WHERE el.id = cr.id
    )) AS abnormal_rows
FROM current_reading cr
GROUP BY cr.user_id
HAVING count(*) FILTER (WHERE NOT EXISTS (
    SELECT 1 FROM expected_latest el WHERE el.id = cr.id
)) > 0;
-- 기대: 0행 반환 (모든 영향 사용자의 보존 reading 행이 최신과 일치)

-- (3) 요약: 영향 사용자 수 vs 현재 reading 행 보유 사용자 수
SELECT
    (SELECT count(DISTINCT user_id) FROM public.backup_enforce_single_reading) AS affected_users_total,
    (SELECT count(DISTINCT user_id) FROM public.user_books WHERE status = 'reading') AS current_reading_users_total;
