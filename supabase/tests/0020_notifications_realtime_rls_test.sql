-- N2-2 Realtime broadcast RLS 게이트 구조적 전제 회귀 테스트 (SPEC-NOTIF-002 acceptance §3.2)
--
-- [목적 / WHY]
-- SPEC-NOTIF-002 의 마지막 AC 갭 N2-2(타인 알림 RLS 차단)는 "로컬 Supabase 환경에서
-- 사용자 A/B 세션으로 실제 RLS 게이트를 확인"하라는 runtime smoke 를 요구한다
-- (acceptance.md §3.2). 본 pgTAP 파일은 그 runtime smoke 가 의존하는 *구조적 전제*를
-- 영구 회귀 테스트로 고정한다:
--   1. notifications_select_own 이 교차 사용자 SELECT 를 차단한다 (브로드캐스트 게이트의 기반)
--   2. notifications_select_own 정책이 SELECT + auth.uid()=user_id 로 존재한다 (게이트 정의)
--   3. FORCE ROW LEVEL SECURITY 가 설정되어 있다 (서비스 롤 외 모든 롤에 RLS 강제)
--   4. notifications 가 supabase_realtime publication 에 포함되어 있다 (postgres_changes 활성화)
--   5. REPLICA IDENTITY FULL 이 설정되어 있다 (브로드캐스트 페이로드 전체 행 포함)
--
-- [왜 throws_ok 가 아닌 results_eq 인가]
-- SELECT RLS 정책은 교차 사용자 조회 시 예외(42501)를 던지지 *않는다* — 단지 0행을
-- 반환한다(조용한 필터링). 따라서 교차 사용자 SELECT 차단 검증에는 throws_ok 가 아닌
-- results_eq count=0 이 의미적으로 정확하며, 본 저장소의 선례 0014_rls_test.sql 이
-- 모든 교차 사용자 RLS 차단을 results_eq(ARRAY[0::bigint]) 로 검증한 것과 동일 패턴이다.
--
-- [runtime smoke 와의 역할 분담]
-- 본 파일은 *구조적 전제*(정책/force/publication/replica identity)를 고정한다.
-- "실제 브로드캐스트 시 A 가 B 의 INSERT 이벤트를 수신하지 않는다"는 *런타임 동작*은
-- scripts/realtime-smoke/n2-2-broadcast-rls.mjs (Layer 2 runtime smoke) 가 검증한다.
-- 두 레이어가 함께 §3.2 N2-2 를 충족한다.
--
-- pgTAP 패턴 (0014_rls_test.sql 준용):
-- 1. setup INSERT 는 postgres role(default)로 실행 → RLS 우회
-- 2. SET ROLE authenticated 로 사용자 전환
-- 3. set_config('request.jwt.claims', json, FALSE) — session-level(false); auth.uid() 추출

BEGIN;

SELECT plan(6);

-- ============================================================================
-- SETUP (postgres role — RLS 우회, 테스트 데이터 시딩)
-- ============================================================================
-- idempotent cleanup (FK 역순) — reset 없이 재실행 허용
DELETE FROM notifications WHERE user_id IN ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002');
DELETE FROM users       WHERE id     IN ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002');

INSERT INTO users (id, email, nickname, provider) VALUES
    ('00000000-0000-0000-0000-000000000001', 'usera@test.com', 'UserA', 'kakao'),
    ('00000000-0000-0000-0000-000000000002', 'userb@test.com', 'UserB', 'kakao');

-- A/B 각각 자기 알림 1행 시딩 (postgres role — RLS 우회)
INSERT INTO notifications (user_id, type, title, body) VALUES
    ('00000000-0000-0000-0000-000000000001', 'completion', 'A own', 'A body'),
    ('00000000-0000-0000-0000-000000000002', 'completion', 'B own', 'B body');

-- ============================================================================
-- RLS 테스트 — SET ROLE authenticated, set_config(false)로 사용자 전환
-- ============================================================================
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', false);

-- --- 전제 1: 교차 사용자 SELECT 차단 (브로드캐스트 게이트 기반) ---
SELECT results_eq(
    $$SELECT count(*)::bigint FROM notifications WHERE user_id = '00000000-0000-0000-0000-000000000002'$$,
    ARRAY[0::bigint],
    'N2-2 전제 1: A 는 B 의 notifications 를 SELECT 할 수 없다 (notifications_select_own 게이트)'
);

-- --- 전제 2: 자기 알림 SELECT 허용 ---
SELECT results_eq(
    $$SELECT count(*)::bigint FROM notifications WHERE user_id = '00000000-0000-0000-0000-000000000001'$$,
    ARRAY[1::bigint],
    'N2-2 전제 2: A 는 자기 notifications 를 SELECT 할 수 있다 (positive control)'
);

RESET ROLE;

-- ============================================================================
-- 구조적 전제 (catalog 쿼리 — postgres role)
-- ============================================================================

-- --- 전제 3: notifications_select_own 정책 존재 (게이트 정의) ---
SELECT is(
    (SELECT count(*)::int FROM pg_policies
       WHERE schemaname = 'public' AND tablename = 'notifications'
         AND policyname = 'notifications_select_own' AND cmd = 'SELECT'),
    1,
    'N2-2 전제 3: notifications_select_own SELECT 정책이 존재한다 (auth.uid()=user_id)'
);

-- --- 전제 4: FORCE ROW LEVEL SECURITY ---
SELECT is(
    (SELECT c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON c.relnamespace = n.oid
       WHERE n.nspname = 'public' AND c.relname = 'notifications'),
    true,
    'N2-2 전제 4: notifications 에 FORCE ROW LEVEL SECURITY 가 설정되어 있다 (서비스 롤 외 RLS 강제)'
);

-- --- 전제 5: supabase_realtime publication 멤버십 ---
SELECT is(
    (SELECT count(*)::int FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'),
    1,
    'N2-2 전제 5: notifications 가 supabase_realtime publication 에 포함되어 있다 (postgres_changes 활성화)'
);

-- --- 전제 6: REPLICA IDENTITY FULL ---
SELECT is(
    (SELECT c.relreplident FROM pg_class c JOIN pg_namespace n ON c.relnamespace = n.oid
       WHERE n.nspname = 'public' AND c.relname = 'notifications'),
    'f'::"char",
    'N2-2 전제 6: notifications REPLICA IDENTITY = FULL (브로드캐스트 페이로드 전체 행 포함)'
);

SELECT * FROM finish();
ROLLBACK;
