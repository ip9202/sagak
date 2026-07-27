-- pgTAP 회귀 테스트: 다중 reading 공개 가시성 (SPEC-LIBRARY-002 M4)
-- 대상 AC: AC-LIB2-VIS-001 (P1, 메모리 #29), AC-LIB2-VIS-002 (P2)
--
-- 검증 범위:
--   AC-VIS-001: 다중 reading + is_public=true N권 → user_books_public 노출 (메모리 #29)
--   AC-VIS-002: "대표 책" 개념 부재 — 모든 공개 reading 이 동등하게 노출 (P2)
--   부가: RLS 게이트 — 타인이 user_books_public 조회 시 공개 행만 노출
--   부가: idx_user_books_user_status (M1 D11) 존재 — reader list 쿼리 성능 회귀 대응
--
-- 설계 결정:
--   - AC-VIS-001 은 user_books_public 보안 뷰(view)를 통한 간접 검증.
--     뷰가 is_public=true 만 노출하므로, 클라이언트(fetchActiveReaders)가 뷰에서
--     읽을 때 is_public=false 행이 자동 누락됨을 DB 레벨에서 입증.
--   - RLS 는 SET ROLE authenticated + set_config 로 시뮬레이션 (0014 패턴 준용).
--   - AC-VIS-002 는 "대표 책 단일 노출" 회귀 방어: 공개 reading N권이 뷰에 N행 노출됨.
--     (클라이언트 코드에 "대표 책"/pickCurrentBook 부재는 grep 으로 별도 검증 — plan.md M4)
--   - UUID 접두사 bbbb0000-* 로 0022(aaaa0000) 및 타 테스트와 충돌 회피.
--   - 다중 reading 은 M1 enforce_single_reading 철회로 가능 (AC-LIB2-DB-004).
--
-- @MX:ANCHOR: [AUTO] 다중 reading 공개 가시성 회귀 방어선 — user_books_public 뷰가 is_public=true reading 다수를 독립 노출
-- @MX:REASON: SPEC-LIBRARY-002 가 다중 reading 을 허용함에 따라, 공개 reader list(Track A)가
--             "대표 책 1개만 노출" 회귀를 일으키지 않음을 영원히 보장. 회귀 시 사용자가 다중 reading 공개가 묻힘.
-- @MX:SPEC SPEC-LIBRARY-002

BEGIN;
SELECT plan(9);

-- ============================================================================
-- SETUP (postgres role — RLS 우회, 테스트 데이터 시딩)
-- ============================================================================
DELETE FROM sticker_reactions WHERE record_id IN (
    SELECT id FROM emotion_records WHERE user_id IN ('bbbb0000-0000-0000-0000-000000000001','bbbb0000-0000-0000-0000-000000000002')
);
DELETE FROM emotion_records WHERE user_id IN ('bbbb0000-0000-0000-0000-000000000001','bbbb0000-0000-0000-0000-000000000002');
DELETE FROM completion_reports WHERE user_book_id IN (
    SELECT id FROM user_books WHERE user_id IN ('bbbb0000-0000-0000-0000-000000000001','bbbb0000-0000-0000-0000-000000000002')
);
DELETE FROM user_books WHERE user_id IN ('bbbb0000-0000-0000-0000-000000000001','bbbb0000-0000-0000-0000-000000000002');
DELETE FROM books WHERE id IN (
    'bbbb0000-0000-0000-0000-000000000101',
    'bbbb0000-0000-0000-0000-000000000102',
    'bbbb0000-0000-0000-0000-000000000103'
);
DELETE FROM users WHERE id IN ('bbbb0000-0000-0000-0000-000000000001','bbbb0000-0000-0000-0000-000000000002');

-- 사용자 u1(다중 reading 보유), u2(타인 — RLS 게이트 검증용)
INSERT INTO users (id, email, nickname, provider) VALUES
    ('bbbb0000-0000-0000-0000-000000000001', 'vis1@test.com', 'VisOne', 'kakao'),
    ('bbbb0000-0000-0000-0000-000000000002', 'vis2@test.com', 'VisTwo', 'kakao');

-- 책 3종 (u1 이 다중 reading 보유)
INSERT INTO books (id, isbn, title, author) VALUES
    ('bbbb0000-0000-0000-0000-000000000101', '9781111111111', 'Public Book A', 'Author'),
    ('bbbb0000-0000-0000-0000-000000000102', '9782222222222', 'Public Book B', 'Author'),
    ('bbbb0000-0000-0000-0000-000000000103', '9783333333333', 'Private Book C', 'Author');

-- u1 다중 reading: 2개 is_public=true, 1개 is_public=false
-- (AC-LIB2-VIS-001 fixture: 3 reading 행, 2 public, 1 private)
INSERT INTO user_books (user_id, book_id, status, is_public) VALUES
    ('bbbb0000-0000-0000-0000-000000000001', 'bbbb0000-0000-0000-0000-000000000101', 'reading', true),
    ('bbbb0000-0000-0000-0000-000000000001', 'bbbb0000-0000-0000-0000-000000000102', 'reading', true),
    ('bbbb0000-0000-0000-0000-000000000001', 'bbbb0000-0000-0000-0000-000000000103', 'reading', false);

-- ============================================================================
-- AC-LIB2-VIS-001 (a): user_books_public 뷰 — u1 의 공개 reading 행 수 = 2
-- (메모리 #29: is_public=false 행은 뷰에서 자동 누락)
-- ============================================================================
SELECT results_eq(
    $$SELECT count(*)::bigint FROM user_books_public
      WHERE user_id = 'bbbb0000-0000-0000-0000-000000000001'$$,
    ARRAY[2::bigint],
    'AC-VIS-001a: u1 의 user_books_public 조회 시 공개 reading 2행 노출 (is_public=false 1행 자동 누락)'
);

-- ============================================================================
-- AC-LIB2-VIS-001 (b): 공개 reading 2행은 서로 다른 book_id — 다중 reading 독립 노출
-- ============================================================================
SELECT results_eq(
    $$SELECT count(DISTINCT book_id)::bigint FROM user_books_public
      WHERE user_id = 'bbbb0000-0000-0000-0000-000000000001'$$,
    ARRAY[2::bigint],
    'AC-VIS-001b: 공개 reading 2행은 서로 다른 book_id — 다중 reading 이 각 책 리더 목록에 독립 노출'
);

-- ============================================================================
-- AC-LIB2-VIS-001 (c): is_public=false book_id(Private Book C) 는 뷰에 노출 안 됨
-- ============================================================================
SELECT results_eq(
    $$SELECT count(*)::bigint FROM user_books_public
      WHERE user_id = 'bbbb0000-0000-0000-0000-000000000001'
        AND book_id = 'bbbb0000-0000-0000-0000-000000000103'$$,
    ARRAY[0::bigint],
    'AC-VIS-001c: is_public=false Private Book C 는 user_books_public 에 노출 안 됨'
);

-- ============================================================================
-- AC-LIB2-VIS-001 (d): 노출 컬럼 제한 준수 (book_id, current_page, started_reading_at, user_id, status)
-- (기존 0014 테스트가 5컬럼을 검증했으나, 본 테스트는 다중 reading 컨텍스트에서 재확인)
-- ============================================================================
SELECT is(
    (SELECT count(*)::int FROM information_schema.columns
      WHERE table_name = 'user_books_public'),
    5,
    'AC-VIS-001d: user_books_public 노출 컬럼 = 5 (book_id, current_page, started_reading_at, user_id, status)'
);

-- ============================================================================
-- AC-LIB2-VIS-002: "대표 책" 개념 부재 — 공개 reading N권이 뷰에 N행 노출
-- (단일 "대표 책"으로 축소 없음 — 모든 공개 reading 이 동등하게 처리)
-- 본 검증은 DB 레벨: user_books_public 행 수 = 공개 reading user_books 행수.
-- 클라이언트 코드 부재(pickCurrentBook 등)는 grep 으로 별도 검증(plan.md M4 범위).
-- ============================================================================
SELECT results_eq(
    $$SELECT count(*)::bigint FROM user_books_public
      WHERE user_id = 'bbbb0000-0000-0000-0000-000000000001'$$,
    $$SELECT count(*)::bigint FROM user_books
      WHERE user_id = 'bbbb0000-0000-0000-0000-000000000001'
        AND is_public = true$$,
    'AC-VIS-002: "대표 책" 축소 없음 — user_books_public 행수 = 공개 reading user_books 행수'
);

-- ============================================================================
-- RLS 게이트 (a): 타인(u2)이 user_books_public 조회 시 u1 의 공개 행만 보임
-- (0014 패턴 준용 — SET ROLE authenticated + set_config 로 시뮬레이션)
-- ============================================================================
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"bbbb0000-0000-0000-0000-000000000002","role":"authenticated"}', false);

SELECT results_eq(
    $$SELECT count(*)::bigint FROM user_books_public
      WHERE user_id = 'bbbb0000-0000-0000-0000-000000000001'$$,
    ARRAY[2::bigint],
    'RLS-a: 타인(u2)이 user_books_public 으로 u1 조회 시 공개 reading 2행 노출'
);

-- ============================================================================
-- RLS 게이트 (b): 타인(u2)이 book_id=Public Book A 로 조회 시 u1 이 reader 로 노출
-- (fetchActiveReaders 와 동일한 쿼리 패턴: WHERE book_id=? AND status=reading)
-- ============================================================================
SELECT results_eq(
    $$SELECT count(*)::bigint FROM user_books_public
      WHERE book_id = 'bbbb0000-0000-0000-0000-000000000101'
        AND status = 'reading'$$,
    ARRAY[1::bigint],
    'RLS-b: 타인이 Public Book A 의 active readers 조회 시 u1 이 1행 노출 (fetchActiveReaders 패턴)'
);

-- ============================================================================
-- RLS 게이트 (c): 타인(u2)이 book_id=Private Book C 로 조회 시 0행 (is_public=false)
-- ============================================================================
SELECT results_eq(
    $$SELECT count(*)::bigint FROM user_books_public
      WHERE book_id = 'bbbb0000-0000-0000-0000-000000000103'
        AND status = 'reading'$$,
    ARRAY[0::bigint],
    'RLS-c: 타인이 Private Book C 조회 시 0행 (is_public=false → 뷰에서 자동 누락)'
);

-- ============================================================================
-- M1 D11: idx_user_books_user_status 일반 인덱스 존재 (reader list 쿼리 성능 회귀 대응)
-- (0022 에서 이미 검증되었으나, 본 테스트는 가시성 컨텍스트에서 재확인)
-- 참고: reader list 쿼리(WHERE book_id=? AND status=reading)는 book-centric 이므로
--       idx_user_books_book_id_public_progress 가 주로 사용되며,
--       idx_user_books_user_status(user_id, status) 는 user-centric 쿼리(useLibrary)용.
-- ============================================================================
RESET ROLE;
SELECT has_index(
    'public', 'user_books', 'idx_user_books_user_status',
    'M1 D11: idx_user_books_user_status 존재 — user-centric WHERE status 쿼리 성능 회귀 대응'
);

SELECT * FROM finish();
ROLLBACK;
