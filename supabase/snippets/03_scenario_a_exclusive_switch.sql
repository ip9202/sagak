-- ============================================================
-- 03_scenario_a_exclusive_switch.sql
-- 목적: 시나리오 A (배타 전환) 검증.
--       새 reading INSERT (또는 비-reading -> reading UPDATE) 시
--       기존 reading 행이 자동으로 shelved 로 전환되는지 확인.
-- MUTATING 여부: MUTATING (테스트 INSERT/UPDATE + cleanup 포함)
-- 시나리오: A (exclusive switch)
-- ============================================================
-- 준비: 아래 :test_user_id, :test_book_id_a, :test_book_id_b 자리에
--       실제 존재하는 user_id 와 books 테이블의 book_id 두 개를 대입.
--       Supabase SQL Editor 에서는 변수 바인딩을 지원하지 않으므로,
--       리터럴 uuid 문자열로 직접 치환하여 실행할 것.
--       예: '11111111-1111-1111-1111-111111111111' 형태.

-- ====================================================================
-- STEP A-1: 테스트용 기존 reading 행 확보 (또는 생성).
-- ====================================================================

-- 기존 reading 행이 있는지 확인. 없으면 아래 INSERT 블록으로 생성.
-- (사용자 치환 후 주석 해제하여 실행)
/*
INSERT INTO public.user_books (user_id, book_id, status, current_page)
VALUES (
    :'test_user_id'::uuid,
    :'test_book_id_a'::uuid,
    'reading',
    10
);
*/

-- 기존 reading 행 id 를 변수로 저장 (SQL Editor 변수 미지원이므로 결과를 눈으로 확인)
SELECT id, user_id, book_id, status
FROM public.user_books
WHERE user_id = :'test_user_id'::uuid
  AND status = 'reading';
-- 기록: 위 결과의 id 를 prior_reading_id 로 메모 (다음 단계 검증용).

-- ====================================================================
-- STEP A-2: 새 reading 행 INSERT -> 트리거가 prior reading 을 shelved 로 전환해야 함.
-- ====================================================================

INSERT INTO public.user_books (user_id, book_id, status, current_page)
VALUES (
    :'test_user_id'::uuid,
    :'test_book_id_b'::uuid,
    'reading',
    5
);

-- ====================================================================
-- STEP A-3: 검증 — 이전 reading 행이 shelved 로, 새 행이 reading 으로.
-- ====================================================================

SELECT id, book_id, status, updated_at
FROM public.user_books
WHERE user_id = :'test_user_id'::uuid
  AND book_id IN (:'test_book_id_a'::uuid, :'test_book_id_b'::uuid)
ORDER BY book_id;
-- 기대:
--   book_id_a -> status = 'shelved' (배타 전환됨)
--   book_id_b -> status = 'reading' (새로 삽입됨)

-- 사용자별 reading 행 수 (반드시 1이어야 함)
SELECT count(*) AS reading_count_for_test_user
FROM public.user_books
WHERE user_id = :'test_user_id'::uuid
  AND status = 'reading';
-- 기대: 1

-- ====================================================================
-- STEP A-4: cleanup — 테스트 행 삭제하여 잔류물 제거.
--           (테스트 전용 book/user 를 사용한 경우에만 삭제.
--            실제 사용자/도서를 재사용했다면 status 만 원래 상태로 복원)
-- ====================================================================

DELETE FROM public.user_books
WHERE user_id = :'test_user_id'::uuid
  AND book_id IN (:'test_book_id_a'::uuid, :'test_book_id_b'::uuid);
