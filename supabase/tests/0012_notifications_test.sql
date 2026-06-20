-- notifications table tests for SPEC-DB-001 (SPEC-NOTIF-001 ENUM 6종 전환 반영)
-- Migration: 0012_create_notifications (+ 0003_enrich_notifications_for_notif)
-- Requirements: REQ-DB-012 (notification system), SPEC-NOTIF-001 REQ-NOTIF-011/013
--
-- NOTE: 2026-06-20 SPEC-NOTIF-001 — type 이 text → notification_type ENUM 6종 으로 전환.
--   구형 placeholder 값(club_invite/reaction/mention/system) 테스트를 6종으로 교체.
--   data jsonb 컬럼 검증 추가.

BEGIN;

SELECT plan(28);

-- Seed data
INSERT INTO users (id, email, nickname, provider) VALUES
('11111111-1111-1111-1111-111111111111', 'user1@test.com', 'Test User 1', 'kakao'),
('22222222-2222-2222-2222-222222222222', 'user2@test.com', 'Test User 2', 'kakao');

-- Test 1: Table exists
SELECT has_table('public', 'notifications', 'notifications table should exist');

-- Test 2: id column is uuid PRIMARY KEY
SELECT col_type_is('public', 'notifications', 'id', 'uuid', 'id column should be uuid');
SELECT col_is_pk('public', 'notifications', 'id', 'id should be PRIMARY KEY');

-- Test 3: user_id column exists and is uuid FK
SELECT col_type_is('public', 'notifications', 'user_id', 'uuid', 'user_id should be uuid');
SELECT col_not_null('public', 'notifications', 'user_id', 'user_id should be NOT NULL');

-- Test 4: FK to users with ON DELETE RESTRICT
SELECT col_is_fk('public', 'notifications', 'user_id', 'user_id should FK to users.id');

-- Test 5: type column is notification_type ENUM (SPEC-NOTIF-001 전환)
SELECT col_type_is('public', 'notifications', 'type', 'notification_type', 'type should be notification_type ENUM');
SELECT col_not_null('public', 'notifications', 'type', 'type should be NOT NULL');

-- Test 6: title column is text NOT NULL
SELECT col_type_is('public', 'notifications', 'title', 'text', 'title should be text');
SELECT col_not_null('public', 'notifications', 'title', 'title should be NOT NULL');

-- Test 7: body column is text NOT NULL
SELECT col_type_is('public', 'notifications', 'body', 'text', 'body should be text');
SELECT col_not_null('public', 'notifications', 'body', 'body should be NOT NULL');

-- Test 8: ref_id column is nullable uuid
SELECT col_type_is('public', 'notifications', 'ref_id', 'uuid', 'ref_id should be uuid');

-- Test 9: is_read column is boolean default false
SELECT col_type_is('public', 'notifications', 'is_read', 'boolean', 'is_read should be boolean');
SELECT col_default_is('public', 'notifications', 'is_read', 'false', 'is_read should default to false');

-- Test 10: created_at column is timestamptz with default now()
SELECT col_type_is('public', 'notifications', 'created_at', 'timestamptz', 'created_at should be timestamptz');
SELECT col_default_is('public', 'notifications', 'created_at', 'now()', 'created_at should default to now()');

-- Test 10b: data column is jsonb (SPEC-NOTIF-001 REQ-NOTIF-013)
SELECT col_type_is('public', 'notifications', 'data', 'jsonb', 'data should be jsonb (SPEC-NOTIF-001)');

-- Test 11: Can insert notification with all fields (ENUM 6종 값 + data)
INSERT INTO notifications (user_id, type, title, body, ref_id, data)
VALUES ('11111111-1111-1111-1111-111111111111', 'join_request_received', 'Club Invitation', 'You are invited to a book club', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, '{"club_title":"데미안 모임"}'::jsonb);
SELECT results_eq(
    $$SELECT type::text FROM notifications WHERE user_id = '11111111-1111-1111-1111-111111111111' AND type = 'join_request_received'$$,
    ARRAY['join_request_received']::text[],
    'Should insert notification with all fields + ENUM type + data'
);

-- Test 12: Can insert notification without ref_id/data (nullable)
INSERT INTO notifications (user_id, type, title, body)
VALUES ('11111111-1111-1111-1111-111111111111', 'reading_reminder', 'Reading Reminder', 'Time to read');
SELECT results_eq(
    $$SELECT type::text FROM notifications WHERE user_id = '11111111-1111-1111-1111-111111111111' AND type = 'reading_reminder'$$,
    ARRAY['reading_reminder']::text[],
    'Should insert notification without ref_id/data'
);

-- Test 13: is_read defaults to false
SELECT results_eq(
    $$SELECT is_read FROM notifications WHERE user_id = '11111111-1111-1111-1111-111111111111' AND type = 'join_request_received' LIMIT 1$$,
    ARRAY[false]::boolean[],
    'is_read should default to false'
);

-- Test 14: created_at auto-populates
SELECT isnt_empty(
    $$SELECT created_at::text FROM notifications WHERE user_id = '11111111-1111-1111-1111-111111111111' AND type = 'join_request_received' LIMIT 1$$,
    'created_at should be auto-populated'
);

-- Test 15: Can update is_read to true
UPDATE notifications SET is_read = true WHERE user_id = '11111111-1111-1111-1111-111111111111' AND type = 'join_request_received';
SELECT results_eq(
    $$SELECT is_read FROM notifications WHERE user_id = '11111111-1111-1111-1111-111111111111' AND type = 'join_request_received' LIMIT 1$$,
    ARRAY[true]::boolean[],
    'Should update is_read to true'
);

-- Test 16: data jsonb round-trip
SELECT results_eq(
    $$SELECT data->>'club_title' FROM notifications WHERE user_id = '11111111-1111-1111-1111-111111111111' AND type = 'join_request_received' LIMIT 1$$,
    ARRAY['데미안 모임']::text[],
    'data jsonb should round-trip template variables'
);

-- Test 17: ENUM rejects invalid type (SPEC-NOTIF-001 REQ-NOTIF-011)
SELECT throws_ok(
    $$INSERT INTO notifications (user_id, type, title, body) VALUES ('11111111-1111-1111-1111-111111111111', 'invalid_type', 'X', 'Y')$$,
    '22P02'
);

-- Test 18: legacy placeholder value rejected after ENUM 전환
SELECT throws_ok(
    $$INSERT INTO notifications (user_id, type, title, body) VALUES ('11111111-1111-1111-1111-111111111111', 'club_invite', 'X', 'Y')$$,
    '22P02'
);

-- Test 19-22: Test remaining notification types (ENUM 6종)
INSERT INTO notifications (user_id, type, title, body) VALUES
('11111111-1111-1111-1111-111111111111', 'sticker_received', 'Sticker', 'Someone reacted'),
('11111111-1111-1111-1111-111111111111', 'club_signal', 'Signal', 'Someone is reading'),
('11111111-1111-1111-1111-111111111111', 'completion', 'Book Completed', 'A book club member completed a book'),
('11111111-1111-1111-1111-111111111111', 'join_accepted', 'Join Accepted', 'You joined a club');

SELECT results_eq(
    $$SELECT count(DISTINCT type) FROM notifications WHERE user_id = '11111111-1111-1111-1111-111111111111'$$,
    ARRAY[6]::bigint[],
    'Should support all 6 notification_type ENUM values'
);

-- Test 23: FK RESTRICT behavior
INSERT INTO notifications (user_id, type, title, body) VALUES ('11111111-1111-1111-1111-111111111111', 'completion', 'FK Test', 'Test body');
SELECT throws_ok(
    $$DELETE FROM users WHERE id = '11111111-1111-1111-1111-111111111111'$$,
    '23503'
);

SELECT * FROM finish();

ROLLBACK;
