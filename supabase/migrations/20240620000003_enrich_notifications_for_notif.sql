-- Enrich notifications for SPEC-NOTIF-001 (알림 타입 ENUM + data + push_token)
-- Migration: 0003_enrich_notifications_for_notif
-- Entity: notifications, users (push_token)
-- Requirements: SPEC-NOTIF-001 REQ-NOTIF-011 (ENUM 검증), REQ-NOTIF-013 (data 템플릿 변수), 미결정 6.1 (push_token 임시 방침)
--
-- 목적:
-- 1. notifications.type 을 text → notification_type ENUM 6종으로 전환 (SPEC-NOTIF-001 정식화)
-- 2. notifications.data jsonb 추가 (템플릿 변수 저장 — REQ-NOTIF-013)
-- 3. users.push_token 추가 (Expo Push Token 임시 저장 — 미결정 6.1 "users 확장")
--
-- 기존 데이터 정규화 (SPEC-DB-001 초기 placeholder → SPEC-NOTIF-001 6종):
--   club_invite   → join_request_received
--   reaction      → sticker_received
--   completion    → completion (유지)
--   mention/system → ENUM 대응 없음 → 행 삭제 (notifications 는 아직 실사용 전 — 발송 로직 미구현)

-- ============================================================================
-- 1. notification_type ENUM 생성 (6종)
-- ============================================================================
CREATE TYPE public.notification_type AS ENUM (
    'reading_reminder',
    'join_request_received',
    'join_accepted',
    'sticker_received',
    'completion',
    'club_signal'
);

COMMENT ON TYPE public.notification_type IS
    'SPEC-NOTIF-001 알림 타입 6종: reading_reminder(독서 알림), join_request_received(가입 요청 수신), join_accepted(가입 수락), sticker_received(스티커 수신), completion(완독), club_signal(실시간 시그널-확장)';

-- ============================================================================
-- 2. 기존 notifications.type 정규화 (ENUM 호환값으로)
-- ============================================================================
-- ENUM 대응이 없는 구형 값(mention/system 등) 보유 행 삭제
DELETE FROM public.notifications
WHERE type NOT IN (
    'reading_reminder', 'join_request_received', 'join_accepted',
    'sticker_received', 'completion', 'club_signal',
    -- 매핑 대상 구형 값 (아래 UPDATE 에서 전환)
    'club_invite', 'reaction'
);

-- 구형 placeholder 값 매핑
UPDATE public.notifications SET type = 'join_request_received' WHERE type = 'club_invite';
UPDATE public.notifications SET type = 'sticker_received'      WHERE type = 'reaction';

-- ============================================================================
-- 3. notifications.type text → notification_type 변환
-- ============================================================================
-- @MX:NOTE: [AUTO] USING 절로 안전 변환 — 정규화 단계를 거쳤으므로 모든 값이 ENUM 에 존재함
ALTER TABLE public.notifications
    ALTER COLUMN type TYPE public.notification_type USING type::public.notification_type;

-- ============================================================================
-- 4. notifications.data jsonb 추가 (템플릿 변수 — REQ-NOTIF-013)
-- ============================================================================
ALTER TABLE public.notifications
    ADD COLUMN IF NOT EXISTS data jsonb;

COMMENT ON COLUMN public.notifications.data IS
    'SPEC-NOTIF-001 템플릿 변수 (예: book_title, page, requester_nickname) — REQ-NOTIF-013';

-- type 컬럼 주석 갱신 (구형 "club_invite / reaction / mention / completion / system" → 6종)
COMMENT ON COLUMN public.notifications.type IS
    'SPEC-NOTIF-001 알림 타입 (notification_type ENUM 6종)';

-- ============================================================================
-- 5. users.push_token 추가 (미결정 6.1 임시 방침 — users 확장)
-- ============================================================================
-- @MX:NOTE: [AUTO] MVP 임시 방침: users 단일 컬럼(1인 1기기). 다기기 지원은 확장 단계에서
--   별도 user_push_tokens 테이블로 마이그레이션. 토큰 "등록 로직"은 Optional(REQ-NOTIF-003)이므로
--   본 마이그레이션은 컬럼 준비만 수행 — 값은 Optional 구현 시 채워진다.
ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS push_token text;

COMMENT ON COLUMN public.users.push_token IS
    'SPEC-NOTIF-001 Expo Push Token (임시: users 확장, 미결정 6.1). NULL=푸시 미수신/미등록';
