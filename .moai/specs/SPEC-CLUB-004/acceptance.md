# SPEC-CLUB-004 — Acceptance Criteria

> 본 문서는 SPEC-CLUB-004의 검증 가능한 인수 기준 SSOT다. 모든 AC는 `spec.md`의 REQ와 traceable해야 한다. Given-When-Then 시나리오 + observable evidence + quality gate criteria.

## §A AC Matrix (요약)

| AC ID | REQ binding | Severity | Description |
|-------|-------------|----------|-------------|
| AC-CLUB4-001 | REQ-CLUB4-001 | P0 | 허브 단일 화면에 서재+외부검색 동시 렌더링 |
| AC-CLUB4-002 | REQ-CLUB4-002 | P1 | "책 검색하기" 단일 CTA 제거 |
| AC-CLUB4-010 | REQ-CLUB4-010 | P0 | 서재 목록 reading+shelved 필터 (completed 제외) |
| AC-CLUB4-011 | REQ-CLUB4-011 | P0 | 서재 책 탭 → ClubCreateScreen bookId 핸드오프 |
| AC-CLUB4-012 | REQ-CLUB4-012 | P1 | 서재 아이템 메타데이터(표지/제목/저자/상태칩/진도율) |
| AC-CLUB4-013 | REQ-CLUB4-013 | P1 | 빈 서재(0건) fallback — 외부 검색 부각 |
| AC-CLUB4-014 | (파생) | P2 | useLibrary 로딩 중 스켈레톤/스피너 분기 |
| AC-CLUB4-015 | (파생) | P2 | useLibrary 에러 상태 분기 |
| AC-CLUB4-020 | REQ-CLUB4-020 | P0 | 모임 컨텍스트 외부 검색 결과 → ClubCreateScreen 핸드오프 (dead-end fix) |
| AC-CLUB4-021 | REQ-CLUB4-021 | P0 | standalone /search → /[bookId] 이탈 동작 유지 (회귀 부재) |
| AC-CLUB4-022 | REQ-CLUB4-022 | P1 | 허브 내 검색 vs 별도 화면 — 어느 쪽이든 핸드오프 계약 준수 |
| AC-CLUB4-030 | REQ-CLUB4-030 | P0 | 기존 ClubCreateScreen bookId 호환 (회귀 부재) |
| AC-CLUB4-031 | REQ-CLUB4-031 | P0 | standalone /search 회귀 부재 (AC-021과 쌍) |
| AC-CLUB4-032 | REQ-CLUB4-032 | P1 | clubs.tsx "모임 만들기" → /clubs/new 진입 유지 |
| AC-CLUB4-033 | REQ-CLUB4-033 | P0 | SPEC-LIBRARY-002 다중 reading N행 표시 |
| AC-CLUB4-040 | (파생) | P0 | DB migration 부재 (grep / glob 검증) |

> 총 16 AC — P0=8, P1=5, P2=2, 파생=1.

---

## §B Detailed Scenarios (Given-When-Then)

### AC-CLUB4-001: 허브 단일 화면 렌더링

**Scenario**: 인증된 사용자가 `/clubs/new`에 진입한다 (bookId 라우트 파라미터 없음).

**Given**: 사용자가 인증되어 있고, 라우트 파라미터 `bookId`가 없다.
**When**: 사용자가 `/clubs/new` 경로로 진입한다.
**Then**:
- 단일 허브 화면이 렌더링된다.
- 허브는 (a) 서재 섹션 — 호스트 본인 `user_books`의 `reading`/`shelved` 책 목록, (b) 외부 검색 섹션 — Kakao 도서 검색 입력을 **동일 화면에** 포함한다.
- 두 섹션은 계단식 게이트가 아니라 동등하게 접근 가능하다.

**Evidence**: 컴포넌트 테스트 (`BookSelectionHub.test.tsx`) — 렌더링된 두 섹션 존재 assertion.

---

### AC-CLUB4-002: 게이트 CTA 재설계

**Scenario**: 기존 "책 검색하기" 단일 CTA가 제거된다.

**Given**: 본 SPEC 변경 적용 후.
**When**: `/clubs/new` 허브를 렌더링한다.
**Then**: 기존 "책 검색하기" 단일 CTA(`app/(tabs)/clubs/new.tsx` 48-67행 현재 구현)가 화면에 존재하지 않는다. 책 선택은 서재 아이템 탭 또는 외부 검색 결과 선택으로만 이루어진다.

**Evidence**: grep — 기존 CTA 텍스트/로직이 컴포넌트에서 제거됨.

---

### AC-CLUB4-010: 서재 목록 reading+shelved 필터

**Scenario**: 호스트의 서재에서 `reading`/`shelved` 책만 선택 목록에 표시되고, `completed` 책은 제외된다.

**Given**: 호스트가 다음 4종의 `user_books` 행을 보유한다:
- bookA: `status='reading'`
- bookB: `status='shelved'`
- bookC: `status='completed'`
- bookD: `status='reading'` (다중 reading — SPEC-LIBRARY-002)

**When**: 사용자가 `/clubs/new` 허브에 진입한다.
**Then**:
- 서재 섹션에 bookA, bookB, bookD가 표시된다 (3개).
- bookC(`completed`)는 서재 섹션에 표시되지 않는다 (hidden — 권장 기본값, M1-2 clarification).

**Evidence**: 통합 테스트 — `completed` 행이 쿼리 결과에 포함되지 않음을 assertion. (`libraryApi.getLibrary`가 `status='completed'`로 호출되지 않는지 검증 + UI에서 `completed` 행이 렌더링되지 않음.)

---

### AC-CLUB4-011: 서재 책 탭 → ClubCreateScreen 핸드오프

**Scenario**: 호스트가 서재 섹션의 한 책을 탭하면 모임 생성 폼으로 진입한다.

**Given**: 허브 서재 섹션에 bookA(`status='reading'`, `user_books.book_id=42`)가 표시되어 있다.
**When**: 사용자가 bookA 아이템을 탭한다.
**Then**: 클라이언트가 `router.push({ pathname: '/clubs/new', params: { bookId: '42' } })` (또는 동등한 `ClubCreateScreen` 라우트)를 호출한다. `ClubCreateScreen`이 `bookId='42'`를 수신하여 폼을 렌더링한다.

**Evidence**: 통합 테스트 — 탭 액션 후 라우트 파라미터 검증 + `ClubCreateScreen` 마운트 확인.

---

### AC-CLUB4-012: 서재 아이템 메타데이터 표시

**Scenario**: 서재 아이템이 표지/제목/저자/상태칩/진도율을 표시한다.

**Given**: bookA의 `user_books.book_id=42`, `books.title='코스모스'`, `books.author='칼 세이건'`, `books.cover_image='https://...'`, `status='reading'`, `current_page=50`, `total_pages=200`.
**When**: 허브 서재 섹션이 렌더링된다.
**Then**: bookA 아이템에 다음이 표시된다: 표지 이미지, "코스모스", "칼 세이건", "읽는중" 상태 칩, 진도율 25% (또는 `progressRate` 계산 결과).

**Evidence**: 컴포넌트 테스트 — 메타데이터 텍스트/이미지 존재 assertion.

---

### AC-CLUB4-013: 빈 서재 fallback

**Scenario**: 호스트의 `reading`/`shelved` 책이 0건인 경우 외부 검색이 부각된다.

**Given**: 호스트의 `user_books`에 `status IN ('reading','shelved')`인 행이 0건이다. `status='completed'` 행 2건만 존재한다.
**When**: 사용자가 `/clubs/new` 허브에 진입한다.
**Then**:
- 서재 섹션이 접힘/생략되거나 빈 상태로 표시된다 (M1-1 clarification 결과).
- 외부 검색 섹션이 1차 선택지로 부각된다 (시각적 강조).
- 모임 생성 플로우가 차단되지 않는다 — 사용자는 외부 검색으로 책을 선택할 수 있다.

**Evidence**: 컴포넌트 테스트 — 0건 `reading`/`shelved` fixture에서 외부 검색 섹션 활성 상태 assertion.

---

### AC-CLUB4-014: useLibrary 로딩 상태 분기

**Scenario**: `useLibrary` 로딩 중에 스켈레톤/스피너가 표시된다.

**Given**: 허브 진입 직후, `useLibrary({status:'reading'})` 쿼리가 `isLoading === true`.
**When**: 로딩이 완료되기 전 화면이 렌더링된다.
**Then**: 로딩 스켈레톤/스피너가 서재 섹션에 표시된다. 빈 상태(0건) UI는 로딩 중에 렌더링되지 않는다 (메모리 교훈 #37 — useState 초기값 race 회피).

**Evidence**: 컴포넌트 테스트 — `isLoading=true` fixture에서 스켈레톤 assertion.

---

### AC-CLUB4-015: useLibrary 에러 상태 분기

**Scenario**: `useLibrary` 쿼리 실패 시 에러 상태가 표시된다.

**Given**: `useLibrary({status:'reading'})` 쿼리가 `isError === true` (예: 서버 5xx 또는 RLS 거부).
**When**: 에러 상태 화면이 렌더링된다.
**Then**: 서재 섹션에 에러 메시지가 표시된다. 외부 검색 섹션은 여전히 접근 가능해야 한다 (한쪽 실패가 다른쪽을 차단하지 않음).

**Evidence**: 컴포넌트 테스트 — `isError=true` fixture에서 에러 메시지 + 외부 검색 섹션 활성 상태 assertion.

---

### AC-CLUB4-020: 모임 컨텍스트 외부 검색 핸드오프 (dead-end fix)

**Scenario**: 모임 생성 컨텍스트에서 외부 검색 결과를 선택하면 모임 생성 폼으로 진입한다 (현재 dead-end 수정).

**Given**: 사용자가 `/clubs/new` 허브에서 외부 검색 입력에 도달했다. 검색 결과로 ISBN `9781234567890`의 책이 표시된다. (기존 동작: `onSelectBook` → `/[bookId]` 책 상세 이탈.)
**When**: 사용자가 검색 결과를 탭한다.
**Then**:
- 클라이언트가 `resolveBookId('9781234567890')` → `books.id=99` 확보 (캐시 또는 신규 INSERT).
- 클라이언트가 `router.push({ pathname: '/clubs/new', params: { bookId: '99' } })` (또는 동등한 `ClubCreateScreen` 라우트) 호출.
- `ClubCreateScreen`이 `bookId='99'`로 폼을 렌더링.
- `/[bookId]` 책 상세 화면으로 이탈하지 **않는다** (dead-end fix 검증).

**Evidence**: 통합 테스트 — `/clubs/new` 컨텍스트에서의 `onSelectBook` 핸드오프 경로 검증.

---

### AC-CLUB4-021: standalone /search 회귀 부재

**Scenario**: 모임 컨텍스트가 아닌 standalone `/search` 진입 시 기존 동작이 유지된다.

**Given**: 사용자가 탭 내 일반 검색으로 `/search`에 진입한다 (모임 생성 컨텍스트 아님).
**When**: 사용자가 검색 결과를 탭한다.
**Then**: 기존 동작대로 `onSelectBook` → `/[bookId]` 책 상세 화면으로 이동한다 (회귀 부재).

**Evidence**: 기존 `/search` 통합 테스트 green 유지 — 본 SPEC 변경 후에도 동일 테스트 PASS.

---

### AC-CLUB4-022: 허브 내 검색 vs 별도 화면 — 핸드오프 계약 준수

**Scenario**: 구현 방식(인라인 vs 별도 화면)에 상관없이 `bookId` 핸드오프 계약이 준수된다.

**Given**: M2-1 clarification으로 허브 내 인라인 검색(옵션 A) 또는 별도 `/search` 화면 + 컨텍스트 파라미터(옵션 B)가 선택되었다.
**When**: 어느 쪽이든 사용자가 검색 결과를 선택한다.
**Then**: AC-CLUB4-020과 동일한 `bookId` 핸드오프 계약이 준수된다 — `ClubCreateScreen`이 `bookId=<books.id>`로 진입한다.

**Evidence**: 통합 테스트 — 양쪽 경로 모두 (또는 선택된 경로) `bookId` 핸드오프 검증.

---

### AC-CLUB4-030: 기존 ClubCreateScreen bookId 호환 (회귀 부재)

**Scenario**: 본 SPEC 변경 후에도 `bookId`가 주어진 상태에서 `ClubCreateScreen`이 기존대로 동작한다.

**Given**: 본 SPEC 변경 적용 후.
**When**: `ClubCreateScreen`이 `bookId=<유효한 books.id>` 프롭으로 마운트된다.
**Then**: SPEC-CLUB-002 REQ-CLUBB-001~005가 회귀 없이 동작한다 — 폼 필드(모임명/설명/진도계획) 렌더링, `useCreateClub().mutate` 정상 호출.

**Evidence**: 기존 `ClubCreateScreen` 테스트 green 유지.

---

### AC-CLUB4-031: standalone /search 회귀 부재 (AC-CLUB4-021과 쌍)

> AC-CLUB4-021과 동일 시나리오의 회귀 gate. 본 AC는 run-phase M4 회귀 테스트 묶음에서 실행된다. AC-021이 "기능적 동작 유지"라면, AC-031은 "회귀 테스트 묶음 관점에서 green 유지"를 명시.

---

### AC-CLUB4-032: clubs.tsx "모임 만들기" 진입 회귀 부재

**Scenario**: `clubs` 탭의 "모임 만들기" CTA가 `/clubs/new` 허브로 정상 진입한다.

**Given**: 본 SPEC 변경 적용 후.
**When**: 사용자가 `app/(tabs)/clubs.tsx`의 "모임 만들기" CTA를 탭한다.
**Then**: 클라이언트가 `router.push('/clubs/new')` 호출, 허브가 정상 렌더링된다.

**Evidence**: 통합 테스트 — `clubs.tsx` CTA 탭 후 `/clubs/new` 라우팅 확인.

---

### AC-CLUB4-033: SPEC-LIBRARY-002 다중 reading 호환

**Scenario**: 호스트가 N개의 서로 다른 `status='reading'` 책을 보유한 상태에서 허브 서재 섹션이 모두 표시한다.

**Given**: SPEC-LIBRARY-002 edfa20b 적용 상태. 호스트가 bookA, bookD, bookE 3개의 `status='reading'` 행을 보유한다 (서로 다른 `book_id`).
**When**: 사용자가 `/clubs/new` 허브에 진입한다.
**Then**: 서재 섹션에 3개의 `reading` 행이 모두 표시된다 (다중 reading 회귀 부재). 각각 독립적으로 선택 가능하다.

**Evidence**: 통합 테스트 — 3개 `reading` fixture에서 3개 아이템 렌더링 assertion. (`enforce_single_reading` 철회 이후 자연 동작.)

---

### AC-CLUB4-040: DB migration 부재 (무결성 검증)

**Scenario**: 본 SPEC은 어떤 DB migration도 추가하지 않는다.

**Given**: 본 SPEC run-phase 완료 후.
**When**: `supabase/migrations/` 디렉토리를 검사한다.
**Then**: 본 SPEC ID(`SPEC-CLUB-004` 또는 `CLUB-004`)를 이름에 포함하는 신규 migration 파일이 0건이다.

**Evidence**: `glob supabase/migrations/*CLUB-004*` → 0 matches (또는 `ls supabase/migrations/*CLUB-004* 2>/dev/null | wc -l` → 0).

---

## §C Edge Cases

- **E1 — 사용자가 비인증 상태**: 허브 진입 시 인증 게이트(SPEC-AUTH-001)가 먼저 동작. 본 SPEC은 인증된 사용자만 다룬다.
- **E2 — `useLibrary` 쿼리 에러**: 서버 응답 5xx 또는 RLS 거부 시 에러 상태 분기 (AC-CLUB4-015).
- **E3 — 외부 검색 네트워크 실패**: Kakao Edge Function 응답 실패 시 에러 메시지 표시 (기존 `searchApi` 에러 처리 준수).
- **E4 — ISBN이 캐시에 없는 신규 도서**: `resolveBookId`가 `books` INSERT 수행 후 `books.id` 반환 (SPEC-BOOK-001 기존 동작).
- **E5 — 동시 다중 탭**: 허브 서재 아이템 탭 + 외부 검색 결과 탭이 동시에 발생할 수 없음 (단일 탭 UI). 다중 탭 시도 시 마지막 탭이 승리.
- **E6 — 호스트가 라우트 파라미터를 직접 조작**: 사용자가 URL에 `?bookId=<존재하지 않는 id>`를 직접 입력한 경우, `ClubCreateScreen`이 기존 에러 처리(SPEC-CLUB-002)로 대응. 본 SPEC은 추가 검증을 도입하지 않는다.

---

## §D Quality Gate Criteria

### §D.1 TRUST 5 준수

- **Tested**: 신규/수정 파일 커버리지 85%+ (jest --coverage). 회귀 테스트 green.
- **Readable**: 한국어 주석 (`code_comments: ko`), 명확한 명명, 기존 `LibraryItem`/`BookSearchScreen` 패턴 준수.
- **Unified**: prettier/eslint 통과. 기존 파일 컨벤션 준수.
- **Secured**: RLS 정책 변경 없음, 외부 검색 입력 검증 (기존 `searchApi` 준수), `books.id` FK 무결성 (DB 제약 위임).
- **Trackable**: Conventional Commits (`feat(SPEC-CLUB-004): M{N} ...`), MX tag (`@MX:NOTE`/`@MX:ANCHOR`).

### §D.2 SPEC 품질

- spec-lint clean (12 canonical frontmatter + GEARS notation + `### Out of Scope —` 서브헤딩).
- 모든 AC가 observable evidence와 함께 verification-claim-integrity 5-section format 준수.
- 모든 `[NEEDS CLARIFICATION]` 마커가 Implementation Kickoff Approval 전 해소.

### §D.3 회귀 안전

- standalone `/search`, `ClubCreateScreen`, `clubs.tsx`, SPEC-LIBRARY-002 다중 reading — 모든 기존 AC green 유지.

---

## §E Test Strategy Note

### 단위 테스트 (jest)

- 허브 컴포넌트 렌더링 (서재 섹션 + 외부 검색 섹션)
- 서재 목록 필터 로직 (status IN ('reading','shelved'))
- 핸드오프 라우트 파라미터 계약 (`bookId` 전달)
- 로딩/에러/빈 상태 분기

### 통합 테스트

- `/clubs/new` 진입 → 서재 책 탭 → `ClubCreateScreen` 진입 end-to-end
- `/clubs/new` 진입 → 외부 검색 → 결과 선택 → `ClubCreateScreen` 진입 end-to-end
- standalone `/search` 진입 → 결과 선택 → `/[bookId]` 이탈 (회귀)

### 회귀 테스트

- 기존 `ClubCreateScreen` 테스트 (SPEC-CLUB-002) green 유지
- 기존 `/search` standalone 테스트 green 유지
- SPEC-LIBRARY-002 다중 reading 회귀 테스트 (있을 경우) green 유지

### DB 테스트 (pgTAP)

- 본 SPEC은 DB migration을 추가하지 않으므로 **pgTAP 신규 테스트 불필요**.
- AC-CLUB4-040 (migration 부재)은 glob/grep 검증으로 충분.

### 실기기 검증 (메모리 교훈 #19 — "실기기 검증" 라벨)

- 허브 진입 → 서재 책 탭 → 폼 진입 플로우 (iOS/Android)
- 외부 검색 → 결과 선택 → 폼 진입 플로우 (iOS/Android)
- 빈 서재 fallback 시나리오

---

## §F Definition of Done

- [ ] 모든 P0 AC (8건) PASS
- [ ] 모든 P1 AC (5건) PASS
- [ ] P2 AC (2건) PASS 또는 명시적 defer (사유 기록)
- [ ] TRUST 5 5개 항목 모두 green
- [ ] 커버리지 85%+ (신규/수정 파일)
- [ ] 회귀 테스트 4종 (standalone search, ClubCreateScreen, clubs.tsx, 다중 reading) 모두 green
- [ ] DB migration 신규 파일 0건 (AC-CLUB4-040)
- [ ] MX tag 추가 (`@MX:NOTE`/`@MX:ANCHOR`)
- [ ] spec-lint / eslint / jest 모두 green
- [ ] Git Flow: `feature/SPEC-CLUB-004-...` 브랜치 → PR → develop (develop direct push 룰셋 차단)
- [ ] 모든 `[NEEDS CLARIFICATION]` 마커 해소 (M1-1, M1-2, M1-3, M2-1)
