---
id: SPEC-AUTH-001
title: "OAuth Authentication & Session Management — Compact Reference"
version: "1.0.0"
status: completed
created: 2026-06-14
updated: 2026-06-15
author: "강력쇠주먹"
priority: high
issue_number: 0
labels: [auth, oauth, compact, reference]
---

# SPEC-AUTH-001 Compact Reference

> 본 문서는 `spec.md` + `acceptance.md`에서 REQ 요약, 핵심 인수 기준, 제외 범위만
> 추출한 실행 요약이다. 구현 에이전트(Run Phase)가 컨텍스트 예산 내에서 빠르게
> 참조하기 위함이다. 상세 내용은 원본 파일을 참조할 것.

---

## 1. 요구사항 요약 (Requirements Summary)

| REQ ID | 모듈 | 요약 |
|--------|------|------|
| REQ-AUTH-001 | OAUTH | `'kakao' \| 'apple' \| 'google'` AuthProvider 유니온 타입 정의 (`users.provider` CHECK와 일치) |
| REQ-AUTH-002 | OAUTH | `signInWithOAuth(provider, { redirectTo })` — 딥링크는 `makeRedirectUri()` |
| REQ-AUTH-003 | OAUTH | OAuth 실패(취소/오류/거부) 시 친화적 에러 메시지, 원시 에러는 로그만 |
| REQ-AUTH-004 | OAUTH | `handle_new_user` 트리거가 자동 INSERT — 클라이언트 INSERT 금지 |
| REQ-AUTH-010 | SESSION | AuthContext: session, user, profile, loading + 3개 액션 노출 |
| REQ-AUTH-011 | SESSION | `onAuthStateChange` 4이벤트 구독 (INITIAL_SESSION, SIGNED_IN, TOKEN_REFRESHED, SIGNED_OUT) |
| REQ-AUTH-012 | SESSION | 앱 시작 시 `getSession()` 자동 로그인, `loading` 상태 전환 |
| REQ-AUTH-013 | SESSION | 인증 시 `public.users` 프로필 행 조회; 누락 시 null + 로깅 |
| REQ-AUTH-014 | SESSION | `signOut()` 로컬 세션 폐기 (제공자 토큰 취소는 MVP 밖) |
| REQ-AUTH-020 | ONBOARD | session 있음 + profile.nickname 미설정 시 온보딩 진입 |
| REQ-AUTH-021 | ONBOARD | nickname 검증: 1~20자, 빈 문자열 제출 방지 |
| REQ-AUTH-022 | ONBOARD | avatar_url 선택 입력 (Storage 업로드 로직은 본 SPEC 밖) |
| REQ-AUTH-023 | ONBOARD | `public.users` UPDATE (nickname 필수, avatar_url 선택) → `refreshProfile()` |
| REQ-AUTH-024 | ONBOARD | UPDATE 실패(RLS/네트워크) 시 에러 메시지, 세션 유지, 재시도 가능 |
| REQ-AUTH-030 | GUARD | `useSession()` 훅: 상태 + `isAuthenticated` + `isOnboarded` + 액션 반환 |
| REQ-AUTH-031 | GUARD | 파생값이 AuthContext 상태 변경 시 즉시 재계산 |
| REQ-AUTH-032 | GUARD | `loading === true` 시 네비게이션 보류 (깜빡임 방지) |
| REQ-AUTH-033 | GUARD | Provider 범위 밖 `useSession()` 호출 시 명확한 에러 throw |

**REQ 총계**: 17개 (REQ-AUTH-001~004: 4개, REQ-AUTH-010~014: 5개, REQ-AUTH-020~024: 5개, REQ-AUTH-030~033: 4개 — 일부 번호는 예약)

---

## 2. 핵심 인수 기준 (Key Acceptance Criteria)

### OAuth 로그인

- 세 제공자 버튼 탭 시 `signInWithOAuth`가 올바른 provider로 호출된다 (A1-A3)
- 취소/오류 시 session 유지 안 됨, 친화적 메시지 표시, 원시 에러는 로그만 (A4-A5)
- 클라이언트가 `public.users` INSERT 수행하지 않음 (A7)

### 세션 관리

- 앱 시작 시 `getSession()` 자동 복원, `loading` 전환 (S2-S3)
- `onAuthStateChange` 4이벤트가 상태를 올바르 갱신 (S4-S6)
- 프로필 조회 성공/누락 분기 처리 (S7-S8)
- 로그아웃 시 세션+프로필 초기화, 제공자 토큰 취소 안 함 (S9)

### 온보딩

- 신규 사용자만 온보딩 진입, 기존 사용자 건너뜀 (O1-O2)
- nickname 빈 문자열/20자 초과 제출 방지 (O3-O5)
- nickname(필수) + avatar(선택) UPDATE 성공 시 `refreshProfile()` (O6-O7)
- UPDATE 실패 시 에러 표시, 세션 유지, 재시도 가능 (O8-O9)

### 인증 가드 훅

- `useSession()`이 상태 + 파생값 + 액션 반환 (G1)
- `isAuthenticated`/`isOnboarded` 정확한 분기 (G2-G5)
- `loading` 중 네비게이션 보류 (G6)
- Provider 외부 호출 시 에러 throw (G7)
- 상태 변경 시 파생값 재계산 (G8)

---

## 3. 제외 범위 (Exclusions Summary)

| 제외 항목 | 이유/담당 SPEC |
|----------|---------------|
| OAuth 앱 등록·콜백 URL 인프라 설정 | SPEC-DEPLOY-001 |
| 비밀번호 로그인 | MVP 비목표 (OAuth만) |
| 이메일 인증 / 매직 링크 | MVP 비목표 |
| 비밀번호 재설정 / 찾기 | OAuth 전용 정책 |
| MFA (다중 인증) | 확장 단계 |
| OAuth 제공자 토큰 취소 (연동 해제) | MVP 범위 밖 |
| 아바타 Storage 업로드 로직 | SPEC-DEPLOY-001 + 프로필 확장 SPEC |
| 온보딩 건너뛰기 세부 UX | 미결정 사항 5.1 |
| 세션 만료 자동 리다이렉트 vs 모달 | 미결정 사항 5.2 |
| 닉네임 중복 검사 | `users.nickname` UNIQUE 제약 없음 |
| Edge Function 인증 로직 | Supabase Auth 자체 기능 사용 |
| 백엔드 스키마 변경 | SPEC-DB-001에 이미 구현 |

---

## 4. SPEC-DB-001 연동 포인트

| SPEC-DB-001 REQ | 본 SPEC 연동 |
|-----------------|-------------|
| REQ-DB-001 (`users.provider` CHECK: kakao/apple/google) | REQ-AUTH-001 AuthProvider 유니온 타입과 정확히 일치 |
| REQ-DB-013c (`handle_new_user` SECURITY DEFINER 트리거) | REQ-AUTH-004 클라이언트 INSERT 금지, 트리거 자동 생성 가정 |
| REQ-DB-014 (`users` RLS: `auth.uid() = id` UPDATE만 허용) | REQ-AUTH-023 온보딩 UPDATE가 RLS 통과, REQ-AUTH-013 profile 조회 |

---

## 5. 의존성 그래프

```
SPEC-API-001 (Supabase 클라이언트) ──→ SPEC-AUTH-001 ──→ SPEC-NAV-001 (인증 가드)
SPEC-DB-001 (스키마/RLS/트리거) ──────↗
SPEC-UI-001 (디자인 토큰/컴포넌트) ──↗
```

---

## 6. 미결정 사항 요약

| ID | 질문 | 상태 | 기본 정책 |
|----|------|------|-----------|
| 5.1 | 온보딩 건너뛰기 허용 여부 | 미해결 | (A) nickname 필수 |
| 5.2 | 세션 만료 시 자동 리다이렉트 vs 모달 | 미해결 | (A) 자동 리다이렉트 |
| 5.3 | 애플 Sign in with Apple iOS 강제 요구사항 | 미해결 | (B) 양쪽 플랫폼 표시 |

---

## 구현 노트 (Implementation Notes)

본 SPEC은 2026-06-15에 전체 구현이 완료되었습니다:

- **구현 범위**: 17개 REQ 모두 충족 (REQ-AUTH-001~004: OAuth, REQ-AUTH-010~014: 세션, REQ-AUTH-020~024: 온보딩, REQ-AUTH-030~033: 가드 훅)
- **모듈 위치**: `src/auth/` (AuthContext, useSession, types, oauth, login, onboarding)
- **라우팅**: `app/(auth)/`는 리익스포트 레이어 (실제 구현은 `src/auth/`에 존재)
- **테스트 커버리지**: src/auth 모듈 96.72% (277개 테스트 통과)
- **품질 검증**: TypeScript 0 에러, ESLint 0 에러, evaluator-active + expert-security PASS
- **PR 기록**: #4 (M0-M2: AuthContext/useSession/login), #5 (M3 온보딩 + M4 라우터 통합)

**plan.md와의 차이점**:
- `src/auth/oauth.ts`: 원본 plan.md에 없던 신규 파일 (expo-linking 의존성 해결용 래퍼)
- 구현 위치: `src/auth/*` (plan.md에는 `app/(auth)/*`로 기재됨) — 컴포넌트 분리/테스트 용이성을 위해 `src/auth/`에 실제 구현, `app/(auth)/`는 리익스포트 레이어로 변경
- 그 외 모든 파일은 plan.md대로 구현됨

*Compact reference generated from spec.md v1.0.0 + acceptance.md v1.0.0*
