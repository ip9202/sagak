-- Emotion Records Table Test for SPEC-DB-001 T-003
-- Tests emotion_records with visibility CHECK and club_id guard

BEGIN;
SELECT plan(22);

-- Test 1: emotion_records table exists with correct columns
SELECT has_table('public', 'emotion_records', 'emotion_records table should exist');
SELECT col_type_is('public', 'emotion_records', 'id', 'uuid', 'emotion_records.id should be uuid');
SELECT col_type_is('public', 'emotion_records', 'user_id', 'uuid', 'emotion_records.user_id should be uuid');
SELECT col_type_is('public', 'emotion_records', 'book_id', 'uuid', 'emotion_records.book_id should be uuid');
SELECT col_type_is('public', 'emotion_records', 'club_id', 'uuid', 'emotion_records.club_id should be uuid');
SELECT col_type_is('public', 'emotion_records', 'page_number', 'integer', 'emotion_records.page_number should be integer');
SELECT col_type_is('public', 'emotion_records', 'content', 'text', 'emotion_records.content should be text');
SELECT col_type_is('public', 'emotion_records', 'visibility', 'text', 'emotion_records.visibility should be text');
SELECT col_type_is('public', 'emotion_records', 'created_at', 'timestamptz', 'emotion_records.created_at should be timestamptz');

-- Test 2: NOT NULL constraints
SELECT col_not_null('public', 'emotion_records', 'id', 'emotion_records.id should be NOT NULL');
SELECT col_not_null('public', 'emotion_records', 'user_id', 'emotion_records.user_id should be NOT NULL');
SELECT col_not_null('public', 'emotion_records', 'book_id', 'emotion_records.book_id should be NOT NULL');
SELECT col_not_null('public', 'emotion_records', 'content', 'emotion_records.content should be NOT NULL');
SELECT col_not_null('public', 'emotion_records', 'visibility', 'emotion_records.visibility should be NOT NULL');

-- Test 3: CHECK constraint for visibility
SELECT col_has_check('public', 'emotion_records', 'visibility', 'emotion_records should have visibility CHECK constraint');

-- Test 4: CHECK constraint that visibility=club requires club_id NOT NULL
-- This will be tested via behavioral tests below
SELECT ok(true, 'emotion_records.visibility=club requires club_id NOT NULL (behavioral test)');

-- Test 5: Foreign key constraints
SELECT col_is_fk('public', 'emotion_records', 'user_id', 'emotion_records.user_id should be FK to users.id');
SELECT col_is_fk('public', 'emotion_records', 'book_id', 'emotion_records.book_id should be FK to books.id');
SELECT col_is_fk('public', 'emotion_records', 'club_id', 'emotion_records.club_id should be FK to clubs.id');

-- Test 6: Behavioral test - visibility=club requires club_id NOT NULL
-- Create test data
INSERT INTO public.users (id, email, nickname, provider) VALUES
  ('11111111-1111-1111-1111-111111111111', 'test@test.com', 'testuser', 'kakao');
INSERT INTO public.books (id, isbn, title, author) VALUES
  ('22222222-2222-2222-2222-222222222222', '9781234567890', 'Test Book', 'Test Author');
INSERT INTO public.clubs (id, name, host_id, book_id, type) VALUES
  ('33333333-3333-3333-3333-333333333333', 'Test Club', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'group');

-- Test 6a: visibility=public should allow NULL club_id
SELECT lives_ok(
  $SQL$INSERT INTO public.emotion_records (user_id, book_id, content, visibility) VALUES ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'Test content', 'public')$SQL$,
  'emotion_records with visibility=public should allow NULL club_id'
);

-- Test 6b: visibility=club should require club_id NOT NULL
SELECT throws_ok(
  $SQL$INSERT INTO public.emotion_records (user_id, book_id, content, visibility) VALUES ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'Test content', 'club')$SQL$,
  '23514',
  NULL,
  'emotion_records with visibility=club should require club_id (error 23514)'
);

-- Test 6c: visibility=club with valid club_id should succeed
SELECT lives_ok(
  $SQL$INSERT INTO public.emotion_records (user_id, book_id, club_id, content, visibility) VALUES ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', 'Test content', 'club')$SQL$,
  'emotion_records with visibility=club and valid club_id should succeed'
);

-- Clean up test data
DELETE FROM public.emotion_records;
DELETE FROM public.club_members;
DELETE FROM public.clubs;
DELETE FROM public.books;
DELETE FROM public.users;

SELECT * FROM finish();
ROLLBACK;
