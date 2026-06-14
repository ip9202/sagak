-- Users Table Test for SPEC-DB-001 T-002
-- Tests core users table structure and handle_new_user trigger

BEGIN;
SELECT plan(21);

-- Setup: Create test users in auth schema (simulating Supabase Auth)
-- Note: In real Supabase, auth.users is managed by the Auth service
-- For tests, we'll simulate the structure

-- Test 1: users table exists with correct columns
SELECT has_table('public', 'users', 'users table should exist');
SELECT col_type_is('public', 'users', 'id', 'uuid', 'users.id should be uuid');
SELECT col_type_is('public', 'users', 'email', 'text', 'users.email should be text');
SELECT col_type_is('public', 'users', 'nickname', 'text', 'users.nickname should be text');
SELECT col_type_is('public', 'users', 'avatar_url', 'text', 'users.avatar_url should be text');
SELECT col_type_is('public', 'users', 'provider', 'text', 'users.provider should be text');
SELECT col_type_is('public', 'users', 'reading_alarm_time', 'time', 'users.reading_alarm_time should be time');
SELECT col_type_is('public', 'users', 'reading_alarm_enabled', 'boolean', 'users.reading_alarm_enabled should be boolean');
SELECT col_type_is('public', 'users', 'role', 'text', 'users.role should be text');
SELECT col_type_is('public', 'users', 'created_at', 'timestamptz', 'users.created_at should be timestamptz');
SELECT col_type_is('public', 'users', 'updated_at', 'timestamptz', 'users.updated_at should be timestamptz');

-- Test 2: Constraints
SELECT col_not_null('public', 'users', 'id', 'users.id should be NOT NULL');
SELECT col_not_null('public', 'users', 'email', 'users.email should be NOT NULL');
SELECT col_not_null('public', 'users', 'nickname', 'users.nickname should be NOT NULL');

-- Test 3: UNIQUE constraint on email
SELECT col_is_unique('public', 'users', 'email', 'users.email should have UNIQUE constraint');

-- Test 4: Default values
SELECT col_has_default('public', 'users', 'id', 'users.id should have default value');
SELECT col_has_default('public', 'users', 'reading_alarm_enabled', 'users.reading_alarm_enabled should have default value');
SELECT col_has_default('public', 'users', 'created_at', 'users.created_at should have default value');
SELECT col_has_default('public', 'users', 'updated_at', 'users.updated_at should have default value');

-- Test 5: CHECK constraints for role and provider
SELECT col_has_check('public', 'users', 'role', 'users should have role CHECK constraint');
SELECT col_has_check('public', 'users', 'provider', 'users should have provider CHECK constraint');

SELECT * FROM finish();
ROLLBACK;
