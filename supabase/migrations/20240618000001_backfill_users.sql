-- 기존 auth.users 중 public.users 에 누락된 사용자 backfill
-- 배경: handle_new_user 트리거/테이블이 DB 스키마 배포 전에 가입한 기존 OAuth 사용자에게는
--       적용되지 않았으므로, public.users 행을 수동으로 보충한다.
-- idempotent: LEFT JOIN ... IS NULL 로 이미 존재하는 행은 건너뛴다.
-- 주의: provider 는 auth.users.raw_app_meta_data 에 저장됨 (raw_user_meta_data 아님).
INSERT INTO public.users (id, email, nickname, avatar_url, provider)
SELECT
    au.id,
    au.email,
    left(COALESCE(au.raw_user_meta_data->>'name', split_part(au.email, '@', 1)), 20),
    au.raw_user_meta_data->>'avatar_url',
    au.raw_app_meta_data->>'provider'
FROM auth.users au
LEFT JOIN public.users pu ON pu.id = au.id
WHERE pu.id IS NULL;
