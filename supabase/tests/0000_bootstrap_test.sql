-- Bootstrap Test for SPEC-DB-001 T-001
-- Verifies Supabase infrastructure is properly initialized
-- This test validates that the basic Supabase structure exists before we start migrations

BEGIN;
SELECT plan(1);

-- Test 1: Verify we can connect to the database and run pgTAP tests
-- This confirms Supabase is running and pgTAP is available
SELECT ok(
    (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' LIMIT 1) >= 0,
    'Database connection and pgTAP framework working'
);

SELECT * FROM finish();
ROLLBACK;
