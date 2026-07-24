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

# SPEC-CLUB-003 인수 기준 (acceptance.md)

> Given-When-Then 시나리오. 각 REQ 에 매핑. 최소 2개 시나리오 + 엣지 케이스.

---

## REQ-CLUBC-001 (RPC 시그니처)

### AC-001-A: RPC 반환 타입 검증
**Given** host 가 소유한 활성 group 모임이 2개 있고
**When** `get_host_clubs_progress(p_host_id := host.uuid)` 호출하면
**Then** 2행이 반환되며, 각 행은 `(club_id, median_page, member_count_with_progress, total_pages)` 컬럼을 포함한다.

---

## REQ-CLUBC-002 (매개변수 검증)

### AC-002-A: 타인 UUID 호출 → 빈 결과
**Given** host A, host B 가 서로 다른 모임을 가지고
**When** host A 가 `get_host_clubs_progress(p_host_id := B.uuid)` 호출하면
**Then** 빈 결과 집합이 반환된다.

---

## REQ-CLUBC-003 (median 계산, current_page>0)

### AC-003-A: 홀수 멤버 median
**Given** 모임에 current_page>0 멤버 3명(10/20/30p) 이고
**When** RPC 호출하면
**Then** median_page=20, member_count_with_progress=3.

### AC-003-B: 0p 멤버 제외
**Given** 모임에 멤버 3명(0/20/30p) 이고
**When** RPC 호출하면
**Then** median_page=25, member_count_with_progress=2.

### AC-003-C: 진도 입력 멤버 0명
**Given** 모임에 멤버 3명(모두 0p) 이고
**When** RPC 호출하면
**Then** median_page=0, member_count_with_progress=0.

---

## REQ-CLUBC-004 (user_books_public 데이터 소스)

### AC-004-A: is_public=false 멤버 제외
**Given** 모임에 멤버 3명, A(is_public=false, 20p), B(is_public=true, 30p), C(is_public=true, 40p) 이고
**When** RPC 호출하면
**Then** median_page=35, member_count_with_progress=2 (A 제외).

---

## REQ-CLUBC-005 (books.total_pages 조인)

### AC-005-A: total_pages 존재
**Given** 모임의 책 books.total_pages=300 이고
**When** RPC 호출하면
**Then** 반환 total_pages=300.

### AC-005-B: total_pages NULL
**Given** 모임의 책 books.total_pages=NULL 이고
**When** RPC 호출하면
**Then** 반환 total_pages=NULL.

---

## REQ-CLUBC-006 (GRANT)

### AC-006-A: authenticated EXECUTE 권한
**Given** 마이그레이션 적용 후
**When** `authenticated` 역할 사용자가 RPC 호출하면
**Then** 권한 거부 없이 실행된다.

### AC-006-B: anon 권한 없음
**Given** 마이그레이션 적용 후
**When** `anon` 역할이 RPC 호출 시도하면
**Then** 권한 거부된다.

---

## REQ-CLUBC-007 (HostClubWithCount 확장 + 병합)

### AC-007-A: 타입 필드 존재
**Given** useHostClubs 호출하고
**When** 데이터 로드되면
**Then** 각 항목이 `median_page`, `member_count_with_progress`, `progress_total_pages` 필드를 갖는다.

### AC-007-B: 단일 라운드트립 병합
**Given** clubs SELECT 2행 + RPC 2행 이고
**When** useHostClubs 완료되면
**Then** club_id 기준 병합되어 median_page 가 각 모임에 할당된다.

---

## REQ-CLUBC-008 (RPC 실패 degradation)

### AC-008-A: RPC 에러 시 기본값
**Given** clubs SELECT 성공, RPC 500 에러 이고
**When** useHostClubs 완료되면
**Then** 쿼리는 실패하지 않고, 진도 필드가 (0, 0, null) 로 채워지며, clubs 데이터는 정상 표시된다.

---

## REQ-CLUBC-009 (캐시 무효화)

### AC-009-A: useCreateClub 성공 시 host 캐시 무효화
**Given** useCreateClub mutation 이 성공하고
**When** onSuccess 실행되면
**Then** `['club','trackb','host']` 캐시가 무효화되어 다음 조회 시 진도 데이터가 갱신된다.

---

## REQ-CLUBC-010 (진도 텍스트)

### AC-010-A: median>0 텍스트
**Given** ClubCard median_page=100, member_count_with_progress=3 이고
**When** 렌더링되면
**Then** `p.100 · 진도 3명` (또는 동등 문구) 텍스트가 표시된다.

---

## REQ-CLUBC-011 (진도 바, total_pages 존재)

### AC-011-A: 바 폭 비례
**Given** median_page=100, progress_total_pages=300 이고
**When** 렌더링되면
**Then** Fill 폭이 약 33% 로 표시된다.

### AC-011-B: 100% clamp
**Given** median_page=350, progress_total_pages=300 (초과) 이고
**When** 렌더링되면
**Then** Fill 폭이 100% 로 clamp 된다.

---

## REQ-CLUBC-012 (total_pages NULL 시 바 생략)

### AC-012-A: total_pages NULL → 바 없음
**Given** median_page=50, progress_total_pages=null 이고
**When** 렌더링되면
**Then** 진도 바가 렌더링되지 않고 텍스트만 표시된다.

---

## REQ-CLUBC-013 (median 0 시 대체 텍스트)

### AC-013-A: median=0 대체 문구
**Given** median_page=0 이고
**When** 렌더링되면
**Then** `아직 진도가 없어요` (또는 동등 문구) 가 표시되고 바는 표시되지 않는다.

---

## REQ-CLUBC-014 (@MX:TODO 해소)

### AC-014-A: TODO 제거
**Given** 구현 완료 후
**When** `src/features/club/trackB/components/ClubsScreen.tsx` 을 grep 하면
**Then** `@MX:TODO` at line 309 블록이 제거되어 있다.

---

## REQ-CLUBC-015 (SPEC-UI-002 토큰 준수)

### AC-015-A: 하드코딩 없음
**Given** ClubCard 진도 표시 코드하고
**When** 정적 분석하면
**Then** `theme.colors.*`, `theme.radius.*`, `theme.spacing.*`, `typography.*` 토큰만 사용되며 하드코딩 색상/숫자가 없다.

---

## REQ-CLUBC-016 / 017 (비과시 원칙)

### AC-016-A: 개인 진도 미표시
**Given** ClubCard 가 렌더링되고
**When** DOM/트리를 검사하면
**Then** 개별 멤버의 current_page, 멤버 간 순위, "가장 앞선/뒤처진 독자" 정보가 존재하지 않는다.

### AC-016-B: median 집계만 표시
**Given** ClubCard 진도 표시하고
**When** 텍스트를 읽으면
**Then** median 페이지와 진도 입력 멤버 수만 표시되며, "진도 입력률 %" 등 과시 지표가 없다.

---

## 통합 시나리오 (End-to-End)

### AC-E2E-1: host 가 모임 목록에서 진도를 본다
**Given** host 가 3개 모임을 가지고 (각각 다른 진도 상태: 진도 진행 중/진도 미입력/total_pages NULL)
**When** host 가 ClubsScreen 을 열면
**Then** 3개 ClubCard 가 모두 렌더링되고, 각각 진도 텍스트가 올바르게 표시되며, total_pages 가 있는 모임은 바가 표시된다.

### AC-E2E-2: RPC 장애 시에도 목록은 보인다
**Given** get_host_clubs_progress RPC 가 일시적 장애이고
**When** host 가 ClubsScreen 을 열면
**Then** 모임 카드(이름, 멤버 수, 상태)는 정상 표시되고 진도 영역만 기본값(0/대체 텍스트) 으로 표시된다.

---

## 품질 게이트 (Definition of Done)

- [ ] 모든 AC 시나리오 통과 (pgTAP + Vitest + Testing Library)
- [ ] RPC 마이그레이션 dev/prod Supabase 적용
- [ ] gen-types 재생성
- [ ] 커버리지 85%+ (RPC, hook, UI)
- [ ] `npx tsc --noEmit` 통과
- [ ] ESLint 통과
- [ ] `@MX:TODO` at ClubsScreen.tsx:309 제거
- [ ] SPEC-UI-002 토큰만 사용
- [ ] 비과시 원칙 준수 (median 전용)
- [ ] 회귀 검증(실기기 — 기존 ClubsScreen 동작 유지)
