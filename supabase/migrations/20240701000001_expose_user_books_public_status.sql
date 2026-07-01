-- migration: user_books_public 뷰에 status 컬럼 노출 (SPEC-CLUB-001 active readers 필터)
--
-- 배경: fetchActiveReaders 가 "읽는중 독자"(status='reading')만 반환해야 하나,
--       뷰가 status 를 노출하지 않아 PostgREST 서버 필터가 불가능 → completed/shelved 독자까지 포함되는 부작용.
-- 변경: status 컬럼 추가 노출(WHERE is_public=true 유지, 전 status 포함).
--       get_host_clubs_progress RPC(migration 20240627000001)은 user_books_public 의 status 미참조 → 영향 없음.
-- 보안: status(reading/completed/shelved)는 reading 데이터의 일부(current_page 보다 덜 민감).
--       REQ-DB-013e "limited public reading data" 준수. 클라이언트는 readersApi 에서 .eq('status','reading') 로 서버 필터.
CREATE OR REPLACE VIEW public.user_books_public AS
SELECT
    book_id,
    current_page,
    started_reading_at,
    user_id,
    status
FROM public.user_books
WHERE is_public = true;

COMMENT ON VIEW public.user_books_public IS 'Security view - exposes limited user_books columns for is_public=true rows (book_id, current_page, started_reading_at, user_id, status)';
