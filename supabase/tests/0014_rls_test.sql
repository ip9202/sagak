-- RLS Policy Tests for SPEC-DB-001 T-007
-- 모든 RLS 정책을 두 사용자 격리로 검증 (acceptance scenarios 1, 4, 5, 10, 12-14, 16, 17, 18)
--
-- pgTAP 패턴 (manager-tdd가 놓친 정확한 패턴):
-- 1. setup INSERT는 postgres role(default)로 실행 → RLS 우회
-- 2. SET ROLE authenticated 한 번 설정
-- 3. set_config('request.jwt.claims', json, FALSE) — session-level(false), local(true) 아님
--    local은 transaction 분리 시 사라짐, session은 pg_prove 세션 전체에 유지
-- 4. auth.uid() = current_setting('request.jwt.claims')에서 sub 추출

BEGIN;

SELECT plan(26);

-- ============================================================================
-- SETUP (postgres role — RLS 우회, 테스트 데이터 시딩)
-- ============================================================================
-- idempotent cleanup (FK 역순) — reset 없이 재실행 허용
DELETE FROM sticker_reactions   WHERE user_id IN ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002');
DELETE FROM completion_reports  WHERE user_id IN ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002');
DELETE FROM notifications       WHERE user_id IN ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002');
DELETE FROM point_logs          WHERE user_id IN ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002');
DELETE FROM reading_sessions    WHERE user_id IN ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002');
DELETE FROM emotion_records     WHERE user_id IN ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002');
DELETE FROM club_members        WHERE user_id IN ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002');
DELETE FROM join_requests       WHERE requester_id IN ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002');
DELETE FROM clubs               WHERE id = '00000000-0000-0000-0000-000000000200';
DELETE FROM user_books          WHERE user_id IN ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002');
DELETE FROM books               WHERE id = '00000000-0000-0000-0000-000000000100';
DELETE FROM users               WHERE id IN ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002');

INSERT INTO users (id, email, nickname, provider) VALUES
    ('00000000-0000-0000-0000-000000000001', 'usera@test.com', 'UserA', 'kakao'),
    ('00000000-0000-0000-0000-000000000002', 'userb@test.com', 'UserB', 'kakao');

INSERT INTO books (id, isbn, title, author) VALUES
    ('00000000-0000-0000-0000-000000000100', '9781234567890', 'Test Book', 'Test Author');

-- clubs INSERT → handle_new_club_host 트리거가 club_members(host=A) 자동 추가
INSERT INTO clubs (id, name, book_id, host_id, type, status) VALUES
    ('00000000-0000-0000-0000-000000000200', 'Test Club',
     '00000000-0000-0000-0000-000000000100',
     '00000000-0000-0000-0000-000000000001', 'group', 'active');

INSERT INTO emotion_records (id, user_id, book_id, page_number, content, visibility, club_id) VALUES
    ('00000000-0000-0000-0000-000000000300',
     '00000000-0000-0000-0000-000000000001',
     '00000000-0000-0000-0000-000000000100',
     10, 'Test content', 'public', NULL);

INSERT INTO user_books (user_id, book_id, status, is_public) VALUES
    ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000100', 'reading', false),
    ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000100', 'reading', true);

INSERT INTO sticker_reactions (record_id, user_id, sticker_type) VALUES
    ('00000000-0000-0000-0000-000000000300',
     '00000000-0000-0000-0000-000000000001', 'empathy');

INSERT INTO reading_sessions (user_id, book_id) VALUES
    ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000100'),
    ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000100');

INSERT INTO point_logs (user_id, amount, reason) VALUES
    ('00000000-0000-0000-0000-000000000001', 100, 'test');

INSERT INTO notifications (user_id, type, title, body) VALUES
    ('00000000-0000-0000-0000-000000000001', 'completion', 'Test', 'Body');

INSERT INTO completion_reports (user_id, book_id, user_book_id, report_data)
SELECT '00000000-0000-0000-0000-000000000001',
       '00000000-0000-0000-0000-000000000100',
       id, '{}'::jsonb
FROM user_books
WHERE user_id = '00000000-0000-0000-0000-000000000001'
  AND book_id = '00000000-0000-0000-0000-000000000100';

-- ============================================================================
-- RLS 테스트 — SET ROLE authenticated, set_config(false)로 사용자 전환
-- ============================================================================
SET ROLE authenticated;

-- --- fn_user_in_club SECURITY DEFINER 속성 (REQ-DB-013d) ---
SELECT is(
    (SELECT prosecdef FROM pg_proc WHERE proname = 'fn_user_in_club'),
    true,
    'fn_user_in_club is SECURITY DEFINER'
);
SELECT is(
    (SELECT proowner FROM pg_proc WHERE proname = 'fn_user_in_club'),
    (SELECT oid FROM pg_roles WHERE rolname = 'postgres'),
    'fn_user_in_club owned by postgres (BYPASSRLS)'
);

-- --- Scenario 1: user_books RLS (REQ-DB-015) ---
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', false);
SELECT results_eq(
    $$SELECT count(*)::bigint FROM user_books WHERE user_id = '00000000-0000-0000-0000-000000000002'$$,
    ARRAY[0::bigint],
    'Scenario 1: A cannot see B user_books'
);
SELECT results_eq(
    $$SELECT count(*)::bigint FROM user_books WHERE user_id = '00000000-0000-0000-0000-000000000001'$$,
    ARRAY[1::bigint],
    'Scenario 1: A sees own user_books'
);
-- user_books_public 보안 뷰
SELECT results_eq(
    $$SELECT count(*)::bigint FROM user_books_public WHERE user_id = '00000000-0000-0000-0000-000000000002'$$,
    ARRAY[1::bigint],
    'user_books_public shows B public entry'
);
SELECT results_eq(
    $$SELECT count(*)::bigint FROM user_books_public WHERE user_id = '00000000-0000-0000-0000-000000000001'$$,
    ARRAY[0::bigint],
    'user_books_public hides A private entry'
);
SELECT is(
    (SELECT count(*)::int FROM information_schema.columns WHERE table_name = 'user_books_public'),
    4,
    'user_books_public has 4 columns (book_id, current_page, started_reading_at, user_id)'
);

-- --- Scenario 4: emotion_records visibility + fn_user_in_club (REQ-DB-016, 013d) ---
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', false);
SELECT results_eq(
    $$SELECT count(*)::bigint FROM emotion_records WHERE visibility = 'public'$$,
    ARRAY[1::bigint],
    'Scenario 4: B sees A public emotion_record'
);
SELECT is(
    (SELECT public.fn_user_in_club('00000000-0000-0000-0000-000000000200')),
    false,
    'fn_user_in_club false for B (non-member)'
);
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', false);
SELECT is(
    (SELECT public.fn_user_in_club('00000000-0000-0000-0000-000000000200')),
    true,
    'fn_user_in_club true for A (host) — recursion broken'
);

-- --- Scenario 5: clubs public read + host write (REQ-DB-018) ---
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', false);
SELECT results_eq(
    $$SELECT count(*)::bigint FROM clubs WHERE id = '00000000-0000-0000-0000-000000000200'$$,
    ARRAY[1::bigint],
    'Scenario 5: B sees club (public read)'
);
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', false);
SELECT results_eq(
    $$SELECT count(*)::bigint FROM clubs WHERE id = '00000000-0000-0000-0000-000000000200' AND host_id = '00000000-0000-0000-0000-000000000001'$$,
    ARRAY[1::bigint],
    'Scenario 5: A (host) sees own club for write'
);

-- --- Scenario 16: club_members same-club visibility (REQ-DB-019) ---
SELECT results_eq(
    $$SELECT count(*)::bigint FROM club_members WHERE club_id = '00000000-0000-0000-0000-000000000200'$$,
    ARRAY[1::bigint],
    'Scenario 16: A (host) sees club_members — no recursion'
);
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', false);
SELECT results_eq(
    $$SELECT count(*)::bigint FROM club_members WHERE club_id = '00000000-0000-0000-0000-000000000200'$$,
    ARRAY[0::bigint],
    'Scenario 16: B (non-member) cannot see club_members'
);

-- --- Scenario 17: users own-row + user_profiles view (REQ-DB-014, 013e) ---
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', false);
SELECT results_eq(
    $$SELECT count(*)::bigint FROM users WHERE id = '00000000-0000-0000-0000-000000000001'$$,
    ARRAY[1::bigint],
    'Scenario 17: A sees own users row (Option A: RLS own-row, no REVOKE)'
);
SELECT results_eq(
    $$SELECT count(*)::bigint FROM users WHERE id = '00000000-0000-0000-0000-000000000002'$$,
    ARRAY[0::bigint],
    'Scenario 17: A cannot see B users row'
);
SELECT is(
    (SELECT count(*)::int FROM information_schema.columns WHERE table_name = 'user_profiles'),
    3,
    'user_profiles view has 3 columns (id, nickname, avatar_url)'
);

-- --- Scenario 18: sticker_reactions public read (REQ-DB-017) ---
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', false);
SELECT results_eq(
    $$SELECT count(*)::bigint FROM sticker_reactions WHERE record_id = '00000000-0000-0000-0000-000000000300'$$,
    ARRAY[1::bigint],
    'Scenario 18: B sees A sticker_reaction (public read)'
);

-- --- Scenario 10: books public catalog (REQ-DB-013b) ---
SELECT results_eq(
    $$SELECT count(*)::bigint FROM books WHERE id = '00000000-0000-0000-0000-000000000100'$$,
    ARRAY[1::bigint],
    'Scenario 10: B sees book (public catalog, USING(true))'
);
SELECT is(
    (SELECT count(*)::int FROM pg_policies WHERE tablename = 'books' AND cmd = 'SELECT'),
    1,
    'books has exactly 1 SELECT policy'
);

-- --- Scenario 12: reading_sessions own-row (REQ-DB-021) ---
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', false);
SELECT results_eq(
    $$SELECT count(*)::bigint FROM reading_sessions WHERE user_id = '00000000-0000-0000-0000-000000000001'$$,
    ARRAY[1::bigint],
    'Scenario 12: A sees own reading_sessions'
);
SELECT results_eq(
    $$SELECT count(*)::bigint FROM reading_sessions WHERE user_id = '00000000-0000-0000-0000-000000000002'$$,
    ARRAY[0::bigint],
    'Scenario 12: A cannot see B reading_sessions'
);

-- --- Scenario 13: point_logs own-row (REQ-DB-021) ---
SELECT results_eq(
    $$SELECT count(*)::bigint FROM point_logs WHERE user_id = '00000000-0000-0000-0000-000000000001'$$,
    ARRAY[1::bigint],
    'Scenario 13: A sees own point_logs'
);
SELECT results_eq(
    $$SELECT count(*)::bigint FROM point_logs WHERE user_id = '00000000-0000-0000-0000-000000000002'$$,
    ARRAY[0::bigint],
    'Scenario 13: A cannot see B point_logs'
);

-- --- Scenario 14: notifications own-row (REQ-DB-021) ---
SELECT results_eq(
    $$SELECT count(*)::bigint FROM notifications WHERE user_id = '00000000-0000-0000-0000-000000000001'$$,
    ARRAY[1::bigint],
    'Scenario 14: A sees own notifications'
);

-- --- completion_reports own-row (REQ-DB-021) ---
SELECT results_eq(
    $$SELECT count(*)::bigint FROM completion_reports WHERE user_id = '00000000-0000-0000-0000-000000000001'$$,
    ARRAY[1::bigint],
    'A sees own completion_reports'
);

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
