-- Indexes tests for SPEC-DB-001
-- Migration: 0013_create_indexes
-- Requirements: Performance optimization for common queries

BEGIN;

SELECT plan(12);

-- Test 1: user_books (user_id, status) index for 서재 목록 조회
SELECT has_index(
    'public',
    'user_books',
    'idx_user_books_user_id_status',
    'Index on user_books(user_id, status) should exist'
);

-- Test 2: user_books (book_id, is_public, last_progress_at) for Track A readers
SELECT has_index(
    'public',
    'user_books',
    'idx_user_books_book_id_public_progress',
    'Index on user_books(book_id, is_public, last_progress_at) should exist'
);

-- Test 3: user_books (book_id, started_reading_at) for time-based recommendations
SELECT has_index(
    'public',
    'user_books',
    'idx_user_books_book_id_started',
    'Index on user_books(book_id, started_reading_at) should exist'
);

-- Test 4: clubs (book_id, type, status) for book club discovery
SELECT has_index(
    'public',
    'clubs',
    'idx_clubs_book_id_type_status',
    'Index on clubs(book_id, type, status) should exist'
);

-- Test 5: join_requests (club_id, status) for pending join requests
SELECT has_index(
    'public',
    'join_requests',
    'idx_join_requests_club_id_status',
    'Index on join_requests(club_id, status) should exist'
);

-- Test 6: join_requests (requester_id, status) for user's sent requests
SELECT has_index(
    'public',
    'join_requests',
    'idx_join_requests_requester_id_status',
    'Index on join_requests(requester_id, status) should exist'
);

-- Test 7: emotion_records (book_id, page_number) for feed pagination
SELECT has_index(
    'public',
    'emotion_records',
    'idx_emotion_records_book_id_page',
    'Index on emotion_records(book_id, page_number) should exist'
);

-- Test 8: emotion_records (user_id, created_at DESC) for user's records
SELECT has_index(
    'public',
    'emotion_records',
    'idx_emotion_records_user_id_created_at',
    'Index on emotion_records(user_id, created_at DESC) should exist'
);

-- Test 9: sticker_reactions (record_id) for reaction aggregation
SELECT has_index(
    'public',
    'sticker_reactions',
    'idx_sticker_reactions_record_id',
    'Index on sticker_reactions(record_id) should exist'
);

-- Test 10: club_members (user_id) for user's groups list
SELECT has_index(
    'public',
    'club_members',
    'idx_club_members_user_id',
    'Index on club_members(user_id) should exist'
);

-- Test 11: reading_sessions (user_id, book_id) for reading footprint
SELECT has_index(
    'public',
    'reading_sessions',
    'idx_reading_sessions_user_id_book_id',
    'Index on reading_sessions(user_id, book_id) should exist'
);

-- Test 12: notifications (user_id, is_read) for unread notifications
SELECT has_index(
    'public',
    'notifications',
    'idx_notifications_user_id_is_read',
    'Index on notifications(user_id, is_read) should exist'
);

SELECT * FROM finish();

ROLLBACK;
