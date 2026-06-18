-- handle_new_user 트리거 함수 컬럼 오타 수정
-- 배경: 기존 함수가 NEW.raw_user_id_data (auth.users 에 없는 컬럼) 에서 provider/nickname/avatar 를
--       읽어 provider 가 항상 null 이 되고, provider CHECK(migration 18) 위반으로
--       신규 OAuth 가입이 "Database error saving new user" 로 전체 rollback 되었다.
-- 수정:
--   - provider  -> NEW.raw_app_meta_data (Supabase GoTrue 가 provider 를 app meta 에 저장)
--   - nickname  -> NEW.raw_user_meta_data (name/full_name/nickname 우선, 폴백 email localpart)
--   - avatar    -> NEW.raw_user_meta_data (avatar_url/picture)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.users (id, email, nickname, avatar_url, provider)
    VALUES (
        NEW.id,
        NEW.email,
        left(
            COALESCE(
                NEW.raw_user_meta_data->>'name',
                NEW.raw_user_meta_data->>'full_name',
                NEW.raw_user_meta_data->>'nickname',
                split_part(NEW.email, '@', 1)
            ),
            20
        ),
        COALESCE(
            NEW.raw_user_meta_data->>'avatar_url',
            NEW.raw_user_meta_data->>'picture'
        ),
        NEW.raw_app_meta_data->>'provider'
    );
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS
    'auth.users INSERT 시 public.users 프로필 행 생성. provider=raw_app_meta_data, nickname/avatar=raw_user_meta_data (2026-06-18 컬럼 오타 수정).';
