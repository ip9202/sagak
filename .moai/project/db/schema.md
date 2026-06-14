---
engine: supabase
orm: supabase-js
multi_tenant: single-schema-rls
migration_tool: supabase-cli
last_synced_at: 2026-06-14
manifest_hash: none
---

# Database Schema

Supabase(관리형 PostgreSQL + PostgREST + Realtime + Storage)를 기본 데이터 계층으로 사용하며,
단일 스키마 + RLS(Row Level Security)로 사용자 데이터를 격리한다. 모든 마이그레이션은
`supabase/migrations/*.sql`에 보관되며, 이 파일은 그 스키마의 공식 문서 출처이다.

> 초기화 상태: 아직 `supabase/migrations/`에 마이그레이션이 없다. 아래 테이블은
> 감정 공유 독서 모임 앱(사각) 도메인에 기반한 시작 스켈레톤이다. 마이그레이션을
> 작성하면 `moai-domain-db-docs` PostToolUse 훅이 이 문서를 자동으로 재생성한다.

---

## Tables

| Table | Description |
|-------|-------------|
| users | 사용자 프로필 — Supabase `auth.users`와 1:1, 닉네임/프로필 이미지/알림 설정 |
| books | 도서 카탈로그 — Kakao Book Search API 결과 캐싱, ISBN 고유키 |
| reading_records | 독서 기록 — 사용자별 책 진행률/완독 여부, 완독률 데이터 수집의 핵심 |
| clubs | 독서 모임 — 감정 공유 중심의 모임 메타데이터 |
| club_members | 모임 멤버 — clubs × users junction, 역할(owner/member) 포함 |
| emotion_shares | 감정 공유 기록 — 책/독서 기록에 대한 감정 표현 (좋아요 경쟁 회피, 단순 공유) |
| push_tokens | 푸시 알림 토큰 — Expo Push Notifications 연동, 사용자별 디바이스 토큰 |

<!--
참고: Supabase Auth는 인증 신원을 `auth.users`(내부 스키마)에 보관한다.
public.users는 프로필 확장 정보만 담으며 `id`(uuid)가 auth.users.id를 참조한다.
-->

---

## Relationships

<!-- Cardinality notation: 1:1, 1:N, N:M -->

| From | To | Cardinality | FK Column | Notes |
|------|----|-------------|-----------|-------|
| users | auth.users | 1:1 | users.id → auth.users.id | 프로필과 인증 신원 연결 |
| users | reading_records | 1:N | reading_records.user_id | 사용자는 여러 독서 기록을 가짐 |
| books | reading_records | 1:N | reading_records.book_id | 책은 여러 사용자의 독서 기록에 등장 |
| users | emotion_shares | 1:N | emotion_shares.user_id | 사용자가 남긴 감정 공유 |
| reading_records | emotion_shares | 1:N | emotion_shares.record_id | 특정 독서 기록에 달린 감정 |
| clubs | club_members | 1:N | club_members.club_id | 모임의 멤버 목록 |
| users | club_members | 1:N | club_members.user_id | 사용자가 가입한 모임 목록 |
| users | push_tokens | 1:N | push_tokens.user_id | 사용자별 다중 디바이스 토큰 |

---

## Indexes

<!-- 마이그레이션이 작성되기 전까지 _TBD_. 아래는 권장 인덱스 가이드라인. -->

| Table | Columns | Type | Purpose |
|-------|---------|------|---------|
| _TBD_ | _TBD_ | _TBD_ | _TBD_ |

<!--
권장 인덱스(마이그레이션 작성 시 반영 검토):
| users          | (kakao_id)                      | UNIQUE  | 카카오 소셜 로그인 중복 가입 방지           |
| books          | isbn                            | UNIQUE  | ISBN 기반 도서 중복 저장 방지                |
| books          | title                           | GIN/FTS | 도서 제목 전문 검색                          |
| reading_records | (user_id, book_id)              | UNIQUE  | 사용자별 동일 책 중복 기록 방지              |
| reading_records | (user_id, created_at)           | COMPOSITE| 사용자 독서 기록 시간순 페이지네이션         |
| club_members   | (club_id, user_id)              | UNIQUE  | 모임-사용자 중복 가입 방지                   |
| emotion_shares | (record_id, created_at)         | COMPOSITE| 독서 기록별 감정 시간순 조회                 |
| push_tokens    | user_id                         | INDEX   | 사용자별 토큰 조회(알림 발송 시)             |
-->

---

## Constraints

<!-- UNIQUE, CHECK, EXCLUSION, NOT NULL (non-obvious cases) -->

| Table | Constraint | Type | Definition |
|-------|-----------|------|-----------|
| _TBD_ | _TBD_ | _TBD_ | _TBD_ |

<!--
검토 대상 제약조건(마이그레이션 작성 시 반영):
| users          | users_kakao_id_unique         | UNIQUE | kakao_id는 고유 (소셜 로그인)                    |
| books          | books_isbn_unique             | UNIQUE | ISBN 고유                                         |
| reading_records | reading_records_user_book_unique | UNIQUE | (user_id, book_id) 조합 고유                     |
| club_members   | club_member_role_check        | CHECK  | role IN ('owner', 'member')                       |
| reading_records | reading_records_progress_check | CHECK  | progress >= 0 AND progress <= 100                 |
-->
