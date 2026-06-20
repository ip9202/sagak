---
engine: supabase
orm: supabase-js
multi_tenant: single-schema-rls
migration_tool: supabase-cli
last_synced_at: 2026-06-20
manifest_hash: synced-from-22-migrations
---

# Database Schema

Supabase(관리형 PostgreSQL + PostgREST + Realtime + Storage) 데이터 계층. 단일 스키마 +
RLS(Row Level Security)로 사용자 데이터를 행 단위로 격리한다. 본 문서는 SPEC-DB-001
구현(supabase/migrations/0001-0015, 272 pgTAP 테스트 통과)의 공식 스키마 출처이다.

> 추출 기준: 2026-06-14 live DB ground truth (docker exec psql 검증). migration 변경 시
> `moai-domain-db-docs` PostToolUse 훅이 이 문서를 재생성한다.

---

## Tables (12)

| Table | 목적 | 주요 제약 |
|-------|------|----------|
| users | 사용자 프로필 (auth.users 1:1) | email UNIQUE, role CHECK(member/admin), provider CHECK(kakao/naver/google), nickname CHECK(길이 1~20, 제어문자/zero-width 거부), nickname nullable |
| books | 도서 카탈로그 (Kakao API 캐시) | isbn UNIQUE |
| user_books | 개인 서재 (진행률/완독) | UNIQUE(user_id, book_id), status CHECK(reading/completed/shelved), is_public |
| clubs | 독서 모임 | type CHECK(group/instant), status CHECK(active/closed), daily_pages CHECK(>=0 OR NULL), trigger_page CHECK(>=0 OR NULL), duration_days CHECK(>=0 OR NULL) |
| club_members | 모임 멤버 junction | UNIQUE(club_id, user_id), role CHECK(host/member) |
| join_requests | 가입 요청 상태기계 | UNIQUE(club_id, requester_id), status CHECK(pending/accepted/declined) |
| emotion_records | 감정 기록 | visibility CHECK(public/club), club_id NOT NULL when visibility=club |
| sticker_reactions | 스티커 반응 | sticker_type ENUM, UNIQUE(record_id, user_id) |
| reading_sessions | 독서 타이머 로그 | duration_seconds, pages_read |
| completion_reports | 완독 리포트 | UNIQUE(user_book_id), report_data jsonb (트리거 자동 생성) |
| point_logs | 포인트 내역 | reason CHECK(completion/reaction/exchange) |
| notifications | 알림 | type CHECK(6종), is_read |

---

## Relationships (FK 20)

| From → To | FK Column | ON DELETE |
|-----------|-----------|-----------|
| club_members → users | user_id | RESTRICT |
| club_members → clubs | club_id | RESTRICT |
| clubs → books | book_id | RESTRICT |
| clubs → users (host) | host_id | RESTRICT |
| completion_reports → user_books | user_book_id | RESTRICT |
| completion_reports → books | book_id | CASCADE |
| completion_reports → users | user_id | CASCADE |
| emotion_records → users | user_id | RESTRICT |
| emotion_records → books | book_id | RESTRICT |
| emotion_records → clubs | club_id | RESTRICT |
| join_requests → clubs | club_id | RESTRICT |
| join_requests → users (requester) | requester_id | RESTRICT |
| notifications → users | user_id | RESTRICT |
| point_logs → users | user_id | RESTRICT |
| reading_sessions → users | user_id | CASCADE |
| reading_sessions → books | book_id | CASCADE |
| sticker_reactions → emotion_records | record_id | CASCADE |
| sticker_reactions → users | user_id | RESTRICT |
| user_books → users | user_id | RESTRICT |
| user_books → books | book_id | RESTRICT |

FK 정책: 사용자 콘텐츠 이력 보존(RESTRICT) 원칙. 단, 파생 데이터(completion_reports의
book/user, reading_sessions, sticker_reactions의 record)는 부모 삭제 시 CASCADE.

---

## Indexes (31 = 12 PK + 7 UNIQUE + 12 성능)

### 성능 인덱스 (12, ERD §3 기반 — migration 0013)

| Table | Index | 목적 |
|-------|-------|------|
| user_books | idx_user_books_user_id_status | 서재 목록 조회 |
| user_books | idx_user_books_book_id_public_progress | Track A 공개 진행 |
| user_books | idx_user_books_book_id_started | 시간순 추천 |
| clubs | idx_clubs_book_id_type_status | 모임 탐색 |
| join_requests | idx_join_requests_club_id_status | 대기 요청 |
| join_requests | idx_join_requests_requester_id_status | 사용자 요청 |
| emotion_records | idx_emotion_records_book_id_page | 피드 페이지네이션 |
| emotion_records | idx_emotion_records_user_id_created_at | 사용자 기록 (DESC) |
| sticker_reactions | idx_sticker_reactions_record_id | 반응 집계 |
| club_members | idx_club_members_user_id | 사용자 모임 |
| reading_sessions | idx_reading_sessions_user_id_book_id | 독서 발자취 |
| notifications | idx_notifications_user_id_is_read | 안읽은 알림 |

### UNIQUE 제약 (7)
books.isbn, users.email, user_books(user_id, book_id), club_members(club_id, user_id),
join_requests(club_id, requester_id), sticker_reactions(record_id, user_id),
completion_reports(user_book_id).

---

## Enums

| Enum | Values |
|------|--------|
| sticker_type | empathy, touching, comforted |

---

## Views (2, Option A — 컬럼 마스킹)

| View | 컬럼 | 목적 |
|------|------|------|
| user_profiles | id, nickname, avatar_url | 타인 프로필 노출 제한 (REQ-DB-013e) |
| user_books_public | book_id, current_page, started_reading_at, user_id | 공개 서재 항목 (is_public=true 필터) |

옵션 A: 베이스 테이블 REVOKE 없음. RLS own-row 정책으로 자기 행만 노출, 타인은 보안 뷰로 제한 컬럼만.

---

## Triggers (8)

| Table | Trigger | 이벤트 | 목적 |
|-------|---------|--------|------|
| users | trg_users_updated_at | BEFORE UPDATE | updated_at 자동 갱신 (T-009) |
| user_books | trg_user_books_updated_at | BEFORE UPDATE | updated_at 자동 갱신 (T-009) |
| user_books | on_user_books_update | — | last_progress_at / completed_at 비즈니스 로직 |
| user_books | generate_completion_report_trigger | AFTER UPDATE OF status | 완독 시 리포트 자동 생성 |
| emotion_records | trg_emotion_records_updated_at | BEFORE UPDATE | updated_at 자동 갱신 (T-009) |
| clubs | on_club_created | — | 호스트 자동 가입 (handle_new_club_host) |
| join_requests | guard_join_request_status_trigger | BEFORE UPDATE | terminal 상태 재설정 거부 |
| join_requests | join_request_accept_trigger | AFTER UPDATE | 수락 시 club_members 자동 INSERT |

---

## Security

- **RLS 활성화**: 11개 사용자 데이터 테이블 (users, user_books, clubs, club_members,
  join_requests, emotion_records, sticker_reactions, reading_sessions,
  completion_reports, point_logs, notifications)
- **books**: ✅ RLS **활성화** (migration 0016 fix for DoD #4). `books_select_all`
  정책(authenticated, USING true) 적용 → authenticated 공개 카탈로그 조회, anon 차단
  (인증 후 도서 검색 = 설계 의도). owner(postgres)/service_role BYPASSRLS.
- **SECURITY DEFINER 함수 (6, 모두 owner=postgres/BYPASSRLS)**:
  handle_new_user, handle_new_club_host, guard_join_request_status, join_request_accept,
  generate_completion_report, fn_user_in_club
- **handle_new_user** (migration 0004 + 0005, 2026-06-18): auth.users INSERT 시 두 가지 정규화 수행 — ① `REPLACE(raw_app_meta_data->>'provider','custom:','')` → Custom OIDC 값(custom:naver)을 users.provider CHECK(kakao/naver/google) 값으로 변환. ② email COALESCE 폴백 — 네이버 등 email 미제공 provider 가입 시 `public.users.email NOT NULL` 위반(C1, "Database error saving new user") 해결. 형태: `{provider}_{auth.users.id}@noemail.local` (uuid 기반 UNIQUE 보장). kakao/google(email 제공)는 영향 없음. owner postgres 고정 (리뷰 M1, FORCE RLS 환경 안전성). (2026-06-18, SPEC-AUTH-001 REQ-AUTH-001)
- **정책**: 31개 (rls-policies.md 참조)
- **fn_user_in_club**: club_members 재귀 방지용 멤버십 헬퍼 (SECURITY DEFINER)

---

## Realtime (Supabase Realtime — postgres_changes)

> SPEC-FEED-001(모임 피드 실시간) 지원을 위해 migration `20240620000001_enable_realtime_feed.sql`(2026-06-20)로 활성화.

---

## RPC Functions (2, SPEC-ROUTINE-001)

| Function | 목적 | SECURITY DEFINER | 인자 | 반환 | Note |
|----------|------|------------------|------|------|------|
| start_reading_session | 독서 타이머 시작 (자동종료+INSERT) | Yes (user_id=auth.uid() 가드) | p_user_book_id uuid | uuid | started_at=now(), ended_at=NULL |
| end_reading_session | 독서 타이머 종료 (서버 duration 계산) | Yes (user_id=auth.uid() 가드) | p_session_id uuid, p_pages_read int? | void | duration_seconds = EXTRACT(EPOCH FROM (ended_at - started_at)) |

**SECURITY DEFINER 보안:** RPC 함수는 RLS를 우회하므로 `user_id=auth.uid()` 가드(COERCE 기본값)로 명시적으로 본인 행만 조작. pgTAP 0018 테스트로 RLS 차단 검증 완료.

- **publication**: `supabase_realtime`에 `emotion_records`, `sticker_reactions` 테이블 추가(브로드캐스트 활성화). 이전에는 두 테이블이 publication에 없어 Realtime 이벤트가 발생하지 않았음.
- **REPLICA IDENTITY FULL**: `emotion_records`, `sticker_reactions` 양 테이블에 적용. INSERT는 기본값으로도 새 행 전체를 전달하지만, 향후 UPDATE/DELETE 실시간 반영 시에도 안정적으로 전체 행 페이로드를 전달하도록 미리 설정.
- **브로드캐스트 RLS 게이트**: 별도 broadcast 정책을 추가하지 않는다. Supabase Realtime은 `postgres_changes` 브로드캐스트 시 테이블의 SELECT RLS 정책을 그대로 적용 — 구독자는 자신이 SELECT할 수 있는 행에 대한 이벤트만 수신. 따라서 migration 0014의 기존 정책이 브로드캐스트를 자동 게이트:
  - `emotion_records`: `visibility='public'` OR 본인 OR (`visibility='club'` AND `fn_user_in_club(club_id)`) → 비멤버에게 `visibility='club'` INSERT 이벤트 미전달(SPEC-FEED-001 F13 충족)
  - `sticker_reactions`: `USING (true)` → 인증된 사용자에게 모두 브로드캐스트
- **FORCE RLS**: 두 테이블 모두 migration 0014에서 FORCE ROW LEVEL SECURITY 설정됨 → service_role 제외 모든 롤에 RLS 강제 적용. 본 마이그레이션은 정책을 변경하지 않음.
- **팔로업 검증(필수)**: 외부 시스템(Supabase Realtime) 동작은 실제 검증 필요. 로컬 Supabase에서 ① 멤버 visibility='club' INSERT → 같은 클럽 멤버 수신, ② 비멤버 미수신, ③ visibility='public' INSERT → 모든 인증 사용자 수신을 확인해야 함. SELECT RLS가 브로드캐스트에 자동 적용되지 않는다면 별도 broadcast RLS 정책 추가 팔로업.

---

*Synced 2026-06-14 from supabase/migrations/0001-0015 (SPEC-DB-001 T-001~T-009). Updated 2026-06-18: migration 0004+0005 (SPEC-AUTH-001 naver Custom OIDC — handle_new_user custom: 정규화 + owner 고정 + email COALESCE 폴백). Updated 2026-06-19: migration 0006 (SPEC-CLUB-002 — clubs 진도 계획 컬럼 추가). Updated 2026-06-20: migration 20240620000001 (SPEC-FEED-001 — Realtime publication 활성화 + REPLICA IDENTITY FULL, Realtime 섹션 추가).*
