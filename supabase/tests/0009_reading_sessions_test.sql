-- T-005: reading_sessions table tests
-- RED Phase: Tests fail because table doesn't exist yet

BEGIN;

SET client_min_messages TO warning;

-- Plan the tests
-- Actual count will be determined after writing tests
SELECT plan(1);

-- Test 1: reading_sessions table exists
SELECT has_table(
    'public',
    'reading_sessions',
    'reading_sessions table should exist'
);

-- Finish tests
SELECT * FROM finish();

ROLLBACK;
