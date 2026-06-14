-- User Books Table Test for SPEC-DB-001 T-002
-- Tests user_books junction table with UNIQUE, CHECK, and FK constraints

BEGIN;
SELECT plan(25);

-- Test 1: user_books table exists with correct columns
SELECT has_table('public', 'user_books', 'user_books table should exist');
SELECT col_type_is('public', 'user_books', 'id', 'uuid', 'user_books.id should be uuid');
SELECT col_type_is('public', 'user_books', 'user_id', 'uuid', 'user_books.user_id should be uuid');
SELECT col_type_is('public', 'user_books', 'book_id', 'uuid', 'user_books.book_id should be uuid');
SELECT col_type_is('public', 'user_books', 'status', 'text', 'user_books.status should be text');
SELECT col_type_is('public', 'user_books', 'current_page', 'integer', 'user_books.current_page should be integer');
SELECT col_type_is('public', 'user_books', 'is_public', 'boolean', 'user_books.is_public should be boolean');
SELECT col_type_is('public', 'user_books', 'started_reading_at', 'timestamptz', 'user_books.started_reading_at should be timestamptz');
SELECT col_type_is('public', 'user_books', 'last_progress_at', 'timestamptz', 'user_books.last_progress_at should be timestamptz');
SELECT col_type_is('public', 'user_books', 'completed_at', 'timestamptz', 'user_books.completed_at should be timestamptz');
SELECT col_type_is('public', 'user_books', 'created_at', 'timestamptz', 'user_books.created_at should be timestamptz');
SELECT col_type_is('public', 'user_books', 'updated_at', 'timestamptz', 'user_books.updated_at should be timestamptz');

-- Test 2: NOT NULL constraints
SELECT col_not_null('public', 'user_books', 'id', 'user_books.id should be NOT NULL');
SELECT col_not_null('public', 'user_books', 'user_id', 'user_books.user_id should be NOT NULL');
SELECT col_not_null('public', 'user_books', 'book_id', 'user_books.book_id should be NOT NULL');
SELECT col_not_null('public', 'user_books', 'status', 'user_books.status should be NOT NULL');

-- Test 3: UNIQUE constraint on (user_id, book_id) - prevents duplicate registration
-- Composite UNIQUE constraint creates a unique index automatically
SELECT has_index('public', 'user_books', 'user_books_user_id_book_id_unique', 'user_books should have UNIQUE index on (user_id, book_id)');

-- Test 4: Default values
SELECT col_has_default('public', 'user_books', 'id', 'user_books.id should have default value');
SELECT col_has_default('public', 'user_books', 'current_page', 'user_books.current_page should have default value');
SELECT col_has_default('public', 'user_books', 'is_public', 'user_books.is_public should have default value');
SELECT col_has_default('public', 'user_books', 'created_at', 'user_books.created_at should have default value');
SELECT col_has_default('public', 'user_books', 'updated_at', 'user_books.updated_at should have default value');

-- Test 5: CHECK constraint for status
SELECT col_has_check('public', 'user_books', 'status', 'user_books should have status CHECK constraint');

-- Test 6: Foreign key constraints
SELECT col_is_fk('public', 'user_books', 'user_id', 'user_books.user_id should be FK to users.id');
SELECT col_is_fk('public', 'user_books', 'book_id', 'user_books.book_id should be FK to books.id');

SELECT * FROM finish();
ROLLBACK;
