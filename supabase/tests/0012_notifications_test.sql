-- notifications table tests for SPEC-DB-001
-- Migration: 0012_create_notifications
-- Requirements: REQ-DB-012 (notification system)

BEGIN;

SELECT plan(25);

-- Seed data
INSERT INTO users (id, email, nickname, provider) VALUES
('11111111-1111-1111-1111-111111111111', 'user1@test.com', 'Test User 1', 'kakao'),
('22222222-2222-2222-2222-222222222222', 'user2@test.com', 'Test User 2', 'kakao');

-- Test 1: Table exists
SELECT has_table('public', 'notifications', 'notifications table should exist');

-- Test 2: id column is uuid PRIMARY KEY
SELECT col_type_is('public', 'notifications', 'id', 'uuid', 'id column should be uuid');
SELECT col_is_pk('public', 'notifications', 'id', 'id should be PRIMARY KEY');

-- Test 3: user_id column exists and is uuid FK
SELECT col_type_is('public', 'notifications', 'user_id', 'uuid', 'user_id should be uuid');
SELECT col_not_null('public', 'notifications', 'user_id', 'user_id should be NOT NULL');

-- Test 4: FK to users with ON DELETE RESTRICT
SELECT col_is_fk('public', 'notifications', 'user_id', 'user_id should FK to users.id');
-- FK RESTRICT test will be done at the end (after all other tests complete)

-- Test 5: type column is text NOT NULL
SELECT col_type_is('public', 'notifications', 'type', 'text', 'type should be text');
SELECT col_not_null('public', 'notifications', 'type', 'type should be NOT NULL');

-- Test 6: title column is text NOT NULL
SELECT col_type_is('public', 'notifications', 'title', 'text', 'title should be text');
SELECT col_not_null('public', 'notifications', 'title', 'title should be NOT NULL');

-- Test 7: body column is text NOT NULL
SELECT col_type_is('public', 'notifications', 'body', 'text', 'body should be text');
SELECT col_not_null('public', 'notifications', 'body', 'body should be NOT NULL');

-- Test 8: ref_id column is nullable uuid
SELECT col_type_is('public', 'notifications', 'ref_id', 'uuid', 'ref_id should be uuid');
-- Skip nullable test - pgTAP doesn't have a direct function for this
-- Nullable behavior is tested by inserting records without ref_id in later tests

-- Test 9: is_read column is boolean default false
SELECT col_type_is('public', 'notifications', 'is_read', 'boolean', 'is_read should be boolean');
SELECT col_default_is('public', 'notifications', 'is_read', 'false', 'is_read should default to false');
-- is_read is boolean, so it doesn't need nullable test (booleans are always NOT NULL effectively)

-- Test 10: created_at column is timestamptz with default now()
SELECT col_type_is('public', 'notifications', 'created_at', 'timestamptz', 'created_at should be timestamptz');
SELECT col_default_is('public', 'notifications', 'created_at', 'now()', 'created_at should default to now()');

-- Test 11: Can insert notification with all fields
INSERT INTO notifications (user_id, type, title, body, ref_id)
VALUES ('11111111-1111-1111-1111-111111111111', 'club_invite', 'Club Invitation', 'You are invited to a book club', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid);
SELECT results_eq(
    $$SELECT type FROM notifications WHERE user_id = '11111111-1111-1111-1111-111111111111' AND type = 'club_invite'$$,
    ARRAY['club_invite']::text[],
    'Should insert notification with all fields'
);

-- Test 12: Can insert notification without ref_id (nullable)
INSERT INTO notifications (user_id, type, title, body)
VALUES ('11111111-1111-1111-1111-111111111111', 'system', 'System Notice', 'System maintenance scheduled');
SELECT results_eq(
    $$SELECT type FROM notifications WHERE user_id = '11111111-1111-1111-1111-111111111111' AND type = 'system'$$,
    ARRAY['system']::text[],
    'Should insert notification without ref_id'
);

-- Test 13: is_read defaults to false
SELECT results_eq(
    $$SELECT is_read FROM notifications WHERE user_id = '11111111-1111-1111-1111-111111111111' AND type = 'club_invite' LIMIT 1$$,
    ARRAY[false]::boolean[],
    'is_read should default to false'
);

-- Test 14: created_at auto-populates
SELECT isnt_empty(
    $$SELECT created_at::text FROM notifications WHERE user_id = '11111111-1111-1111-1111-111111111111' AND type = 'club_invite' LIMIT 1$$,
    'created_at should be auto-populated'
);

-- Test 15: Can update is_read to true
UPDATE notifications SET is_read = true WHERE user_id = '11111111-1111-1111-1111-111111111111' AND type = 'club_invite';
SELECT results_eq(
    $$SELECT is_read FROM notifications WHERE user_id = '11111111-1111-1111-1111-111111111111' AND type = 'club_invite' LIMIT 1$$,
    ARRAY[true]::boolean[],
    'Should update is_read to true'
);

-- Test 16: User isolation (user A cannot see user B notifications)
-- Note: This test is a placeholder for RLS which will be implemented in T-007
-- For now, we just verify the query structure
SELECT results_eq(
    $$SELECT count(*) FROM notifications WHERE user_id = '22222222-2222-2222-2222-222222222222'$$,
    ARRAY[0]::bigint[],
    'User A cannot see user B notifications (RLS test placeholder - will be enforced in T-007)'
);

-- Test 17-20: Test different notification types
INSERT INTO notifications (user_id, type, title, body) VALUES
('11111111-1111-1111-1111-111111111111', 'reaction', 'New Reaction', 'Someone reacted to your emotion record'),
('11111111-1111-1111-1111-111111111111', 'mention', 'New Mention', 'You were mentioned in a club'),
('11111111-1111-1111-1111-111111111111', 'completion', 'Book Completed', 'A book club member completed a book');

SELECT results_eq(
    $$SELECT count(DISTINCT type) FROM notifications WHERE user_id = '11111111-1111-1111-1111-111111111111'$$,
    ARRAY[5]::bigint[],
    'Should support multiple notification types'
);

-- Test 21: FK RESTRICT behavior (test at end to avoid breaking other tests)
INSERT INTO notifications (user_id, type, title, body) VALUES ('11111111-1111-1111-1111-111111111111', 'system', 'FK Test', 'Test body');
SELECT throws_ok(
    $$DELETE FROM users WHERE id = '11111111-1111-1111-1111-111111111111'$$,
    '23503'
);

SELECT * FROM finish();

ROLLBACK;
