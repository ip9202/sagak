# Row-Level Security Policies

단일 스키마 + RLS 전략의 핵심 산출물. 모든 사용자 데이터는 하나의 스키마를 공유하되,
PostgreSQL RLS로 행 단위 격리를 수행한다. 감정 공유 독서 모임 특성상 **개인 데이터**와
**모임 공유 데이터**의 접근 경계를 명확히 정의한다.

> 원칙: 기본 거부(Deny by default). 명시적 정책이 없으면 행이 보이지 않는다.
> `service_role` 키는 모든 RLS를 자동 우회하므로 서버 측(Edge Functions) 관리 로직에만 사용.

---

## Supabase RLS 정책 매트릭스

| Table | Policy Name | Operation | Condition | Notes |
|-------|-------------|-----------|-----------|-------|
| users | profiles_select_own | SELECT | `auth.uid() = id` | 자신의 전체 프로필 조회 |
| users | profiles_update_own | UPDATE | `auth.uid() = id` | 자신의 프로필만 수정 |
| users | profiles_insert_own | INSERT | `auth.uid() = id` | 회원가입 시 본인 프로필 생성 (WITH CHECK) |
| books | books_select_all | SELECT | `true` | 도서 카탈로그는 전체 공개 (읽기 전용) |
| reading_records | records_owner_all | ALL | `auth.uid() = user_id` | 자신의 독서 기록은 전 권한 |
| reading_records | records_members_select | SELECT | 모임 멤버 여부 (서브쿼리) | 모임 멤버끼리 독서 기록 공유 |
| clubs | clubs_select_all | SELECT | `true` | 모임 목록은 공개 (탐색 허용) |
| clubs | clubs_owner_modify | UPDATE/DELETE | `auth.uid() = owner_id` | 오너만 모임 수정/삭제 |
| clubs | clubs_owner_insert | INSERT | `auth.uid() = owner_id` | 모임 생성 시 오너 지정 |
| club_members | members_select_in_club | SELECT | 같은 모임 멤버 여부 | 멤버 목록은 모임원만 열람 |
| club_members | members_insert_own | INSERT | `auth.uid() = user_id` | 본인 가입만 (가입 승인 정책은 비즈니스 결정) |
| club_members | members_delete_own | DELETE | `auth.uid() = user_id` | 본인 탈퇴 |
| emotion_shares | emotions_owner_all | INSERT/DELETE | `auth.uid() = user_id` | 자신의 감정 공유 작성/삭제 |
| emotion_shares | emotions_members_select | SELECT | 같은 모임 멤버 여부 | 모임원만 감정 공유 열람 |
| push_tokens | tokens_owner_all | ALL | `auth.uid() = user_id` | 자신의 알림 토큰만 관리 |

---

## RLS 활성화 SQL (초기 마이그레이션용)

```sql
-- 모든 테이블에 RLS 활성화 (기본 거부)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE books ENABLE ROW LEVEL SECURITY;
ALTER TABLE reading_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE emotion_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

-- 예시: 사용자 프로필 자기 행만 접근
CREATE POLICY "profiles_select_own" ON users
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON users
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- 예시: 도서 카탈로그는 공개 읽기
CREATE POLICY "books_select_all" ON books
  FOR SELECT USING (true);
```

---

## Access Control Matrix

| Table | anonymous | authenticated | service_role | admin |
|-------|-----------|---------------|--------------|-------|
| users | NONE | SELECT/UPDATE/INSERT (본인 행만) | ALL (RLS 우회) | ALL |
| books | SELECT | SELECT | ALL | ALL |
| reading_records | NONE | ALL(본인) + SELECT(모임원) | ALL | ALL |
| clubs | SELECT(공개 목록) | SELECT + INSERT/UPDATE(오너) | ALL | ALL |
| club_members | NONE | SELECT(같은 모임원) + INSERT/DELETE(본인) | ALL | ALL |
| emotion_shares | NONE | INSERT/DELETE(본인) + SELECT(모임원) | ALL | ALL |
| push_tokens | NONE | ALL(본인만) | ALL | ALL |

<!--
비즈니스 결정 대기事项(_TBD_):
- 모임 가입 승인: 자유 가입 vs 오너 승인 — 가입 INSERT 정책 반영 필요
- 모임 공개 범위: clubs 목록 전체 공개 vs 검색 가능만 — clubs_select_all 정책 미세 조정
- 독서 기록 공유 범위: 모든 모임원 열람 vs 본인만 — records_members_select 적용 여부
- 감정 공유 수정 허용: UPDATE 허용 vs INSERT/DELETE만 — emotion_shares UPDATE 정책 추가 여부
-->
