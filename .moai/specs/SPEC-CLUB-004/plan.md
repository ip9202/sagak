# SPEC-CLUB-004 — Plan

> 본 문서는 SPEC-CLUB-004의 구현 계획이다. 요구사항은 `spec.md` SSOT, 검증 기준은 `acceptance.md` SSOT, recon 상세는 `research.md`를 따른다.

## §A Context

### §A.1 현재 상태 (recon 기반)

- **브랜치**: `develop` (HEAD `edfa20b` — SPEC-LIBRARY-002 머지 직후)
- **SPEC 상태**: `status: draft`, plan-phase 진행 중
- **복잡도 Tier**: M (표준 — 3 artifacts + research + progress)
- **scope**: ~5-8 파일 (gate 재설계, 검색 핸드오프 wiring, 서재 쿼리 재사용)
- **새 아키텍처**: 없음 (기존 패턴 재사용)
- **DB migration**: 없음

### §A.2 Recon 핵심 발견 (상세는 research.md)

1. `/clubs/new` 게이트는 unwired dead-end — `bookId` 공급 호출자 0건.
2. `/search` `onSelectBook` → `/[bookId]` 이탈 → 모임 생성 컨텍스트로 복귀 불가.
3. `clubs.book_id` / `user_books.book_id`는 동일 `books.id` 참조 → 서재 선택 시 별도 매핑 불필요.
4. `user_books.status`는 정확히 3값 (`reading`/`completed`/`shelved`) — 다른 상태 없음.
5. `SPEC-LIBRARY-002` 다중 reading 허용 → 본 SPEC 서재 선택 목록에 자연 반영.

### §A.3 plan-auditor verdict

- (plan-phase 종료 시점에 plan-auditor가 산출 — 현재 진행 전)

### §A.4 PRESERVE 목록 (수정 금지 — Brownfield)

- `src/features/club/trackB/components/ClubCreateScreen.tsx` — `bookId` 프롭 소비자. 본 SPEC은 이 파일의 내부 동작을 건드리지 않는다 (REQ-CLUB4-030).
- `src/features/club/trackB/hooks.ts` — `useCreateClub`, `ClubFormInput` 타입. 변경 금지.
- `src/features/club/trackB/clubApi.ts` — `createClub` 호출부. 변경 금지.
- `supabase/migrations/*` — 본 SPEC은 신규 migration을 추가하지 않는다.
- `app/(tabs)/library.tsx` — 서재 탭 자체는 회귀 only.
- `supabase/functions/kakao-book-search/` — 외부 검색 Edge Function. 변경 금지.

### §A.5 EXTEND / MODIFY 목록 (본 SPEC이 수정)

- `app/(tabs)/clubs/new.tsx` — 게이트 재설계 (M1) — 허브 단일 화면으로 전환
- `app/(tabs)/search.tsx` — 모임 생성 컨텍스트 인지 + 핸드오프 분기 (M2) — `onSelectBook` 동작 분기 (standalone vs `/clubs/new` 컨텍스트)
- 신규 컴포넌트 (가칭) `src/features/club/trackB/components/BookSelectionHub.tsx` — 허브 본체 (M1)
- `src/features/library/libraryApi.ts` — `useLibrary({status})` 재사용 (M1, 수정 아닌 소비) — 또는 clubs-scoped 셀렉터 쿼리 추가 검토 (run-phase 결정)

---

## §B Known Issues (자동 주입 — B1~B12 중 도메인 관련)

### B4. Frontmatter Canonical Schema

- 본 SPEC plan-phase 산출물은 `created:`/`updated:`/`tags:` 사용 (snake_case 별칭 금지).
- 참조: `.claude/rules/moai/development/spec-frontmatter-schema.md`

### B5. CI 3-tier Awareness

- spec-lint / eslint / jest 각각 별도 실패 가능. run-phase에서 NEW 결함 vs 기존 baseline 구분 필수.
- 특히 standalone `/search` 회귀 테스트가 기존 테스트를 break하지 않는지 확인.

### B6. spec-lint Heading Convention

- `## Out of Scope` (h2) 단독 사용 금지 — `### Out of Scope — <topic>` (h3) 서브헤딩 필요.
- 본 SPEC spec.md는 7개 `### Out of Scope —` 서브헤딩 사용 중.

### B8. Working Tree Hygiene

- runtime-managed 파일(`.moai/state/`, `.moai/harness/`) 수정 금지.
- unrelated untracked files 커밋 금지 (`git add` 특정 경로만).

### B9. Git Commit + Push (sagak은 Git Flow — Tier M이므로 feature 브랜치 PR)

- **sagak은 글로벌 Git Flow HARD 준수** (사용자 워크스페이스 규칙) — `feature/SPEC-CLUB-004-...` 브랜치 → PR → develop. develop direct push 룰셋 차단됨 (메모리 교훈 #8).
- Conventional Commits: `feat(SPEC-CLUB-004): M{N} <subject>` (한국어 본문 허용 — `git_commit_messages: ko`).
- `--no-verify` 금지.

### B10. Untouched Paths PRESERVE

- §A.4 PRESERVE 목록 엄수. 특히 `ClubCreateScreen.tsx` 내부 동작 건드리지 않음.
- runtime 파일(`.moai/harness/*`, `.moai/state/*`, `.moai/cache/*`) 수정 금지.

### B11. AskUserQuestion Prohibited (Subagent Boundary)

- run-phase manager-develop은 blocker report 반환 — 직접 AskUserQuestion 호출 금지.
- `[NEEDS CLARIFICATION]` 마커 발견 시 즉시 작업 중지, orchestrator에 보고.

### sagak-specific lessons (강제 준수)

- **#35**: react-query queryKey 접두사 매칭 — 허브가 `useLibrary({status:'reading'})` 캐시를 오염시키지 않아야 함.
- **#36**: FlatList `contentContainerStyle` flex 함정 — 허브 서재 목록 스크롤 차단/헤더 0 회귀 없이 렌더링.
- **#37**: useState 초기값 race — `bookId` 라우트 파라미터가 `undefined`로 시작 후 resolve되는 경우 폼 진입 race 주의.

---

## §C Pre-flight Check List

run-phase M1 시작 전 manager-develop이 실행:

```bash
# 1. 현재 브랜치 + baseline
git branch --show-current                    # develop이어야 함 (Git Flow)
git rev-parse HEAD                           # edfa20b 이후이어야 함

# 2. baseline lint/build (NEW vs 기존 결함 구분)
npm run lint 2>&1 | tail -10
npm run build 2>&1 | tail -10   # 있을 경우
npm test 2>&1 | tail -20

# 3. PRESERVE 목록 현황
ls src/features/club/trackB/components/ClubCreateScreen.tsx
ls src/features/club/trackB/hooks.ts
ls supabase/migrations/ | tail -10

# 4. 기존 SPEC 충돌 점검
grep -r "SPEC-CLUB-004" .moai/specs/ || echo "no conflicts"

# 5. clubs/new 호출자 현황 (recon 확인용)
grep -rn "clubs/new" app/ src/ 2>/dev/null
```

---

## §D Constraints

### §D.1 DO NOT VIOLATE (금지)

- **DB migration 추가 금지** — `supabase/migrations/<NEW>-SPEC-CLUB-004-*.sql` 파일 생성 즉시 위반.
- **`ClubCreateScreen.tsx` 내부 동작 변경 금지** — `bookId` 프롭 소비자 관점에서 회귀 부재 요구 (REQ-CLUB4-030).
- **`hooks.ts:72-80` `ClubFormInput.bookId` 타입 변경 금지**.
- **standalone `/search` 동작 변경 금지** — REQ-CLUB4-021 위반.
- **`--no-verify`, `--amend`, force-push 금지**.
- **`amendment_of` 프론트매터 필드 사용 금지** — 본 SPEC은 신규 SPEC (in-place amendment 아님).
- **`.moai/specs/SPEC-{CLUB-001,CLUB-002,CLUB-003,LIBRARY-001,LIBRARY-002,BOOK-001}/` 디렉토리 수정 금지** — 본 SPEC은 선행 SPEC body를 건드리지 않는다.

### §D.2 Required (필수)

- Conventional Commits: `feat(SPEC-CLUB-004): M{N} <subject>` (한국어 본문 허용 — `git_commit_messages: ko`).
- 모든 신규/수정 파일에 TRUST 5 준수 (Tested 85%+, Readable, Unified, Secured, Trackable).
- MX tag: 허브 컴포넌트 공개 함수에 `@MX:NOTE` (context), `bookId` 핸드오프 함수는 fan_in ≥ 3 예상 시 `@MX:ANCHOR`.
- spec-lint clean (모든 12 canonical 프론트매터 필드 + `### Out of Scope —` 서브헤딩 + GEARS notation).

### §D.3 회귀 테스트 의무

- standalone `/search` → `/[bookId]` 이탈 동작 유지 (REQ-CLUB4-021, REQ-CLUB4-031).
- `ClubCreateScreen` `bookId` 주어진 상태에서 폼 정상 렌더링 (REQ-CLUB4-030).
- `clubs.tsx` "모임 만들기" CTA → `/clubs/new` 진입 (REQ-CLUB4-032).
- SPEC-LIBRARY-002 다중 reading N행 표시 (REQ-CLUB4-033).

---

## §E Self-Verification Deliverables

> manager-develop이 run-phase 종료 시 제출. 각 항목은 verification-claim-integrity 5-section format (Claim / Evidence / Baseline-attribution / Gaps / Residual-risk) 준수.

- **E1. AC Binary PASS/FAIL Matrix** — `acceptance.md` SSOT 기준
- **E2. Cross-Platform Build** — iOS/Android (Expo prebuild 통과)
- **E3. Coverage** — 신규/수정 파일 85%+ (jest --coverage)
- **E4. Subagent Boundary grep** — `grep -rn 'AskUserQuestion' src/features/club/trackB/ | grep -v "_test.tsx" | grep -v "^//"` → 0 matches
- **E5. Lint Status** — `npm run lint` clean (NEW vs baseline 구분)
- **E6. Branch HEAD + Push state** — `feature/SPEC-CLUB-004-...` 브랜치 커밋 + push
- **E7. DB migration 부재 검증** — `ls supabase/migrations/*CLUB-004* 2>/dev/null` 0건
- **E8. Blocker Report** (있을 경우) — `[NEEDS CLARIFICATION]` 마커 미해소 시

---

## §F Milestones (reversibility 순서 — UX flow 변경 우선, 기계적 단계 후반)

> Constitution Rule 1 (Approach-First)에 따라 decisions most likely to change를 먼저 배치. 본 SPEC은 DB 스키마 변경이 없으므로 UX flow 변경(허브 재설계, 핸드오프)이 가장 reversibility 위험.

### M1 — 허브 단일 화면 재설계 + 서재 선택 목록 (P0, UX flow 변경)

**Scope**:
- `app/(tabs)/clubs/new.tsx` 재설계 — "책 검색하기" 단일 CTA 제거, 허브 단일 화면으로 전환
- 신규 컴포넌트 `BookSelectionHub.tsx` — 서재 섹션 + 외부 검색 섹션 렌더링
- 서재 쿼리: `useLibrary({userId, status: 'reading'})` + `useLibrary({userId, status: 'shelved'})` 호출 (또는 병합 쿼리) — `libraryApi.ts` 재사용
- 서재 아이템 프레젠테이션: 기존 `LibraryItem` 재사용 (권장) 또는 허브 전용 최소 프레젠테이션
- `completed` 필터: 쿼리 결과에서 `status='completed'` 행 제외 (이미 쿼리 단에서 분기하므로 자연)
- 서재 아이템 탭 → `router.push({ pathname: '/clubs/new', params: { bookId: userBook.book_id } })` (또는 `ClubCreateScreen` 직접 라우트)

**AC binding**: AC-CLUB4-001 (허브 렌더링), AC-CLUB4-010 (reading+shelved 필터), AC-CLUB4-011 (핸드오프), AC-CLUB4-012 (메타데이터), AC-CLUB4-013 (빈 서재 fallback), AC-CLUB4-014 (로딩 상태), AC-CLUB4-033 (다중 reading 호환)

**Files**:
- `app/(tabs)/clubs/new.tsx` (MODIFY, 현재 71행 → 재설계)
- `src/features/club/trackB/components/BookSelectionHub.tsx` (NEW)
- `src/features/library/libraryApi.ts` (소비만 — 수정 가능성 낮음)

**✅ RESOLVED (2026-07-27): M1-1 빈 서재 fallback = "섹션 생략 + 외부 검색 부각"** — 서재(reading+shelved) 0건 시 서재 섹션을 렌더하지 않고 외부 검색 입력을 화면 주요 요소로 부각. (per progress.md § Resolved [NEEDS CLARIFICATION] Markers)

**✅ RESOLVED (2026-07-27): M1-2 `completed` UX = "hidden"** — completed 책은 선택 목록에서 숨김 (쿼리 단에서 status='completed' 제외로 자연 구현). (per progress.md § Resolved Markers)

**✅ RESOLVED (2026-07-27): M1-3 서재 아이템 프레젠테이션 = "기존 `LibraryItem` 재사용"** — 서재 탭과 시각적 일관성 + 구현 최소화. (per progress.md § Resolved Markers)

---

### M2 — 외부 검색 핸드오프 수정 (dead-end fix) (P0, UX flow 변경)

**Scope**:
- `app/(tabs)/search.tsx` 수정 — `onSelectBook` 핸들러가 모임 생성 컨텍스트 인지
- 컨텍스트 전달 방식 — ✅ RESOLVED (2026-07-27, M2-1): **허브 내 인라인 검색 채택 (옵션 B)**. 검색 결과를 허브 화면 내에 인라인 렌더링하며 별도 `/search` 이동 없이 책 선택 완료. 옵션 A(컨텍스트 param)·C(백스택 관리)는 폐기. 단, standalone `/search`(모임 컨텍스트 아닌 일반 진입)는 기존 `/[bookId]` 이탈 동작 유지(REQ-CLUB4-021 회귀 보장). (per progress.md § Resolved Markers)
- 외부 검색 결과 선택 시: `resolveBookId(isbn)` → `books.id` 확보 → `router.push({ pathname: '/clubs/new', params: { bookId } })`
- standalone `/search` (모임 컨텍스트 아님) → 기존 `/[bookId]` 이탈 동작 유지

**AC binding**: AC-CLUB4-020 (모임 컨텍스트 핸드오프), AC-CLUB4-021 (standalone 회귀 부재), AC-CLUB4-022 (허브 내 vs 별도 화면), AC-CLUB4-031 (standalone 회귀)

**Files**:
- `app/(tabs)/search.tsx` (MODIFY, 현재 53행 → 컨텍스트 분기 추가)
- `src/features/book/BookSearchScreen.tsx` (MODIFY 가능성 — `onSelectBook` 콜백 시그니처 확장)
- `src/features/book/searchApi.ts` (소비만)

**✅ RESOLVED (2026-07-27): M2-1 허브 내 검색 vs 별도 화면 = "허브 내 인라인 검색 (옵션 B)"** — REQ-CLUB4-022 구현 방식 확정. 허브 화면 내 인라인 검색 결과 렌더링으로 UX 일관성 확보. (per progress.md § Resolved Markers)

---

### M3 — 빈 상태 + completed UX + polish (P1, 시각적 마무리)

**Scope**:
- M1-1 / M1-2 clarification 결과 반영 — 빈 서재 fallback, completed UX 최종 구현
- 허브 헤더 문구("어떤 책으로 모임을 만들까요?") 유지/수정 결정
- 서재 섹션과 외부 검색 섹션의 시각적 우선순위(둘 다 동등 vs 서재 먼저) — 사용자 요구("읽는중, 보관함에 있는 모든 책을 먼저 선택")에 따라 서재 우선 정렬 권장
- 접근성 — 상태 칩 aria-label, 키보드 네비게이션
- 로딩/에러 상태 분기 (`useLibrary` 로딩 중 스켈레톤)

**AC binding**: AC-CLUB4-013 (빈 서재 fallback), AC-CLUB4-014 (로딩 상태), AC-CLUB4-015 (에러 상태)

**Files**: M1/M2에서 생성된 파일 최종 조율

---

### M4 — 회귀 테스트 + 품질 게이트 (P1, 기계적)

**Scope**:
- 회귀 테스트 작성 — standalone `/search`, `ClubCreateScreen`, SPEC-LIBRARY-002 다중 reading 회귀
- 컴포넌트 테스트 — 허브 렌더링, 서재 목록 필터, 핸드오프 라우팅
- 통합 테스트 — `/clubs/new` 진입 → 책 선택 → 폼 진입 end-to-end
- 커버리지 85%+ (신규/수정 파일)
- MX tag 추가 (hub 공개 함수 `@MX:NOTE`, `bookId` 핸드오프 fan_in ≥ 3 시 `@MX:ANCHOR`)
- spec-lint / eslint / jest 모두 green

**AC binding**: AC-CLUB4-030 (ClubCreateScreen 회귀), AC-CLUB4-031 (standalone search 회귀), AC-CLUB4-032 (clubs.tsx 진입 회귀), AC-CLUB4-033 (다중 reading 호환), AC-CLUB4-040 (DB migration 부재)

**Files**:
- `src/features/club/trackB/components/__tests__/BookSelectionHub.test.tsx` (NEW)
- `app/(tabs)/__tests__/search.test.tsx` (NEW 또는 EXTEND)
- 기존 회귀 테스트 EXTEND

---

## §G Anti-Patterns

- **AP-CLUB4-001 — `ClubCreateScreen` 내부 동작 건드림**: 본 SPEC은 `bookId` 공급자 관점. 폼 검증/제출 로직 수정 금지.
- **AP-CLUB4-002 — DB migration 추가**: FK 호환성 확인됨 — migration 추가는 즉시 revert.
- **AP-CLUB4-003 — standalone `/search` 동작 변경**: 모임 컨텍스트가 아닌 경우 기존 동작 유지 의무 (REQ-CLUB4-021).
- **AP-CLUB4-004 — 외부 검색 결과를 호스트 서재에 자동 INSERT**: 사용자 결정에 의해 명시적 비목표.
- **AP-CLUB4-005 — `BookDetailScreen` CTA 추가**: 사용자 결정 3에 의해 명시적 비목표 (향후 별도 SPEC).
- **AP-CLUB4-006 — 허브를 2-버튼 분기 게이트로 설계**: 사용자 결정 1에 의해 기각됨 — 단일 화면 허브가 채택됨.

---

## §H Cross-References

- `spec.md` SSOT — 요구사항
- `acceptance.md` SSOT — AC
- `research.md` — recon 상세
- `progress.md` — 진행 상황 + §E audit-ready signal
- `.moai/specs/SPEC-CLUB-002/spec.md` — `bookId` FK, `ClubCreateScreen` 소유
- `.moai/specs/SPEC-LIBRARY-001/spec.md` — `user_books.status` 모델, `useLibrary` 인터페이스
- `.moai/specs/SPEC-LIBRARY-002/spec.md` — 다중 reading 허용 (edfa20b)
- `.moai/specs/SPEC-BOOK-001/spec.md` — `books` 카탈로그
- `.claude/rules/moai/development/spec-frontmatter-schema.md` — 12 canonical 필드
- `.claude/rules/moai/development/manager-develop-prompt-template.md` — Tier M/L delegation template
