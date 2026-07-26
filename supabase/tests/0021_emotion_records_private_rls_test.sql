-- RLS Test: emotion_records visibility='private' 가시성 (SPEC-EMOTION-001 visibility 확장)
-- F3 (sync-auditor review): private 기록은 작성자(user_id=auth.uid())만 SELECT, 타인은 차단됨을 증명.
-- verification-claim-integrity §1.1 surface 3 — visibility 주장을 도메인 도구(pgTAP)로 검증.
--
-- pgTAP 패턴 (0014_rls_test.sql 준수):
-- 1. setup INSERT는 postgres role(default)로 실행 → RLS 우회
-- 2. SET ROLE authenticated 한 번 설정
-- 3. set_config('request.jwt.claims', json, FALSE) — session-level
-- 4. auth.uid() = current_setting('request.jwt.claims')에서 sub 추출
BEGIN;

SELECT plan(3);

-- ============================================================================
-- SETUP (postgres role — RLS 우회, 테스트 데이터 시딩)
-- ============================================================================
DELETE FROM sticker_reactions WHERE record_id IN (
    SELECT id FROM emotion_records
    WHERE user_id IN ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002')
);
DELETE FROM emotion_records WHERE user_id IN ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002');
DELETE FROM user_books WHERE user_id IN ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002');
DELETE FROM books WHERE id = '00000000-0000-0000-0000-000000000100';
DELETE FROM users WHERE id IN ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002');

INSERT INTO users (id, email, nickname, provider) VALUES
    ('00000000-0000-0000-0000-000000000001', 'privatea@test.com', 'PrivateA', 'kakao'),
    ('00000000-0000-0000-0000-000000000002', 'privateb@test.com', 'PrivateB', 'kakao');

INSERT INTO books (id, isbn, title, author) VALUES
    ('00000000-0000-0000-0000-000000000100', '9780000000001', 'Private Test Book', 'Tester');

-- User A 의 private 감정 기록 시딩 (postgres role — RLS 우회)
INSERT INTO emotion_records (id, user_id, book_id, page_number, content, visibility) VALUES
    ('00000000-0000-0000-0000-000000000310',
     '00000000-0000-0000-0000-000000000001',
     '00000000-0000-0000-0000-000000000100',
     10, '비공개 감정 내용', 'private');

-- ============================================================================
-- TESTS (authenticated role — RLS 적용)
-- ============================================================================
SET ROLE authenticated;

-- 1) 작성자 본인은 private 기록 SELECT 가능 → 1건
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', false);
SELECT results_eq(
    $$SELECT count(*)::bigint FROM emotion_records WHERE visibility = 'private'$$,
    ARRAY[1::bigint],
    'private 기록 작성자(User A) 본인 SELECT 가능 (RLS user_id = auth.uid())'
);

-- 2) 타인은 private 기록 SELECT 불가 → 0건
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', false);
SELECT results_eq(
    $$SELECT count(*)::bigint FROM emotion_records WHERE visibility = 'private'$$,
    ARRAY[0::bigint],
    '타인(User B)은 private 기록 SELECT 불가 — RLS가 private 노출 차단'
);

-- 3) user_id 변조 INSERT → RLS INSERT WITH CHECK 거부
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', false);
SELECT throws_ok(
    $$INSERT INTO emotion_records (user_id, book_id, page_number, content, visibility) VALUES ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000100', 20, '변조 시도', 'private')$$,
    '42501',
    'user_id 변조 INSERT 거부 (RLS INSERT WITH CHECK auth.uid() = user_id)'
);

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
