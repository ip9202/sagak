-- T-005: completion_reports table and trigger tests
-- RED Phase: Tests fail because table doesn't exist yet

BEGIN;

SET client_min_messages TO warning;

-- Plan the tests
-- Actual count: 21 tests
SELECT plan(21);

-- Setup test data
INSERT INTO users (id, email, nickname, provider, role) VALUES
    ('11111111-1111-1111-1111-111111111111', 'user@example.com', 'Test User', 'kakao', 'member');

INSERT INTO books (id, isbn, title, author) VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '9788991884885', 'Test Book', 'Test Author');

INSERT INTO user_books (id, user_id, book_id, status) VALUES
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'reading');

INSERT INTO emotion_records (id, user_id, book_id, page_number, content) VALUES
    ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 10, 'Test content 1'),
    ('ffffffff-ffff-ffff-ffff-ffffffffffff', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 20, 'Test content 2');

-- Test 1: completion_reports table exists
SELECT has_table(
    'public',
    'completion_reports',
    'completion_reports table should exist'
);

-- Test 2: id column is UUID PK
SELECT col_is_pk('completion_reports', 'id', 'completion_reports.id should be primary key');
SELECT col_type_is('completion_reports', 'id', 'uuid', 'completion_reports.id should be uuid');

-- Test 3: user_id FK to users
SELECT col_type_is('completion_reports', 'user_id', 'uuid', 'completion_reports.user_id should be uuid');
SELECT col_not_null('completion_reports', 'user_id', 'completion_reports.user_id should be NOT NULL');
SELECT fk_ok('completion_reports', 'user_id', 'users', 'id', 'completion_reports.user_id should FK to users.id');

-- Test 4: book_id FK to books
SELECT col_type_is('completion_reports', 'book_id', 'uuid', 'completion_reports.book_id should be uuid');
SELECT col_not_null('completion_reports', 'book_id', 'completion_reports.book_id should be NOT NULL');
SELECT fk_ok('completion_reports', 'book_id', 'books', 'id', 'completion_reports.book_id should FK to books.id');

-- Test 5: user_book_id FK to user_books
SELECT col_type_is('completion_reports', 'user_book_id', 'uuid', 'completion_reports.user_book_id should be uuid');
SELECT col_not_null('completion_reports', 'user_book_id', 'completion_reports.user_book_id should be NOT NULL');
SELECT fk_ok('completion_reports', 'user_book_id', 'user_books', 'id', 'completion_reports.user_book_id should FK to user_books.id');

-- Test 6: report_data column is JSONB NOT NULL
SELECT col_type_is('completion_reports', 'report_data', 'jsonb', 'completion_reports.report_data should be jsonb');
SELECT col_not_null('completion_reports', 'report_data', 'completion_reports.report_data should be NOT NULL');

-- Test 7: created_at timestamp
SELECT col_type_is('completion_reports', 'created_at', 'timestamp with time zone', 'completion_reports.created_at should be timestamptz');

-- Test 8: UNIQUE(user_book_id) constraint
-- This is tested implicitly via ON CONFLICT behavior in test 16

-- Test 9: FK ON DELETE RESTRICT
SELECT is(
    (
        SELECT confdeltype FROM pg_constraint
        JOIN pg_class ON pg_constraint.conrelid = pg_class.oid
        JOIN pg_namespace ON pg_class.relnamespace = pg_namespace.oid
        WHERE pg_namespace.nspname = 'public'
        AND pg_class.relname = 'completion_reports'
        AND conname = 'completion_reports_user_book_id_fkey'
    ) = 'r',
    true,
    'completion_reports.user_book_id FK should be ON DELETE RESTRICT'
);

-- Test 10: Trigger function exists
SELECT has_function('generate_completion_report', 'generate_completion_report trigger function should exist');

-- Test 11: Trigger function is SECURITY DEFINER
SELECT is(
    prosecdef,
    true,
    'generate_completion_report should be SECURITY DEFINER (prosecdef=true)'
) FROM pg_proc WHERE proname = 'generate_completion_report';

-- Test 12: Trigger exists on user_books
SELECT has_trigger('user_books', 'generate_completion_report_trigger', 'generate_completion_report trigger should exist');

-- Test 13: Delete manual insert to test trigger from scratch
-- (No manual insert - let trigger create the first report)

-- Test 14: Trigger fires on status change to completed (should auto-generate report)
UPDATE user_books
SET status = 'completed'
WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

SELECT is(
    (SELECT COUNT(*) FROM completion_reports WHERE user_book_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')::int,
    1,
    'Trigger should create completion_report when status changes to completed'
);

-- Test 16: Trigger is idempotent (ON CONFLICT DO NOTHING prevents duplicates)
-- Change status back to reading, then to completed again
UPDATE user_books SET status = 'reading' WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
UPDATE user_books SET status = 'completed' WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

SELECT is(
    (SELECT COUNT(*) FROM completion_reports WHERE user_book_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')::int,
    1,
    'ON CONFLICT DO NOTHING should prevent duplicate completion_reports'
);

-- Finish tests
SELECT * FROM finish();

ROLLBACK;
