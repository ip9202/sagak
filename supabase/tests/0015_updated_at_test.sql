-- T-009: updated_at 자동 갱신 트리거 테스트
-- users, user_books, emotion_records BEFORE UPDATE 트리거 동작 검증
--
-- 핵심 통찰: now()는 트랜잭션 시작 시간을 고정 반환하므로, 같은 트랜잭션 내에서는
-- INSERT와 UPDATE의 updated_at이 동일해 트리거 동작을 검출할 수 없다.
-- 따라서 "수동 updated_at 덮어쓰기 시도 → 트리거가 now()로 덮어씌우는지"로 검증:
--   - 트리거 있음: NEW.updated_at = now() → 2020 시도가 2026(now)로 덮어씌워짐
--   - 트리거 없음: 2020-01-01 유지
--
-- 기존 0014 패턴 준수: information_schema / pg_proc 직접 쿼리 (has_column 미사용)

BEGIN;
SELECT plan(5);

-- ============================================================================
-- SETUP (postgres role — RLS 우회, 테스트 데이터 시딩)
-- idempotent cleanup (FK 역순)
-- ============================================================================
DELETE FROM sticker_reactions   WHERE record_id = '00000000-0000-0000-0000-000000000098';
DELETE FROM emotion_records     WHERE id = '00000000-0000-0000-0000-000000000098';
DELETE FROM user_books          WHERE user_id = '00000000-0000-0000-0000-000000000099';
DELETE FROM users               WHERE id = '00000000-0000-0000-0000-000000000099';
DELETE FROM books               WHERE id = '00000000-0000-0000-0000-000000000099';

INSERT INTO users (id, email, nickname, provider) VALUES
    ('00000000-0000-0000-0000-000000000099', 'upd@test.com', 'UpdTest', 'kakao');
INSERT INTO books (id, isbn, title, author) VALUES
    ('00000000-0000-0000-0000-000000000099', '9789999999999', 'Upd Book', 'Upd Author');
INSERT INTO user_books (user_id, book_id, status, is_public) VALUES
    ('00000000-0000-0000-0000-000000000099', '00000000-0000-0000-0000-000000000099', 'reading', false);
INSERT INTO emotion_records (id, user_id, book_id, page_number, content, visibility) VALUES
    ('00000000-0000-0000-0000-000000000098',
     '00000000-0000-0000-0000-000000000099',
     '00000000-0000-0000-0000-000000000099',
     5, 'initial content', 'public');

-- ============================================================================
-- 구조 검증 (information_schema / pg_proc 직접 쿼리 — 0014 패턴 준수)
-- ============================================================================

-- emotion_records updated_at 컬럼 존재 (T-009 신규 추가)
SELECT is(
    (SELECT count(*)::int FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'emotion_records' AND column_name = 'updated_at'),
    1,
    'emotion_records has updated_at column (T-009 added)'
);

-- 재사용 가능한 트리거 함수 존재
SELECT is(
    (SELECT count(*)::int FROM pg_proc
     WHERE proname = 'set_updated_at' AND pronamespace = 'public'::regnamespace),
    1,
    'set_updated_at() function exists (shared trigger function)'
);

-- ============================================================================
-- 동작 검증: 수동 updated_at 덮어쓰기 → 트리거가 now()로 override 하는지
-- ============================================================================

-- --- users: BEFORE UPDATE 트리거 동작 ---
UPDATE users SET updated_at = '2020-01-01 00:00:00+00'::timestamptz, nickname = 'UpdTest2'
    WHERE id = '00000000-0000-0000-0000-000000000099';
SELECT ok(
    (SELECT updated_at FROM users WHERE id = '00000000-0000-0000-0000-000000000099')
        > '2025-01-01'::timestamptz,
    'users: trigger overrode manual updated_at=2020 (trigger fired, set to now())'
);

-- --- user_books: BEFORE UPDATE 트리거 동작 ---
UPDATE user_books SET updated_at = '2020-01-01 00:00:00+00'::timestamptz, current_page = 10
    WHERE user_id = '00000000-0000-0000-0000-000000000099';
SELECT ok(
    (SELECT updated_at FROM user_books WHERE user_id = '00000000-0000-0000-0000-000000000099')
        > '2025-01-01'::timestamptz,
    'user_books: trigger overrode manual updated_at=2020 (trigger fired, set to now())'
);

-- --- emotion_records: BEFORE UPDATE 트리거 동작 ---
UPDATE emotion_records SET updated_at = '2020-01-01 00:00:00+00'::timestamptz, content = 'updated content'
    WHERE id = '00000000-0000-0000-0000-000000000098';
SELECT ok(
    (SELECT updated_at FROM emotion_records WHERE id = '00000000-0000-0000-0000-000000000098')
        > '2025-01-01'::timestamptz,
    'emotion_records: trigger overrode manual updated_at=2020 (trigger fired, set to now())'
);

SELECT * FROM finish();
ROLLBACK;
