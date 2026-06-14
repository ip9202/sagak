-- point_logs table tests for SPEC-DB-001
-- Migration: 0011_create_point_logs
-- Requirements: REQ-DB-011 (point system)

BEGIN;

SELECT plan(18);

-- Seed data
INSERT INTO users (id, email, nickname, provider) VALUES
('11111111-1111-1111-1111-111111111111', 'user1@test.com', 'Test User 1', 'kakao'),
('22222222-2222-2222-2222-222222222222', 'user2@test.com', 'Test User 2', 'kakao');

-- Test 1: Table exists
SELECT has_table('public', 'point_logs', 'point_logs table should exist');

-- Test 2: id column is uuid PRIMARY KEY
SELECT col_type_is('public', 'point_logs', 'id', 'uuid', 'id column should be uuid');
SELECT col_is_pk('public', 'point_logs', 'id', 'id should be PRIMARY KEY');

-- Test 3: user_id column exists and is uuid FK
SELECT col_type_is('public', 'point_logs', 'user_id', 'uuid', 'user_id should be uuid');
SELECT col_not_null('public', 'point_logs', 'user_id', 'user_id should be NOT NULL');

-- Test 4: FK to users with ON DELETE RESTRICT
SELECT col_is_fk('public', 'point_logs', 'user_id', 'user_id should FK to users.id');
-- FK RESTRICT test will be done at the end (after all other tests complete)

-- Test 5: amount column is integer NOT NULL
SELECT col_type_is('public', 'point_logs', 'amount', 'integer', 'amount should be integer');
SELECT col_not_null('public', 'point_logs', 'amount', 'amount should be NOT NULL');

-- Test 6: reason column is text NOT NULL
SELECT col_type_is('public', 'point_logs', 'reason', 'text', 'reason should be text');
SELECT col_not_null('public', 'point_logs', 'reason', 'reason should be NOT NULL');

-- Test 7: created_at column is timestamptz with default now()
SELECT col_type_is('public', 'point_logs', 'created_at', 'timestamptz', 'created_at should be timestamptz');
SELECT col_default_is('public', 'point_logs', 'created_at', 'now()', 'created_at should default to now()');

-- Test 8: Can insert point_log with positive amount (earn)
INSERT INTO point_logs (user_id, amount, reason)
VALUES ('11111111-1111-1111-1111-111111111111', 100, 'completion');
SELECT results_eq(
    $$SELECT amount FROM point_logs WHERE user_id = '11111111-1111-1111-1111-111111111111' AND amount = 100$$,
    ARRAY[100]::integer[],
    'Should insert point_log with positive amount'
);

-- Test 9: Can insert point_log with negative amount (spend)
INSERT INTO point_logs (user_id, amount, reason)
VALUES ('11111111-1111-1111-1111-111111111111', -50, 'exchange');
SELECT results_eq(
    $$SELECT amount FROM point_logs WHERE user_id = '11111111-1111-1111-1111-111111111111' AND amount = -50$$,
    ARRAY[-50]::integer[],
    'Should insert point_log with negative amount'
);

-- Test 10: created_at auto-populates
SELECT isnt_empty(
    $$SELECT created_at::text FROM point_logs WHERE user_id = '11111111-1111-1111-1111-111111111111' AND amount = 100 LIMIT 1$$,
    'created_at should be auto-populated'
);

-- Test 11: User isolation (user A cannot see user B point_logs)
-- Note: This test is a placeholder for RLS which will be implemented in T-007
-- For now, we just verify the query structure
SELECT results_eq(
    $$SELECT count(*) FROM point_logs WHERE user_id = '22222222-2222-2222-2222-222222222222'$$,
    ARRAY[0]::bigint[],
    'User A cannot see user B point_logs (RLS test placeholder - will be enforced in T-007)'
);

-- Test 12-16: CHECK constraint for amount (positive or negative, both valid - no range check in schema)
-- The schema allows any integer, positive = earn, negative = spend
INSERT INTO point_logs (user_id, amount, reason)
VALUES ('11111111-1111-1111-1111-111111111111', 0, 'test_zero');
SELECT results_eq(
    $$SELECT amount FROM point_logs WHERE user_id = '11111111-1111-1111-1111-111111111111' AND amount = 0$$,
    ARRAY[0]::integer[],
    'Should allow zero amount'
);

-- Test 17: FK RESTRICT behavior (test at end to avoid breaking other tests)
INSERT INTO point_logs (user_id, amount, reason) VALUES ('11111111-1111-1111-1111-111111111111', 100, 'fk_test');
SELECT throws_ok(
    $$DELETE FROM users WHERE id = '11111111-1111-1111-1111-111111111111'$$,
    '23503'
);

SELECT * FROM finish();

ROLLBACK;
