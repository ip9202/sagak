---
id: SPEC-CLUB-004
title: "모임 생성 책 선택 허브 — 서재 + 외부 검색 통합 (Club Creation Book-Selection Hub)"
version: "0.1.0"
status: draft
created: 2026-07-27
updated: 2026-07-27
author: "강력쇠주먹"
priority: P1
phase: "v1.3.0"
module: "app/(tabs)/clubs/new, src/features/club/trackB, src/features/library, src/features/book, app/(tabs)/search"
lifecycle: spec-anchored
tags: "club, book-selection, library, hub-ui, external-search, dead-end-fix"
depends_on: [SPEC-CLUB-002, SPEC-LIBRARY-001]
related_specs: [SPEC-LIBRARY-002, SPEC-BOOK-001]
tier: M
---

# SPEC-CLUB-004: 모임 생성 책 선택 허브 — 서재 + 외부 검색 통합

## HISTORY

| 날짜 | 버전 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 2026-07-27 | 0.1.0 | 최초 작성 — `/clubs/new` 게이트를 통합 북선택 허브로 재설계. 호스트 본인 서재(`reading`+`shelved`) 책 선택과 외부(Kakao) 검색을 단일 화면에서 지원. 외부 검색 → 모임 생성 폼 핸드오프 누락(dead-end) 수정. `completed` 책 선택 제외. DB 스키마 변경 없음. | 강력쇠주먹 |

---

## 1. 환경 (Environment)

- **클라이언트 런타임**: React Native 0.83.2 + Expo SDK 55 + React 19.2 (iOS/Android, TypeScript strict)
- **데이터 테이블**: `user_books` (본 SPEC 읽기 전용 — status 모델 소비), `books` (글로벌 카탈로그 — `book_id` FK 대상), `clubs` (본 SPEC이 `book_id` FK를 채움)
- **데이터 페칭**: TanStack React Query v5 — `useLibrary({userId, status})` 패턴 (SPEC-LIBRARY-001)
- **인증 컨텍스트**: `useSession()` → `auth.uid()` (SPEC-AUTH-001)
- **라우팅**: Expo Router — `app/(tabs)/clubs/new` (게이트/허브 + 모임 생성 폼), `app/(tabs)/search` (외부 검색)
- **외부 검색**: Kakao 도서 검색 Edge Function (`supabase/functions/kakao-book-search/`, SPEC-BOOK-001) — ISBN 기반 `books` 캐시/업sert

### 단일 출처 (Single Source of Truth)

- `.moai/specs/SPEC-CLUB-002/spec.md` — `clubs.book_id NOT NULL FK REFERENCES books(id)` (REQ-CLUBB-001), `ClubCreateScreen`이 `bookId` 라우트 파라미터를 소비 (가정 2.2.2). 본 SPEC은 이 `bookId`를 공급하는 진입 경로를 정의한다.
- `.moai/specs/SPEC-LIBRARY-001/spec.md` — `user_books.status IN ('reading','completed','shelved')` 모델, `useLibrary({userId, status})` 인터페이스. 본 SPEC은 status 모델을 소비만 한다.
- `.moai/specs/SPEC-LIBRARY-002/spec.md` (최신 edfa20b) — `enforce_single_reading` 철회. 다중 `reading` 보유 허용 → 본 SPEC의 서재 선택 목록에 자연 반영 (회귀 없음).
- `.moai/specs/SPEC-BOOK-001/spec.md` — `books` 글로벌 카탈로그 + ISBN UNIQUE.

### 의존성

- **SPEC-CLUB-002** (선행, completed): 본 SPEC이 `bookId` 라우트 파라미터를 `ClubCreateScreen`에 공급 → SPEC-CLUB-002의 모임 생성 폼/`createClub` 호출이 정상 동작.
- **SPEC-LIBRARY-001** (선행, completed): `user_books.status` 모델, `useLibrary({userId, status})` 인터페이스를 본 SPEC이 소비.
- **SPEC-LIBRARY-002** (선행, completed, edfa20b): 다중 `reading` 허용 — 본 SPEC 서재 선택 목록이 0/1/N개 `reading` 행을 자연 지원.
- **SPEC-BOOK-001** (선행, completed): 외부 검색 결과의 `books.id` 확보 경로(`resolveBookId(isbn)`)가 정의됨.

---

## 2. 가정 (Assumptions)

### 2.1 아키텍처 가정

1. **`/clubs/new` 게이트는 현재 unwired dead-end 상태다.** 진입점 `app/(tabs)/clubs.tsx`의 "모임 만들기" CTA는 `router.push('/clubs/new')`로 bookId 없이 진입하며, 게이트 화면은 "책 검색하기" 단일 CTA만 제공한다. 이 CTA는 `router.push('/search')`로 연결되나, `/search`의 `onSelectBook` 핸들러는 모임 생성 컨텍스트로 되돌아오지 않고 `/[bookId]` 책 상세로 이탈한다. 리포 전체 grep 결과 `clubs/new?bookId=` 형태의 호출자는 0건이다. 본 SPEC은 이 dead-end를 허브 재설계와 핸드오프 라우팅으로 수정한다.
2. **DB 스키마 변경은 없다.** `clubs.book_id`와 `user_books.book_id`는 모두 동일한 글로벌 `books.id`를 참조한다 (FK 호환성 확인됨). 서재 책 선택은 `user_books.book_id` (a `books.id`)를 `clubs.book_id`에 그대로 공급하며, 별도 조인 테이블/마이그레이션 없이 FK 제약을 만족한다.
3. **`createClub`은 선택된 책을 호스트 서재에 자동 추가하지 않는다** (기존 동작 보존). 호스트가 외부 검색으로 선택한 책이 본인 서재에 없더라도, 본 SPEC은 이를 자동 추가하지 않는다. 이는 명시적 비목표(Out of Scope)다.
4. **`user_books.status`는 정확히 3값이다.** `'reading'`(읽는중) / `'completed'`(완독) / `'shelved'`(보관함). `paused`/`want_to_read`/`dropped`는 존재하지 않는다 (스키마 CHECK 제약 + TS 타입 일치). 본 SPEC은 이 3값만 다룬다.
5. **`SPEC-LIBRARY-002`의 다중 reading 허용이 본 SPEC에 자연 반영된다.** 한 사용자가 N개의 서로 다른 책을 `status='reading'`으로 보유할 수 있으며, 모두 선택 가능 목록에 표시된다. `UNIQUE(user_id, book_id)` 제약은 동일 책 중복을 막으므로 선택 목록에 중복 책이 나타나지 않는다.

### 2.2 비즈니스 가정

1. **호스트는 모임 생성 시 본인 서재의 `reading` 또는 `shelved` 책을 선택할 수 있어야 한다.** 이는 사용자의 명시적 요구("읽는중, 보관함에 있는 모든 책을 먼저 선택할 수 있어야 해")다.
2. **`completed`(완독) 책은 선택 목록에서 제외된다.** 사용자가 이미 완독한 책은 모임을 만들 이유가 없다 ("완독한 책은 자신도 다 읽었으니 모임을 만들 필요가 없어"). 본 SPEC은 completed 행을 선택 가능 목록에서 숨기는 것을 기본 동작으로 한다.
3. **외부(Kakao) 검색은 계속 지원된다.** 호스트가 본인 서재에 없는 책으로 모임을 만들고 싶은 경우, 허브 화면에서 외부 검색으로 책을 선택할 수 있어야 한다. 외부 검색 결과 선택 시 기존 dead-end(책 상세로 이탈) 없이 모임 생성 폼으로 핸드오프되어야 한다.
4. **모임 생성 진입은 오직 `/clubs/new` 단일 경로다.** 본 SPEC은 `BookDetailScreen`의 "이 책으로 모임 만들기" CTA나 서재 아이템의 CTA를 추가하지 않는다 (명시적 비목표 — 향후 별도 SPEC에서 다룬다).

---

## 3. 요구사항 (Requirements)

> 본 SPEC은 4개 요구사항 모듈로 구성된다: REQ-CLUB4-HUB (통합 허브 재설계), REQ-CLUB4-LIBRARY (서재 책 선택), REQ-CLUB4-SEARCH (외부 검색 핸드오프), REQ-CLUB4-REGRESSION (회귀 보장).

### REQ-CLUB4-HUB: 통합 북선택 허브 재설계

**목적**: 현재 "책 검색하기" 단일 CTA만 제공하는 `/clubs/new` 게이트를, 서재 목록 + 외부 검색이 단일 화면에 공존하는 **통합 북선택 허브**로 재설계한다. 이 허브는 모임 생성 플로우의 진정한 진입점이 된다.

#### REQ-CLUB4-001: 통합 북선택 허브 화면 렌더링

**When** 인증된 사용자가 `bookId` 라우트 파라미터 없이 `/clubs/new`에 진입하면, the 클라이언트는 단일 허브 화면에 다음 두 선택지를 함께 렌더링해야 한다:

1. **서재 섹션** — 호스트 본인의 `user_books` 행 중 `status IN ('reading','shelved')`인 책들을 선택 가능한 목록으로 표시
2. **외부 검색 섹션** — Kakao 도서 검색 입력 + 검색 결과 목록

두 섹션 중 하나를 먼저 선택해야 다른 하나가 잠기는 계단식 게이트가 아니라, 같은 화면에서 동등하게 접근 가능해야 한다.

#### REQ-CLUB4-002: 게이트 CTA 재설계

**When** `/clubs/new` 허브가 렌더링되면, the 클라이언트는 기존 "책 검색하기" 단일 CTA(`app/(tabs)/clubs/new.tsx` 현재 구현)를 제거하고, 허브 내의 서재 목록 또는 외부 검색 입력을 통해서만 책을 선택하도록 플로우를 단순화해야 한다. 기존 "어떤 책으로 모임을 만들까요?" 헤더 문구는 유지 가능하다.

---

### REQ-CLUB4-LIBRARY: 호스트 서재 책 선택

**목적**: 호스트가 본인 서재의 `reading`/`shelved` 책을 탭하여 모임 생성 폼으로 진입할 수 있도록 한다. `completed` 책은 명시적으로 제외된다.

#### REQ-CLUB4-010: 서재 선택 목록 — reading + shelved 필터

**Where** 허브의 서재 섹션이 호스트의 `user_books`를 렌더링할 때, the 클라이언트는 `status='reading'` 행과 `status='shelved'` 행만 선택 가능 목록에 포함해야 한다. `status='completed'` 행은 선택 가능 목록에서 제외된다 — 호스트가 이미 완독한 책이므로 모임 생성 이유가 없다 (사용자 명시 요구).

> 다중 reading(SPEC-LIBRARY-002) 컨텍스트에서 `reading` 행이 0/1/N개일 수 있으며, 모두 선택 목록에 표시된다. `UNIQUE(user_id, book_id)`가 동일 책 중복을 막으므로 목록에 중복 제목이 나타나지 않는다.

#### REQ-CLUB4-011: 서재 책 선택 → 모임 생성 폼 핸드오프

**When** 호스트가 서재 섹션의 한 책을 탭하면, the 클라이언트는 해당 `user_books.book_id`(글로벌 `books.id`)를 `ClubCreateScreen`(SPEC-CLUB-002)이 기대하는 `bookId` 라우트 파라미터로 전달하여 모임 생성 폼으로 진입해야 한다.

**And** 전달된 `bookId`는 `clubs.book_id` FK 제약을 만족하는 유효한 `books.id`여야 한다 (FK 호환성 — 별도 매핑/조인 없음).

#### REQ-CLUB4-012: 서재 아이템 메타데이터 표시

**While** 서재 섹션이 선택 가능 책 목록을 렌더링하는 동안, the 클라이언트는 각 아이템에 다음 메타데이터를 표시해야 한다:

- 책 표지 이미지 (`books.cover_image`)
- 책 제목 / 저자 (`books.title`, `books.author`)
- 상태 칩 (읽는중 / 보관함 — 한국어 라벨)
- 진도율 (`progressRate` 계산 결과, `reading` 상태에만 해당)

표시 형식은 기존 서재(`LibraryItem`) 프레젠테이션을 재사용하는 것을 권장한다 (run-phase 디자인 결정).

#### REQ-CLUB4-013: 빈 서재 fallback

**When** 호스트의 `user_books`에 `status IN ('reading','shelved')`인 행이 0건인 경우 (빈 서재), the 클라이언트는 서재 섹션을 접힌 상태로 렌더링하거나 생략하고, 외부 검색 섹션을 1차 선택지로 부각해야 한다. 빈 서재 상태가 모임 생성 플로우를 차단하지 않아야 한다 — 호스트는 외부 검색으로 모임을 시작할 수 있다.

---

### REQ-CLUB4-SEARCH: 외부 검색 핸드오프 (dead-end fix)

**목적**: 현재 `/search`의 `onSelectBook` 핸들러가 책 상세로 이탈하며 모임 생성 컨텍스트로 되돌아오지 않는 dead-end를 수정한다. 모임 생성 컨텍스트에서 외부 검색 결과를 선택하면 모임 생성 폼으로 핸드오프되어야 한다.

#### REQ-CLUB4-020: 모임 생성 컨텍스트 — 외부 검색 결과 핸드오프

**When** 호스트가 `/clubs/new` 허브를 통해 외부 검색을 수행하고 검색 결과 중 하나를 선택하면, the 클라이언트는 선택한 책의 ISBN으로 `books.id`를 확보(`resolveBookId` 캐시/업sert)한 뒤, 해당 `books.id`를 `ClubCreateScreen`의 `bookId` 라우트 파라미터로 전달하여 모임 생성 폼으로 진입해야 한다.

**And** 이 핸드오프 경로는 서재 책 선택(REQ-CLUB4-011)과 동일한 `bookId` 라우트 파라미터 계약을 사용한다 — 두 경로 모두 동일한 `ClubCreateScreen` 진입점으로 수렴한다.

#### REQ-CLUB4-021: standalone `/search` 동작 회귀 보장

**Where** `/search`가 `/clubs/new` 컨텍스트 외부에서 standalone으로 사용되는 경우 (예: 탭 내 일반 도서 검색), the 클라이언트는 기존 동작(`onSelectBook` → `/[bookId]` 책 상세 이동)을 그대로 유지해야 한다. 본 SPEC의 핸드오프 변경은 **모임 생성 컨텍스트에서만** 적용되며, standalone `/search` 사용을 변경하지 않는다.

#### REQ-CLUB4-022: 허브 내 검색 vs 별도 화면 분기

**Where** 허브가 외부 검색을 지원하는 방식(허브 내 인라인 검색 결과 vs 별도 `/search` 화면으로 이동 후 컨텍스트-aware 핸드오프), the 클라이언트는 둘 중 하나를 선택해 구현해야 한다. 두 방식 모두 REQ-CLUB4-020의 `bookId` 핸드오프 계약을 준수해야 한다.

> 구체적 구현 방식(인라인 vs 별도 화면 + 컨텍스트 파라미터)은 plan.md에서 설계 결정으로 다룬다. 본 REQ는 "두 방식 모두 허용되나 어느 쪽이든 핸드오프 계약을 지켜야 함"만을 명시한다.

---

### REQ-CLUB4-REGRESSION: 회귀 보장

**목적**: 본 SPEC의 허브 재설계와 핸드오프 수정이 기존 모임 생성(`ClubCreateScreen`), standalone `/search`, 서재 탭 동작에 회귀를 일으키지 않음을 보장한다.

#### REQ-CLUB4-030: 기존 `ClubCreateScreen` `bookId` 호환

**While** 본 SPEC의 변경이 적용된 후에도, the 클라이언트는 `bookId` 라우트 파라미터가 주어진 상태에서 `ClubCreateScreen`이 기존대로 모임 생성 폼을 렌더링하고 `useCreateClub().mutate`를 정상 호출해야 한다 (SPEC-CLUB-002 REQ-CLUBB-001 ~ REQ-CLUBB-005 준수). 본 SPEC은 `ClubCreateScreen`의 내부 동작을 변경하지 않는다.

#### REQ-CLUB4-031: standalone `/search` 회귀 부재

**While** 본 SPEC의 핸드오프 수정이 적용된 후에도, the 클라이언트는 standalone `/search` 진입 시 기존 검색 → 책 상세 이탈 동작이 회귀 없이 유지됨을 보장해야 한다 (REQ-CLUB4-021과 쌍을 이룸).

#### REQ-CLUB4-032: `/clubs` 탭 "모임 만들기" 진입 회귀 부재

**While** 본 SPEC의 허브 재설계가 적용된 후에도, the 클라이언트는 `app/(tabs)/clubs.tsx`의 "모임 만들기" CTA가 `/clubs/new` 허브로 정상 진입함을 보장해야 한다. 진입점 자체는 변경되지 않는다.

#### REQ-CLUB4-033: SPEC-LIBRARY-002 다중 reading 호환

**While** 한 호스트가 N개의 서로 다른 `status='reading'` 책을 보유한 상태에서, the 클라이언트는 허브 서재 섹션이 N개의 `reading` 행을 모두 선택 가능 목록에 표시해야 한다 (SPEC-LIBRARY-002 회귀 호환). `enforce_single_reading` 철회 이후의 자연 동작이 본 SPEC에서도 유효해야 한다.

---

## 4. 제외 범위 (Exclusions)

본 SPEC은 다음을 포함하지 않는다.

### Out of Scope — BookDetailScreen "이 책으로 모임 만들기" CTA

- `BookDetailScreen`(`src/features/book/BookDetailScreen.tsx`)에 모임 생성 CTA를 추가하는 것은 명시적 비목표다. 이는 향후 별도 SPEC에서 다룬다 (사용자 결정 3 — 최소 변경 원칙).

### Out of Scope — 서재 아이템 CTA

- `app/(tabs)/library.tsx`의 서재 아이템에 "이 책으로 모임 만들기" 진입점을 추가하는 것은 명시적 비목표다 (사용자 결정 3).

### Out of Scope — DB 스키마 변경 / 마이그레이션

- `clubs`, `user_books`, `books` 테이블에 컬럼/제약/인덱스/뷰를 추가하는 스키마 변경은 하지 않는다. FK 호환성 분석 결과 본 SPEC은 스키마 없이 구현 가능하다 (가정 2.1.2).

### Out of Scope — 선택한 외부 검색 책의 서재 자동 추가

- `createClub`이 선택된 책을 호스트의 `user_books`에 자동으로 추가(INSERT)하는 로직은 도입하지 않는다 (가정 2.1.3). 호스트가 외부 검색으로 모임을 시작한 경우, 해당 책은 호스트의 서재에 존재하지 않을 수 있으며, 이는 본 SPEC이 수정하지 않는 기존 동작이다.

### Out of Scope — 모임 생성 폼(`ClubCreateScreen`) 내부 로직

- `ClubCreateScreen`의 필드 검증, 진도 계획 입력, `useCreateClub().mutate` 호출부는 SPEC-CLUB-002 소관이다. 본 SPEC은 `bookId` 라우트 파라미터를 공급할 뿐, 폼 내부 동작을 변경하지 않는다.

### Out of Scope — Track A 합류 요청 / 모임 피드 / 진도 집계

- `join_requests` 상태 기계(SPEC-CLUB-001), 진도별 슬라이딩 피드(SPEC-FEED-001), `get_host_clubs_progress` RPC(SPEC-CLUB-003)는 본 SPEC 범위 밖이다.

### Out of Scope — "대표 책" / "추천 책" 개념

- "사용자의 대표 책 1권을 모임 책으로 자동 제안" 등의 추천 로직은 도입하지 않는다. 허브는 사용자가 명시적으로 선택하는 책만 다룬다.

---

## 5. 미결정 사항 (Open Questions)

> 본 SPEC의 사용자 합의 결정(Decisions 1-6)은 모두 확정되었다. 남은 미결정 사항은 AC 수준의 micro-decision 3종으로, plan.md에 `[NEEDS CLARIFICATION]` 마커로 표시된다. 이들은 Implementation Kickoff Approval 전에 orchestrator의 AskUserQuestion 라운드로 해소되어야 한다.

### 5.1 빈 서재 fallback 처리 — micro-decision (권장 기본값 존재)

**질문**: 호스트의 `user_books`에 `reading`/`shelved` 책이 0건인 경우, 서재 섹션을 어떻게 렌더링할 것인가?

**권장 기본값**: 서재 섹션을 접힘/생략하고 외부 검색을 1차 선택지로 부각. 빈 상태가 모임 생성을 차단하지 않음 (REQ-CLUB4-013).

**상태**: plan.md `[NEEDS CLARIFICATION]` 마커로 표시 — 사용자가 권장값을 수용하거나 대안(빈 상태 메시지 + 외부 검색 CTA 강조 등)을 선택.

### 5.2 `completed` 책 UX — hidden vs greyed-out — micro-decision (권장 기본값 존재)

**질문**: `completed` 책을 선택 가능 목록에서 완전히 숨길 것인가(hidden), 아니면 비활성화 상태로 회색 처리하여 표시할 것인가(greyed-out)?

**권장 기본값**: **hidden** — 목록에서 완전히 제외 (REQ-CLUB4-010). greyed-out은 시각적 혼란(왜 선택 불가인지 사용자가 인지 부조화)을 유발할 수 있다.

**상태**: plan.md `[NEEDS CLARIFICATION]` 마커로 표시.

### 5.3 서재 아이템 프레젠테이션 재사용 — micro-decision (권장 기본값 존재)

**질문**: 허브 서재 아이템이 기존 `LibraryItem` 프레젠테이션을 재사용할 것인가, 아니면 허브 전용 최소 프레젠테이션(표지/제목/저자/상태칩만)을 만들 것인가?

**권장 기본값**: **`LibraryItem` 재사용** — 진도율/상태칩 등 서재와 일관된 UX. 단, 허브 컨텍스트에 맞지 않는 CTA(예: 서재 전용 액션)는 props로 숨김 처리.

**상태**: plan.md `[NEEDS CLARIFICATION]` 마커로 표시.

---

## 6. 추적성 (Traceability)

| TAG | 요구사항 | 소스 |
|-----|---------|------|
| SPEC-CLUB-004 | REQ-CLUB4-001 ~ REQ-CLUB4-033 | 사용자 요구("모임 생성할때 책 검색할때 현재 자신이 읽고 있는 책도 선택할 수 있어야 해..."), `.moai/specs/SPEC-CLUB-002/spec.md`(REQ-CLUBB-001 `bookId` FK + `ClubCreateScreen`), `.moai/specs/SPEC-LIBRARY-001/spec.md`(status 모델), `.moai/specs/SPEC-LIBRARY-002/spec.md`(다중 reading 허용), `.moai/specs/SPEC-BOOK-001/spec.md`(books 카탈로그), reconnaissance(`app/(tabs)/clubs/new.tsx` dead-end 분석) |
| REQ-CLUB4-HUB | REQ-CLUB4-001, REQ-CLUB4-002 | 사용자 결정 1 (통합 허브), recon `app/(tabs)/clubs/new.tsx:23-71` 게이트 현재 상태 |
| REQ-CLUB4-LIBRARY | REQ-CLUB4-010 ~ REQ-CLUB4-013 | 사용자 요구 본문, 사용자 결정 4 (completed 제외), SPEC-LIBRARY-001 status 모델, SPEC-LIBRARY-002 다중 reading |
| REQ-CLUB4-SEARCH | REQ-CLUB4-020 ~ REQ-CLUB4-022 | 사용자 결정 2 (외부 검색 dead-end fix), recon `app/(tabs)/search.tsx:34-53` 현재 `/[bookId]` 이탈 |
| REQ-CLUB4-REGRESSION | REQ-CLUB4-030 ~ REQ-CLUB4-033 | SPEC-CLUB-002, SPEC-LIBRARY-002, standalone `/search` 기존 사용자 |

### 하위 SPEC 의존성 (본 SPEC을 소비하는 SPEC — 향후 영향 범위)

| 소비자 SPEC | 소비 포인트 | 본 SPEC 영향 |
|-------------|-------------|--------------|
| (향후) BookDetailScreen CTA SPEC | "이 책으로 모임 만들기" CTA → `/clubs/new?bookId=` | 본 SPEC이 정의한 `bookId` 라우트 파라미터 계약을 준수 |
| (향후) 서재 아이템 CTA SPEC | 서재 아이템 → `/clubs/new?bookId=` | 동일 |

---

## 7. 제약 (Constraints)

### Non-Functional

- **DB 스키마 무변경**: 본 SPEC은 어떤 migration도 추가하지 않는다 (가정 2.1.2). run-phase에서 migration 파일이 생성되면 안 된다.
- **모바일 렌더링 성능**: 서재 선택 목록이 10권 이상이어도 60fps 유지 (가상화 리스트 — `FlatList` 활용).
- **회귀 안전**: standalone `/search`, `ClubCreateScreen`, SPEC-LIBRARY-002 다중 reading 동작이 본 SPEC 변경 후에도 모두 기존 AC를 PASS 해야 한다.

### Memory Lessons 준수 (강제)

본 SPEC은 다음 메모리 교훈을 강제 준수한다 (run-phase에서 검증):

- **#35**: react-query queryKey 접두사 매칭 — 허브가 `useLibrary` 캐시를 오염시키지 않아야 함.
- **#36**: FlatList `contentContainerStyle` flex 함정 — 허브 서재 목록이 스크롤 차단/헤더 0 회귀 없이 렌더링되어야 함.
- **#37**: useState 초기값 race — 허브 진입 시 `bookId` 초기값이 `undefined`로 시작하여 이후 라우트 파라미터로 resolve되는 경우, 폼 진입이 race하지 않아야 함.

### 보안

- 본 SPEC은 RLS 정책을 변경하지 않는다. 호스트 본인의 `user_books`만 조회 (`auth.uid() = user_id` 조건 유지).
- 외부 검색은 기존 Edge Function 인증/검증 체계를 그대로 사용.

### Ownership (D-NEW-1 경로)

- 본 SPEC SPEC-CLUB-004 body 수정은 plan-phase / Mid-run inline-fix 모두 manager-spec 소관.
- run-phase 중 SPEC body 수정 필요 발생 시, manager-develop은 즉시 작업 중지하고 blocker report 반환 → orchestrator가 manager-spec에 재위임.

---

## 8. 검증 가능한 증거 (Verification Evidence Summary)

> 상세 AC는 `acceptance.md`에 SSOT로 존재한다. 본 절은 요약만 제공한다.

- **허브 단일 화면 렌더링**: 서재 섹션 + 외부 검색 섹션이 동일 화면에 공존 — 컴포넌트 테스트 (REQ-CLUB4-001)
- **서재 선택 목록 필터**: `reading`+`shelved` 행 표시, `completed` 행 제외 — 통합 테스트 (REQ-CLUB4-010)
- **서재 책 선택 핸드오프**: 탭 시 `ClubCreateScreen` 진입, 올바른 `bookId` 전달 — 통합 테스트 (REQ-CLUB4-011)
- **외부 검색 핸드오프 (dead-end fix)**: 모임 생성 컨텍스트에서 검색 결과 선택 시 폼 진입 — 통합 테스트 (REQ-CLUB4-020)
- **standalone `/search` 회귀 부재**: 모임 컨텍스트 외부에서 기존 책 상세 이탈 동작 유지 — 회귀 테스트 (REQ-CLUB4-021, REQ-CLUB4-031)
- **빈 서재 fallback**: 0건 상태에서 외부 검색으로 모임 시작 가능 — 컴포넌트 테스트 (REQ-CLUB4-013)
- **SPEC-LIBRARY-002 다중 reading 호환**: N개 `reading` 행 모두 표시 — 회귀 테스트 (REQ-CLUB4-033)
- **DB migration 부재**: `supabase/migrations/`에 본 SPEC ID 명명 신규 파일이 0건 — grep 검증
