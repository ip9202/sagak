-- T-004: join_requests table and triggers tests
-- RED Phase: Tests fail because tables don't exist yet

BEGIN;

SET client_min_messages TO warning;

-- Plan the tests
-- Actual count: 24 tests
SELECT plan(24);

-- Setup test data
INSERT INTO users (id, email, nickname, provider, role) VALUES
    ('11111111-1111-1111-1111-111111111111', 'host@example.com', 'Host User', 'kakao', 'member'),
    ('22222222-2222-2222-2222-222222222222', 'requester@example.com', 'Requester User', 'kakao', 'member'),
    ('33333333-3333-3333-3333-333333333333', 'requester2@example.com', 'Requester2 User', 'kakao', 'member');

INSERT INTO books (id, isbn, title, author) VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '9788991884885', 'Test Book', 'Test Author');

INSERT INTO clubs (id, host_id, book_id, type, name) VALUES
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'group', 'Test Club');

-- Test 1: join_requests table exists
SELECT has_table(
    'public',
    'join_requests',
    'join_requests table should exist'
);

-- Test 2: id column is UUID PK
SELECT col_is_pk('join_requests', 'id', 'join_requests.id should be primary key');
SELECT col_type_is('join_requests', 'id', 'uuid', 'join_requests.id should be uuid');

-- Test 3: club_id FK to clubs
SELECT col_type_is('join_requests', 'club_id', 'uuid', 'join_requests.club_id should be uuid');
SELECT col_not_null('join_requests', 'club_id', 'join_requests.club_id should be NOT NULL');
SELECT fk_ok('join_requests', 'club_id', 'clubs', 'id', 'join_requests.club_id should FK to clubs.id');

-- Test 4: requester_id FK to users
SELECT col_type_is('join_requests', 'requester_id', 'uuid', 'join_requests.requester_id should be uuid');
SELECT col_not_null('join_requests', 'requester_id', 'join_requests.requester_id should be NOT NULL');
SELECT fk_ok('join_requests', 'requester_id', 'users', 'id', 'join_requests.requester_id should FK to users.id');

-- Test 5: status column with CHECK constraint
SELECT col_type_is('join_requests', 'status', 'text', 'join_requests.status should be text');
SELECT col_not_null('join_requests', 'status', 'join_requests.status should be NOT NULL');

-- Test 6: responded_at column
SELECT col_type_is('join_requests', 'responded_at', 'timestamp with time zone', 'join_requests.responded_at should be timestamptz');

-- Test 7: UNIQUE(club_id, requester_id) - tested via duplicate insert in test 15 below
-- Composite constraint verified by attempting duplicate insertion

-- Test 8: status CHECK constraint (pending/accepted/declined)
-- Check constraint by testing invalid value
SELECT throws_ok(
    'INSERT INTO join_requests (id, club_id, requester_id, status, message) VALUES (''eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'', ''cccccccc-cccc-cccc-cccc-cccccccccccc'', ''22222222-2222-2222-2222-222222222222'', ''invalid_status'', ''Test'')',
    '23514'
);

-- Test 9: guard_join_request_status trigger exists
SELECT has_function('guard_join_request_status', 'guard_join_request_status trigger should exist');

-- Test 10: guard_join_request_status is SECURITY DEFINER
SELECT is(
    prosecdef,
    true,
    'guard_join_request_status should be SECURITY DEFINER (prosecdef=true)'
) FROM pg_proc WHERE proname = 'guard_join_request_status';

-- Test 11: join_request_accept trigger exists
SELECT has_trigger('join_requests', 'join_request_accept_trigger', 'join_request_accept trigger should exist');

-- Test 12: join_request_accept is SECURITY DEFINER
SELECT is(
    prosecdef,
    true,
    'join_request_accept should be SECURITY DEFINER (prosecdef=true)'
) FROM pg_proc WHERE proname = 'join_request_accept';

-- Test 13: FK ON DELETE RESTRICT
SELECT is(
    (
        SELECT confdeltype FROM pg_constraint
        JOIN pg_class ON pg_constraint.conrelid = pg_class.oid
        JOIN pg_namespace ON pg_class.relnamespace = pg_namespace.oid
        WHERE pg_namespace.nspname = 'public'
        AND pg_class.relname = 'join_requests'
        AND conname = 'join_requests_club_id_fkey'
    ) = 'r',
    true,
    'join_requests.club_id FK should be ON DELETE RESTRICT'
);

-- Test 14: Insert valid join_request succeeds
INSERT INTO join_requests (id, club_id, requester_id, status, message)
VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '22222222-2222-2222-2222-222222222222', 'pending', 'Please let me join');

SELECT is(
    (SELECT COUNT(*) FROM join_requests WHERE requester_id = '22222222-2222-2222-2222-222222222222')::int,
    1,
    'Valid join request insert should succeed'
);

-- Test 15: UNIQUE constraint blocks duplicate request
SELECT throws_ok(
    'INSERT INTO join_requests (id, club_id, requester_id, status) VALUES (''00000000-0000-0000-0000-000000000002'', ''cccccccc-cccc-cccc-cccc-cccccccccccc'', ''22222222-2222-2222-2222-222222222222'', ''pending'')',
    '23505'
);

-- Test 16: Scenario 2 case 1 - Accept triggers club_members insert
-- Update status to accepted, should auto-insert into club_members
UPDATE join_requests
SET status = 'accepted', responded_at = NOW()
WHERE id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

SELECT is(
    (SELECT COUNT(*) FROM club_members WHERE user_id = '22222222-2222-2222-2222-222222222222' AND club_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc')::int,
    1,
    'Accepting join request should auto-insert into club_members with role=member'
);

SELECT is(
    (SELECT role FROM club_members WHERE user_id = '22222222-2222-2222-2222-222222222222'),
    'member',
    'Auto-inserted club_member should have role=member'
);

-- Test 17: Scenario 2 case 2 - Status reset on terminal row should RAISE EXCEPTION
-- Try to change status from accepted back to pending (should fail)
-- Note: The trigger uses ERRCODE = 'check_violation' (23514), not P0001
SELECT throws_ok(
    'UPDATE join_requests SET status = ''pending'' WHERE id = ''dddddddd-dddd-dddd-dddd-dddddddddddd''',
    '23514'
);

-- Test 18: Scenario 2 case 3 - Other column edits allowed on terminal row
-- Updating message on accepted row should succeed
UPDATE join_requests
SET message = 'Updated message after acceptance'
WHERE id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

SELECT is(
    (SELECT message FROM join_requests WHERE id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'),
    'Updated message after acceptance',
    'Non-status column updates should be allowed on terminal rows'
);

-- Finish tests
SELECT * FROM finish();

ROLLBACK;
