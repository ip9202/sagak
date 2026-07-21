## SPEC-AUTH-001 Progress

- Started: 2026-06-15
- Mode: Solo Sub-agent TDD (development_mode: tdd)
- Branch: feature/SPEC-AUTH-001-oauth-auth (from develop)
- UltraThink: activated (Phase 1 Strategy — plan.md lists 10 files, new auth module, ultrathink keyword)

### Pre-flight
- [x] develop synced (0 behind origin/develop)
- [x] feature/SPEC-AUTH-001-oauth-auth created from develop

### Dependency verification
- [x] SPEC-API-001: src/lib/supabase/client.ts exists (path correction: plan.md references src/lib/supabase.ts → actual client at src/lib/supabase/client.ts)
- [x] SPEC-UI-001: src/theme/tokens.ts + Button/Card components available for reuse
- [x] Test infra: jest + jest-expo + @testing-library/react-native configured
- [x] src/auth/ and app/(auth)/ do not exist (greenfield auth module — expected)

### Phase log
- Phase 0.5: skipped (memory_guard.enabled: false)
- Phase 0.9: detected TypeScript/React Native (Expo) → moai-lang-typescript
- Phase 0.95: Standard Mode selected (10 files, 1 domain, TDD coupled cycles)
- Phase 1: manager-strategy execution plan complete → UltraThink analysis, 7 core decisions, 20 TDD cycles, complexity score 7/10
- Decision Point 1: User approved plan (Proceed with solo TDD + feature/SPEC-AUTH-001-oauth-auth branch)
- Phase 1.5: tasks.md created (11 files, 17 REQ, 20 cycles)
- Phase 1.6: 33 acceptance criteria registered to TaskList (AC-A1~G8)
- Phase 1.7: 11 stub files created (oauth.ts, types.ts, AuthContext.tsx, useSession.ts, 3 screens, 4 tests)
- Phase 1.8: skipped (greenfield — no existing files to scan)

### Phase 2B: TDD Implementation (manager-tdd)
- Pre-task: expo-linking installed successfully
- M0~M2 implemented: types/oauth, AuthContext, useSession, login (kakao+apple)
- 250 tests passing, src/auth/ coverage healthy

### PR #4 merged (M0~M2 → develop)
- Squash merge: e132bc0 (2026-06-15)
- feature/SPEC-AUTH-001-oauth-auth deleted (local + remote)
- Gap identified: Google button (A2) not yet covered in M2-B

### Branch feature/SPEC-AUTH-001-onboarding-routing (M3 + M4)
- Phase 2B resumed: manager-tdd delegated M3 onboarding + M4 integration + AC tests
- M3: src/auth/onboarding.tsx — nickname validation (1-20), UPDATE via .eq('id', user.id), refreshProfile, error+session-retain on failure (REQ-AUTH-020~024, O3-O9)
- M4: app/_layout.tsx AuthProvider (inside ThemeProvider), app/(auth) re-export from src/auth, Google button added to login.tsx (A2)
- AC tests: it.skip removed; A1-A7 + O3-O9 real tests written
- 277 tests pass, 0 skip, src/auth coverage 96.72% lines
- tsc 0 errors, lint 0 errors, 0 .insert() calls (REQ-AUTH-004)
- Phase 2.8a evaluator-active: PASS (Functionality 100, Security 100, Craft 95, Consistency 100), all AC verified
- Phase 2.9 MX tags: onboarding.tsx @MX:ANCHOR/WARN/NOTE attached, consistent with AuthContext

### SPEC-AUTH-001 status: COMPLETE (all 18 REQ, A1-A7/O1-O9/S1-S9/G1-G8 covered)

### PR #16 merged (hardening + DB schema fixes)
- Squash merge: da5b262 (2026-06-18)
- **RN OAuth 패턴**: `skipBrowserRedirect` + `openAuthSessionAsync` + `exchangeCodeForSession`(PKCE) + implicit fallback
- **딥링크 검증**: `sagak://auth` 스킴/호스트 검증 (defense-in-depth)
- **DB 스키마 수정**: `nickname` nullable, `handle_new_user` 컬럼 오타 수정, CHECK 제약 추가
- **React 19 호환**: `router.replace`를 `useEffect`로 이동
- **실기기 검증**: Pixel 6 end-to-end 완료 (로그인 → 온보딩 → 홈)
- feature/SPEC-AUTH-001-rn-oauth-hardening deleted (local + remote)

### PR #17 merged (네이버 Custom OIDC 연동)
- Squash merge: 799c919 (2026-06-18)
- **네이버 Custom OIDC**: `naver` → `custom:naver` 매핑 (AuthContext.signInWithProvider) — Supabase Custom OIDC 식별자는 `custom:` 접두사 필수
- **DB migration 004**: `handle_new_user` `REPLACE(provider,'custom:','')` 정규화 (custom:naver → naver, users.provider CHECK 준수) + SECURITY DEFINER owner postgres 고정 (리뷰 M1)
- **SPEC-DEPLOY-001 정정**: naver OIDC auto-discovery 모드 (scope openid/profile, email_optional:true, custom:naver 식별자)
- **검증**: tsc 0 / 80 suites 692 tests / 실기기 unsupported_provider 해결 (네이버 로그인 페이지 오픈)
- **보안 리뷰**: expert-security + 직검 — injection/escalation/bypass 없음
- feature/SPEC-AUTH-001-naver-custom-oidc deleted (local + remote)
- **네이버 실기기 e2e 보류**: 네이버 콜백 URL 오타(`o` 누락) 수정 + C1(email NOT NULL) 검증 + M2(provider guard) 차후 진행

### PR #19 merged (로그아웃 UI + 네이버 linking 실기기 검증)
- Squash merge: e456fa6 (2026-06-19)
- **카카오/네이버/구글 account-linking 실기기 검증 PASS**: Pixel 6 end-to-end 검증 — 모든 provider linking 정상 동작
- **근본 원인 발견**: 네이버 Custom OIDC scope에 `account_email` 누락 → email 미제공 → noemail 폴백 → linking 실패. 해결: 대시보드 scope 추가 (코드 변경 무)
- **로그아웃 UI 추가**: 마이 탭 placeholder → 최소 마이페이지 (사용자 정보 카드: 닉네임/프로바이더/이메일 + 로그아웃 버튼 호출 useSession().signOut()), loading/signed-out 상태 분기, token-only 스타일링, SPEC-UI-002 준수
- **실기기 재검증**: 이전 "네이버 linking 검증 완료" 판정이 noemail 폴백으로 틀렸음을 실기기 검증이 포착 — scope 수정 후 재검증 PASS (linking은 최초 시도이므로 회귀 아님 — lessons #7/#19)
- feature/SPEC-AUTH-001-logout-ui deleted (local + remote)

### PR #99 merged (연결계정 다중 표시)
- Squash merge: d666c16 (2026-06-28)
- **신규 인터페이스 3개 추가**:
  - `src/auth/types.ts`: `normalizeIdentityProvider(raw: string): AuthProvider | null` — auth.identities.provider 값(`custom:naver`)을 AuthProvider(`naver`)로 정규화 (커스텀 OIDC 접두 제거). 미지원 provider → null.
  - `src/auth/useUserIdentities.ts` (신규 파일): `useUserIdentities(userId?: string)` — React Query 훅. `getSupabaseClient().auth.getUserIdentities()` 기반으로 연결계정 `AuthProvider[]` 반환. `enabled: Boolean(userId)`로 미인증/loading 시 쿼리 비활성화 (useUserStats 패턴 일관). `profile.provider` 폴백과 함께 마이 탭 연결계정 다중 표시("네이버, 카카오") 지원.
  - `app/(tabs)/my.tsx`: 연결계정 다중 표시. `useUserIdentities(session?.user?.id)` 호출(early return 전, hooks 규칙 준수). linkedProviders → "네이버, 카카오" 다중, 미로드/빈값/에러 시 profile.provider 폴백.
- **데이터 소스 전환**: users.provider(가입 시 단일 provider) → auth.identities(Supabase 진실 원천, 모든 연결 identity)
- **실기기 검증**: 강력쓰주먹 계정(custom:naver + kakao 연결)에서 "네이버, 카카오" 표시 확인 완료
- feature/SPEC-AUTH-001-linked-providers deleted (local + remote)

### 후속 정정 (2026-07-06) — 네이버 실기기 e2e "보류" 항목 해결 확인

**배경**: PR #17(799c919)이 "네이버 실기기 e2e 보류: 네이버 콜백 URL 오타(`o` 누락) 수정 + C1(email NOT NULL) 검증 + M2(provider guard) 차후 진행"이라고 남긴 3개 항목이 핸드오프까지 미갱신 STALE 마커로 잔존 (lessons #23 적중). 코드 직검 결과 **3항목 전부 이미 충족** 확인:

1. **네이버 콜백 URL 오타(`o` 누락)** — 코드 레벨 정상. `src/auth/oauth.ts:23` `getOAuthRedirectUri()` 반환값 `"sagak://auth/callback"` (오타 無, `oauth.test.ts:14-15` 고정 URI 계약 검증). "오타"는 네이버 개발자 콘솔 콜백 URL 설정(외부 프로비저닝 영역)으로, 본 repo 코드가 아님 → 코드 수정 대상 아님.
2. **C1(email NOT NULL)** — DB 제약 충족. `supabase/migrations/20240614000001_create_users.sql:12` `email text UNIQUE NOT NULL`. 추가로 `20240618000005_handle_new_user_email_fallback.sql`가 `noemail.local` 폴백으로 INSERT 위반 방어 (provider+id 가짜 이메일). C1 AC 충족.
3. **provider guard** — 코드 충족. `src/auth/AuthContext.tsx:156` `const supabaseProvider = provider === 'naver' ? 'custom:naver' : provider;` 매핑 + `@MX:REASON` 가드 주석 (fan_in >= 3). `src/auth/types.ts` `AuthProvider = 'kakao' | 'naver' | 'google'` 유니온 타입 화이트리스트 + `normalizeIdentityProvider('custom:naver') → 'naver'` 역정규화 (`types.test.ts:94`).

**실기기 검증 상태**: PR #19(e456fa6)에서 카카오/네이버/구글 account-linking 실기기 검증 PASS (네이버 scope `account_email` 추가 후 noemail 폴백 해결). 네이버 로그인 → 온보딩 → 홈 → linking 전 파이프라인 정상 동작 확인.

**결론**: SPEC-AUTH-001 코드 레벨 잔여 작업 없음. 남은 네이버 항목은 외부 프로비저닝(네이버 개발자 콘솔 콜백 URL)만. 핸드오프 "네이버 실기기 e2e (콜백 URL + C1 + provider guard)" 마커는 PR #17 시점 것으로, 코드 관점에서 STALE.
