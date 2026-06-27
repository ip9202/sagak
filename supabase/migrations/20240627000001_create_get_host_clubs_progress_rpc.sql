-- ============================================================================
-- SPEC-CLUB-003: get_host_clubs_progress RPC 함수 (REQ-CLUBC-001~006)
-- ============================================================================
-- 목적: host 가 소유한 활성 group 모임의 멤버 읽기 진도 median 을 Postgres
-- 서버에서 집계. PostgREST embedded aggregate 는 percentile_cont 를 지원하지
-- 않으므로 전용 RPC 가 필요 (plan.md Section 1.2).
--
-- 데이터 소스: user_books_public 보안 뷰 (REQ-CLUBC-004)
--   - is_public=true 행만 노출 (비공개 독자 진도 자동 제외 — 프라이버시 정합)
--   - authenticated 역할에 SELECT 부여됨 (20240614000014_enable_rls.sql:99)
--   - Track A readersApi.ts:16 READERS_SELECT 와 동일 데이터 소스
--
-- 보안 모델 (plan.md Section 1.1, option a):
--   - SECURITY INVOKER (DEFINER 권한 상승 표면 최소화)
--   - clubs RLS(clubs_select_all USING(true)) 로 모든 authenticated 가 clubs SELECT 가능
--   - club_members RLS(fn_user_in_club) — host 는 자신 모임의 멤버이므로 host 모임
--     멤버 행만 조인됨 (WHERE c.host_id = p_host_id 와 정합)
--   - books RLS(books_select_all USING(true)) — total_pages JOIN 에 RLS 충돌 없음
--
-- median 정책 (REQ-CLUBC-003):
--   - current_page > 0 인 멤버만 percentile_cont 에 포함 (0p = 진도 미시작 제외)
--   - 전원 0p/공개 멤버 0명 → COALESCE 로 median_page=0, member_count_with_progress=0
--
-- GRANT (REQ-CLUBC-006):
--   - authenticated 에게만 EXECUTE 부여 (anon 거부)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_host_clubs_progress(p_host_id uuid)
RETURNS TABLE (
    club_id uuid,
    median_page integer,
    member_count_with_progress integer,
    total_pages integer
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
    SELECT
        c.id AS club_id,
        COALESCE(
            percentile_cont(0.5) WITHIN GROUP (
                ORDER BY ubp.current_page
            )::integer,
            0
        ) AS median_page,
        COUNT(ubp.current_page)::integer AS member_count_with_progress,
        b.total_pages
    FROM public.clubs c
    LEFT JOIN public.club_members cm ON cm.club_id = c.id
    LEFT JOIN public.user_books_public ubp
        ON ubp.user_id = cm.user_id
        AND ubp.book_id = c.book_id
        AND ubp.current_page > 0
    LEFT JOIN public.books b ON b.id = c.book_id
    WHERE c.host_id = p_host_id
        AND c.type = 'group'
        AND c.status = 'active'
    GROUP BY c.id, b.total_pages;
$$;

GRANT EXECUTE ON FUNCTION public.get_host_clubs_progress(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_host_clubs_progress(uuid) IS
    'SPEC-CLUBC-RPC: host 가 소유한 활성 group 모임의 멤버 읽기 진도 median 집계. '
    'user_books_public 뷰 소스 (is_public=true 만). SECURITY INVOKER. '
    'current_page>0 멤버만 median 포함. total_pages NULL 허용.';
