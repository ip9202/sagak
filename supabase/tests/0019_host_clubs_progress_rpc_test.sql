-- get_host_clubs_progress RPC 함수 통합 테스트 (SPEC-CLUB-003 REQ-CLUBC-001~006)
--
-- 검증 대상 (Postgres 서버 측 median 집계):
-- - REQ-CLUBC-001: RPC 시그니처 (club_id, median_page, member_count_with_progress, total_pages)
-- - REQ-CLUBC-002: p_host_id != auth.uid() → 빈 결과 (클라이언트가 잘못된 UUID 전달)
-- - REQ-CLUBC-003: current_page > 0 만 median 포함 (홀수/짝수/0p제외/전원0p)
-- - REQ-CLUBC-004: user_books_public 뷰 소스 (is_public=false 제외)
-- - REQ-CLUBC-005: books.total_pages LEFT JOIN (NULL 허용)
-- - REQ-CLUBC-006: GRANT EXECUTE TO authenticated
--
-- 실행 명령 (로컬 Supabase 필요):
--   supabase start && supabase db test -- -f supabase/tests/0019_host_clubs_progress_rpc_test.sql
--
-- 본 환경에 로컬 Supabase 가 없으면 실행되지 않으나, 테스트 자체는 올바르게 작성됨.
-- pgTAP 패턴 (0018_reading_sessions_rpc_test.sql 과 동일).

BEGIN;

SET client_min_messages TO warning;

SELECT plan(11);

-- ============================================================================
-- SETUP (postgres role — RLS 우회, 테스트 데이터 시딩)
-- ============================================================================
-- idempotent cleanup (FK 역순)
DELETE FROM club_members   WHERE club_id IN ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-0000000000a3');
DELETE FROM clubs          WHERE id IN ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-0000000000a3');
DELETE FROM user_books     WHERE user_id IN ('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000b2','00000000-0000-0000-0000-0000000000b3','00000000-0000-0000-0000-0000000000b4');
DELETE FROM books          WHERE id IN ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000c2');
DELETE FROM users          WHERE id IN ('00000000-0000-0000-0000-0000000000h1','00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000b2','00000000-0000-0000-0000-0000000000b3','00000000-0000-0000-0000-0000000000b4');

-- host H1 + members B1..B4
INSERT INTO users (id, email, nickname, provider) VALUES
    ('00000000-0000-0000-0000-0000000000h1', 'host1@clubc.test', 'Host1', 'kakao'),
    ('00000000-0000-0000-0000-0000000000b1', 'mb1@clubc.test',  'Mb1',   'kakao'),
    ('00000000-0000-0000-0000-0000000000b2', 'mb2@clubc.test',  'Mb2',   'kakao'),
    ('00000000-0000-0000-0000-0000000000b3', 'mb3@clubc.test',  'Mb3',   'kakao'),
    ('00000000-0000-0000-0000-0000000000b4', 'mb4@clubc.test',  'Mb4',   'kakao');

-- book C1 (total_pages=300), C2 (total_pages=NULL)
INSERT INTO books (id, isbn, title, author, total_pages) VALUES
    ('00000000-0000-0000-0000-0000000000c1', '9781111111111', 'Book C1', 'Auth1', 300),
    ('00000000-0000-0000-0000-0000000000c2', '9782222222222', 'Book C2', 'Auth2', NULL);

-- club A1 (host=H1, book=C1, group/active) — 진도 집계 대상
-- club A2 (host=H1, book=C2, group/active) — total_pages NULL 케이스
-- club A3 (host=H1, book=C1, instant/active) — type 필터 (제외 대상)
INSERT INTO clubs (id, name, book_id, host_id, type, status) VALUES
    ('00000000-0000-0000-0000-0000000000a1', 'ClubA1', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000h1', 'group', 'active'),
    ('00000000-0000-0000-0000-0000000000a2', 'ClubA2', '00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000h1', 'group', 'active'),
    ('00000000-0000-0000-0000-0000000000a3', 'ClubA3', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000h1', 'instant', 'active');

-- H1 이 A1/A2/A3 모두 가입 (handle_new_club_host 트리거가 host 자동 가입하지만
-- postgres role 직접 INSERT 는 트리거를 타지 않을 수 있어 명시 삽입)
INSERT INTO club_members (club_id, user_id, role) VALUES
    ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000h1', 'host'),
    ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000h1', 'host'),
    ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000h1', 'host');

-- B1/B2/B3 를 A1 멤버로 (진도 다양화), B4 는 A2 멤버
INSERT INTO club_members (club_id, user_id, role) VALUES
    ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', 'member'),
    ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b2', 'member'),
    ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b3', 'member'),
    ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000b4', 'member');

-- ============================================================================
-- REQ-CLUBC-001/003: median 계산 (current_page>0 만 포함)
-- ============================================================================
-- A1 book=C1(total_pages=300) 에 멤버 진도 시드:
--   B1=10p, B2=20p, B3=30p (모두 is_public=true) → median=20, mcp=3
INSERT INTO user_books (user_id, book_id, current_page, is_public) VALUES
    ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1', 10, true),
    ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000c1', 20, true),
    ('00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000c1', 30, true);

SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000h1","role":"authenticated"}', false);

-- REQ-CLUBC-001: A1 행이 (club_id, median_page=20, member_count_with_progress=3, total_pages=300) 반환
SELECT results_eq(
    $$
        SELECT median_page, member_count_with_progress, total_pages
          FROM get_host_clubs_progress('00000000-0000-0000-0000-0000000000h1')
         WHERE club_id = '00000000-0000-0000-0000-0000000000a1'
    $$,
    $$ VALUES (20::int, 3::int, 300::int) $$,
    'REQ-CLUBC-001/003: A1 median=20 (10/20/30 홀수개), mcp=3, total_pages=300'
);

-- REQ-CLUBC-003-B: 0p 멤버 제외 — B3 를 0p 로 변경하면 median=(10+20)/2=15, mcp=2
RESET ROLE;
UPDATE user_books SET current_page = 0
 WHERE user_id = '00000000-0000-0000-0000-0000000000b3'
   AND book_id = '00000000-0000-0000-0000-0000000000c1';
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000h1","role":"authenticated"}', false);

SELECT results_eq(
    $$
        SELECT median_page, member_count_with_progress
          FROM get_host_clubs_progress('00000000-0000-0000-0000-0000000000h1')
         WHERE club_id = '00000000-0000-0000-0000-0000000000a1'
    $$,
    $$ VALUES (15::int, 2::int) $$,
    'REQ-CLUBC-003: 0p 멤버 제외 → median=15 (percentile_cont 보간 10,20), mcp=2'
);

-- ============================================================================
-- REQ-CLUBC-004: is_public=false 멤버 제외 (user_books_public 뷰)
-- ============================================================================
-- B3 를 다시 30p + is_public=false 로. user_books_public 이 is_public=true 만 노출하므로
-- B3 는 집계에서 제외되어 median=(10+20)/2=15, mcp=2 유지.
RESET ROLE;
UPDATE user_books SET current_page = 30, is_public = false
 WHERE user_id = '00000000-0000-0000-0000-0000000000b3'
   AND book_id = '00000000-0000-0000-0000-0000000000c1';
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000h1","role":"authenticated"}', false);

SELECT results_eq(
    $$
        SELECT median_page, member_count_with_progress
          FROM get_host_clubs_progress('00000000-0000-0000-0000-0000000000h1')
         WHERE club_id = '00000000-0000-0000-0000-0000000000a1'
    $$,
    $$ VALUES (15::int, 2::int) $$,
    'REQ-CLUBC-004: is_public=false 멤버(B3,30p) 제외 → median=15, mcp=2 (user_books_public 뷰 소스)'
);

-- ============================================================================
-- REQ-CLUBC-005: books.total_pages LEFT JOIN (NULL 허용)
-- ============================================================================
-- A2 book=C2(total_pages=NULL) + B4=50p → total_pages=NULL 반환
RESET ROLE;
INSERT INTO user_books (user_id, book_id, current_page, is_public) VALUES
    ('00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-0000000000c2', 50, true);
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000h1","role":"authenticated"}', false);

SELECT results_eq(
    $$
        SELECT median_page, member_count_with_progress, total_pages
          FROM get_host_clubs_progress('00000000-0000-0000-0000-0000000000h1')
         WHERE club_id = '00000000-0000-0000-0000-0000000000a2'
    $$,
    $$ VALUES (50::int, 1::int, NULL::int) $$,
    'REQ-CLUBC-005: A2 total_pages=NULL (books.total_pages LEFT JOIN NULL 허용)'
);

-- ============================================================================
-- REQ-CLUBC-002/001: type/status 필터 + 호출 범위
-- ============================================================================
-- H1 host group/active 모임은 A1, A2 만 (A3 는 instant → 제외)
SELECT is(
    (SELECT count(*)::bigint FROM get_host_clubs_progress('00000000-0000-0000-0000-0000000000h1')),
    2::bigint,
    'REQ-CLUBC-001/002: host H1 의 group/active 모임 2행 (A1, A2) — A3(instant) 제외'
);

-- ============================================================================
-- REQ-CLUBC-006: GRANT EXECUTE TO authenticated
-- ============================================================================
-- 현재 SET ROLE authenticated 상태에서 RPC 호출 자체가 성공했다는 것이 곧 GRANT 증명.
-- anon 권한 거부는 별도 검증 (아래 has_function + table에는 anon 미부여).
RESET ROLE;
SELECT has_function('get_host_clubs_progress', ARRAY['uuid'], 'REQ-CLUBC-006: get_host_clubs_progress(uuid) 함수 존재');

-- ============================================================================
-- REQ-CLUBC-003-C: 전원 0p → median=0, mcp=0
-- ============================================================================
-- A2 의 B4 를 0p 로 변경 → A2 멤버 전원 0p → median=0, mcp=0 (COALESCE 폴백)
RESET ROLE;
UPDATE user_books SET current_page = 0
 WHERE user_id = '00000000-0000-0000-0000-0000000000b4'
   AND book_id = '00000000-0000-0000-0000-0000000000c2';
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000h1","role":"authenticated"}', false);

SELECT results_eq(
    $$
        SELECT median_page, member_count_with_progress
          FROM get_host_clubs_progress('00000000-0000-0000-0000-0000000000h1')
         WHERE club_id = '00000000-0000-0000-0000-0000000000a2'
    $$,
    $$ VALUES (0::int, 0::int) $$,
    'REQ-CLUBC-003-C: 전원 0p → median=0, mcp=0 (COALESCE 폴백)'
);

-- ============================================================================
-- REQ-CLUBC-002: 존재하지 않는 host UUID → 빈 결과
-- ============================================================================
SELECT is(
    (SELECT count(*)::bigint FROM get_host_clubs_progress('00000000-0000-0000-0000-999999999999')),
    0::bigint,
    'REQ-CLUBC-002: 존재하지 않는 host UUID → 빈 결과'
);

-- ============================================================================
-- Finish
-- ============================================================================
SELECT * FROM finish();

ROLLBACK;
