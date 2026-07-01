-- ============================================================
-- 06_scenario_d_completion_reports.sql
-- 목적: 시나리오 D (completion_reports 무회귀) 검증.
--       reading -> shelved 전환 시 completion_reports 행이 생성되지 않는지 확인.
--       completion 트리거(generate_completion_report_trigger)는
--       reading -> completed 전환에서만 발생하므로, reading -> shelved 는
--       completion_reports 에 어떤 행도 추가하지 않아야 한다.
-- MUTATING 여부: MUTATING (테스트 INSERT/UPDATE + cleanup)
-- 시나리오: D (completion_reports 무회귀)
-- ============================================================
-- 준비: :test_user_id, :test_book_id 를 실제 uuid 리터럴로 치환.

-- ====================================================================
-- STEP D-1: 테스트 reading 행 생성 + 기준 completion_reports 카운트.
-- ====================================================================
INSERT INTO public.user_books (user_id, book_id, status, current_page)
VALUES (
    :'test_user_id'::uuid,
    :'test_book_id'::uuid,
    'reading',
    5
)
ON CONFLICT (user_id, book_id) DO UPDATE
SET status = 'reading', current_page = 5;

-- 테스트 user_book 의 id 확보
SELECT id AS test_user_book_id
FROM public.user_books
WHERE user_id = :'test_user_id'::uuid
  AND book_id = :'test_book_id'::uuid;

-- 기준 시점의 completion_reports 카운트 (이 user_book 기준)
SELECT count(*) AS completion_reports_before
FROM public.completion_reports
WHERE user_book_id = (
    SELECT id FROM public.user_books
    WHERE user_id = :'test_user_id'::uuid
      AND book_id = :'test_book_id'::uuid
);
-- 기대: 0 (아직 completed 된 적 없으므로)

-- ====================================================================
-- STEP D-2: reading -> shelved 전환.
--           enforce_single_reading 트리거는 no-op (OLD.status='reading' 이지만
--           이 행 자체가 UPDATE 대상이라 자기 갱신만). completion 트리거는
--           reading->completed 가 아니므로 발생하지 않아야 함.
-- ====================================================================
UPDATE public.user_books
SET status = 'shelved'
WHERE user_id = :'test_user_id'::uuid
  AND book_id = :'test_book_id'::uuid;

-- ====================================================================
-- STEP D-3: 검증 — completion_reports 에 새 행이 없어야 함.
-- ====================================================================
SELECT count(*) AS completion_reports_after
FROM public.completion_reports
WHERE user_book_id = (
    SELECT id FROM public.user_books
    WHERE user_id = :'test_user_id'::uuid
      AND book_id = :'test_book_id'::uuid
);
-- 기대: 0 (reading->shelved 는 completion 트리거 미발생)

-- user_book 상태 확인
SELECT id, status
FROM public.user_books
WHERE user_id = :'test_user_id'::uuid
  AND book_id = :'test_book_id'::uuid;
-- 기대: status = 'shelved'

-- ====================================================================
-- STEP D-4: cleanup — 테스트 행 삭제 (completion_reports 가 생기지 않았으므로
--           user_books 행만 삭제하면 됨; FK RESTRICT 충돌 없음).
-- ====================================================================
DELETE FROM public.user_books
WHERE user_id = :'test_user_id'::uuid
  AND book_id = :'test_book_id'::uuid;
