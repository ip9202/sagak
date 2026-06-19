-- SPEC-FEED-001 Realtime (postgres_changes) 활성화
-- Migration: 20240620000001_enable_realtime_feed
-- Requirements: REQ-FEED-006 ~ REQ-FEED-008 (F12 ~ F17)
--
-- [배경 / WHY]
-- 감상 피드의 실시간 갱신(새 감상 INSERT, 스티커 반응 INSERT)을 위해
-- Supabase Realtime 의 postgres_changes 브로드캐스트를 사용해야 한다.
-- 그런데 emotion_records, sticker_reactions 두 테이블이 아직
-- supabase_realtime publication 에 포함되어 있지 않아 Realtime 이벤트가
-- 발생하지 않는다 -> Feed 실시간 기능(REQ-FEED-006~008)이 동작하지 않는다.
-- 본 마이그레이션은 두 테이블을 publication 에 추가하여 브로드캐스트를 활성화한다.
--
-- [RLS 브로드캐스트 보장 (F13)]
-- Supabase Realtime 는 postgres_changes 브로드캐스트 시 테이블의 SELECT RLS
-- 정책을 그대로 적용한다. 즉, 구독자는 자신이 SELECT 할 수 있는 행에 대한
-- 이벤트만 수신한다. (참고: Supabase Realtime + RLS 공식 문서)
--
-- 따라서 마이그레이션 0014 에 정의된 기존 정책이 브로드캐스트를 자동으로 게이트한다:
--   emotion_records_select_visible (0014_enable_rls.sql):
--     USING (
--       visibility = 'public'
--       OR user_id = auth.uid()
--       OR (visibility = 'club' AND public.fn_user_in_club(club_id))
--     )
-- -> visibility='club' 행은 해당 클럽 멤버에게만 SELECT 허용되므로,
--    비회원에게는 INSERT 브로드캐스트 이벤트가 전달되지 않는다 (F13 충족).
-- sticker_reactions 의 경우 sticker_reactions_select_all (true) 이므로
-- 인증된 사용자에게 모두 브로드캐스트된다 (비가시성 데이터 없음).
--
-- emotion_records, sticker_reactions 모두 migration 0014 에서
-- FORCE ROW LEVEL SECURITY 가 설정되어 있어 서비스 롤을 제외한 모든 롤에
-- RLS 가 강제 적용된다. 본 마이그레이션은 정책을 변경하지 않는다.
--
-- [REPLICA IDENTITY FULL 의 이유]
-- 피드 브로드캐스트 페이로드가 전체 행(감상 내용, 가시성, club_id 등)을
-- 담아야 한다. INSERT 이벤트는 기본값으로도 새 행 전체를 전달하지만,
-- UPDATE/DELETE 이벤트(향후 감상 수정/삭제 실시간 반영 시)에서도 안정적으로
-- 페이로드를 전달하도록 미리 FULL 로 설정한다. (PK 만으로는 부족한 경우 대비)
--
-- [팔로업 검증 (로컬/통합 테스트 필수)]
-- 외부 시스템(Supabase Realtime) 동작은 가정이 아닌 실제 검증이 필요하다
-- (lessons #4). 다음 시나리오를 로컬 Supabase 환경에서 반드시 확인한다:
--   1. 멤버가 visibility='club' 감상 INSERT -> 같은 클럽 멤버는 이벤트 수신
--   2. 비회원(다른 클럽 또는 클럽 미가입자)은 동일 INSERT 이벤트를 수신하지 않음
--   3. visibility='public' 감상 INSERT -> 모든 인증 사용자가 이벤트 수신
-- 만약 프로젝트의 Supabase 버전/설정에서 SELECT RLS 가 브로드캐스트에
-- 자동 적용되지 않는다면, 별도의 broadcast RLS 정책 추가를 팔로업해야 한다.

-- ============================================================================
-- Step 1: supabase_realtime publication 에 두 테이블 추가 (postgres_changes 활성화)
-- ============================================================================
ALTER PUBLICATION supabase_realtime
    ADD TABLE public.emotion_records, public.sticker_reactions;

-- ============================================================================
-- Step 2: REPLICA IDENTITY FULL 설정 (브로드캐스트 페이로드에 전체 행 포함)
-- ============================================================================
ALTER TABLE public.emotion_records REPLICA IDENTITY FULL;
ALTER TABLE public.sticker_reactions REPLICA IDENTITY FULL;
