---
id: SPEC-CLUB-003
title: "모임 진도 집계 표시"
version: "1.0.0"
status: completed
created: 2026-06-27
updated: 2026-07-23
author: "강력쇠주먹"
priority: medium
issue_number: 0
labels: [club, track-b, progress, aggregate, median, rpc, rls, ui]
---

# SPEC-CLUB-003: 모임 진도 집계 표시

## HISTORY

| 날짜 | 버전 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 2026-06-27 | 1.0.0 | 최초 작성 — SPEC-CLUB-002 가 담당하지 않던 "실제 읽기 진도 집계" 영역을 메운다. Postgres RPC 기반 median 집계, ClubsScreen ClubCard 진도 표시, user_books_public 뷰 기반 RLS 결정을 정의. | 강력쇠주먹 |

---

## 1. 환경 (Environment)

- **클라이언트 런타임**: React Native 0.83.2 + Expo SDK 55 + React 19.2 (iOS/Android)
- **데이터베이스**: Supabase PostgreSQL
  - 읽기 대상: `user_books`(소유자 RLS), `user_books_public`(뷰, `is_public=true` 행만, `authenticated` SELECT 부여 — SPEC-DB-001 REQ-DB-013e), `club_members`, `clubs`, `books`
  - 신규 객체: Postgres RPC 함수 `get_host_clubs_progress(uuid)` (본 SPEC 마이그레이션)
- **API 계층**: PostgREST RPC (`supabase.rpc('get_host_clubs_progress', { p_host_id })`)
- **인증**: Supabase Auth (JWT) — `auth.uid()` 로 요청자 식별. RPC 함수는 `auth.uid() = p_host_id` 로 매개변수 검증한다 (호출자가 자신의 host 모임만 조회).
- **RLS 컨텍스트**: 본 SPEC은 테이블 컬럼을 변경하지 않는다. 신규 RPC 함수는 `SECURITY INVOKER` 로 선언하고 `user_books_public` 뷰를 통해서만 다른 멤버의 `current_page` 에 접근한다 (option a — Track A `readersApi.ts` 와 동일한 데이터 소스).
- **API 클라이언트**: `supabase` 싱글톤 (SPEC-API-001)
- **React Query**: `useHostClubs` 훅(`src/features/club/trackB/hooks.ts`) 확장 — 기존 embedded count 쿼리와 병합
- **UI 토큰**: `src/theme/tokens.ts` 전용 (SPEC-UI-002 FROZEN — token-only styling)

### 단일 출처 (Single Source of Truth)

본 SPEC의 진도 집계 데이터 소스는 `user_books_public` 뷰(`supabase/migrations/20240614000014_enable_rls.sql` 88-102행)를 단일 출처로 한다.
이 뷰는 `user_books` 의 `is_public=true` 행에 한해 `(book_id, current_page, started_reading_at, user_id)` 만 노출하며, SPEC-CLUB-001 Track A `readersApi.ts:16 READERS_SELECT` 가 이미 동일 뷰를 소비 중이다. 본 SPEC은 이 데이터 소스를 진도 집계로 재사용한다.

### 의존성

- **SPEC-DB-001** (선행): `clubs`/`club_members`/`user_books`/`books` 스키마 + RLS 정책 + `user_books_public` 보안 뷰
- **SPEC-API-001** (선행): Supabase 클라이언트 싱글톤, gen-types, 에러 처리
- **SPEC-CLUB-002** (선행, 완료): `useHostClubs` 훅 + `HostClubWithCount` 타입 + ClubsScreen + ClubCard. 본 SPEC은 이 훅을 **확장**(신규 필드 추가)하고 ClubCard 의 TODO(`@MX:TODO` at line 309)를 해소한다.
- **SPEC-UI-002** (선행, FROZEN): 화면 패턴 디자인 시스템 — token-only styling, 카드 밀도, 타이포그래피 토큰
- **SPEC-CLUB-001** (참고): Track A `readersApi.ts` 가 `user_books_public` 뷰를 이미 사용 중 — 본 SPEC은 동일 데이터 소스 채택 근거

---

## 2. 가정 (Assumptions)

### 2.1 아키텍처 가정

1. **데이터 소스는 `user_books.current_page` + `books.total_pages`** 이다. `clubs` 테이블에
   `current_page` 컬럼을 추가하지 않는다 (이중 출처, host 부담, RLS/gen-types/UI 폼 부담).
   멤버 개인 진도는 `user_books` 에, 집계는 RPC 가 계산한다.
2. **집계 방식은 MEDIAN(중앙값)** 이다. 평균(avg) 은 극단값(예: 한 명이 0p, 한 명이 300p)에
   왜곡되므로 채택하지 않는다. PostgREST embedded aggregate 는 `percentile_cont` 를 지원하지
   않으므로, Postgres RPC 함수로 직접 계산한다.
3. **데이터 접근은 `user_books_public` 뷰(option a)를 통한다.** host 가 다른 멤버의
   `current_page` 를 직접 SELECT 할 수 없다(`user_books` RLS 는 소유자 전용). 본 SPEC은
   `SECURITY DEFINER` RPC(option b) 대신 `SECURITY INVOKER` + `user_books_public` 뷰를
   사용한다. 이유: (i) Track A 와 동일 데이터 소스로 일관성 확보, (ii) `is_public=false` 인
   멤버의 진도는 집계에서 제외되는 것이 프라이버시 정합(공개 설정한 독자의 진도만 모임
   컨텍스트에 노출), (iii) SECURITY DEFINER 함수의 권한 상승 표면 최소화.
4. **집계 대상은 `current_page > 0` 인 멤버만 포함한다.** `current_page` 기본값은 0(진도
   미시작)이며, 0p 멤버를 median 에 포함하면 모임 시작 직후 "p.0" 만 표시되어 의미가 없다.
   단, `member_count_with_progress` 와 전체 멤버 수(`member_count`)를 분리 반환하여 host 가
   "진도 입력한 멤버 N명" 을 인지할 수 있게 한다.
5. **RPC 호출은 `useHostClubs` 의 기존 embedded-count 쿼리와 병합하여 단일 라운드트립을
   유지한다.** 두 번째 쿼리를 추가하는 대신, RPC 가 club 별 median/total_pages/member_count를
   한 번에 반환하고 클라이언트에서 `host_id` 기준으로 조인(merge)한다. 단, PostgREST embedded
   aggregate 와 RPC 는 동일 쿼리에 섞을 수 없으므로, RPC 한 번 + clubs SELECT(embedded count)
   한 번의 2-라운드트립이 최소이다. 클라이언트 병합(`Promise.all`) 로 직렬 대기 시간을 숨긴다.
6. **표시는 median 페이지 텍스트 + (가능 시) 진도 바 이다.** `books.total_pages` 가 NULL 이면
   바 없이 "p.{median} · 멤버 N명" 텍스트만 표시한다(REQ-CLUBC-007). total_pages 가 있으면
   바 폭 = median/total_pages (0~1 범위, 100% 초과 시 100% clamp).

### 2.2 비즈니스 가정

1. 모임 진도 집계는 **운영 컨텍스트**(member_count 와 동일 성격)이며, 비과시 원칙(constitution
   FROZEN)에 위배되지 않는다. 개별 멤버 랭킹, 멤버 간 진도 비교, 리더보드는 **금지**한다
   (REQ-CLUBC-008). median 은 집단 추세만 노출한다.
2. 진도 집계는 host 의 `ClubsScreen` 목록에서만 표시한다. 비host 멤버의 모임 상세 화면에서
   동일 집계를 표시하는 것은 본 SPEC 범위 밖이다(미결정 6.1).
3. 집계 대상 책은 모임의 `clubs.book_id` 에 해당하는 `user_books` 행만이다. 멤버가 다른 책을
   읽는 중이어도 모임 책 기준으로 집계한다.
4. closed 모임도 집계에서 제외하지 않는다(단, host 가 closed 모임을 보통 목록에서 보지 않을
   뿐). closed 모임의 median 이 정체되어 있어도 데이터 정합성은 유지된다.

---

## 3. 요구사항 (Requirements)

> 본 SPEC은 3개 요구사항 모듈로 구성된다: REQ-CLUBC-RPC, REQ-CLUBC-HOOK, REQ-CLUBC-UI.

### REQ-CLUBC-RPC: Postgres 진도 집계 RPC

**목적**: host 가 소유한 활성 모임(`type='group'`, `status='active'`)의 멤버 읽기 진도 median 을
Postgres 서버에서 집계하여 반환한다. PostgREST embedded aggregate 가 median 을 지원하지 않기
때문에 전용 RPC 가 필요하다.

#### REQ-CLUBC-001: RPC 함수 시그니처

시스템은 **항상** Postgres 함수 `get_host_clubs_progress(p_host_id uuid)` 를 제공해야 한다.
반환 타입은 테이블 형태(`TABLE(...)`)이며 각 행은 host 의 단일 모임에 대한 집계 결과이다.

**반환 컬럼**:
- `club_id uuid` — 모임 식별자
- `median_page integer` — 모임 책 기준, `current_page > 0` 인 멤버의 median (없으면 0)
- `member_count_with_progress integer` — `current_page > 0` 인 멤버 수
- `total_pages integer` — `clubs.book_id` 에 해당하는 `books.total_pages` (NULL 허용)

**WHEN** host 가 `get_host_clubs_progress(p_host_id := auth.uid())` RPC 를 호출하면,
**THEN** 시스템은 `clubs.host_id = p_host_id` AND `type='group'` AND `status='active'` 인 모든
모임에 대해 집계 행을 반환해야 한다.

#### REQ-CLUBC-002: 매개변수 검증 (호출자 = host, defense-in-depth)

**IF** RPC 호출 시 `p_host_id <> auth.uid()` 인 경우,
**THEN** 시스템은 `insufficient_privilege`(SQLSTATE 42501) 예외를 발생시켜야 한다.
(다른 사용자의 host 모임 진도를 조회할 수 없다.)
**AND** RPC 본문(plpgsql) 시작에 `IF p_host_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION ... USING ERRCODE = 'insufficient_privilege'` 단정문을 둔다.

> 보안 메모 (defense-in-depth, expert-security review 2026-06-27):
> `club_members` RLS(`fn_user_in_club`)가 이미 타인 모임 누출을 차단하나(타 host_id 호출 시
> 멤버 아닌 club 행이 필터링되어 빈 집계), 단일 방어선 의존을 보강하기 위해 `auth.uid()` 단정문을
> 추가했다. 진도 데이터는 `user_books_public`(`is_public=true`)에서 오므로 비공개 진도는 항상
> 보호된다. 클라이언트는 항상 본인 `auth.uid()` 를 전달한다.

#### REQ-CLUBC-003: median 계산 (current_page > 0 만 포함)

**WHILE** RPC 가 median 을 계산하는 동안,
**THEN** 시스템은 `user_books_public.current_page > 0` 인 멤버의 `current_page` 만
`percentile_cont(0.5) WITHIN GROUP (ORDER BY current_page)` 에 포함해야 한다.
**AND** 모임에 `current_page > 0` 인 멤버가 없으면 `median_page = 0`, `member_count_with_progress = 0` 을 반환한다.

#### REQ-CLUBC-004: SECURITY INVOKER + user_books_public 데이터 소스

**WHILE** RPC 가 멤버 진도를 읽는 동안,
**THEN** 시스템은 `user_books` 테이블을 직접 SELECT 하지 않고 `user_books_public` 뷰만
SELECT 해야 한다. 이는 `is_public=false` 인 멤버의 진도를 자동으로 제외하며, Track A
`readersApi.ts` 와 동일한 프라이버시 경계를 유지한다.
**AND** RPC 함수는 `SECURITY INVOKER` 로 선언한다(`user_books_public` 뷰가 이미 `authenticated`
SELECT 권한을 부여받았으므로 권한 상승이 불필요).

#### REQ-CLUBC-005: books.total_pages 조인

**WHEN** RPC 가 모임 행을 구성하면,
**THEN** 시스템은 `clubs.book_id` 로 `books.total_pages` 를 LEFT JOIN 하여 반환 컬럼에
포함해야 한다. `books.total_pages` 가 NULL 이면 반환값도 NULL 이다(REQ-CLUBC-007 분기 근거).
**AND** `books` RLS(`books_select_all` — `USING(true)`)로 인해 모든 authenticated 사용자가
`books` 를 읽을 수 있으므로 조인에 RLS 충돌이 없다.

#### REQ-CLUBC-006: RPC GRANT 및 마이그레이션

**WHEN** 마이그레이션이 적용되면,
**THEN** 시스템은 `GRANT EXECUTE ON FUNCTION get_host_clubs_progress(uuid) TO authenticated;`
를 포함해야 한다. 비인증(anon) 역할에는 부여하지 않는다.
**AND** 마이그레이션 파일은 `supabase/migrations/20240627000001_create_get_host_clubs_progress_rpc.sql`
경로에 위치한다.

---

### REQ-CLUBC-HOOK: useHostClubs 진도 병합

**목적**: 기존 `useHostClubs` 훅이 host 모임 목록 + 멤버 수 외에 median 진도 데이터를 함께
반환하도록 확장한다. ClubsScreen ClubCard 가 단일 훅 호출로 모든 표시 데이터를 얻는다.

#### REQ-CLUBC-007: HostClubWithCount 타입 확장

시스템은 **항상** `HostClubWithCount` 타입에 다음 신규 필드를 포함해야 한다:
- `median_page: number` — RPC 결과, 없으면 0
- `member_count_with_progress: number` — RPC 결과, 없으면 0
- `progress_total_pages: number | null` — RPC 결과의 `total_pages`, NULL 허용

**WHILE** `useHostClubs` 가 활성화된 동안,
**THEN** 시스템은 기존 `clubs` SELECT(embedded count) 와 `get_host_clubs_progress` RPC 를
`Promise.all` 로 병렬 실행하고, `club_id` 기준으로 클라이언트 병합하여 `HostClubWithCount[]` 를
반환해야 한다.

#### REQ-CLUBC-008: RPC 실패 시 우아한 degradation

**IF** `get_host_clubs_progress` RPC 가 에러를 반환하면,
**THEN** 시스템은 전체 `useHostClubs` 쿼리를 실패시키지 않고, 진도 필드(`median_page`,
`member_count_with_progress`, `progress_total_pages`)를 기본값(0, 0, null)으로 채운 채
기존 clubs+count 데이터만 반환해야 한다.
**AND** 에러는 콘솔에 로깅한다(Sentry 전송은 SPEC-API-001 에러 처리 위임).

> 근거: 진도 표시는 보조 정보이므로, RPC 장애가 모임 목록 자체를 사용 불가능하게 만들어서는
> 안 된다. host 는 최소한 모임 이름·멤버 수·상태는 볼 수 있어야 한다.

#### REQ-CLUBC-009: 캐시 무효화 일관성

**WHEN** `useCreateClub`/`useCloseClub`/`useReactivateClub`/`useLeaveClub` mutation 이 성공하면,
**THEN** 시스템은 기존 `[...CLUBB_KEY_ROOT, 'host']` 캐시 무효화를 유지해야 한다. 진도 데이터는
동일 queryKey 로 병합되므로 별도 무효화 키가 필요 없다.
**AND** 진도 데이터는 멤버의 `user_books.current_page` 업데이트(본인 서재)에 의해 변동되나,
host 가 타인의 서재 업데이트를 트리거로 삼을 수 없으므로, 캐시는 host 의 다음 `useHostClubs`
refetch(포커스 복귀 등 React Query 기본 동작) 시 자동 갱신된다.

---

### REQ-CLUBC-UI: ClubsScreen ClubCard 진도 표시

**목적**: ClubsScreen 의 ClubCard 에서 `.pen` F11-Clubs Track/Fill/Pct 노드에 해당하는 진도
표시를 구현하고, ClubsScreen.tsx:309 의 `@MX:TODO` 를 해소한다.

#### REQ-CLUBC-010: 진도 텍스트 표시

**WHEN** ClubCard 가 렌더링되면,
**THEN** 시스템은 `.pen` Pct 라인 형식으로 `p.{median_page} · 멤버 {member_count_with_progress}명`
텍스트를 표시해야 한다. (`typography.label` 토큰 사용, `theme.colors.text.tertiary` 색상)
**AND** 기존 `멤버 {member_count}명` 라인(전체 멤버 수)은 유지하되, 진도 라인과 분리된 별도
텍스트 노드로 렌더링한다.

#### REQ-CLUBC-011: 진도 바 표시 (total_pages 존재 시)

**IF** `progress_total_pages` 가 NULL 이 아니고 0 보다 크면,
**THEN** 시스템은 `.pen` Track/Fill 노드 형식의 진도 바를 표시해야 한다.
- Track: `theme.colors.bg.subtle`(또는 brand-100) 배경, `theme.radius.full`, 높이 `theme.spacing[2]`(8px) 토큰
- Fill: `theme.colors.brand[500]`, 폭 = `min(median_page / progress_total_pages, 1) * 100%`
**AND** 진도 바는 진도 텍스트와 수직 배치(gap `theme.spacing[1]`)한다.

#### REQ-CLUBC-012: total_pages NULL 시 바 생략

**IF** `progress_total_pages` 가 NULL 이거나 0 이하이면,
**THEN** 시스템은 진도 바를 렌더링하지 않고 텍스트(`p.{median} · 멤버 N명`)만 표시해야 한다.
**AND** 레이아웃 시프트를 방지하기 위해 바 자리를 예약하지 않는다(조건부 렌더링).

#### REQ-CLUBC-013: median 0 시 표시

**IF** `median_page` 가 0 이면(진도 입력 멤버가 없음),
**THEN** 시스템은 진도 바를 0% 폭으로 표시하지 않고, 텍스트를 `아직 진도가 없어요` 로
대체 표시해야 한다.
**AND** `member_count_with_progress` 가 0 임을 텍스트에 반영하지 않는다(전체 멤버 수 라인은
유지).

#### REQ-CLUBC-014: @MX:TODO 해소

**WHEN** 진도 표시가 구현되면,
**THEN** 시스템은 `src/features/club/trackB/components/ClubsScreen.tsx:309` 의 `@MX:TODO` 블록을
제거하고, 구현 완료를 나타내는 `@MX:NOTE`(필요 시)로 대체하거나 주석을 제거해야 한다.
**AND** MX 프로토콜에 따라 GREEN 단계에서 TODO 제거를 보고한다.

#### REQ-CLUBC-015: SPEC-UI-002 토큰 준수

**WHILE** 진도 표시 컴포넌트가 스타일링되는 동안,
**THEN** 시스템은 `src/theme/tokens.ts` 변수(`$brand-500`, `radius.full`, `spacing.*`,
`typography.label`)만 사용하고 하드코딩된 색상/숫자/폰트 크기를 사용하지 않아야 한다
(SPEC-UI-002 REQ-SCREEN-005 token-only FROZEN).

---

### REQ-CLUBC-NONDISPLAY: 비과시 원칙 (constitution FROZEN)

**목적**: 진도 집계가 개인 간 경쟁/과시로 변질되지 않도록 보장한다.

#### REQ-CLUBC-016: median 전용, 개인 진도 비교 금지

시스템은 **항상** 진도 표시를 median(중앙값) 으로만 제한해야 한다.
**WHEN** ClubsScreen ClubCard 가 진도를 표시하면,
**THEN** 시스템은 개별 멤버의 `current_page`, 멤버 간 진도 순위, "가장 앞선 독자",
"가장 뒤처진 독자" 등 비교/랭킹 정보를 표시하지 않아야 한다.
**AND** `member_count_with_progress` 는 운영 컨텍스트(몇 명이 진도를 입력했는지)로만
표시하며, "진도 입력률 %" 등 과시 유도 지표는 표시하지 않는다.

#### REQ-CLUBC-017: 리더보드/순위 UI 금지

**IF** 향후 확장에서 진도 기반 리더보드, 순위표, "이번 주 독자" 위젯이 제안되면,
**THEN** 시스템은 이를 구현하지 않아야 한다. 본 REQ 는 constitution 비과시 원칙의
명시적 적용이며, median 집계는 운영 컨텍스트(member_count 와 동급)로 허용되나 개인
비교는 금지된다.

---

## 4. API 서피스 매핑 (API Surface Mapping)

| 엔드포인트 | 구현 메커니즘 | REQ |
|-----------|--------------|-----|
| `POST /rpc/get_host_clubs_progress` | PostgREST RPC, `p_host_id uuid` → TABLE(club_id, median_page, member_count_with_progress, total_pages) | REQ-CLUBC-001~006 |
| `useHostClubs` 확장 | `Promise.all([clubs SELECT, RPC])` + 클라이언트 merge | REQ-CLUBC-007~009 |
| ClubCard 진도 표시 | Track/Fill/Pct 노드 + 텍스트 | REQ-CLUBC-010~015 |

> 본 SPEC은 `/clubs`, `/clubs/{id}/progress`(SPEC-CLUB-002) 엔드포인트를 수정하지 않는다.
> 진도 설정(daily_pages/trigger_page) 은 여전히 SPEC-CLUB-002 영역이다.

---

## 5. 제외 범위 (Exclusions)

본 SPEC은 다음을 포함하지 않는다:

1. **`clubs.current_page` 컬럼 추가**: 거부됨(이중 출처, host 부담). 진도는 `user_books` 에
   단일 출처로 존재한다 (가정 2.1.1).
2. **모임 피드 진도 표시**: SPEC-FEED-001 의 스포일러 방지 피드 내 진도 표시는 본 SPEC
   범위 밖이다. 본 SPEC은 ClubsScreen 목록 카드에만 집계를 표시한다.
3. **비host 모임 상세 진도 표시**: 멤버가 보는 모임 상세 화면의 진도 집계 표시는 미결정
   사항(6.1)이며 본 SPEC에서 구현하지 않는다.
4. **평균(avg) 집계**: median 만 지원한다 (가정 2.1.2).
5. **개인 진도 비교/랭킹/리더보드**: constitution 비과시 원칙에 의해 금지(REQ-CLUBC-016/017).
6. **`is_public=false` 멤버 진도 포함**: `user_books_public` 뷰 선택(option a) 에 의해
   공개 설정 독자만 집계에 포함된다. 비공개 독자를 포함하려면 option b(SECURITY DEFINER)가
   필요하나 본 SPEC은 option a 를 채택한다(가정 2.1.3, plan.md 기술 결정 참조).
7. **진도 입력 UI**: 멤버가 자신의 `current_page` 를 업데이트하는 UI 는 SPEC-LIBRARY-001
   영역이다. 본 SPEC은 읽기 전용 집계만 담당한다.
8. **SPEC-CLUB-002 진도 설정(daily_pages/trigger_page) 로직 수정**: 목표치 설정은
   SPEC-CLUB-002 가 완료한 상태이며 본 SPEC이 수정하지 않는다.
9. **실시간 진도 갱신(Realtime)**: 진도 집계는 React Query 기본 refetch(포커스/재마운트)로
   갱신된다. Supabase Realtime 구독은 본 SPEC 범위 밖이다.

---

## 6. 미결정 사항 (Open Questions)

### 6.1 비host 모임 상세 화면 진도 표시 — 미해결

멤버가 모임 상세(`/clubs/{clubId}`) 화면에서 동일 median 집계를 볼 수 있어야 하는지 미확정이다.

**현재 결정**: 본 SPEC은 host 의 ClubsScreen 목록에만 집계를 표시한다. 멤버 상세 화면은
SPEC-CLUB-002 기존 동작(진도 설정 표시) 을 유지한다.

**후보**:
- (A) 멤버 상세에도 동일 median 표시 — 모임원 누구나 집단 추세 인지
- (B) host 전용 유지 — 멤버는 개인 진도만 (비과시 원칙 강화)

**영향 범위**: 사용자 경험, 비과시 원칙 해석.

**해결 시점**: 사용자 피드백 기반 확정.

### 6.2 집계 주기 (staleness) — 미해결

`useHostClubs` 의 React Query `staleTime` 기본값(기본 0 = 매 마운트 refetch) 을 진도 집계에
맞게 조정할지 미확정이다.

**현재 결정**: 기본값(0) 유지. host 가 ClubsScreen 에 진입할 때마다 최신 median 을 가져온다.

**후보**:
- (A) `staleTime: 30_000`(30초) — 빈번한 화면 전환 시 RPC 호출 절감
- (B) 기본값 유지 — 항상 최신

**영향 범위**: RPC 호출 빈도, 배터리/데이터 사용량.

**해결 시점**: 성능 프로파일링 후 확정.

---

## 7. 추적성 (Traceability)

| TAG | 요구사항 | 소스 |
|-----|---------|------|
| SPEC-CLUB-003 | REQ-CLUBC-001 ~ REQ-CLUBC-017 | 본 SPEC, SPEC-CLUB-002 제외 영역(spec.md 308-309행), `.pen` F11-Clubs Track/Fill/Pct 노드, `ClubsScreen.tsx:309 @MX:TODO`, `user_books_public` 뷰(SPEC-DB-001 REQ-DB-013e), Track A `readersApi.ts:16`(동일 데이터 소스), constitution v3.4.0 비과시 원칙 |
| REQ-CLUBC-RPC | REQ-CLUBC-001 ~ REQ-CLUBC-006 | SPEC-DB-001(user_books_public 뷰, clubs/books RLS), PostgREST RPC 한계(aggregate median 미지원) |
| REQ-CLUBC-HOOK | REQ-CLUBC-007 ~ REQ-CLUBC-009 | SPEC-CLUB-002 useHostClubs(hooks.ts), SPEC-API-001(에러 처리) |
| REQ-CLUBC-UI | REQ-CLUBC-010 ~ REQ-CLUBC-015 | SPEC-UI-002(token-only FROZEN, 카드 밀도), `.pen` F11-Clubs(MPJTS/zlR3h/TI83b/RmILS), ClubsScreen.tsx:309 TODO |
| REQ-CLUBC-NONDISPLAY | REQ-CLUBC-016 ~ REQ-CLUBC-017 | constitution v3.4.0 Section 2 FROZEN(Non-competition principle) |
