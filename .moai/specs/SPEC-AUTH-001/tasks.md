## Task Decomposition
SPEC: SPEC-AUTH-001
Created: 2026-06-15
Mode: TDD (RED-GREEN-REFACTOR)
Branch: feature/SPEC-AUTH-001-oauth-auth

## Planned Files

| File Path | Purpose | New/Modify | Dependencies | Status |
|-----------|---------|-------------|--------------|--------|
| src/auth/oauth.ts | expo-linking 래퍼 (getOAuthRedirectUri) | NEW | expo-linking package | pending |
| src/auth/types.ts | AuthProvider union, UserProfile, AuthContextValue interfaces | NEW | - | pending |
| src/auth/AuthContext.tsx | Provider, state machine, onAuthStateChange, getSession, signOut, fetchProfile, refreshProfile | NEW | client.ts, errors.ts, types.ts, oauth.ts | pending |
| src/auth/useSession.ts | useSession hook with derived values (isAuthenticated, isOnboarded), loading guard, Provider-outside throw | NEW | AuthContext.tsx, types.ts | pending |
| app/(auth)/_layout.tsx | Auth route group layout wrapper | NEW | AuthContext.tsx | pending |
| app/(auth)/login.tsx | Login screen with 3 OAuth buttons, error handling | NEW | AuthContext.tsx, Button.tsx, tokens.ts, errors.ts, oauth.ts | pending |
| app/(auth)/onboarding.tsx | Onboarding screen (nickname input, avatar selection, UPDATE) | NEW | AuthContext.tsx, tokens.ts, errors.ts | pending |
| src/auth/__tests__/AuthContext.test.tsx | AuthContext unit/integration tests (S1-S9) | NEW | AuthContext.tsx, types.ts, client.ts (mock) | pending |
| src/auth/__tests__/useSession.test.ts | useSession hook tests (G1-G8) | NEW | useSession.ts, AuthContext.tsx | pending |
| app/(auth)/__tests__/login.test.tsx | Login screen tests (A1-A7) | NEW | login.tsx, AuthContext.tsx (mock) | pending |
| app/(auth)/__tests__/onboarding.test.tsx | Onboarding screen tests (O1-O9) | NEW | onboarding.tsx, AuthContext.tsx (mock) | pending |

**Total**: 11 files (7 implementation + 4 tests)
**Dependencies**: src/lib/supabase/client.ts (EXISTING), src/lib/api/errors.ts (EXISTING), src/theme/tokens.ts (EXISTING), src/components/Button.tsx (EXISTING)

## Path Corrections (from plan.md)

- plan.md references `src/lib/supabase.ts` → ACTUAL: `src/lib/supabase/client.ts`
- plan.md does not list `src/auth/oauth.ts` → NEW FILE for expo-linking wrapper (dependency gap resolution)

## Milestone Sequencing

```
[PRE] expo-linking installation (npm install expo-linking)
    ↓
[M0] types.ts (REQ-AUTH-001) — 1 cycle
    ↓
[M1] AuthContext.tsx (REQ-AUTH-010~014) — 5 cycles
    ↓ parallel start ↓
[M2-A] useSession.ts (REQ-AUTH-030~033) — 4 cycles
[M2-B] login.tsx (REQ-AUTH-002~004) — 3 cycles
    ↓ parallel end ↓
[M3] onboarding.tsx (REQ-AUTH-020~024) — 5 cycles
    ↓
[M4] app/(auth)/_layout.tsx + app/_layout.tsx modification — 1 cycle
```

## TDD Cycles Summary

| Milestone | Cycles | REQ Coverage | Dependency |
|-----------|--------|--------------|-------------|
| PRE | 1 | - | expo-linking install |
| M0 | 1 | REQ-AUTH-001 | - |
| M1 | 5 | REQ-AUTH-010~014 | client.ts, errors.ts, types.ts, oauth.ts |
| M2-A | 4 | REQ-AUTH-030~033 | AuthContext.tsx |
| M2-B | 3 | REQ-AUTH-002~004 | AuthContext.tsx, Button.tsx, tokens.ts |
| M3 | 5 | REQ-AUTH-020~024 | AuthContext.tsx, errors.ts |
| M4 | 1 | Routing integration | All files |

**Total Cycles**: 20 (including PRE)
**Total REQ**: 17 (all covered)

## Acceptance Criteria Mapping

| AC ID | REQ Coverage | Milestone | Cycle |
|-------|--------------|-----------|-------|
| A1-A7 | REQ-AUTH-002~004 | M2-B | M2B-1, M2B-2, M2B-3 |
| S1-S9 | REQ-AUTH-010~014 | M1 | M1-1~M1-5 |
| O1-O9 | REQ-AUTH-020~024 | M3 | M3-1~M3-5 |
| G1-G8 | REQ-AUTH-030~033 | M2-A | M2A-1~M2A-4 |

## Coverage Targets

- **Line Coverage**: 85%+ for `src/auth/` directory
- **Branch Coverage**: 80%+ for `src/auth/` directory
- **Function Coverage**: 90%+ for `src/auth/` directory

## Drift Guard Baseline

- **Planned files**: 11 (7 impl + 4 tests)
- **Planned new files**: 10 (oauth.ts, types.ts, AuthContext.tsx, useSession.ts, 3 screens, 4 tests)
- **Allowed drift**: ≤20% (informational), ≤30% (warning), >30% (re-planning gate)

## Completion Checklist

Implementation complete when:
- [ ] All 20 TDD cycles complete (RED→GREEN→REFACTOR)
- [ ] All tests passing (jest-expo)
- [ ] Coverage targets met (85%+ line)
- [ ] LSP gates passed (0 errors, 0 type errors, 0 lint errors)
- [ ] TRUST 5 validation passed (manager-quality)
- [ ] evaluator-active passed (Phase 2.8a)
- [ ] MX tags updated (Phase 2.9)
- [ ] Conventional commits created (feature branch)
- [ ] PR created (feature → develop)
