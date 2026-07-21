-- books RLS 활성화 (DoD #4 / REQ-DB-013b fix)
-- 배경: 0014_enable_rls.sql에서 books RLS ENABLE 누락 (rowsecurity=false).
--       acceptance.md DoD #4 "모든 테이블(11개 사용자 데이터 + books)에 RLS 활성화" 불일치.
--       기존 books_select_all 정책(authenticated, USING true)이 정의되어 있어 RLS만 켜면
--       공개 카탈로그 조회가 정책 기반으로 동작 (authenticated 허용, anon 정책 없어 차단).
--
-- 설계:
--   - ENABLE만, FORCE 안 함 → owner(postgres)/service_role BYPASSRLS 유지 (서버 로직)
--   - 정책 수정 없음 (기존 books_select_all 재사용)
--   - anon은 authenticated 전용 정책에 매칭 안 되어 자연 차단 (인증 후 도서 검색 = 설계 의도)
--
-- idempotent: ENABLE은 이미 활성화여도 안전.

ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.books IS
    '도서 카탈로그 — RLS 활성화 (REQ-DB-013b / DoD #4). authenticated 전체 공개 SELECT (books_select_all USING true). service_role/postgres BYPASSRLS. 0016 fix for 0014 omission.';
