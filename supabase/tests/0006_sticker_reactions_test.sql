-- Sticker Reactions Table Test for SPEC-DB-001 T-003
-- Tests sticker_type ENUM and sticker_reactions with UNIQUE constraint

BEGIN;
SELECT plan(20);

-- Test 1: sticker_type ENUM exists with correct values
SELECT has_enum('public', 'sticker_type', 'sticker_type ENUM should exist');
SELECT enum_has_labels('public', 'sticker_type', ARRAY['empathy', 'touching', 'comforted'], 'sticker_type should have empathy, touching, comforted labels');

-- Test 2: sticker_type has exactly 3 values (no extra labels)
SELECT results_eq(
  'SELECT count(*)::integer FROM pg_enum WHERE enumtypid = ''public.sticker_type''::regtype',
  'SELECT 3::integer',
  'sticker_type should have exactly 3 values (empathy, touching, comforted)'
);

-- Test 3: sticker_reactions table exists with correct columns
SELECT has_table('public', 'sticker_reactions', 'sticker_reactions table should exist');
SELECT col_type_is('public', 'sticker_reactions', 'id', 'uuid', 'sticker_reactions.id should be uuid');
SELECT col_type_is('public', 'sticker_reactions', 'record_id', 'uuid', 'sticker_reactions.record_id should be uuid');
SELECT col_type_is('public', 'sticker_reactions', 'user_id', 'uuid', 'sticker_reactions.user_id should be uuid');
SELECT col_type_is('public', 'sticker_reactions', 'sticker_type', 'public.sticker_type', 'sticker_reactions.sticker_type should be user-defined ENUM');
SELECT col_type_is('public', 'sticker_reactions', 'created_at', 'timestamptz', 'sticker_reactions.created_at should be timestamptz');

-- Test 4: NOT NULL constraints
SELECT col_not_null('public', 'sticker_reactions', 'id', 'sticker_reactions.id should be NOT NULL');
SELECT col_not_null('public', 'sticker_reactions', 'record_id', 'sticker_reactions.record_id should be NOT NULL');
SELECT col_not_null('public', 'sticker_reactions', 'user_id', 'sticker_reactions.user_id should be NOT NULL');
SELECT col_not_null('public', 'sticker_reactions', 'sticker_type', 'sticker_reactions.sticker_type should be NOT NULL');

-- Test 5: UNIQUE constraint on (record_id, user_id) - prevents duplicate stickers
SELECT has_index('public', 'sticker_reactions', 'sticker_reactions_record_id_user_id_unique', 'sticker_reactions should have UNIQUE index on (record_id, user_id)');

-- Test 6: Foreign key constraints
SELECT col_is_fk('public', 'sticker_reactions', 'record_id', 'sticker_reactions.record_id should be FK to emotion_records.id');
SELECT col_is_fk('public', 'sticker_reactions', 'user_id', 'sticker_reactions.user_id should be FK to users.id');

-- Test 7: Behavioral tests - UNIQUE constraint and multi-user scenarios
-- Create test data
INSERT INTO public.users (id, email, nickname, provider) VALUES
  ('11111111-1111-1111-1111-111111111111', 'user1@test.com', 'user1', 'kakao'),
  ('22222222-2222-2222-2222-222222222222', 'user2@test.com', 'user2', 'kakao');
INSERT INTO public.books (id, isbn, title, author) VALUES
  ('33333333-3333-3333-3333-333333333333', '9781234567890', 'Test Book', 'Test Author');
INSERT INTO public.emotion_records (id, user_id, book_id, content, visibility) VALUES
  ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'Test emotion', 'public');

-- Test 7a: User1 can place sticker on record
SELECT lives_ok(
  $SQL$INSERT INTO public.sticker_reactions (record_id, user_id, sticker_type) VALUES ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 'empathy'::public.sticker_type)$SQL$,
  'User1 should be able to place sticker on record'
);

-- Test 7b: User1 CANNOT place duplicate sticker on same record (error 23505)
SELECT throws_ok(
  $SQL$INSERT INTO public.sticker_reactions (record_id, user_id, sticker_type) VALUES ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 'touching'::public.sticker_type)$SQL$,
  '23505',
  NULL,
  'User1 should NOT be able to place duplicate sticker on same record (error 23505)'
);

-- Test 7c: User2 CAN place sticker on same record (different user)
SELECT lives_ok(
  $SQL$INSERT INTO public.sticker_reactions (record_id, user_id, sticker_type) VALUES ('44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', 'comforted'::public.sticker_type)$SQL$,
  'User2 should be able to place sticker on same record'
);

-- Test 7d: Verify both users have stickers on the same record
SELECT results_eq(
  'SELECT count(*) FROM public.sticker_reactions WHERE record_id = ''44444444-4444-4444-4444-444444444444''::uuid',
  'SELECT 2::bigint',
  'Both users should have stickers on the same record'
);

-- Clean up test data
DELETE FROM public.sticker_reactions;
DELETE FROM public.emotion_records;
DELETE FROM public.books;
DELETE FROM public.users;

SELECT * FROM finish();
ROLLBACK;
