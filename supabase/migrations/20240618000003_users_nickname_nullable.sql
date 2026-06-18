-- nickname 컬럼을 nullable 로 변경 + handle_new_user 가 신규 사용자 nickname 을 NULL 로 생성
-- 배경: nickname NOT NULL + handle_new_user 자동 기본값(name/email localpart) 조합이
--       신규 가입 즉시 isOnboarded=true 를 만들어 온보딩(닉네임 입력)을 건너뛰는 모순 발생.
--       nickname nullable 로 변경하면 신규 사용자는 nickname=NULL → 온보딩에서 입력 → UPDATE.
--       CHECK(migration 17, char_length 1~20)은 NULL 을 unknown 으로 pass 한다.

-- 1. nickname NOT NULL 제거
ALTER TABLE public.users ALTER COLUMN nickname DROP NOT NULL;

-- 2. handle_new_user: 신규 사용자 nickname = NULL (온보딩 대기)
--    provider=raw_app_meta_data, avatar=raw_user_meta_data 유지 (20240618000002 fix)
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
        NULL,  -- 신규 사용자는 온보딩 화면에서 nickname 입력
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture'),
        NEW.raw_app_meta_data->>'provider'
    );
    RETURN NEW;
END;
$$;

-- 3. 기존 사용자(자동 nickname 설정됨) 온보딩 재진입을 위해 nickname NULL 초기화
UPDATE public.users SET nickname = NULL WHERE nickname IS NOT NULL;
