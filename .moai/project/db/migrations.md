# Migrations

마이그레이션 도구: **Supabase CLI** (`supabase/migrations/*.sql`).
SPEC-DB-001 구현: 15개 migration (T-001~T-009), 272 pgTAP 테스트 통과.

---

## Supabase CLI 워크플로

| 작업 | 명령 |
|------|------|
| 새 마이그레이션 생성 | `supabase migration new <name>` |
| 로컬 전체 재적용 | `supabase db reset` |
| 원격 스테이징 적용 | `supabase db push` |
| 상태 확인 | `supabase migration list` |
| 테스트 실행 | `supabase test db` |
| 롤백 (수동) | 역방향 SQL 별도 파일 — Supabase CLI는 자동 down 미제공 |

파일명 규칙: `20240614NNNNNN_<snake_case_name>.sql`.

---

## Applied Migrations (23)

| Filename | SPEC Task | Summary |
|----------|-----------|---------|
| 20240614000001_create_users.sql | T-002 | users 테이블 + handle_new_user (SECURITY DEFINER, auth.users 연동) |
| 20240614000002_create_books.sql | T-002 | books 도서 카탈로그 (ISBN UNIQUE) |
| 20240614000003_create_user_books.sql | T-002 | user_books 서재 (UNIQUE user+book, status CHECK) |
| 20240614000004_create_clubs.sql | T-003 | clubs 모임 + handle_new_club_host 트리거 |
| 20240614000005_create_emotion_records.sql | T-003 | emotion_records (visibility CHECK, club_id guard) |
| 20240614000006_create_sticker_enum_and_reactions.sql | T-003 | sticker_type ENUM + sticker_reactions |
| 20240614000007_create_club_members.sql | T-004 | club_members (UNIQUE club+user, role CHECK) |
| 20240614000008_create_join_requests.sql | T-004 | join_requests + guard/accept 트리거 (SECURITY DEFINER) |
| 20240614000009_create_reading_sessions.sql | T-005 | reading_sessions 타이머 로그 |
| 20240614000010_create_completion_reports.sql | T-005 | completion_reports + generate_completion_report (SECURITY DEFINER, ON CONFLICT 멱등) |
| 20240614000011_create_point_logs.sql | T-005 | point_logs 포인트 내역 (reason CHECK) |
| 20240614000012_create_notifications.sql | T-005 | notifications 알림 (type CHECK 6종) |
| 20240614000013_create_indexes.sql | T-006 | 성능 인덱스 12개 (ERD §3) |
| 20240614000014_enable_rls.sql | T-007/T-008 | RLS 11테이블 + 31 정책 + fn_user_in_club + 보안 뷰 (통합) |
| 20240614000015_create_triggers.sql | T-009 | updated_at 트리거 3개 (set_updated_at 공용 함수, emotion_records 컬럼 추가) |
| 20240614000016_enable_books_rls.sql | post-sync fix | books RLS 활성화 (DoD #4 / REQ-DB-013b fix — 0014 누락 보정, 0016 test로 검증) |
| 20240614000017_users_nickname_check.sql | SPEC-AUTH-001 | 닉네임 CHECK 제약 (길이 1~20, 제어문자/zero-width/RTL/BOM 거부), handle_new_user left(...,20) 수정 |
| 20240618000001_backfill_users.sql | SPEC-AUTH-001 | 기존 OAuth 사용자 backfill (provider=raw_app_meta_data) |
| 20240618000002_fix_handle_new_user_columns.sql | SPEC-AUTH-001 | handle_new_user 컬럼 오타 수정 (raw_user_id_data → raw_app_meta_data/raw_user_meta_data) |
| 20240618000003_users_nickname_nullable.sql | SPEC-AUTH-001 | nickname NOT NULL 제거 + handle_new_user nickname=NULL (온보딩 필수 진입) |
| 20240618000004_handle_new_user_custom_provider_strip.sql | SPEC-AUTH-001 | handle_new_user custom: 접두사 정규화 (REPLACE) + SECURITY DEFINER owner postgres 고정 (naver Custom OIDC 대응, 리뷰 M1) |
| 20240618000005_handle_new_user_email_fallback.sql | SPEC-AUTH-001 | handle_new_user 트리거에 email COALESCE 폴백 추가 — 네이버 등 email 미제공 provider 가입 시 `public.users.email NOT NULL` 위반(C1, "Database error saving new user") 해결. 형태: `{provider}_{auth.users.id}@noemail.local` (uuid 기반 UNIQUE 보장). kakao/google(email 제공)는 영향 없음. (2026-06-18, SPEC-AUTH-001 REQ-AUTH-001) |
| 20240618000006_add_club_reading_plan_columns.sql | SPEC-CLUB-002 | clubs 테이블에 진도 계획 컬럼 추가 (daily_pages, trigger_page, duration_days) — NULL 허용, CHECK >= 0 제약. (2026-06-19, SPEC-CLUB-002 REQ-CLUBB-004/009/010/011) |
| 20240620000001_enable_realtime_feed.sql | SPEC-FEED-001 | Supabase Realtime postgres_changes 활성화 — `supabase_realtime` publication에 `emotion_records`, `sticker_reactions` ADD + 양 테이블 `REPLICA IDENTITY FULL`. 기존 SELECT RLS(migration 0014)가 브로드캐스트 게이트 자동 수행(F13 비멤버 미수신). 정책 변경 없음. (2026-06-20, SPEC-FEED-001 REQ-FEED-006~008) |
| 20240620000002_create_reading_session_rpc.sql | SPEC-ROUTINE-001 | 독서 타이머 RPC 함수 — `start_reading_session(uuid)→uuid`(자동종료+INSERT), `end_reading_session(uuid,int?)→void`(서버 EXTRACT duration, SECURITY DEFINER). `user_id=auth.uid()` 가드(COERCE 기본값). pgTAP 0018 9/9 PASS (R4 서버계산/R2 자동종료/R3 RLS차단/R5 COALESCE 실증). (2026-06-20, SPEC-ROUTINE-001 REQ-ROUT-001~004) |
| 20240620000003_enrich_notifications_for_notif.sql | SPEC-NOTIF-001 | notifications 보완 — `notification_type` ENUM 6종(reading_reminder/join_request_received/join_accepted/sticker_received/completion/club_signal) 생성 + `notifications.type` text→ENUM 변환(기존 placeholder 매핑: club_invite→join_request_received, reaction→sticker_received; mention/system은 대응 없어 삭제), `notifications.data jsonb` 추가(REQ-NOTIF-013 템플릿 변수), `users.push_token text` 추가(미결정 6.1 임시 방침, 등록 로직은 Optional). pgTAP 0012 28/28 + 0014 회귀 복구. (2026-06-20, SPEC-NOTIF-001 REQ-NOTIF-011/013) |
| 20240627000001_create_get_host_clubs_progress_rpc.sql | SPEC-CLUB-003 | 모임 진도 median 집계 RPC — `get_host_clubs_progress(uuid)→TABLE`(club_id, median_page, member_count_with_progress, total_pages). SECURITY INVOKER, plpgsql LANGUAGE, auth.uid() defense-in-depth(42501 on mismatch), user_books_public 뷰 소스(is_public=true만), percentile_cont(0.5) median(current_page>0만), books.total_pages LEFT JOIN + COALESCE(0). pgTAP 0019 8/8 PASS. (2026-06-27, SPEC-CLUB-003 REQ-CLUBC-001~006) |

---

## Applied Migrations (23)

(... 22기존 항목 생략 ...)
| 20240627000001_create_get_host_clubs_progress_rpc.sql | SPEC-CLUB-003 | 모임 진도 median 집계 RPC — `get_host_clubs_progress(uuid)→TABLE`(club_id, median_page, member_count_with_progress, total_pages). SECURITY INVOKER, plpgsql LANGUAGE, auth.uid() defense-in-depth(42501 on mismatch), user_books_public 뷰 소스(is_public=true만), percentile_cont(0.5) median(current_page>0만), books.total_pages LEFT JOIN + COALESCE(0). pgTAP 0019 8/8 PASS. (2026-06-27, SPEC-CLUB-003 REQ-CLUBC-001~006) |

---

## Pending Migrations

없음 — 모든 migration 로컬 DB에 적용 완료.

---

## Rollback Notes

| Migration | Risk | 롤백 방법 | 데이터 손실 |
|-----------|------|-----------|-------------|
| 0014_enable_rls | High | RLS 비활성화 + 정책 DROP | No |
| 0015_triggers | Low | DROP TRIGGER + set_updated_at 함수 | No |
| 0013_indexes | Low | DROP INDEX | No |
| 0001-0012 (테이블) | Critical | DROP TABLE CASCADE | YES |

> Supabase CLI는 자동 down을 제공하지 않는다. 파괴적 변경은 역방향 SQL 별도 수동 작성.

---

*Synced 2026-06-14 (SPEC-DB-001). Updated 2026-06-19: migration 0006 (SPEC-CLUB-002 진도 컬럼). Updated 2026-06-20: migration 20240620000001 (SPEC-FEED-001 Realtime publication 활성화). Updated 2026-06-27: migration 20240627000001 (SPEC-CLUB-003 진도 median RPC).*
