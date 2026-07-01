-- ============================================================
-- 05_scenario_c_noop.sql
-- 목적: 시나리오 C (no-op) 검증.
--       이미 status='reading' 인 행을 UPDATE 로 다시 'reading' 으로
--       설정할 때, 자기 자신/다른 reading 행에 부작용이 없는지 확인.
--       enforce_single_reading 트리거는 OLD.status='reading' 이면
--       분기를 타지 않으므로 no-op 여야 한다.
-- MUTATING 여부: MUTATING (테스트 UPDATE + cleanup)
-- 시나리오: C (no-op)
-- ============================================================
-- 준비: :test_user_id, :test_book_id_a, :test_book_id_b 를 실제 uuid 리터럴로 치환.
--       (book_a 는 기존 reading, book_b 는 두 번째 reading 후보 — no-op 검증용)

-- ====================================================================
-- STEP C-1: 기준 상태 만들기 — test_user 의 reading 행을 book_a 로 하나 둔다.
-- ====================================================================
INSERT INTO public.user_books (user_id, book_id, status, current_page)
VALUES (
    :'test_user_id'::uuid,
    :'test_book_id_a'::uuid,
    'reading',
    7
)
ON CONFLICT (user_id, book_id) DO UPDATE
SET status = 'reading', current_page = 7;

-- 현재 reading 행 id 기록 (이 행이 no-op UPDATE 후에도 변경 없어야 함)
SELECT id AS prior_reading_id, book_id, status
FROM public.user_books
WHERE user_id = :'test_user_id'::uuid
  AND status = 'reading';

-- ====================================================================
-- STEP C-2: no-op UPDATE — 동일 행을 status='reading' 으로 다시 설정.
--           current_page 만 살짝 바꿔 UPDATE 가 발생하도록 유도.
-- ====================================================================
UPDATE public.user_books
SET status = 'reading',
    current_page = 8
WHERE user_id = :'test_user_id'::uuid
  AND book_id = :'test_book_id_a'::uuid;

-- ====================================================================
-- STEP C-3: 검증 — reading 행이 여전히 정확히 1개이고,
--           book_a 가 그대로 reading 이며, 의도치 않은 배타 전환 부재.
--           (별도 book_b reading 행을 만들지 않았으므로 reading_count=1 유지)
-- ====================================================================
SELECT id, book_id, status, current_page
FROM public.user_books
WHERE user_id = :'test_user_id'::uuid
  AND book_id = :'test_book_id_a'::uuid;
-- 기대: status = 'reading', current_page = 8 (의도한 갱신만)

SELECT count(*) AS reading_count_for_test_user
FROM public.user_books
WHERE user_id = :'test_user_id'::uuid
  AND status = 'reading';
-- 기대: 1 (spurious cascade 없음)

-- ====================================================================
-- STEP C-4: 추가 검증 — 더 많은 reading 행이 있었더라도 self no-op 인 경우
--           자기 자신은 보존되는지. (트리거 로직 id IS DISTINCT FROM NEW.id)
--           book_b 를 별도 reading 으로 두지는 않는다 (부분 UNIQUE 위반).
--           대신 OLD.status='reading' 분기 미탑 검증은 위 C-3 로 충분.
-- ====================================================================

-- ====================================================================
-- STEP C-5: cleanup — 테스트 행 삭제.
-- ====================================================================
DELETE FROM public.user_books
WHERE user_id = :'test_user_id'::uuid
  AND book_id = :'test_book_id_a'::uuid;
