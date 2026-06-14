-- Books Table Test for SPEC-DB-001 T-002
-- Tests books catalog table structure

BEGIN;
SELECT plan(16);

-- Test 1: books table exists with correct columns
SELECT has_table('public', 'books', 'books table should exist');
SELECT col_type_is('public', 'books', 'id', 'uuid', 'books.id should be uuid');
SELECT col_type_is('public', 'books', 'isbn', 'text', 'books.isbn should be text');
SELECT col_type_is('public', 'books', 'title', 'text', 'books.title should be text');
SELECT col_type_is('public', 'books', 'author', 'text', 'books.author should be text');
SELECT col_type_is('public', 'books', 'publisher', 'text', 'books.publisher should be text');
SELECT col_type_is('public', 'books', 'cover_url', 'text', 'books.cover_url should be text');
SELECT col_type_is('public', 'books', 'total_pages', 'integer', 'books.total_pages should be integer');
SELECT col_type_is('public', 'books', 'kakao_id', 'text', 'books.kakao_id should be text');
SELECT col_type_is('public', 'books', 'created_at', 'timestamptz', 'books.created_at should be timestamptz');

-- Test 2: NOT NULL constraints
SELECT col_not_null('public', 'books', 'id', 'books.id should be NOT NULL');
SELECT col_not_null('public', 'books', 'isbn', 'books.isbn should be NOT NULL');
SELECT col_not_null('public', 'books', 'title', 'books.title should be NOT NULL');
SELECT col_not_null('public', 'books', 'author', 'books.author should be NOT NULL');

-- Test 3: UNIQUE constraint on isbn
SELECT col_is_unique('public', 'books', 'isbn', 'books.isbn should have UNIQUE constraint');

-- Test 4: Default values
SELECT col_has_default('public', 'books', 'created_at', 'books.created_at should have default value');

SELECT * FROM finish();
ROLLBACK;
