# SPEC-CLUB-003 TDD 작업 분해 (tasks.md)

> TDD RED-GREEN-REFACTOR 사이클 기반 작업 분해. 각 단계는 독립 커밋 단위.

---

## Phase 1 — DB/RPC 레이어 (M1)

### RED-1.1: pgTAP median 정확성 테스트
- 홀수 멤버(3명, pages 10/20/30) → median 20
- 짝수 멤버(4명, pages 10/20/30/40) → median 25 (percentile_cont(0.5) 보간)
- 단일 멤버(1명, page 50) → median 50

### RED-1.2: pgTAP current_page > 0 필터 테스트
- 멤버 3명(0/20/30) → median 25 (0p 제외), member_count_with_progress=2

### RED-1.3: pgTAP is_public=false 제외 테스트
- 멤버 3명, 1명 is_public=false(20p), 2명 is_public=true(30p/40p)
- median 35, member_count_with_progress=2

### RED-1.4: pgTAP host_id 필터 테스트
- host A 모임 2개, host B 모임 1개
- get_host_clubs_progress(A) → 2행, (B) → 1행

### RED-1.5: pgTAP type/status 필터 테스트
- type='instant' 모임 제외
- status='closed' 모임 제외

### RED-1.6: pgTAP total_pages NULL 테스트
- books.total_pages NULL → 반환 total_pages NULL
- books.total_pages 300 → 반환 300

### RED-1.7: pgTAP empty 결과 테스트
- host 모임 0개 → 빈 결과 집합
- host 모임에 current_page>0 멤버 0개 → median 0, member_count_with_progress 0

### GREEN-1: 마이그레이션 + RPC 구현
- 파일: `supabase/migrations/20240627000001_create_get_host_clubs_progress_rpc.sql`
- RPC 함수, GRANT EXECUTE TO authenticated
- pgTAP 테스트 전부 통과 확인

### REFACTOR-1: RPC 쿼리 가독성
- JOIN 순서, GROUP BY 명시, COMMENT ON FUNCTION 추가

---

## Phase 2 — Hook 레이어 (M2)

### RED-2.1: useHostClubs 타입 확정 테스트
- HostClubWithCount 가 median_page, member_count_with_progress, progress_total_pages 필드 포함
- TypeScript 컴파일 통과

### RED-2.2: RPC 성공 시 병합 테스트
- mock clubs SELECT(2 모임) + RPC(2행) → 병합 결과에 median_page/mcp/tp 포함

### RED-2.3: RPC 실패 degradation 테스트
- mock clubs SELECT 성공 + RPC 에러 → clubs 데이터는 반환, 진도 필드 0/0/null
- console.warn 호출 확인

### RED-2.4: RPC 빈 결과 테스트
- mock clubs SELECT(2 모임) + RPC(0행) → 진도 필드 0/0/null

### RED-2.5: clubs SELECT 실패 시 throw 테스트 (기존 동작 유지)
- mock clubs SELECT 에러 → useHostClubs 쿼리 error 상태

### GREEN-2: useHostClubs 구현
- 파일: `src/features/club/trackB/hooks.ts`
- Promise.all([clubs SELECT, RPC]) + Map 병합
- degradation 분기
- Vitest 테스트 전부 통과

### REFACTOR-2: 병합 로직 가독성
- progressMap 빌더 함수 분리(옵션)

---

## Phase 3 — UI 레이어 (M3)

### RED-3.1: median>0 + total_pages>0 → 바 표시 테스트
- ClubCard 렌더링, median_page=100, progress_total_pages=300
- 진도 바 Fill 폭 = 100/300 ≈ 33%
- 텍스트 `p.100 · 진도 N명` 표시

### RED-3.2: median=0 → 대체 텍스트 테스트
- median_page=0
- 텍스트 `아직 진도가 없어요` 표시, 바 미표시

### RED-3.3: total_pages NULL → 바 생략 테스트
- median_page=50, progress_total_pages=null
- 바 미표시, 텍스트 `p.50 · 진도 N명` 표시

### RED-3.4: total_pages 0 이하 → 바 생략 테스트 (엣지)
- progress_total_pages=0
- 바 미표시

### RED-3.5: member_count_with_progress 표시 테스트
- member_count_with_progress=3, member_count(전체)=5
- 텍스트에 3 표시 (진도 입력 멤버 수)

### RED-3.6: 기존 member_count 라인 유지 테스트 (회귀)
- 기존 `멤버 {member_count}명` 라인 존재 확인

### RED-3.7: SPEC-UI-002 토큰 사용 테스트 (정적)
- StyleSheet 에 하드코딩 색상/숫자 없음 (grep 기반 검증 또는 코드 리뷰)

### GREEN-3: ClubCard 진도 표시 구현
- 파일: `src/features/club/trackB/components/ClubsScreen.tsx`
- 진도 텍스트 + 바 조건부 렌더링
- `.pen` F11-Clubs Track/Fill/Pct 노드 참조(Pencil CLI grep 으로 속성 확인)
- 토큰만 사용
- Vitest + Testing Library 테스트 통과

### REFACTOR-3: 진도 표시 서브컴포넌트 분리 (옵션)
- ClubProgressDisplay 컴포넌트 분리(가독성) — 본 SPEC 범위 선택

---

## Phase 4 — MX 태그 해소 + 회귀 (M4)

### GREEN-4.1: @MX:TODO 제거
- 파일: `src/features/club/trackB/components/ClubsScreen.tsx:309`
- `@MX:TODO` 블록 제거
- MX 리포트: "TODO 제거 1건 (SPEC-CLUB-003 진도 표시 구현으로 해소)"

### GREEN-4.2: 신규 코드 @MX:NOTE 추가 (필요 시)
- RPC 함수 호출 지점, useHostClubs 병합 지점, ClubProgressDisplay (분리 시) 에 NOTE

### REFACTOR-4: 전체 회귀
- `npm test` 전체 통과
- `npx tsc --noEmit` 통과
- ESLint 통과
- 회귀 검증(실기기): ClubsScreen 목록 렌더링, ClubCard 레이아웃, closed 모임 표시 유지

---

## 완료 기준 (Definition of Done)

- [ ] 모든 RED 테스트가 GREEN 통과
- [ ] RPC 마이그레이션 dev Supabase 적용 + gen-types 재생성
- [ ] `useHostClubs` 확장 + degradation 정상 동작
- [ ] ClubCard 진도 표시 4분기(median>0/total>0, median=0, total=NULL, total=0) 정상
- [ ] `@MX:TODO` at ClubsScreen.tsx:309 제거
- [ ] SPEC-UI-002 토큰만 사용 (하드코딩 금지)
- [ ] 비과시 원칙 준수 (median 전용, 랭킹/비교 없음)
- [ ] 커버리지 85%+ (RPC pgTAP + hook Vitest + UI Testing Library)
- [ ] 회귀 검증 통과(실기기 — 기존 ClubsScreen 동작 유지)
