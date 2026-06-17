-- Migration: 0018_users_provider_naver
-- SPEC: SPEC-AUTH-001 (provider 변경: apple -> naver)
--
-- 변경 사항:
--   provider 허용 값을 ('kakao', 'apple', 'google') -> ('kakao', 'naver', 'google') 로 변경
--
-- 사유:
--   한국 시장 주류 OAuth 조합(kakao/naver/google)으로 확정.
--   apple 은 제외, naver 를 추가.
--
-- 참고 (naver OAuth 연동):
--   naver 는 Supabase 네이티브 OAuth provider 가 아님.
--   실제 연동은 Supabase Custom OIDC (2026년 기능) 를 통해 Dashboard 에서 등록.
--   즉, 네이버 OAuth wiring (Naver Developers 앱 + Supabase OIDC provider 등록) 은
--   본 스키마/로컬 config 변경 범위가 아니며 SPEC-DEPLOY-001 단계에서 처리됨.
--   따라서 본 마이그레이션은 DB CHECK 제약조건의 "구조적 허용값"만 변경한다.
--
-- ⚠ DEPLOY 필수 검증 (security review PR #11 — C1):
--   handle_new_user 트리거(SPEC-DB-001, migration 0017)가 raw_user_id_data->>'provider' 를
--   그대로 INSERT 한다. 따라서 naver Custom OIDC provider 는 반드시 raw_user_id_data.provider
--   = 'naver' 를 전달해야 함. 누락 시 이 CHECK 위반으로 사용자 가입이 실패한다.
--   → SPEC-DEPLOY-001 REQ-DEPLOY-020 인수 조건으로 검증 필수.

-- 기존 제약조건 제거 (이름이 명시되지 않았으므로 Postgres 자동 이름 규칙 사용: users_provider_check)
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_provider_check;

-- 새 제약조건 추가 (동일 이름으로 재생성)
ALTER TABLE public.users ADD CONSTRAINT users_provider_check
    CHECK (provider IN ('kakao', 'naver', 'google'));
