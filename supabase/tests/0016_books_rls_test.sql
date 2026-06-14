-- books RLS 활성화 검증 (DoD #4 / REQ-DB-013b fix)
-- 배경: 0014에서 books RLS ENABLE 누락 (rowsecurity=false). 0016 fix로 활성화.
-- 기존 0014 books 테스트는 정책 존재/조회만 검증했고 RLS 활성화 자체를 검증 안 함 —
-- 본 테스트가 relrowsecurity=true를 직접 단정하여 DoD #4를 진정으로 충족.

BEGIN;
SELECT plan(3);

-- ============================================================================
-- 구조 검증
-- ============================================================================

-- books RLS 활성화 (DoD #4 핵심 — 기존 누락분)
SELECT is(
    (SELECT relrowsecurity FROM pg_class
     WHERE relname = 'books' AND relnamespace = 'public'::regnamespace),
    true,
    'books has RLS ENABLED (DoD #4, REQ-DB-013b) — fix for 0014 omission'
);

-- books SELECT 정책은 여전히 1개 (books_select_all, USING true)
SELECT is(
    (SELECT count(*)::int FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'books' AND cmd = 'SELECT'),
    1,
    'books retains exactly 1 SELECT policy (books_select_all, authenticated)'
);

-- ============================================================================
-- 동작 검증: authenticated 조회 유지 (회귀 없음)
-- ============================================================================
SET ROLE authenticated;
SELECT set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', false);

-- authenticated는 RLS 활성화 후에도 books SELECT 가능 (books_select_all USING true)
SELECT lives_ok(
    $$SELECT id, isbn, title, author FROM public.books LIMIT 1$$,
    'authenticated can SELECT books after RLS enable (policy active, no regression)'
);

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
