-- Migration: emotion_records.visibility 'private' 허용 (SPEC-EMOTION-001 visibility 확장)
--
-- 배경: 서재 책 비공개(user_books.is_public=false)인 책의 감정 기록도
-- 기본적으로 비공개로 작성하려는 사용자 기대. 기존 visibility는 'public'|'club'만 있어
-- 'private'(나만 보기) 옵션 추가.
--
-- 변경:
-- 1. emotion_records_visibility_check: 허용 집합에 'private' 추가
-- 2. emotion_records_visibility_requires_club: private도 club_id 불필요 (public과 동일)
-- 3. RLS select 정책은 수정 불필요 — 기존 emotion_records_select_visible 의
--    `user_id = auth.uid()` 조건이 private 기록을 작성자에게만 노출시킨다.
--    타 사용자는 visibility='public' 또는 (club + fn_user_in_club) 조건으로만 접근하므로
--    private 행은 자동으로 보이지 않는다 (own-only).
--
-- @MX:NOTE: [AUTO] SPEC-EMOTION-001 visibility 'private' 확장. RLS는 기존 own 조건(user_id = auth.uid())으로 커버 — select 정책 변경 없음.
-- @MX:SPEC SPEC-EMOTION-001

-- 1. visibility 허용 값에 'private' 추가
ALTER TABLE public.emotion_records
  DROP CONSTRAINT IF EXISTS emotion_records_visibility_check,
  ADD CONSTRAINT emotion_records_visibility_check
    CHECK (visibility IN ('public', 'club', 'private'));

-- 2. 복합 CHECK — club_id 는 visibility='club' 일 때만 필수 (public/private 는 club_id 없음)
ALTER TABLE public.emotion_records
  DROP CONSTRAINT IF EXISTS emotion_records_visibility_requires_club,
  ADD CONSTRAINT emotion_records_visibility_requires_club CHECK (
    (visibility = 'club' AND club_id IS NOT NULL) OR
    (visibility IN ('public', 'private'))
  );

COMMENT ON COLUMN public.emotion_records.visibility IS
  'public: visible to all, club: visible only to club members (requires club_id), private: visible only to author (own-only via RLS user_id = auth.uid())';
