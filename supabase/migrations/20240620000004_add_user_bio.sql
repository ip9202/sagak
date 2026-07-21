-- Add bio column to users (SPEC-PROFILE-001)
-- Migration: 0024_add_user_bio
-- Entity: users.bio (사용자 자기소개)
-- Requirements: SPEC-PROFILE-001 REQ-PROF-002 (bio 편집 가능 필드 확장)

-- bio: 사용자 자기소개. nullable (빈 자기소개 허용).
-- 클라이언트 검증(140자) + DB CHECK 로 이중 방어.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS bio text;

COMMENT ON COLUMN public.users.bio IS '사용자 자기소개(SPEC-PROFILE-001). nullable. 최대 길이는 클라이언트 검증 + CHECK(LENGTH(bio) <= 140)로 이중 방어.';

-- 길이 제약 (nullable 허용, 140자 초과 금지)
ALTER TABLE public.users ADD CONSTRAINT users_bio_length
    CHECK (bio IS NULL OR LENGTH(bio) <= 140);

-- Security view 재생성: bio 공개 컬럼 추가 (기존 id/nickname/avatar_url 유지).
-- CREATE OR REPLACE 로 덮어쓰되, 기존 SELECT 권한(authenticated)은 그대로 승계.
CREATE OR REPLACE VIEW public.user_profiles AS
SELECT
    id,
    nickname,
    avatar_url,
    bio
FROM public.users;

COMMENT ON VIEW public.user_profiles IS 'Security view - exposes public profile columns (id, nickname, avatar_url, bio)';
