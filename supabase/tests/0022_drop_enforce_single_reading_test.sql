-- pgTAP 회귀 테스트: enforce_single_reading 정책 철회 (SPEC-LIBRARY-002 M1)
-- 대상 AC: AC-LIB2-DB-001 ~ AC-LIB2-DB-008 (REQ-LIB2-001 ~ REQ-LIB2-008)
--
-- 검증 범위:
--   AC-001: enforce_single_reading 트리거 DROP
--   AC-002: enforce_single_reading 함수 DROP
--   AC-003: user_books_one_reading_per_user 부분 UNIQUE 인덱스 DROP
--   D11   : idx_user_books_user_status 일반 인덱스 신설 (성능 회귀 대응)
--   AC-004: 다중 reading 허용 — INSERT + UPDATE 양쪽 (D10)
--   AC-005: completed / shelved 기존 동작 유지 + UNIQUE(user_id, book_id) 유지
--   AC-006: 잔여 BEFORE ROW 트리거 알파벳순 실행 순서 (메모리 #20) + last_progress_at 갱신
--   AC-007: 4-arg throws_ok / lives_ok 패턴 준수 (메모리 #18, REQ-LIB2-007)
--   AC-008: 다중 reading INSERT 허용 (동시 INSERT 경쟁 순차 근사 — D6)
--
-- 설계 결정:
--   - DB 레벨 동작(트리거/인덱스/제약) 검증이므로 postgres role(default)로 RLS 우회 (0003 패턴 준용).
--   - AC-008 동시성: pgTAP 단일 세션/트랜잭션 한계로 진정한 병렬 커밋을 재현 불가.
--     부분 UNIQUE 인덱스 제거(AC-003) + 순차 다중 INSERT 허용(lives_ok)으로
--     "동시 경쟁 시 23505 발생 불가"를 구조적 + 행위적 근거로 입증.
--   - AC-006 트리거 순서 쿼리: BEFORE ROW 필터는 (tgtype & 3) = 3 (ROW=1 | BEFORE=2).
--     (tgtype 비트: bit0=ROW, bit1=BEFORE per pg_trigger.h)
--   - UUID 접두사 aaaa0000-* 로 타 테스트(0021 emotion_records 등)와 충돌 회피.

BEGIN;
SELECT plan(15);

-- ============================================================================
-- SETUP (postgres role — RLS 우회, 테스트 데이터 시딩)
-- ============================================================================
DELETE FROM sticker_reactions WHERE record_id IN (
    SELECT id FROM emotion_records WHERE user_id IN ('aaaa0000-0000-0000-0000-000000000001','aaaa0000-0000-0000-0000-000000000002')
);
DELETE FROM emotion_records WHERE user_id IN ('aaaa0000-0000-0000-0000-000000000001','aaaa0000-0000-0000-0000-000000000002');
DELETE FROM completion_reports WHERE user_book_id IN (
    SELECT id FROM user_books WHERE user_id IN ('aaaa0000-0000-0000-0000-000000000001','aaaa0000-0000-0000-0000-000000000002')
);
DELETE FROM user_books WHERE user_id IN ('aaaa0000-0000-0000-0000-000000000001','aaaa0000-0000-0000-0000-000000000002');
DELETE FROM books WHERE id IN (
    'aaaa0000-0000-0000-0000-000000000101',
    'aaaa0000-0000-0000-0000-000000000102',
    'aaaa0000-0000-0000-0000-000000000103',
    'aaaa0000-0000-0000-0000-00000000010a',
    'aaaa0000-0000-0000-0000-00000000010b'
);
DELETE FROM users WHERE id IN ('aaaa0000-0000-0000-0000-000000000001','aaaa0000-0000-0000-0000-000000000002');

INSERT INTO users (id, email, nickname, provider) VALUES
    ('aaaa0000-0000-0000-0000-000000000001', 'lib2a@test.com', 'LibTwoA', 'kakao'),
    ('aaaa0000-0000-0000-0000-000000000002', 'lib2b@test.com', 'LibTwoB', 'kakao');

INSERT INTO books (id, isbn, title, author) VALUES
    ('aaaa0000-0000-0000-0000-000000000101', '9781111111111', 'Book 1', 'Author'),
    ('aaaa0000-0000-0000-0000-000000000102', '9782222222222', 'Book 2', 'Author'),
    ('aaaa0000-0000-0000-0000-000000000103', '9783333333333', 'Book 3', 'Author'),
    ('aaaa0000-0000-0000-0000-00000000010a', '9784444444444', 'Book A', 'Author'),
    ('aaaa0000-0000-0000-0000-00000000010b', '9785555555555', 'Book B', 'Author');

-- ============================================================================
-- AC-LIB2-DB-001: enforce_single_reading 트리거 DROP (REQ-LIB2-001)
-- ============================================================================
SELECT results_eq(
    $$SELECT count(*)::bigint FROM pg_trigger
      WHERE tgrelid = 'public.user_books'::regclass
        AND tgname = 'enforce_single_reading'$$,
    ARRAY[0::bigint],
    'AC-001: enforce_single_reading 트리거가 user_books 에서 제거됨'
);

-- ============================================================================
-- AC-LIB2-DB-002: enforce_single_reading 함수 DROP (REQ-LIB2-002)
-- ============================================================================
SELECT results_eq(
    $$SELECT count(*)::bigint FROM pg_proc WHERE proname = 'enforce_single_reading'$$,
    ARRAY[0::bigint],
    'AC-002: enforce_single_reading() 함수가 pg_proc 에서 제거됨'
);

-- ============================================================================
-- AC-LIB2-DB-003: user_books_one_reading_per_user 부분 UNIQUE 인덱스 DROP (REQ-LIB2-003)
-- ============================================================================
SELECT results_eq(
    $$SELECT count(*)::bigint FROM pg_indexes
      WHERE tablename = 'user_books'
        AND indexname = 'user_books_one_reading_per_user'$$,
    ARRAY[0::bigint],
    'AC-003: user_books_one_reading_per_user 부분 UNIQUE 인덱스 제거됨 (다중 reading 봉쇄 해제)'
);

-- ============================================================================
-- D11: idx_user_books_user_status 일반 인덱스 신설 (성능 회귀 대응)
-- ============================================================================
SELECT has_index(
    'public', 'user_books', 'idx_user_books_user_status',
    'D11: (user_id, status) 복합 인덱스 신설 — 다중 reading WHERE clause 쿼리 성능 회귀 대응'
);

-- ============================================================================
-- AC-LIB2-DB-004 (a): 다중 reading INSERT 허용 (D10 — 초기 INSERT 경로)
-- ============================================================================
INSERT INTO user_books (user_id, book_id, status) VALUES
    ('aaaa0000-0000-0000-0000-000000000001', 'aaaa0000-0000-0000-0000-000000000101', 'reading'),
    ('aaaa0000-0000-0000-0000-000000000001', 'aaaa0000-0000-0000-0000-000000000102', 'reading'),
    ('aaaa0000-0000-0000-0000-000000000001', 'aaaa0000-0000-0000-0000-000000000103', 'reading');

SELECT results_eq(
    $$SELECT count(*)::bigint FROM user_books
      WHERE user_id = 'aaaa0000-0000-0000-0000-000000000001' AND status = 'reading'$$,
    ARRAY[3::bigint],
    'AC-004a: 한 사용자 3개 reading INSERT 허용 — 23505 없이 모두 reading 유지'
);

-- ============================================================================
-- AC-LIB2-DB-004 (b): 다중 reading UPDATE 허용 (비-reading → reading 전환 경로)
-- 먼저 3개 행을 shelved 로 되돌린 뒤, 다시 reading 으로 UPDATE.
-- ============================================================================
UPDATE user_books SET status = 'shelved'
WHERE user_id = 'aaaa0000-0000-0000-0000-000000000001';

UPDATE user_books SET status = 'reading'
WHERE user_id = 'aaaa0000-0000-0000-0000-000000000001';

SELECT results_eq(
    $$SELECT count(*)::bigint FROM user_books
      WHERE user_id = 'aaaa0000-0000-0000-0000-000000000001' AND status = 'reading'$$,
    ARRAY[3::bigint],
    'AC-004b: 한 사용자 3개 행 UPDATE→reading 시 모두 reading 유지 (자동 배타 전환 부재)'
);

-- ============================================================================
-- AC-LIB2-DB-005 (a): reading → completed 전환 시 completed_at 자동 설정
-- (on_user_books_update BEFORE UPDATE 트리거 — 정책 철회 후에도 동작 유지)
-- ============================================================================
UPDATE user_books SET status = 'completed'
WHERE user_id = 'aaaa0000-0000-0000-0000-000000000001'
  AND book_id = 'aaaa0000-0000-0000-0000-000000000101';

SELECT results_eq(
    $$SELECT count(*)::bigint FROM user_books
      WHERE user_id = 'aaaa0000-0000-0000-0000-000000000001'
        AND book_id = 'aaaa0000-0000-0000-0000-000000000101'
        AND status = 'completed'
        AND completed_at IS NOT NULL$$,
    ARRAY[1::bigint],
    'AC-005a: reading→completed 전환 시 completed_at 자동 설정 (on_user_books_update 유지)'
);

-- ============================================================================
-- AC-LIB2-DB-005 (b): completion_report 자동 생성 (AFTER UPDATE 트리거, 멱등)
-- ============================================================================
SELECT results_eq(
    $$SELECT count(*)::bigint FROM completion_reports cr
      JOIN user_books ub ON cr.user_book_id = ub.id
      WHERE ub.user_id = 'aaaa0000-0000-0000-0000-000000000001'
        AND ub.book_id = 'aaaa0000-0000-0000-0000-000000000101'$$,
    ARRAY[1::bigint],
    'AC-005b: reading→completed 전환 시 completion_report 자동 생성'
);

-- ============================================================================
-- AC-LIB2-DB-005 (c): reading → shelved 전환 — 서재 필터링 동작 유지
-- ============================================================================
UPDATE user_books SET status = 'shelved'
WHERE user_id = 'aaaa0000-0000-0000-0000-000000000001'
  AND book_id = 'aaaa0000-0000-0000-0000-000000000102';

SELECT results_eq(
    $$SELECT status::text FROM user_books
      WHERE user_id = 'aaaa0000-0000-0000-0000-000000000001'
        AND book_id = 'aaaa0000-0000-0000-0000-000000000102'$$,
    ARRAY['shelved'::text],
    'AC-005c: reading→shelved 전환 정상 동작'
);

-- ============================================================================
-- AC-LIB2-DB-005 (d): UNIQUE(user_id, book_id) 복합 제약 유지 — 동일 책 중복 23505
-- (메모리 #18: 4-arg throws_ok — errcode + errmsg + description)
-- ============================================================================
SELECT throws_ok(
    $$INSERT INTO user_books (user_id, book_id, status)
      VALUES ('aaaa0000-0000-0000-0000-000000000001', 'aaaa0000-0000-0000-0000-000000000101', 'reading')$$,
    '23505',
    'duplicate key value violates unique constraint "user_books_user_id_book_id_unique"',
    'AC-005d: UNIQUE(user_id, book_id) 유지 — 동일 책 중복 등록 23505 (정책 철회와 무관)'
);

-- ============================================================================
-- AC-LIB2-DB-006 (a): 잔여 BEFORE ROW 트리거 알파벳순 실행 순서 (메모리 #20)
-- enforce_single_reading 제거 후 on_user_books_update 가 최초 BEFORE ROW 트리거.
-- BEFORE ROW 필터: (tgtype & 3) = 3 (bit0 ROW=1 | bit1 BEFORE=2, pg_trigger.h).
--
-- 검증 전략: on_user_books_update 보다 알파벳순으로 앞선 BEFORE ROW 트리거가 0건이면
-- on_user_books_update 가 최초 실행됨이 입증된다 (enforce_single_reading 은 'e' < 'o' 로
-- 앞섰으나 AC-001 에서 제거됨 — 본 count=0 이 그 제거를 재확인).
-- name 타입 비교는 이진(C collation) 기반이라 results_eq text 비교의 collation 모호성 회피.
-- ============================================================================
SELECT is(
    (SELECT count(*)::bigint FROM pg_trigger
      WHERE tgrelid = 'public.user_books'::regclass
        AND (tgtype & 3) = 3
        AND tgenabled = 'O'
        AND tgname < 'on_user_books_update'),
    0::bigint,
    'AC-006a: on_user_books_update 보다 알파벳순 앞선 BEFORE ROW 트리거 부재 — 잔여 BEFORE ROW 중 최초 실행 입증'
);

-- ============================================================================
-- AC-LIB2-DB-006 (b): current_page UPDATE 시 last_progress_at 자동 갱신
-- (b3 는 아직 reading 상태 — on_user_books_update 경로 입증)
-- ============================================================================
UPDATE user_books SET current_page = 50
WHERE user_id = 'aaaa0000-0000-0000-0000-000000000001'
  AND book_id = 'aaaa0000-0000-0000-0000-000000000103';

SELECT results_eq(
    $$SELECT count(*)::bigint FROM user_books
      WHERE user_id = 'aaaa0000-0000-0000-0000-000000000001'
        AND book_id = 'aaaa0000-0000-0000-0000-000000000103'
        AND last_progress_at IS NOT NULL$$,
    ARRAY[1::bigint],
    'AC-006b: current_page 변경 시 last_progress_at 자동 갱신 (on_user_books_update 정상 동작)'
);

-- ============================================================================
-- AC-LIB2-DB-008: 다중 reading INSERT 허용 (동시 INSERT 경쟁 순차 근사, D6)
-- 두 번째 사용자(u2)로 서로 다른 책(bA, bB)을 순차적으로 reading INSERT.
-- pgTAP 단일 세션 한계: 진정한 병렬 커밋 재현 불가 → lives_ok + 행 수로 입증.
-- 부분 UNIQUE 인덱스(AC-003)가 제거되었으므로 동시 경쟁 시 23505 발생 경로 자체가 소멸.
-- (REQ-LIB2-007 / AC-007: lives_ok 패턴 준수)
-- ============================================================================
SELECT lives_ok(
    $$INSERT INTO user_books (user_id, book_id, status)
      VALUES ('aaaa0000-0000-0000-0000-000000000002', 'aaaa0000-0000-0000-0000-00000000010a', 'reading')$$,
    'AC-008a: 사용자 u2 책 bA reading INSERT 성공 (경쟁 세션 A 근사)'
);

SELECT lives_ok(
    $$INSERT INTO user_books (user_id, book_id, status)
      VALUES ('aaaa0000-0000-0000-0000-000000000002', 'aaaa0000-0000-0000-0000-00000000010b', 'reading')$$,
    'AC-008b: 사용자 u2 책 bB reading INSERT 성공 (경쟁 세션 B 근사)'
);

SELECT results_eq(
    $$SELECT count(*)::bigint FROM user_books
      WHERE user_id = 'aaaa0000-0000-0000-0000-000000000002' AND status = 'reading'$$,
    ARRAY[2::bigint],
    'AC-008c: 두 reading 행 모두 존재 — 동시 INSERT 경쟁 시 다중 reading 허용 입증'
);

SELECT * FROM finish();
ROLLBACK;
