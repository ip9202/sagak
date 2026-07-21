-- Migration: 0005_handle_new_user_email_fallback
-- SPEC: SPEC-AUTH-001 (REQ-AUTH-001) — 네이버 Custom OIDC email 미제공 대응 (C1)
-- Date: 2026-06-18
--
-- 배경:
--   네이버 OIDC 는 scopes_supported [openid, profile] — email 미지원 (discovery 검증).
--   Supabase "Allow users without email" 로 auth.users 엔 email NULL 로 생성되지만,
--   public.users.email 은 text UNIQUE NOT NULL 이라 handle_new_user INSERT 가 위반 실패 →
--   "Database error saving new user" 로 가입 rollback (C1).
--   2026-06-18 실기기 검증 + 직접 INSERT 테스트로 100% 확정:
--     ERROR 23502: null value in column "email" of relation "users" violates not-null constraint
--
-- 수정:
--   handle_new_user 가 email NULL 일 때 placeholder 자동 생성.
--   형태: {provider}_{auth.users.id}@noemail.local
--   - id(uuid, UNIQUE) 기반이라 email UNIQUE 보장.
--   - kakao/google (email 제공 provider) 은 NEW.email 그대로 → 영향 없음.
--   - naver 만 폴백 → 가입 성공.
--   - email 을 실사용하지 않는 sagak (src/types/supabase.ts 타입 정의만) 에서 안전.
--
-- nickname 폴백도 email NULL 시 대비: split_part(NULL,'@',1)=NULL 이므로
-- 최종 COALESCE 에 v_provider||'_user' 추가하여 nickname NOT NULL 도 방어.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_raw_provider text;
    v_provider text;
    v_email text;
BEGIN
    -- raw_app_meta_data.provider 정규화: 'custom:' 접두사 제거 (users.provider CHECK 준수).
    v_raw_provider := NEW.raw_app_meta_data->>'provider';
    v_provider := REPLACE(v_raw_provider, 'custom:', '');

    -- email 폴백 (C1): 네이버 등 email 미제공 provider → {provider}_{id}@noemail.local
    -- id(uuid, UNIQUE) 기반으로 email UNIQUE 보장. email 제공 provider(kakao/google)는 NEW.email 그대로.
    v_email := COALESCE(
        NEW.email,
        v_provider || '_' || NEW.id::text || '@noemail.local'
    );

    INSERT INTO public.users (id, email, nickname, avatar_url, provider)
    VALUES (
        NEW.id,
        v_email,
        left(
            COALESCE(
                NEW.raw_user_meta_data->>'name',
                NEW.raw_user_meta_data->>'full_name',
                NEW.raw_user_meta_data->>'nickname',
                split_part(NEW.email, '@', 1),
                v_provider || '_user'
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
    'auth.users INSERT 시 public.users 프로필 행 생성. provider=custom: 접두사 정규화 + email 폴백(provider_id@noemail.local, C1 네이버 OIDC email 미제공 대응, 2026-06-18). nickname/avatar=raw_user_meta_data + 폴백.';

-- SECURITY DEFINER owner 고정 (M1, migration 004 패턴):
-- users FORCE RLS(migration 0014) 우회를 위해 owner 를 postgres 로 고정.
-- non-BYPASSRLS role 이면 SECURITY DEFINER 가 RLS 를 우회하지 못해 INSERT 가 조용히 실패한다.
ALTER FUNCTION public.handle_new_user() OWNER TO postgres;
