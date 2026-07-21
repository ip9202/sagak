-- 독서 세션 서버 측 계산 RPC 함수 (SPEC-ROUTINE-001 REQ-ROUT-001/002 R2/R4)
--
-- 목적:
--   duration_seconds 와 ended_at 을 DB 서버 시간(now()) 기준으로 원자적으로 계산한다.
--   가정 2.1.1 — 클라이언트 setInterval/백그라운드 타이머에 의존하지 않는다.
--
-- 배경:
--   기존 sessionApi.ts 는 PostgREST .update({duration_seconds: 'extract(epoch ...)'}) 로
--   raw SQL 문자열을 JSON 리터럴로 전송해 PostgREST 가 평가하지 못하는 결함이 있었다.
--   본 마이그레이션은 SECURITY DEFINER RPC 함수로 서버 측 계산을 위임한다.
--
-- 보안:
--   SECURITY DEFINER 는 RLS 를 우회하므로, 각 함수 본문에 user_id = auth.uid() 검사를
--   명시적으로 넣어 타인 세션 접근/수정을 차단한다. SET search_path = public 로
--   search_path 인젝션을 방어한다.

-- ============================================================================
-- 1) start_reading_session
--    - 본인 활성 세션(ended_at IS NULL) 이 있으면 종료(ended_at=now, duration 계산)
--    - 새 세션 INSERT(user_id=auth.uid(), started_at=now())
--    - 반환: 새 세션 id
-- ============================================================================
CREATE OR REPLACE FUNCTION public.start_reading_session(p_book_id uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    -- 기존 활성 세션 종료 — duration_seconds 서버 측 계산
    UPDATE reading_sessions
       SET ended_at = now(),
           duration_seconds = EXTRACT(EPOCH FROM (now() - started_at))::integer
     WHERE user_id = auth.uid()
       AND ended_at IS NULL;

    INSERT INTO reading_sessions (user_id, book_id, started_at)
    VALUES (auth.uid(), p_book_id, now())
    RETURNING id;
$$;

COMMENT ON FUNCTION public.start_reading_session(uuid) IS
    '독서 세션 시작 — 기존 활성 세션 자동 종료(R2) 후 새 세션 INSERT(R1). duration_seconds 서버 측 계산(R4).';

-- ============================================================================
-- 2) end_reading_session
--    - 특정 세션 종료(ended_at=now, duration 서버 계산)
--    - pages_read: NULL 이면 기존값 유지(COALESCE), 값이면 덮어쓰기(R5)
--    - 본인 세션(user_id = auth.uid()) 만 종료 가능
-- ============================================================================
CREATE OR REPLACE FUNCTION public.end_reading_session(p_session_id uuid, p_pages_read integer DEFAULT NULL)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    UPDATE reading_sessions
       SET ended_at = now(),
           duration_seconds = EXTRACT(EPOCH FROM (now() - started_at))::integer,
           pages_read = COALESCE(p_pages_read, pages_read)
     WHERE id = p_session_id
       AND user_id = auth.uid();
$$;

COMMENT ON FUNCTION public.end_reading_session(uuid, integer) IS
    '독서 세션 종료 — ended_at/duration_seconds 서버 측 계산(R4), pages_read 선택적 갱신(R5). 본인 세션만 종료 가능(R3).';

-- ============================================================================
-- 권한 부여 — authenticated 역할만 실행 가능
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.start_reading_session(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.end_reading_session(uuid, integer) TO authenticated;
