# SPEC-CLUB-004 — Research (Codebase Reconnaissance)

> 본 문서는 plan-phase 정찰(Explore read-only subagent) 결과를 통합한 research 산출물이다.
> run-phase는 본 문서를 신뢰하고 재조사하지 않는다. 모든 발견은 `file:line` 기반으로 검증 가능하다.
> 작성일: 2026-07-27. 정찰 출처: Explore agent + orchestrator QA 검수.

## 0. TL;DR

모임 생성(`/clubs/new`)의 "책 선택 → 폼" 핸드오프가 **현재 연결되어 있지 않다(dead-end)**. 외부 Kakao 검색 결과 선택 시 책 상세 화면으로 이탈하며, 어떤 호출자도 `bookId`를 공급하지 않는다. 내 서재(library)에서 책을 선택하는 경로는 전무하다. 본 SPEC은 (1) 게이트를 통합 선택 허브로 재설계, (2) 외부 검색 핸드오프를 모임 생성 폼으로 복귀시키는(dead-end fix) 것을 다룬다. DB 스키마 변경은 없다 — `clubs.book_id`와 `user_books.book_id`가 동일한 전역 `books.id`를 참조하므로 서재 책 선택이 자연 호환된다.

---

## 1. 모임 생성 flow + 현재 책 선택 (UNWIRED dead-end)

### 진입점 (단일)
- Clubs 탭 → `router.push('/clubs/new')` (bookId **없음**): `app/(tabs)/clubs.tsx:21`
- 두 CTA: 헤더 `Plus` 아이콘 (`src/features/club/trackB/components/ClubsScreen.tsx:88-97`, `accessibilityLabel="새 모임 만들기"`), 빈 상태 `NewClubCTA` (`ClubsScreen.tsx:194-213`, `"새 모임 만들기 (0명도 OK)"`).

### 게이트 화면 (bookId 없을 때)
- `app/(tabs)/clubs/new.tsx:23-71`: 제목 `"어떤 책으로 모임을 만들까요?"`, 단일 CTA `"책 검색하기"` → `router.push('/search')` (`clubs/new.tsx:48-67`).
- 라우트는 bookId를 기대(`clubs/new.tsx:6` 주석, `:20`)하지만 **공급 호출자가 0건**이다 (repo-wide grep `clubs/new?` → 0 hits).

### 외부 검색 (Kakao API 전용)
- `src/features/book/BookSearchScreen.tsx` → `searchBooks()` (`searchApi.ts`) → `kakao-book-search` Edge Function (`supabase/functions/kakao-book-search/`).
- `app/(tabs)/search.tsx:34-53`: `onSelectBook` → `resolveBookId(isbn)` → `router.push(`/${id}`)` (책 상세). **`/clubs/new?bookId=...`로 복귀하지 않는다.**

### 책 상세 화면
- `src/features/book/BookDetailScreen.tsx`: 모임 생성 CTA **없음**. 버튼은 "서재에 추가" (`:400`), 상태 칩, "같이 읽는 독자 보기" → `/readers` (`:562-583`, Track A), "삭제" (`:586`).

### 모임 생성 폼 (bookId 있을 때 동작)
- `src/features/club/trackB/components/ClubCreateScreen.tsx:52`. 필드: 모임 이름(필수 `:167`), 설명(선택 `:194`), 진도 계획(선택 `:223-280`).
- submit `handleSubmit:71` → `useCreateClub().mutate` (`hooks.ts:222`) → 3-step: `createClub` → `verifyHostMembership` → optional `updateProgress` (`hooks.ts:238-261`).
- `ClubFormInput` (`hooks.ts:72-80`): `bookId: string` (a `books.id`).

### 핵심 결론
책 선택 컴포넌트(전용 book-picker)는 **존재하지 않는다**. 현재 선택 surface는 `BookSearchScreen`(범용 외부 검색)이며 club-aware 하지 않다. 본 SPEC이 이 갭을 채운다.

---

## 2. `user_books` 상태 모델 — 정확히 3값

### 스키마
- `supabase/migrations/20240614000003_create_user_books.sql:7-21`:
  `status text NOT NULL DEFAULT 'reading' CHECK (status IN ('reading', 'completed', 'shelved'))`.
- 기본값은 이후 `'shelved'`로 변경 (`20240630000001_enforce_single_reading_policy.sql:57-58`), 정책 철회 후에도 `'shelved'` 유지 (`20260727000001_drop_enforce_single_reading.sql:17-19`).
- `UNIQUE (user_id, book_id)` (`:20`).

### TS 타입
- `src/features/library/types.ts:12`: `export type ReadingStatus = 'reading' | 'completed' | 'shelved';` ("DB text column, app narrows to 3 literals" 주석 `:9`).
- `LibraryItem`은 `UserBookRow` 확장 + joined `books` (`:27`).

### 한국어 라벨 매핑 (두 소스 일치)
| status | 한국어 | 소스 |
|--------|--------|------|
| `reading` | 읽는중 | `app/(tabs)/library.tsx:47`, `BookDetailScreen.tsx:96` |
| `completed` | 완독 | `app/(tabs)/library.tsx:47`, `BookDetailScreen.tsx:98` |
| `shelved` | 보관함 | `app/(tabs)/library.tsx:48`, `BookDetailScreen.tsx:100` |

`paused` / `want_to_read` / `dropped` 값은 **존재하지 않는다**. `addBook` 기본값 `'shelved'` (`libraryApi.ts:57`, `types.ts:42-46`).

### "보관함"의 정확한 의미
"보관함"은 독립 화면이 **아니다**. 서재(Library) 탭의 필터 중 하나일 뿐 (`app/(tabs)/library.tsx`). 서재 탭 필터 4개: `전체 / 읽는중 / 완독 / 보관함` (`library.tsx:44-49`). 보관함 선택 = `status='shelved'` + `useLibrary({userId, status:'shelved'})` (`library.tsx:58-60`) → `getLibrary`의 `.eq('status','shelved')` (`libraryApi.ts:87-89`).

→ 본 SPEC에서 사용자가 말한 "읽고 있는 책" = `reading`, "보관함에 있는 책" = `shelved`, "완독" = `completed`.

---

## 3. 다중 reading (SPEC-LIBRARY-002) 영향 — 없음

### 구조
- 별도 `readings` / `reading_records` 테이블은 **없다**. `user_books` 행 자체가 독서 기록이다.
- 인접 테이블 `reading_sessions` (`20240614000009_create_reading_sessions.sql:7-15`)는 타이머 세션 로그(`user_id`, `book_id`, `duration_seconds`, `pages_read`)이며 다중 reading 메커니즘과 무관 — `books(id)`를 참조하고 `user_books(id)`가 아니다.

### 관계
- 한 (user, book)당 `user_books` 1행. `UNIQUE (user_id, book_id)` 유지 (`20260727000001_drop_enforce_single_reading.sql:22` 주석: "복합 제약은 유지").
- `enforce_single_reading` 완전 제거됨 (가장 최근 migration `20260727000001_drop_enforce_single_reading.sql`, commit `edfa20b`):
  - `DROP TRIGGER IF EXISTS enforce_single_reading` (`:36`)
  - `DROP FUNCTION IF EXISTS public.enforce_single_reading()` (`:42`)
  - `DROP INDEX IF EXISTS public.user_books_one_reading_per_user` (`:50`) — 과거 partial unique index `ON user_books (user_id) WHERE status = 'reading'` (`20240630000001:48-50`).
  - 신규 non-unique index `idx_user_books_user_status ON user_books (user_id, status)` 추가 (`:60-61`).

### 클라이언트 API
- `src/features/library/libraryApi.ts:11-14`, `:39-43`: "과거 enforce_single_reading 트리거가 한 사용자 reading 행을 1개로 제한했으나, 본 정책은 SPEC-LIBRARY-002 M1 migration으로 철회되었다. 이제 한 사용자가 0/1/N개의 status='reading' 행을 보유할 수 있다." `addBook`은 reading-singlelet을 강제하지 않는다 (`libraryApi.ts:48-69`).

### 본 SPEC에 대한 함의
- **영향 없음**. 책 선택은 단순 status 필터다. 한 사용자가 여러 책을 `status='reading'`으로 보유(병행 독서)하면 그 모두가 허브의 "읽는중" 목록에 표시되는 것이 자연스럽다. 구조적 변경 불필요.

---

## 4. Club ↔ Book 관계 — 서재 선택이 자연 호환

### FK
- `supabase/migrations/20240614000004_create_clubs.sql:11`: `book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE RESTRICT`.
- 모임 생성 payload `src/features/club/trackB/clubApi.ts:76-81`: `book_id: input.bookId` (a `books.id`)를 `clubs`에 직접 INSERT. `user_books` 참조 없음.
- `user_books.book_id`도 **동일** 전역 `books.id`를 참조.

### `books` 테이블 (전역 카탈로그)
- `supabase/migrations/20240614000002_create_books.sql:7-18`: `id`, `isbn (UNIQUE)`, `title`, `author`, `publisher`, `published_at`, `cover_url`, `total_pages`, `kakao_id`, `created_at`.
- 주석: "Book catalog - cache of Kakao Book Search API results plus manual entries".
- RLS: authenticated SELECT all, INSERT service_role only (SPEC-BOOK-001).

### 핵심 함의
`clubs.book_id`와 `user_books.book_id`가 같은 `books.id`를 참조한다. 서재에서 책을 고르면 그 `user_books.book_id` (a `books.id`)를 `clubs.book_id`에 그대로 공급할 수 있다. **FK 충돌 없음, 별도 조인 테이블/마이그레이션 불필요**.

### 진도 집계 연관 (참고)
- `get_host_clubs_progress` RPC (`20240627000001_create_get_host_clubs_progress_rpc.sql:62`): `user_books_public`(RLS 보안 뷰, `20240614000014_enable_rls.sql:88-102`, status 노출 확장 `20240701000001`)을 `book_id`로 LEFT JOIN하여 클럽별 중위 페이지 산출. 공유 `books.id`로 키잉.

---

## 5. 기존 SPEC 맵

모든 SPEC은 `.moai/specs/` 하위.

### SPEC-CLUB-*
- **SPEC-CLUB-001** — "Track A — 합류형 요청 (비동기 연결)" (`completed`). 합류 요청 상태머신, 독자 목록, 호스트 수락/거절, DB 트리거 자동 멤버 추가. library 가시성을 간접 소비(`user_books_public` 읽기). **책 선택 미접촉**.
- **SPEC-CLUB-002** — "Track B 개설형 모임 관리" (`completed`). **모임 생성 SPEC**. `ClubCreateScreen`, `createClub`, `handle_new_club_host` 트리거, 0명-출발 정책, 진도 컬럼 소유. `bookId`가 라우트 param으로 온다고 가정하지만 **picker surface를 명시하지 않는다** → 본 SPEC(004)이 채우는 갭. SPEC-CLUB-004는 `depends_on: [SPEC-CLUB-002]`.
- **SPEC-CLUB-003** — "모임 진도 집계 표시" (`completed`). Postgres RPC `get_host_clubs_progress` 중위 집계, `ClubsScreen` ClubCard 진도 표시, `user_books_public` RLS. **책 선택 미접촉**.

### SPEC-LIBRARY-*
- **SPEC-LIBRARY-001** — "Personal Library Management" (`completed`, `partially_superseded_by: [SPEC-LIBRARY-002]`). 기반 library SPEC: `user_books` CRUD, 진도 추적, ReadingStatus enum, 가시성 토글. 3값 `reading|completed|shelved` 모델 소유. 정책 5.5(reading 단일)은 `(RESCINDED by SPEC-LIBRARY-002)` in-place amendment. SPEC-CLUB-004는 `depends_on: [SPEC-LIBRARY-001]`.
- **SPEC-LIBRARY-002** — "Parallel Reading Support (다중 독서 병행)" (`completed`, 2026-07-27, 최신 — commit `edfa20b`). `enforce_single_reading` 제거, 메인 다중 표시, 상태 전환 정리, 공개 가시성 검토. SPEC-LIBRARY-001 후속 amendment.

### 기타
- **SPEC-BOOK-001** — 도서 카탈로그. `books` 테이블, Kakao 캐시. `related_specs`.

### 갭 확인
**"모임 생성 시 사용자 본인 서재에서 책 선택"을 다루는 기존 SPEC은 없다.** SPEC-CLUB-002가 모임 생성을 정의하지만 `bookId` param 경계에서 멈추며, picker surface 자체가 미소유다.

---

## 6. 정량 검증 근거 (verification-claim-integrity 준수)

본 research의 핵심 주장은 모두 위 `file:line` 참조로 검증 가능하다. 재현 명령:

```bash
# (a) clubs/new? 호출자 0건 (dead-end 주장)
grep -rn "clubs/new?" app/ src/ 2>/dev/null   # 예상: app/(tabs)/clubs/new.tsx:6 주석만

# (b) user_books status CHECK 제약 (3값 주장)
grep -n "status IN" supabase/migrations/20240614000003_create_user_books.sql

# (c) clubs.book_id FK
grep -n "book_id uuid" supabase/migrations/20240614000004_create_clubs.sql

# (d) ReadingStatus TS 타입
grep -n "ReadingStatus" src/features/library/types.ts

# (e) enforce_single_reading 제거
grep -n "DROP TRIGGER\|DROP FUNCTION\|DROP INDEX" supabase/migrations/20260727000001_drop_enforce_single_reading.sql
```

---

## 7. 산출 메모

- 본 research.md는 plan-phase 정찰 결과 통합이다. manager-spec 에이전트가 429(5시간 사용량 한도)로 산출 도중 중단되어, 핵심 3종(spec/plan/acceptance)은 manager-spec이, 보조 2종(research/progress)은 orchestrator가 예외적으로 직접 작성했다 (§4 "no specialist exists" 예외). 핵심 3종의 품질은 QA 검수 완료(frontmatter 12필드 + tier M, frozen 결정 4종 반영 확인).
