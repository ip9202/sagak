-- T-009: updated_at 자동 갱신 트리거
-- users, user_books, emotion_records에 BEFORE UPDATE 트리거 적용
-- 단일 재사용 가능한 set_updated_at() 함수로 DRY 원칙 준수 (3테이블 공용)
--
-- 배경: users, user_books는 기존 updated_at 컬럼 보유 (0001, 0003).
--       emotion_records는 created_at만 있었으므로 updated_at을 이 마이그레이션에서 추가.
-- idempotent: IF NOT EXISTS / OR REPLACE / DROP IF EXISTS 로 재실행 안전.

-- 1. emotion_records에 updated_at 컬럼 추가 (users, user_books는 기존 보유)
ALTER TABLE public.emotion_records
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 2. 재사용 가능한 공용 트리거 함수 (모든 테이블이 공유)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.set_updated_at() IS
    'T-009: BEFORE UPDATE 트리거용 updated_at 자동 갱신 함수. users, user_books, emotion_records 공용.';

-- 3. 각 테이블에 BEFORE UPDATE 트리거 연결 (idempotent)
DROP TRIGGER IF EXISTS trg_users_updated_at ON public.users;
CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_user_books_updated_at ON public.user_books;
CREATE TRIGGER trg_user_books_updated_at
    BEFORE UPDATE ON public.user_books
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_emotion_records_updated_at ON public.emotion_records;
CREATE TRIGGER trg_emotion_records_updated_at
    BEFORE UPDATE ON public.emotion_records
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
