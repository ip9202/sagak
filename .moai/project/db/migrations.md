# Migrations

마이그레이션 도구: **Supabase CLI** (`supabase/migrations/*.sql` 규칙).
마이그레이션을 작성·적용하면 `moai-domain-db-docs` PostToolUse 훅이 이 문서의
Applied Migrations 표를 부분적으로 자동 갱신한다(사용자 승인 필요).

---

## Supabase CLI 워크플로

| 작업 | 명령 |
|------|------|
| 새 마이그레이션 생성 | `supabase migration new <name>` |
| 로컬 적용 | `supabase db reset` (전체 재적용) 또는 `supabase migration up` |
| 원격 스테이징 적용 | `supabase db push` |
| 상태 확인 | `supabase migration list` |
| 롤백(수동) | 역방향 마이그레이션 파일 작성 — Supabase CLI는 자동 down을 제공하지 않음 |

파일명 규칙: `<YYYYMMDDHHMMSS>_<snake_case_name>.sql` (예: `20260613000001_create_users.sql`).

---

## Applied Migrations

| Filename | Applied At | Checksum | Summary |
|----------|-----------|----------|---------|
| _TBD_ | _TBD_ | _TBD_ | _TBD_ |

<!--
초기 마이그레이션 추천 순서:
| 20260613000001_create_profiles.sql      | 2026-06-13 | sha256:... | users 프로필 테이블 + auth.users 트리거 |
| 20260613000002_create_books.sql         | 2026-06-13 | sha256:... | books 도서 카탈로그 (ISBN 고유)         |
| 20260613000003_create_reading_records.sql| 2026-06-13 | sha256:... | 독서 기록 + 진행률 추적                  |
| 20260613000004_create_clubs.sql         | 2026-06-13 | sha256:... | 독서 모임 + 멤버 junction                |
| 20260613000005_create_emotion_shares.sql| 2026-06-13 | sha256:... | 감정 공유 기록                           |
| 20260613000006_enable_rls.sql           | 2026-06-13 | sha256:... | 모든 테이블 RLS 활성화 + 기본 정책        |
-->

---

## Pending Migrations

List migrations that exist in the codebase but have not yet been applied to production.

| Filename | Created At | Description | Blocking? |
|----------|-----------|-------------|-----------|
| _TBD_ | _TBD_ | _TBD_ | _TBD_ |

---

## Rollback Notes

Document rollback procedures for each migration that is difficult or non-trivial to reverse.

> 참고: Supabase CLI는 자동 down 마이그레이션을 제공하지 않는다. 파괴적 변경(컬럼 삭제,
> 테이블 삭제)은 역방향 SQL을 별도 파일로 수동 작성해야 한다. 확장 전용 변경(컬럼/인덱스
> 추가)은 자연스럽게 롤백 가능하다.

| Migration | Risk Level | Rollback Steps | Data Loss? |
|-----------|-----------|----------------|------------|
| _TBD_ | _TBD_ | _TBD_ | _TBD_ |

<!--
예시:
| 20260613000006_enable_rls.sql        | High     | RLS 비활성화 후 원래 정책 복원                 | No  |
| 20260613000003_create_reading_records.sql | Low | DROP TABLE reading_records (CASCADE)            | YES |
| 20260614000001_drop_legacy_column.sql | Critical | 롤백 불가 — 컬럼 데이터 손실                    | YES |
-->
