## Task Decomposition
SPEC: SPEC-NAV-001 (Navigation & Routing Structure)
Methodology: TDD (RED-GREEN-REFACTOR) per quality.yaml
Branch: feature/SPEC-NAV-001-navigation
Baseline: tsc 0 errors, 26 test files (277 tests), develop @ 92c100f

> 인터페이스 협약 (AUTH-001 VERIFIED): `useSession()`은 loading 시 `null` 반환. loading 완료 시 `{ session, user, profile, loading:false, isAuthenticated, isOnboarded, signInWithProvider, signOut, refreshProfile }`. `isAuthenticated = session && user`. `isOnboarded = profile && profile.nickname`. 가드는 `null` → 스플래시, `!isAuthenticated` → login, `isAuthenticated && !isOnboarded` → onboarding, 그 외 → tabs.

| Task ID | Description | Requirement | Dependencies | Planned Files | Status |
|---------|-------------|-------------|--------------|---------------|--------|
| T-001 | 루트 `app/_layout.tsx` Stack 확장 — ThemeProvider + AuthProvider 보존, 자식에 `(tabs)`/`(auth)` 그룹 Screen 추가, `_dev` 라우트 `__DEV__` 게이트. headerShown:false 보존. | REQ-NAV-012 (부분) | - | app/_layout.tsx (MODIFY) | pending |
| T-002 | `app/index.tsx` 전환 — 데모 제거 → `useSession()` 기반 진입 분기 (null→ActivityIndicator, 인증→/(tabs)/, 미인증→/(auth)/login, 온보딩미완→/(auth)/onboarding). `router.replace` 사용. | REQ-NAV-020 | T-001 | app/index.tsx (MODIFY) | pending |
| T-003 | `(auth)/_layout.tsx` 가드 추가 — `isAuthenticated && isOnboarded` 사용자의 `(auth)` 접근 시 `/(tabs)/` 리다이렉트. 기존 login+onboarding Stack 보존. callback Screen 등록은 T-010에서. | REQ-NAV-021 | T-001 | app/(auth)/_layout.tsx (MODIFY) | pending |
| T-004 | `(tabs)` 그룹 보호 + 온보딩 가드 — `(tabs)/_layout.tsx` 최상단에서 미인증→login, `isAuthenticated && !isOnboarded`→onboarding 리다이렉트. (REQ-NAV-022, REQ-NAV-023 통합 구현 — 동일 진입점) | REQ-NAV-022, REQ-NAV-023 | T-001, T-005 | app/(tabs)/_layout.tsx (NEW) | pending |
| T-005 | `(tabs)/_layout.tsx` Tabs 네비게이터 — 4탭(홈/서재/모임/마이), Feather 아이콘, 높이 56dp+safe area, 활성 brand-500/비활성 text-tertiary, bg-surface/border-default/label 타이포. 모든 값 `useTheme()` 토큰. | REQ-NAV-001, REQ-NAV-003 | T-001 | app/(tabs)/_layout.tsx (NEW) | pending |
| T-006 | 4개 탭 placeholder 셸 — index(홈)/library(서재)/clubs(모임)/my(마이). 헤더 타이틀 + 중앙 placeholder 텍스트만. 도메인 콘텐츠 제외(YAGNI). | REQ-NAV-002 | T-005 | app/(tabs)/index.tsx, library.tsx, clubs.tsx, my.tsx (NEW) | pending |
| T-007 | 스택 동적 라우트 골격 — `[bookId].tsx`, `clubs/[clubId].tsx`. `useLocalSearchParams()`로 파라미터 수신만. | REQ-NAV-010, REQ-NAV-011 | T-005 | app/(tabs)/[bookId].tsx, app/(tabs)/clubs/[clubId].tsx (NEW) | pending |
| T-008 | 스택 전환 옵션 — 기본 슬라이드(React Navigation 기본값), 모달형 `presentation:'modal'` 옵션 명시. 커스텀 애니메이션 제외. | REQ-NAV-013 | T-005 | app/(tabs)/_layout.tsx (stack 옵션) | pending |
| T-009 | `app.json` scheme 검증 — `"scheme":"sagak"` 존재 확인 (이미 등록됨). iOS CFBundleURLSchemes + Android intent-filter 자동 생성 신뢰. 신규 등록 작업 아님. | REQ-NAV-030 | - | app.json (검증만) | pending |
| T-010 | OAuth 콜백 라우트 — `app/(auth)/auth/callback.tsx`. `useLocalSearchParams()` 수신 후 `useSession()` 상태로 `/(tabs)/` 또는 `/(auth)/login` 리다이렉트. 세션 교환은 AUTH-001 onAuthStateChange에 위임(최소 골격). | REQ-NAV-031 | T-001 | app/(auth)/auth/callback.tsx (NEW) | pending |

## Coverage Verification

| REQ | Task | AC 시나리오 |
|-----|------|------------|
| REQ-NAV-001 | T-005 | T1~T6 (탭 렌더링/토큰/활성색/다크모드/전환/placeholder) |
| REQ-NAV-002 | T-006 | T6 |
| REQ-NAV-003 | T-005 | T2, T3, T4 |
| REQ-NAV-010 | T-007 | S1, S3 |
| REQ-NAV-011 | T-007 | S2, S4 |
| REQ-NAV-012 | T-001 | R1, R2 (_layout 보존, _dev 게이트) |
| REQ-NAV-013 | T-008 | S3, S4 (전환 방향) |
| REQ-NAV-020 | T-002 | G1~G3, G7 (loading 점멸/진입분기) |
| REQ-NAV-021 | T-003 | G5 (auth 그룹 보호) |
| REQ-NAV-022 | T-004 | G4 (tabs 그룹 보호) |
| REQ-NAV-023 | T-004 | G6 (온보딩 미완료), EC3 |
| REQ-NAV-030 | T-009 | D4 (scheme 검증) |
| REQ-NAV-031 | T-010 | D1~D3 (콜백 수신/분기) |

전체 AC: G1~G7(7) + T1~T6(6) + S1~S4(4) + D1~D4(4) + A1~A3(3) + R1~R3(3) + EC1~EC10(10) = 27 acceptance scenarios, 13 REQ.

## Implementation Order (dependency-respecting)

1. T-001 (root layout) → T-009 (app.json verify, 병렬 가능)
2. T-005 (tabs layout 본체) → T-002 (index 진입분기) + T-003 (auth 가드) 병렬
3. T-004 (tabs 보호+온보딩 가드, T-005 완료 후)
4. T-006 (탭 placeholder) + T-007 (스택 라우트) + T-008 (전환 옵션) 병렬
5. T-010 (callback 라우트)

## Drift Guard Reference

Planned new files (9): app/(tabs)/_layout.tsx, index.tsx, library.tsx, clubs.tsx, my.tsx, [bookId].tsx, clubs/[clubId].tsx, app/(auth)/auth/callback.tsx + test files.
Planned modify (4): app/_layout.tsx, app/index.tsx, app/_dev.tsx, app/(auth)/_layout.tsx.
Verify-only: app.json.
Drift threshold: >30% cumulative triggers Phase 2.7 re-planning.
