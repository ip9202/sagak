-- Clubs Table Test for SPEC-DB-001 T-003
-- Tests clubs table with handle_new_club_host trigger

BEGIN;
SELECT plan(19);

-- Test 1: clubs table exists with correct columns
SELECT has_table('public', 'clubs', 'clubs table should exist');
SELECT col_type_is('public', 'clubs', 'id', 'uuid', 'clubs.id should be uuid');
SELECT col_type_is('public', 'clubs', 'name', 'text', 'clubs.name should be text');
SELECT col_type_is('public', 'clubs', 'description', 'text', 'clubs.description should be text');
SELECT col_type_is('public', 'clubs', 'book_id', 'uuid', 'clubs.book_id should be uuid');
SELECT col_type_is('public', 'clubs', 'type', 'text', 'clubs.type should be text');
SELECT col_type_is('public', 'clubs', 'status', 'text', 'clubs.status should be text');
SELECT col_type_is('public', 'clubs', 'host_id', 'uuid', 'clubs.host_id should be uuid');
SELECT col_type_is('public', 'clubs', 'max_members', 'integer', 'clubs.max_members should be integer');
SELECT col_type_is('public', 'clubs', 'created_at', 'timestamptz', 'clubs.created_at should be timestamptz');

-- Test 2: NOT NULL constraints
SELECT col_not_null('public', 'clubs', 'id', 'clubs.id should be NOT NULL');
SELECT col_not_null('public', 'clubs', 'name', 'clubs.name should be NOT NULL');
SELECT col_not_null('public', 'clubs', 'host_id', 'clubs.host_id should be NOT NULL');

-- Test 3: CHECK constraints for type and status
SELECT col_has_check('public', 'clubs', 'type', 'clubs should have type CHECK constraint');
SELECT col_has_check('public', 'clubs', 'status', 'clubs.should have status CHECK constraint');

-- Test 4: Foreign key constraints
SELECT col_is_fk('public', 'clubs', 'book_id', 'clubs.book_id should be FK to books.id');
SELECT col_is_fk('public', 'clubs', 'host_id', 'clubs.host_id should be FK to users.id');

-- Test 5: handle_new_club_host function exists
SELECT has_function('handle_new_club_host', 'handle_new_club_host function should exist');

-- Test 6: Trigger on clubs exists
SELECT has_trigger('public', 'clubs', 'on_club_created', 'clubs should have trigger for auto-inserting host into club_members');

SELECT * FROM finish();
ROLLBACK;
