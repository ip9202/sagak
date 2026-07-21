-- T-004: club_members table tests
-- RED Phase: Tests fail because tables don't exist yet

BEGIN;

SET client_min_messages TO warning;

-- Plan the tests
-- Actual count: 16 tests
SELECT plan(16);

-- Test 1: club_members table exists
SELECT has_table(
    'public',
    'club_members',
    'club_members table should exist'
);

-- Test 2: id column is UUID PK
SELECT col_is_pk('club_members', 'id', 'club_members.id should be primary key');
SELECT col_type_is('club_members', 'id', 'uuid', 'club_members.id should be uuid');

-- Test 3: club_id FK to clubs
SELECT col_type_is('club_members', 'club_id', 'uuid', 'club_members.club_id should be uuid');
SELECT col_not_null('club_members', 'club_id', 'club_members.club_id should be NOT NULL');
SELECT fk_ok('club_members', 'club_id', 'clubs', 'id', 'club_members.club_id should FK to clubs.id');

-- Test 4: user_id FK to users
SELECT col_type_is('club_members', 'user_id', 'uuid', 'club_members.user_id should be uuid');
SELECT col_not_null('club_members', 'user_id', 'club_members.user_id should be NOT NULL');
SELECT fk_ok('club_members', 'user_id', 'users', 'id', 'club_members.user_id should FK to users.id');

-- Test 5: role column with CHECK constraint
SELECT col_type_is('club_members', 'role', 'text', 'club_members.role should be text');
SELECT col_not_null('club_members', 'role', 'club_members.role should be NOT NULL');
-- Check constraint tested below

-- Test 6: joined_at timestamp
SELECT col_type_is('club_members', 'joined_at', 'timestamp with time zone', 'club_members.joined_at should be timestamptz');

-- Test 7: UNIQUE(club_id, user_id) - tested via duplicate insert in test 11 below
-- Composite constraint verified by attempting duplicate insertion

-- Test 8: role CHECK constraint (host/member)
-- Check constraint by testing invalid value
SELECT throws_ok(
    'INSERT INTO club_members (id, club_id, user_id, role) VALUES (''ffffffff-ffff-ffff-ffff-ffffffffffff'', ''cccccccc-cccc-cccc-cccc-cccccccccccc'', ''22222222-2222-2222-2222-222222222222'', ''invalid_role'')',
    '23514'
);

-- Test 9: FK ON DELETE RESTRICT
-- This is verified by checking the FK constraint behavior
SELECT is(
    (
        SELECT confdeltype FROM pg_constraint
        JOIN pg_class ON pg_constraint.conrelid = pg_class.oid
        JOIN pg_namespace ON pg_class.relnamespace = pg_namespace.oid
        WHERE pg_namespace.nspname = 'public'
        AND pg_class.relname = 'club_members'
        AND conname = 'club_members_club_id_fkey'
    ) = 'r',
    true,
    'club_members.club_id FK should be ON DELETE RESTRICT'
);

-- Test 10: Insert with valid data succeeds
-- Note: We cannot insert host club_member manually because the trigger in migration 0004
-- (handle_new_club_host) auto-inserts it when we INSERT into clubs. So we test member insertion instead.
INSERT INTO users (id, email, nickname, provider, role) VALUES
    ('11111111-1111-1111-1111-111111111111', 'host@example.com', 'Host User', 'kakao', 'member'),
    ('22222222-2222-2222-2222-222222222222', 'member@example.com', 'Member User', 'kakao', 'member');

INSERT INTO books (id, isbn, title, author) VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '9788991884885', 'Test Book', 'Test Author');

INSERT INTO clubs (id, host_id, book_id, type, name) VALUES
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'group', 'Test Club');

-- Host was auto-inserted by trigger. Now insert a regular member.
INSERT INTO club_members (id, club_id, user_id, role)
VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '22222222-2222-2222-2222-222222222222', 'member');

SELECT is(
    (SELECT COUNT(*) FROM club_members WHERE user_id = '22222222-2222-2222-2222-222222222222')::int,
    1,
    'Valid club member insert should succeed'
);

-- Test 11: UNIQUE constraint blocks duplicate
SELECT throws_ok(
    'INSERT INTO club_members (id, club_id, user_id, role) VALUES (''00000000-0000-0000-0000-000000000001'', ''cccccccc-cccc-cccc-cccc-cccccccccccc'', ''22222222-2222-2222-2222-222222222222'', ''member'')',
    '23505'
);

-- Finish tests
SELECT * FROM finish();

ROLLBACK;
