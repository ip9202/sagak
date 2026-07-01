-- ============================================================
-- 00_pre_impact_measure.sql
-- 목적: enforce_single_reading_policy 마이그레이션 적용 전,
--       다중 reading 사용자 수와 정리 대상 행 수를 정량화한다.
--       rollback 기준점 확보 + Phase 3 시나리오 E 교차 검증용.
-- MUTATING 여부: SELECT-only (쓰기 없음)
-- 시나리오: 사전 측정 (Phase 0)
-- ============================================================

-- (1) 다중 reading 행을 가진 사용자 수
WITH ranked AS (
    SELECT user_id,
           ROW_NUMBER() OVER (
               PARTITION BY user_id
               ORDER BY updated_at DESC, id DESC
           ) AS rn
    FROM public.user_books
    WHERE status = 'reading'
)
SELECT count(DISTINCT user_id) AS multi_reading_user_count
FROM ranked
WHERE rn > 1;

-- (2) 정리 대상 행 수 (rn>1, 즉 shelved 로 전환될 행)
--     마이그레이션 Step-1 이 정확히 이 행들을 갱신한다.
WITH ranked AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY user_id
               ORDER BY updated_at DESC, id DESC
           ) AS rn
    FROM public.user_books
    WHERE status = 'reading'
)
SELECT count(*) AS cleanup_target_row_count
FROM ranked
WHERE rn > 1;

-- (3) 사용자별 현재 reading 행 분해 (어떤 행이 보존/전환될지 사전 점검)
--     kept_expected = true 인 행이 마이그레이션 후에도 reading 으로 잔류해야 한다.
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
SELECT
    user_id,
    id,
    book_id,
    status,
    updated_at,
    rn,
    CASE WHEN rn = 1 THEN true ELSE false END AS kept_expected
FROM ranked
WHERE EXISTS (
    SELECT 1 FROM ranked r2
    WHERE r2.user_id = ranked.user_id AND r2.rn > 1
)
ORDER BY user_id, rn;
