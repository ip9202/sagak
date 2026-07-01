-- ============================================================
-- 03_scenario_a_exclusive_switch.sql
-- 목적: 시나리오 A (배타 전환) 검증.
--       새 reading INSERT (또는 비-reading -> reading UPDATE) 시
--       기존 reading 행이 자동으로 shelved 로 전환되는지 확인.
-- MUTATING 여부: MUTATING (테스트 INSERT/UPDATE + cleanup 포함)
-- 시나리오: A (exclusive switch)
-- ============================================================
-- ⚠️ 준비 (W1 안전 가드): 본 스크립트는 더미 UUID(00000000-...)를 기본값으로 사용한다.
--   SQL Editor는 psql 변수 바인딩(:var)을 지원하지 않으므로 구문 오류를 유발한다.
--   실행 전 더미 UUID를 '실제 테스트 전용 계정/도서 UUID'로 치환하라.
--   - 운용 계정(본인/동료) UUID를 절대 사용하지 말 것 (BYPASSRLS → 실데이터 파괴).
--   - 각 MUTATING 문 실행 전 반드시 SELECT로 대상 행을 먼저 확인할 것.
--   - 치환 누락 시 더미 UUID로 실행되어(안전), 실패를 알린다.

-- ====================================================================
-- STEP A-1: 테스트용 기존 reading 행 확보 (또는 생성).
-- ====================================================================

-- 기존 reading 행이 있는지 확인. 없으면 아래 INSERT 블록으로 생성.
-- (사용자 치환 후 주석 해제하여 실행)
/*
INSERT INTO public.user_books (user_id, book_id, status, current_page)
VALUES (
    '00000000-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-0000000000a1'::uuid,
    'reading',
    10
)
ON CONFLICT (user_id, book_id) DO UPDATE
SET status = 'reading', current_page = 10;
*/

-- 기존 reading 행 id 를 변수로 저장 (SQL Editor 변수 미지원이므로 결과를 눈으로 확인)
SELECT id, user_id, book_id, status
FROM public.user_books
WHERE user_id = '00000000-0000-0000-0000-000000000001'::uuid
  AND status = 'reading';
-- 기록: 위 결과의 id 를 prior_reading_id 로 메모 (다음 단계 검증용).

-- ====================================================================
-- STEP A-2: 새 reading 행 INSERT -> 트리거가 prior reading 을 shelved 로 전환해야 함.
-- ====================================================================

INSERT INTO public.user_books (user_id, book_id, status, current_page)
VALUES (
    '00000000-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-0000000000b2'::uuid,
    'reading',
    5
)
ON CONFLICT (user_id, book_id) DO UPDATE
SET status = 'reading', current_page = 5;

-- ====================================================================
-- STEP A-3: 검증 — 이전 reading 행이 shelved 로, 새 행이 reading 으로.
-- ====================================================================

SELECT id, book_id, status, updated_at
FROM public.user_books
WHERE user_id = '00000000-0000-0000-0000-000000000001'::uuid
  AND book_id IN ('00000000-0000-0000-0000-0000000000a1'::uuid, '00000000-0000-0000-0000-0000000000b2'::uuid)
ORDER BY book_id;
-- 기대:
--   book_id_a -> status = 'shelved' (배타 전환됨)
--   book_id_b -> status = 'reading' (새로 삽입됨)

-- 사용자별 reading 행 수 (반드시 1이어야 함)
SELECT count(*) AS reading_count_for_test_user
FROM public.user_books
WHERE user_id = '00000000-0000-0000-0000-000000000001'::uuid
  AND status = 'reading';
-- 기대: 1

-- ====================================================================
-- STEP A-4: cleanup — 테스트 행 삭제하여 잔류물 제거.
--           (테스트 전용 book/user 를 사용한 경우에만 삭제.
--            실제 사용자/도서를 재사용했다면 status 만 원래 상태로 복원)
-- ====================================================================

DELETE FROM public.user_books
WHERE user_id = '00000000-0000-0000-0000-000000000001'::uuid
  AND book_id IN ('00000000-0000-0000-0000-0000000000a1'::uuid, '00000000-0000-0000-0000-0000000000b2'::uuid);
