-- Enforce single-reading policy for SPEC-LIBRARY-001 (정책 5.5)
-- Migration: enforce_single_reading_policy
-- Entity: user_books (서재)
-- Requirements: REQ-LIB-020, REQ-LIB-023 (reading 단일 보장)
--
-- 정책: 한 사용자(user_id)는 동시에 최대 1개의 status='reading' 행만 보유한다.
-- 새 reading이 발생(INSERT reading 또는 타 상태→reading UPDATE)하면
-- 기존 reading 행은 자동으로 'shelved'로 배타 전환된다.
--
-- 구성 (순서 엄수 — 부분 UNIQUE 인덱스는 다중 reading이 존재하면 생성 실패):
--   1. 다중 reading 데이터 정리 (updated_at DESC 최신 1개만 잔류)
--   2. 부분 UNIQUE 인덱스 (동시성 최종 방어선)
--   3. status 기본값 'reading' → 'shelved'
--   4. enforce_single_reading() 함수 + BEFORE INSERT OR UPDATE OF status 트리거
--
-- @MX:ANCHOR: [AUTO] reading 단일 보장의 DB 단일 진실 원천 — 트리거 이름 enforce_single_reading 은
--   같은 시점 BEFORE ROW 트리거 알파벳순 실행 규칙에 의해 on_user_books_update / trg_user_books_updated_at
--   보다 먼저 실행되도록 보장한다. 이름 변경 금지 (실행 순서 의존).
-- @MX:REASON: 부분 UNIQUE 인덱스 검사 전에 기존 reading 을 shelved 로 전환하지 않으면
--   정상적인 배타 전환이 unique_violation(23505) 으로 오작동한다.
-- @MX:SPEC SPEC-LIBRARY-001

-- ============================================================
-- 1. 다중 reading 데이터 정리
--    사용자별 updated_at DESC 최신 1개만 reading 유지, 나머지 shelved 전환.
--    정리 시점엔 아직 enforce_single_reading 트리거가 없으므로 전환은 안전하게 no-op cascade.
--    (on_user_books_update 트리거는 발생하나 updated_at 갱신 외 부작용 없음.
--     completion_reports 트리거는 reading→completed 만 감지하므로 reading→shelved 에 반응하지 않음)
-- ============================================================
WITH ranked AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY user_id
               ORDER BY updated_at DESC, id DESC
           ) AS rn
    FROM public.user_books
    WHERE status = 'reading'
)
UPDATE public.user_books
SET status = 'shelved'
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- ============================================================
-- 2. 부분 UNIQUE 인덱스 — 동시성 최종 방어선
--    두 트랜잭션이 동시에 같은 user_id 에서 reading 전환 시 한쪽을 23505 unique_violation 으로 롤백.
--    클라이언트는 이미 23505 를 AppError(VALIDATION) 로 분류한다.
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS user_books_one_reading_per_user
    ON public.user_books (user_id)
    WHERE status = 'reading';

-- ============================================================
-- 3. status 기본값 변경: 'reading' → 'shelved'
--    서재 추가(addBook)는 보관(shelved) 상태로 시작하며,
--    사용자가 "읽기 시작"을 명시해야 reading 으로 전환된다.
-- ============================================================
ALTER TABLE public.user_books
    ALTER COLUMN status SET DEFAULT 'shelved';

-- ============================================================
-- 4. enforce_single_reading() 함수 + 트리거
--    BEFORE INSERT OR UPDATE OF status, FOR EACH ROW.
--    NEW.status='reading' 이고 이전이 reading 이 아니면 같은 user_id 의 다른 reading 을 shelved 로 전환.
-- ============================================================
CREATE OR REPLACE FUNCTION public.enforce_single_reading()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    -- defense-in-depth: cascade UPDATE 트리거 재진입 차단.
    -- (다른 행을 shelved 로 UPDATE 할 때 본 트리거가 재실행되어도 NEW.status='shelved' 이므로
    --  아래 조건이 불만족되어 자연 종료하지만, 깊이 가드로 이중 보장.)
    IF pg_trigger_depth() > 1 THEN
        RETURN NEW;
    END IF;

    -- INSERT 로 reading 이 되거나, UPDATE 로 비-reading → reading 전환 시에만 배타 전환 수행.
    -- UPDATE 에서 이미 reading 인 행(OLD.status='reading')은 no-op — 무의미한 자기 갱신/재귀 방지.
    IF NEW.status = 'reading'
       AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'reading')
    THEN
        UPDATE public.user_books
        SET status = 'shelved'
        WHERE user_id = NEW.user_id
          AND status = 'reading'
          AND id IS DISTINCT FROM NEW.id;
    END IF;

    RETURN NEW;
END;
$$;

-- 트리거 이름 enforce_single_reading 은 알파벳순 실행 보장에 기능적 (변경 금지).
DROP TRIGGER IF EXISTS enforce_single_reading ON public.user_books;
CREATE TRIGGER enforce_single_reading
    BEFORE INSERT OR UPDATE OF status ON public.user_books
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_single_reading();

-- ============================================================
-- 문서화
-- ============================================================
COMMENT ON FUNCTION public.enforce_single_reading() IS
    'reading 단일 정책(SPEC-LIBRARY-001 정책 5.5): 한 사용자의 reading 행을 최대 1개로 강제. 새 reading 발생 시 기존 reading 을 shelved 로 배타 전환.';
COMMENT ON INDEX public.user_books_one_reading_per_user IS
    'reading 단일 정책 부분 UNIQUE — 동시성 경쟁 시 한 사용자 reading 행을 1개로 강제(23505 최종 방어).';
