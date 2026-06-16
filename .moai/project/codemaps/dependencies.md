# Sa-gak Dependency Graph

모듈 간 의존성 분석 — app/ → src/ 임포트, @MX:ANCHOR 후보 식별, 순환 의존성 검증

## Dependency Overview

```mermaid
graph TB
    subgraph "Presentation Layer (app/)"
        A1[app/_layout.tsx]
        A2[app/index.tsx]
        A3[app/(tabs)/_layout.tsx]
        A4[app/(auth)/_layout.tsx]
        A5[app/(auth)/auth/callback.tsx]
        A6[app/(auth)/login.tsx]
        A7[app/(auth)/onboarding.tsx]
    end

    subgraph "Business Logic (src/)"
        B1[src/auth/useSession.ts<br/>@MX:ANCHOR]
        B2[src/auth/AuthContext.tsx]
        B3[src/auth/login.tsx]
        B4[src/auth/onboarding.tsx]
        B5[src/theme/theme.tsx<br/>@MX:ANCHOR]
        B6[src/theme/tokens.ts<br/>@MX:ANCHOR]
        B7[src/lib/api/index.ts]
        B8[src/lib/api/edgeFunctions.ts]
    end

    subgraph "Infrastructure (src/lib/)"
        I1[src/lib/supabase/client.ts<br/>@MX:ANCHOR]
        I2[src/lib/supabase/storageAdapter.ts]
        I3[src/config/env.ts]
    end

    A1 --> B5
    A1 --> B2
    A2 --> B1
    A3 --> B1
    A3 --> B5
    A4 --> B1
    A5 --> B1
    A6 --> B3
    A7 --> B4
    B1 --> B2
    B2 --> I1
    B5 --> B6
    B7 --> B8
    B8 --> I1
    I1 --> I2
    I1 --> I3
```

## Import Matrix

### From `app/` to `src/auth/`

| 호출자 (app/) | 대상 (src/auth/) | 임포트 | 용도 |
|--------------|------------------|--------|------|
| `app/_layout.tsx` | `src/auth/AuthContext.tsx` | `AuthProvider` | 루트 인증 제공자 |
| `app/index.tsx` | `src/auth/useSession.ts` | `useSession` | 진입점 분기 로직 |
| `app/(tabs)/_layout.tsx` | `src/auth/useSession.ts` | `useSession` | 탭 가드 |
| `app/(auth)/_layout.tsx` | `src/auth/useSession.ts` | `useSession` | 인증 그룹 가드 |
| `app/(auth)/auth/callback.tsx` | `src/auth/useSession.ts` | `useSession` | 콜백 후 리다이렉트 |
| `app/(auth)/login.tsx` | `src/auth/login.tsx` | re-export | 로그인 화면 구현 |
| `app/(auth)/onboarding.tsx` | `src/auth/onboarding.tsx` | re-export | 온보딩 화면 구현 |

### From `app/` to `src/theme/`

| 호출자 (app/) | 대상 (src/theme/) | 임포트 | 용도 |
|--------------|------------------|--------|------|
| `app/_layout.tsx` | `src/theme/theme.tsx` | `ThemeProvider` | 루트 테마 제공자 |
| `app/(tabs)/_layout.tsx` | `src/theme/theme.tsx` | `useTheme` | 탭 내비게이터 스타일링 |
| `app/(auth)/_layout.tsx` | `src/theme/theme.tsx` | `useTheme` | 인증 화면 스타일링 |

### From `src/auth/` to `src/lib/supabase/`

| 호출자 (src/auth/) | 대상 (src/lib/supabase/) | 임포트 | 용도 |
|-------------------|------------------------|--------|------|
| `src/auth/AuthContext.tsx` | `src/lib/supabase/client.ts` | `getSupabaseClient` | 인증 상태 관리, OAuth 토큰 교환 |

### From `src/lib/api/` to `src/lib/supabase/`

| 호출자 (src/lib/api/) | 대상 (src/lib/supabase/) | 임포트 | 용도 |
|---------------------|------------------------|--------|------|
| `src/lib/api/edgeFunctions.ts` | `src/lib/supabase/client.ts` | `getSupabaseClient` | Edge Function 호출 |

### From `src/lib/supabase/` to `src/config/`

| 호출자 (src/lib/supabase/) | 대상 (src/config/) | 임포트 | 용도 |
|---------------------------|-------------------|--------|------|
| `src/lib/supabase/client.ts` | `src/config/env.ts` | `getEnvVar` | Supabase URL/키 초기화 |

## High Fan-in Analysis (@MX:ANCHOR Candidates)

### 1. `useSession` (Fan-in: 4+)

**호출자:**
- `app/index.tsx` - 진입점 분기
- `app/(tabs)/_layout.tsx` - 탭 가드
- `app/(auth)/_layout.tsx` - 인증 그룹 가드
- `app/(auth)/auth/callback.tsx` - 콜백 리다이렉트

**의존성:**
```typescript
import { useSession } from '@/auth/useSession'
```

**중요도:** HIGH - 모든 라우팅 분기 로직의 핵심

**@MX:ANCHOR 권장:** ✅ - 4개 라우트에서 사용, 인터페이스 변경 영향도 높음

---

### 2. `useTheme` (Fan-in: 6+)

**호출자:**
- `app/_layout.tsx` - 루트 테마 제공자
- `app/(tabs)/_layout.tsx` - 탭 스타일링
- `app/(auth)/_layout.tsx` - 인증 화면 스타일링
- 모든 컴포넌트 (Button, Card, 등)

**의존성:**
```typescript
import { useTheme, ThemeProvider } from '@/theme/theme'
import tokens from '@/theme/tokens'
```

**중요도:** HIGH - 전역 스타일링 인터페이스

**@MX:ANCHOR 권장:** ✅ - 반환값 구조(theme, colorScheme, etc.) 변경 시 영향도 광범위

---

### 3. `tokens` (Fan-in: 3+)

**호출자:**
- `src/theme/theme.tsx` - ThemeProvider
- 다수 컴포넌트 (Button, Card, etc.)

**의존성:**
```typescript
import tokens from '@/theme/tokens'
```

**중요도:** MEDIUM - 디자인 토큰 참조

**@MX:ANCHOR 권장:** ⚠️ - 토큰 구조 변경 시 컴포넌트 스타일링 영향

---

### 4. `getSupabaseClient` (Fan-in: CRITICAL)

**호출자:**
- `src/auth/AuthContext.tsx` - 인증 상태 관리
- `src/lib/api/edgeFunctions.ts` - Edge Function 호출
- 모든 Supabase 직접 호출 (추후 추가될 API 계층)

**의존성:**
```typescript
import { getSupabaseClient } from '@/lib/supabase/client'
```

**중요도:** **CRITICAL** - Supabase 클라이언트 싱글톤

**@MX:ANCHOR 권장:** ✅ 필수 - 클라이언트 초기화 로직 변경 시 모든 데이터 접근 영향

---

### 5. `supabaseStorageAdapter` (Fan-in: 1)

**호출자:**
- `src/lib/supabase/client.ts` - 클라이언트 초기화 시 주입

**의존성:**
```typescript
import { supabaseStorageAdapter } from '@/lib/supabase/storageAdapter'
```

**중요도:** MEDIUM - 세션 지속성 어댑터

**@MX:ANCHOR 권장:** ⚠️ - 저장소 인터페이스 변경 시 클라이언트 초기화 영향

## Circular Dependency Check

**검증 결과:** ✅ **순환 의존성 없음**

**검증 방법:**
1. `app/` → `src/` 의존성 (단방향)
2. `src/auth/` → `src/lib/supabase/` 의존성 (단방향)
3. `src/lib/api/` → `src/lib/supabase/` 의존성 (단방향)
4. `src/lib/supabase/` → `src/config/` 의존성 (단방향)

**의존성 방향:**
```
app/ (Presentation)
  ↓ imports
src/ (Business Logic)
  ↓ imports
src/lib/ (Infrastructure)
```

**역방향 의존성 없음:**
- `src/`는 `app/`를 임포트하지 않음
- `src/lib/`는 `src/`를 임포트하지 않음

## Bidirectional Consistency

**검증 항목:**

1. **인증 흐름 일관성**
   - ✅ `useSession` → `AuthContext` → `getSupabaseClient` 체인 일관됨
   - ✅ 모든 라우트에서 동일한 `useSession` 인터페이스 사용

2. **테마 적용 일관성**
   - ✅ `ThemeProvider` → `tokens` → `darkTokens` 체인 일관됨
   - ✅ 모든 컴포넌트에서 `useTheme` 통해 토큰 접근

3. **API 호출 일관성**
   - ✅ `invokeEdgeFunction` → `getSupabaseClient` 체인 일관됨
   - ✅ 에러 처리 → `retryWithBackoff` 통합 일관됨

## Dependency Health Score

| 항목 | 점수 | 비고 |
|------|------|------|
| 순환 의존성 | ✅ 10/10 | 없음 |
| 계층 분리 | ✅ 10/10 | 명확한 Presentation → Business → Infrastructure |
| @MX:ANCHOR 식별 | ✅ 9/10 | 5개 후보 모두 식별 |
| 얇은 래퍼 준수 | ✅ 10/10 | app/는 src/를 재내보내거나 호출만 |
| 인터페이스 안정성 | ✅ 8/10 | 고 fan-in 모듈 안정적 |

**총점:** 47/50 (94%)

## Recommendations

1. **@MX:ANCHOR 추가 권장:**
   - `useSession.ts` - @MX:ANCHOR (HIGH priority)
   - `useTheme.tsx` - @MX:ANCHOR (HIGH priority)
   - `getSupabaseClient.ts` - @MX:ANCHOR (CRITICAL priority)

2. **모듈 경계 강화:**
   - `app/`는 라우팅만 담당, 비즈니스 로직은 `src/`에 위임 (현재 잘 준수됨)
   - `src/lib/`는 인프라만 담당, 도메인 로직은 상위 계층에 (현재 잘 준수됨)

3. **의존성 모니터링:**
   - 향후 `src/` → `app/` 역방향 임포트 방지 (린트 규칙 권장)
   - `src/lib/` → `src/` 역방향 임포트 방지 (린트 규칙 권장)

---

**Last Updated:** 2026-06-16  
**Branch:** develop (82d2031)
