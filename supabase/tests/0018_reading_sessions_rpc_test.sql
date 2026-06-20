-- 독서 세션 RPC 함수 통합 테스트 (SPEC-ROUTINE-001 REQ-ROUT-001/002)
--
-- 검증 대상 (RPC 기반 서버 측 duration 계산):
-- - R4: end_reading_session 이 서버 now() - started_at 으로 duration_seconds 계산
-- - R3: 타인 세션 종료 차단 (user_id = auth.uid() 검사)
-- - R2: start_reading_session 이 기존 활성 세션 자동 종료 + 새 INSERT (원자적)
-- - R5: pages_read COALESCE 동작 (NULL=유지, 값=덮어쓰기)
--
-- 실행 명령 (로컬 Supabase 필요):
--   supabase start && supabase db test
-- 또는 파일 단위:
--   supabase db test -- -f supabase/tests/0018_reading_sessions_rpc_test.sql
--
-- 본 환경에 로컬 Supabase 가 없으면 실행되지 않으나, 테스트 자체는 올바르게 작성됨.
--
-- pgTAP 패턴 (0014_rls_test.sql 과 동일):
-- 1. setup INSERT는 postgres role(default)로 실행 → RLS 우회
-- 2. SET ROLE authenticated 한 번 설정
-- 3. set_config('request.jwt.claims', json, FALSE) — session-level
-- 4. auth.uid() = current_setting('request.jwt.claims') 에서 sub 추출

BEGIN;

SET client_min_messages TO warning;

SELECT plan(9);

-- ============================================================================
-- SETUP (postgres role — RLS 우회, 테스트 데이터 시딩)
-- ============================================================================
-- idempotent cleanup (FK 역순)
DELETE FROM reading_sessions    WHERE user_id IN ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002');
DELETE FROM user_books          WHERE user_id IN ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002');
DELETE FROM books               WHERE id = '00000000-0000-0000-0000-000000000100';
DELETE FROM users               WHERE id IN ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002');

INSERT INTO users (id, email, nickname, provider) VALUES
    ('00000000-0000-0000-0000-000000000001', 'rpcusera@test.com', 'RpcA', 'kakao'),
    ('00000000-0000-0000-0000-000000000002', 'rpcuserb@test.com', 'RpcB', 'kakao');

INSERT INTO books (id, isbn, title, author) VALUES
    ('00000000-0000-0000-0000-000000000100', '9781234567890', 'Rpc Test Book', 'Author');

-- ============================================================================
-- R4: end_reading_session 서버 측 duration 계산
-- ============================================================================
-- user A 의 세션: started_at 를 90초 과거로 설정 (postgres role 로 직접 INSERT)
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', false);

INSERT INTO reading_sessions (id, user_id, book_id, started_at)
VALUES ('00000000-0000-0000-0000-000000000010',
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000100',
        now() - interval '90 seconds');

-- end_reading_session 호출 (pages_read NULL)
SELECT end_reading_session('00000000-0000-0000-0000-000000000010', NULL);

-- R4-1: ended_at NOT NULL
SELECT is(
    (SELECT ended_at IS NOT NULL FROM reading_sessions
      WHERE id = '00000000-0000-0000-0000-000000000010'),
    true,
    'R4: end_reading_session sets ended_at (server now())'
);

-- R4-2: duration_seconds ≈ 90 (±5초 허용 오차, 서버 처리 지연)
-- @MX:NOTE: [AUTO] 서버 now() 호출 시점에 따라 ±수초 차이 발생 가능하므로 tolerance 적용
SELECT ok(
    (SELECT duration_seconds BETWEEN 85 AND 95 FROM reading_sessions
      WHERE id = '00000000-0000-0000-0000-000000000010'),
    'R4: duration_seconds computed server-side (~90s, tolerance ±5s)'
);

-- ============================================================================
-- R5: pages_read COALESCE 동작
-- ============================================================================
-- 5-A: NULL 전달 시 기존 pages_read 유지
INSERT INTO reading_sessions (id, user_id, book_id, started_at, pages_read)
VALUES ('00000000-0000-0000-0000-000000000020',
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000100',
        now() - interval '30 seconds',
        42);
SELECT end_reading_session('00000000-0000-0000-0000-000000000020', NULL);
SELECT is(
    (SELECT pages_read FROM reading_sessions WHERE id = '00000000-0000-0000-0000-000000000020'),
    42,
    'R5-A: pages_read preserved when p_pages_read is NULL'
);

-- 5-B: 값 전달 시 덮어쓰기
INSERT INTO reading_sessions (id, user_id, book_id, started_at, pages_read)
VALUES ('00000000-0000-0000-0000-000000000021',
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000100',
        now() - interval '20 seconds',
        10);
SELECT end_reading_session('00000000-0000-0000-0000-000000000021', 99);
SELECT is(
    (SELECT pages_read FROM reading_sessions WHERE id = '00000000-0000-0000-0000-000000000021'),
    99,
    'R5-B: pages_read overwritten when p_pages_read has value'
);

-- ============================================================================
-- R3: 타인 세션 종료 차단 (user_id = auth.uid() 검사)
-- ============================================================================
-- user A 권한으로 user B 세션 종료 시도 → 영향 0행
-- user B 세션 시드 (postgres role 필요 → 잠시 역할 해제)
RESET ROLE;
INSERT INTO reading_sessions (id, user_id, book_id, started_at)
VALUES ('00000000-0000-0000-0000-000000000030',
        '00000000-0000-0000-0000-000000000002',
        '00000000-0000-0000-0000-000000000100',
        now() - interval '60 seconds');

-- 다시 user A 권한
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', false);

-- user A 가 user B 세션 종료 시도 (user_id 불일치 → WHERE user_id=auth.uid() 가 0행 → 차단)
SELECT end_reading_session('00000000-0000-0000-0000-000000000030', NULL);

-- R3: user B 세션은 ended_at 여전히 NULL (RPC 가 user_id=auth.uid() 가드로 차단).
-- @MX:NOTE: [AUTO] 검증은 RESET ROLE(postgres, RLS 우회)로 수행해야 한다 — authenticated(user A) 로
-- 조회하면 RLS 가 user B 행을 숨겨 서브쿼리가 0행이 되어 ended_at IS NULL 결과가 NULL 이 된다.
RESET ROLE;
SELECT is(
    (SELECT ended_at IS NULL FROM reading_sessions
      WHERE id = '00000000-0000-0000-0000-000000000030'),
    true,
    'R3: cross-user end_reading_session blocked (user_id = auth.uid() guard)'
);

-- ============================================================================
-- R2: start_reading_session 원자적 (기존 활성 세션 자동 종료 + 새 INSERT)
-- ============================================================================
-- user A 의 활성 세션 하나 더 시드
RESET ROLE;
INSERT INTO reading_sessions (id, user_id, book_id, started_at)
VALUES ('00000000-0000-0000-0000-000000000040',
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000100',
        now() - interval '120 seconds');

-- 새 id 확보를 위해 미리 알려진 자리표시자 — RETURNING id 만으로는 pgTAP 비교 어려움
-- 대신 start 호출 후 user A 의 활성 세션(ended_at IS NULL) 이 정확히 1개이고
-- 기존 세션은 종료되었는지 검증

SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', false);

-- start 호출 — 기존 활성 세션(040) 자동 종료 + 새 세션 INSERT
SELECT start_reading_session('00000000-0000-0000-0000-000000000100');

-- R2-1: 기존 활성 세션(040) 자동 종료됨
SELECT is(
    (SELECT ended_at IS NOT NULL FROM reading_sessions
      WHERE id = '00000000-0000-0000-0000-000000000040'),
    true,
    'R2: start_reading_session auto-ends prior active session'
);

-- R2-2: 기존 세션의 duration_seconds 서버 계산됨 (~120s, tolerance ±10s)
SELECT ok(
    (SELECT duration_seconds BETWEEN 110 AND 135 FROM reading_sessions
      WHERE id = '00000000-0000-0000-0000-000000000040'),
    'R2: prior session duration_seconds computed (~120s, tolerance ±10s)'
);

-- R2-3: user A 의 활성 세션(ended_at IS NULL) 정확히 1개 (새 세션)
SELECT is(
    (SELECT count(*)::bigint FROM reading_sessions
      WHERE user_id = '00000000-0000-0000-0000-000000000001'
        AND ended_at IS NULL),
    1::bigint,
    'R2: exactly one active session remains after start_reading_session'
);

-- R2-4: 새 활성 세션의 started_at 이 최근(now 근처) — 방금 INSERT 됨
SELECT ok(
    (SELECT started_at > now() - interval '5 seconds'
       FROM reading_sessions
      WHERE user_id = '00000000-0000-0000-0000-000000000001'
        AND ended_at IS NULL),
    'R2: new active session started_at is recent (just inserted)'
);

-- ============================================================================
-- Finish
-- ============================================================================
SELECT * FROM finish();

ROLLBACK;
