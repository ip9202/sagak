# Row-Level Security Policies

단일 스키마 + RLS 전략의 핵심 산출물. 기본 거부(Deny by default). SPEC-DB-001: 11개
사용자 데이터 테이블에 31개 정책. 감정 공유 독서 모임 특성상 **개인 데이터**와
**모임 공유 데이터**의 접근 경계를 행 단위로 격리.

> 원칙: 명시적 정책이 없으면 행이 보이지 않는다. `service_role` 키는 모든 RLS 자동
> 우회 (서버/Edge Functions 전용). `authenticated` 역할만 정책 기반 접근.

---

## RLS 활성화 현황

| Table | RLS | 비고 |
|-------|-----|------|
| users | ✅ ENABLED | 본인 행만 |
| user_books | ✅ ENABLED | 본인 행 + 공개 뷰 |
| clubs | ✅ ENABLED | 공개 조회 + host 쓰기 |
| club_members | ✅ ENABLED | 같은 모임원 조회 (fn_user_in_club) |
| join_requests | ✅ ENABLED | 요청자 + host |
| emotion_records | ✅ ENABLED | public 전체 + club 멤버 (fn_user_in_club) |
| sticker_reactions | ✅ ENABLED | 전체 읽기 + 본인 쓰기 |
| reading_sessions | ✅ ENABLED | 본인만 |
| completion_reports | ✅ ENABLED | 본인만 (서버 INSERT) |
| point_logs | ✅ ENABLED | 본인만 (읽기 전용) |
| notifications | ✅ ENABLED | 본인만 (서버 INSERT) |
| books | ✅ ENABLED (0016 fix) | 공개 카탈로그 — `books_select_all` USING true → authenticated 허용, anon 차단 (인증 후 검색). service_role/postgres BYPASSRLS |

---

## 정책 매트릭스 (31)

### users — REQ-DB-014 (3)
| Policy | Op | Condition |
|--------|-----|-----------|
| users_select_own_row | SELECT | `auth.uid() = id` |
| users_insert_own_row | INSERT | `auth.uid() = id` (WITH CHECK) |
| users_update_own_row | UPDATE | `auth.uid() = id` |

### books — REQ-DB-013b (1)
| Policy | Op | Condition |
|--------|-----|-----------|
| books_select_all | SELECT | `true` (공개 카탈로그 — RLS 비활성화로 현재 미적용) |

### user_books — REQ-DB-015 (4)
| Policy | Op | Condition |
|--------|-----|-----------|
| user_books_select_own_rows | SELECT | `auth.uid() = user_id` |
| user_books_insert_own_row | INSERT | `auth.uid() = user_id` |
| user_books_update_own_rows | UPDATE | `auth.uid() = user_id` |
| user_books_delete_own_rows | DELETE | `auth.uid() = user_id` |

### clubs — REQ-DB-018 (4)
| Policy | Op | Condition |
|--------|-----|-----------|
| clubs_select_all | SELECT | `true` (공개 탐색) |
| clubs_insert_host_self | INSERT | `auth.uid() = host_id` (WITH CHECK) |
| clubs_update_own | UPDATE | `auth.uid() = host_id` |
| clubs_delete_own | DELETE | `auth.uid() = host_id` |

### club_members — REQ-DB-019 (2)
| Policy | Op | Condition |
|--------|-----|-----------|
| club_members_select_same_club | SELECT | `fn_user_in_club(club_id)` |
| club_members_delete_own | DELETE | `auth.uid() = user_id` |

> INSERT는 SECURITY DEFINER 트리거(join_request_accept, handle_new_club_host)만 — 클라이언트 INSERT 정책 없음 (권한 상승 방지).

### join_requests — REQ-DB-020 (3)
| Policy | Op | Condition |
|--------|-----|-----------|
| join_requests_select_requester_or_host | SELECT | `auth.uid() IN (requester_id, club.host_id)` |
| join_requests_insert_own | INSERT | `auth.uid() = requester_id` |
| join_requests_update_host | UPDATE | `auth.uid() = club.host_id` (status 변경은 host만) |

### emotion_records — REQ-DB-016 (4)
| Policy | Op | Condition |
|--------|-----|-----------|
| emotion_records_select_visible | SELECT | `auth.uid()=user_id OR visibility='public' OR (visibility='club' AND fn_user_in_club(club_id))` |
| emotion_records_insert_own | INSERT | `auth.uid() = user_id` |
| emotion_records_update_own | UPDATE | `auth.uid() = user_id` |
| emotion_records_delete_own | DELETE | `auth.uid() = user_id` |

### sticker_reactions — REQ-DB-017 (3)
| Policy | Op | Condition |
|--------|-----|-----------|
| sticker_reactions_select_all | SELECT | `true` (공개 소셜 신호 — 설계 의도) |
| sticker_reactions_insert_own | INSERT | `auth.uid() = user_id` |
| sticker_reactions_delete_own | DELETE | `auth.uid() = user_id` |

### reading_sessions — REQ-DB-021 (3)
| Policy | Op | Condition |
|--------|-----|-----------|
| reading_sessions_select_own | SELECT | `auth.uid() = user_id` |
| reading_sessions_insert_own | INSERT | `auth.uid() = user_id` |
| reading_sessions_update_own | UPDATE | `auth.uid() = user_id` |

### completion_reports — REQ-DB-021 (1)
| Policy | Op | Condition |
|--------|-----|-----------|
| completion_reports_select_own | SELECT | `auth.uid() = user_id` |

> 서버 전용 — SECURITY DEFINER 트리거가 INSERT. 클라이언트 쓰기 없음.

### point_logs — REQ-DB-021 (1)
| Policy | Op | Condition |
|--------|-----|-----------|
| point_logs_select_own | SELECT | `auth.uid() = user_id` |

> 서버 전용 읽기. 클라이언트 쓰기 없음.

### notifications — REQ-DB-021 (2)
| Policy | Op | Condition |
|--------|-----|-----------|
| notifications_select_own | SELECT | `auth.uid() = user_id` |
| notifications_update_own | UPDATE | `auth.uid() = user_id` (is_read 토글) |

> INSERT는 service_role/트리거만 — 클라이언트 알림 생성 차단.

---

## 핵심 보안 함수

**fn_user_in_club(club_id) → boolean**: SECURITY DEFINER (owner=postgres, BYPASSRLS).
club_members RLS 정책 안에서 다시 club_members를 쿼리하는 재귀를 끊기 위해 BYPASSRLS
역할로 멤버십 판정. emotion_records(visibility=club) + club_members SELECT 정책에서 사용.

---

## RPC Functions 접근 제어 (SPEC-CLUB-003)

**get_host_clubs_progress(p_host_id uuid)**: SECURITY INVOKER, plpgsql LANGUAGE.

- **데이터 소스**: `user_books_public` 뷰 (is_public=true만 노출) → 공개 설정 독자의 진도만 집계
- **Defense-in-depth**: `p_host_id IS DISTINCT FROM auth.uid()` 시 `insufficient_privilege`(42501) 예외.
  club_members RLS(fn_user_in_club)가 타인 모임을 필터링하나(빈 결과), 단일 방어선 의존을 보강.
- **권한 모델**: SECURITY INVOKER → user_books_public 뷰의 authenticated SELECT 권한 사용.
  권한 상승 불필요(DEFINER 함수의 BYPASSRLS 우회 없음).
- **pgTAP 검증**: 0019 8/8 PASS (타 host_id 호출 시 throws_ok 42501).

---

## 검증

- 272/272 pgTAP 테스트 통과 (0014_rls_test.sql: 두 사용자 격리, fn_user_in_club 재귀 차단, 보안 뷰)
- SECURITY DEFINER 6함수 prosecdef=true, proowner=postgres (docker exec psql 검증)
- Option A: 베이스 테이블 REVOKE 없음 — RLS own-row 정책으로 자기 행만 노출

---

*Synced 2026-06-14 (SPEC-DB-001, 31 정책).*
