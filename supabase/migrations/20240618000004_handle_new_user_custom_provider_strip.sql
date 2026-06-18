-- Migration: 0004_handle_new_user_custom_provider_strip
-- SPEC: SPEC-AUTH-001 (REQ-AUTH-001), SPEC-DEPLOY-001 (REQ-DEPLOY-019/020)
-- Date: 2026-06-18
--
-- 배경:
--   네이버는 Supabase 빌트인 OAuth provider 가 아님 → Custom OIDC provider 로 연동 (2026년 기능).
--   Custom OIDC provider 의 식별자는 'custom:' 접두사가 필수이므로 네이버는 'custom:naver' 로 등록.
--   이 경우 인증 후 auth.users.raw_app_meta_data->>'provider' = 'custom:naver' 가 된다.
--   그러나 public.users.provider CHECK 는 ('kakao','naver','google') 이므로,
--   'custom:naver' 를 그대로 INSERT 하면 CHECK 위반으로 신규 가입이 rollback 된다
--   (migration 0018 주석 경고, 2026-06-18 실기기 검증에서 unsupported_provider → 본 원인 확인).
--
-- 수정:
--   handle_new_user 가 provider 값을 INSERT 하기 전에 'custom:' 접두사를 제거하여 정규화.
--   - 'custom:naver' → 'naver'
--   - 'kakao' / 'google' (빌트인 provider, 'custom:' 부분문자열 없음) → 변화 없음
--   단일 REPLACE 로 3 provider 모두 무해하게 처리한다.
--
-- 참고: AuthContext.signInWithProvider 가 provider='naver' 일 때 Supabase 에게는 'custom:naver' 로
--       전달한다 (src/auth/AuthContext.tsx). 앱 도메인 식별자(naver)와 DB CHECK 값은 'naver' 유지.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_raw_provider text;
    v_provider text;
BEGIN
    -- raw_app_meta_data.provider 는 빌트인('kakao'/'google') 또는 custom OIDC('custom:naver').
    -- 'custom:' 접두사를 제거해 앱 도메인 식별자로 정규화 (users.provider CHECK 준수).
    v_raw_provider := NEW.raw_app_meta_data->>'provider';
    v_provider := REPLACE(v_raw_provider, 'custom:', '');

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
        v_provider
    );
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS
    'auth.users INSERT 시 public.users 프로필 행 생성. provider=raw_app_meta_data 에서 custom: 접두사 제거 정규화 (2026-06-18, SPEC-AUTH-001 naver Custom OIDC 대응). nickname/avatar=raw_user_meta_data.';
