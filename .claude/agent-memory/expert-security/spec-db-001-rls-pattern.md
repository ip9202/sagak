---
name: spec-db-001-rls-pattern
description: sagak 프로젝트는 RLS(auth.uid()=id)를 클라이언트 UPDATE의 유일 백스톱으로 사용 — Supabase 표준 패턴
metadata:
  type: project
---

sagak SPEC-DB-001의 모든 사용자 소유 테이블(users, user_books, emotion_records 등)은 RLS `USING (auth.uid() = id) WITH CHECK (auth.uid() = id)` 정책으로 행 에스컬레이션을 방지한다. 클라이언트 코드(onboarding.tsx 등)가 `.eq('id', user.id)`를 보내더라도, auth.uid()는 PostgREST가 JWT sub에서 서버 검증하여 추출하므로 클라이언트 변조 불가.

**Why:** Supabase 모바일 클라이언트는 anon_key 기반이라 권한 부여를 전적으로 서버 RLS에 의존. FORCE ROW LEVEL SECURITY가 적용되어 테이블 소유자 권한 우회도 차단됨.

**How to apply:** 클라이언트 인증 코드 리뷰 시, `.eq('id', user.id)`가 RLS 없이도 안전한지 묻지 말 것. RLS 정책 자체(supabase/migrations/*_enable_rls.sql)가 올바른지 먼저 확인. 단일 백스톱이 이 프로젝트의 의도된 아키텍처이므로 RLS 정책 회귀 = 크리티컬.
