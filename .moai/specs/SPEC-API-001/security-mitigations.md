# SPEC-API-001 보안 완화 계획 (Review Phase — High Issues)

본 문서는 SPEC-API-001 PR #3 코드 리뷰에서 식별된 High 이슈(H1/H2/H3)의
완화 계획만 기록한다. **본 문서는 계획 문서이며, 코드 로직은 변경하지 않는다.**
각 이슈는 별도 SPEC 또는 후속 PR 에서 코드 수정 후 적용한다.

---

## H1: `errors.ts` logToSentry 의 originalError 민감정보 노출

### 현위치
- 파일: `src/lib/api/errors.ts`
- 함수: `logToSentry` (lines ~359-383)
- 코드: `payload.extra.originalError = error.originalError`

### 문제
`normalizeError` 는 `originalError` 필드에 throw 된 원본 에러를 그대로 보존한다.
`logToSentry` 는 이 값을 payload 에 담아 `console.error`(이후 Sentry)로 전송한다.
원본 에러 객체는 HTTP 요청/응답 컨텍스트를 포함할 수 있으며, `token`,
`password`, `email`, `authorization`, `secret` 등의 키가 평문으로 섞여 있을 수 있다.
결과적으로 Sentry 와 같은 관측 도구로 민감정보가 유출될 수 있다.

### 완화 방안 — 화이트리스트 기반 마스킹
원본 에러에서 안전한 필드만 화이트리스트로 추출하고, 키 이름이 민감 패턴에
매칭되면 값을 마스킹한다.

**계획 코드 (참고용 — 후속 PR 에서 구현):**

```ts
const SENSITIVE_KEY_PATTERNS = /(token|password|email|authorization|secret)/i;

function redactForLogging(error: unknown): Record<string, unknown> {
  if (typeof error !== 'object' || error === null) {
    return { value: String(error) };
  }
  const safe: Record<string, unknown> = {};
  // code/message/status 만 화이트리스트 추출
  for (const key of ['code', 'message', 'status'] as const) {
    if (key in error) {
      safe[key] = (error as Record<string, unknown>)[key];
    }
  }
  // 추가 필드는 민감 키 패턴에 매칭되면 마스킹
  for (const [k, v] of Object.entries(error as Record<string, unknown>)) {
    if (['code', 'message', 'status'].includes(k)) continue;
    safe[k] = SENSITIVE_KEY_PATTERNS.test(k) ? '[REDACTED]' : v;
  }
  return safe;
}
```

이후 `logToSentry` 에서 `originalError: redactForLogging(error.originalError)` 로 교체.

### 적용 시점
- 후속 PR (SPEC-API-001 follow-up) 또는 SPEC-DEPLOY-001 Sentry 통합 시점.

---

## H2: `storageAdapter.ts` AsyncStorage 폴백 — 세션 평문 저장

### 현위치
- 파일: `src/lib/supabase/storageAdapter.ts`
- 함수: `setItem` (lines ~105-127)
- 코드: SecureStore 용량 초과 시 `AsyncStorage.setItem` 으로 폴백

### 문제
`AsyncStorage` 는 암호화되지 않은 평문 저장소(iOS NSUserDefaults / Android
sqlite)이다. 세션(JWT + refresh token)이 평문으로 기기에 저장되면 루팅/탈옥
기기나 백업 추출 공격에 노출된다.

### 완화 방안 — 두 가지 옵션

#### 옵션 A: expo-crypto 로 암호화 후 AsyncStorage 저장
- 앱 고유 키로 세션을 대칭 암호화한 뒤 AsyncStorage 에 기록.
- 장점: 용량 초과 시에도 기밀성 유지.
- 단점: 암호화 키 보관 위치(Keychain)가 다시 용량 제한에 걸릴 수 있음.
  의존성(`expo-crypto`) 추가. 구현 복잡도 상승.

#### 옵션 B (권장): 폴백 제거, 용량 초과 시 throw
- AsyncStorage 폴백을 완전히 제거하고, SecureStore 용량 초과 시 에러를 throw.
- 장점: 평문 세션 저장 경로 자체가 사라져 보안면에서 단순/안전.
- 단점: 용량 초과 발생 시 세션 저장 실패 → 사용자 재로그인 필요.
- MVP 단계에서는 안정성(보안) > 가용성(재로그인 빈도) 이므로 권장.

### 결정 필요 (문서화)
- 본 완화 방안의 최종 결정은 **SPEC-AUTH-001** 에서 다룬다.
- MVP 기본값: **옵션 B 채택**. 용량 실패가 빈번하게 관측되면 옵션 A 를
  재검토한다.

### 적용 시점
- SPEC-AUTH-001 구현 단계에서 폴백 제거 또는 암호화 적용.

---

## H3: `errors.ts` classifyError — NETWORK/AUTH 판별 순서

### 현위치
- 파일: `src/lib/api/errors.ts`
- 함수: `classifyError` (lines ~136-196)
- 코드: lines 146-172, NETWORK 분기가 status === undefined 일 때만 평가되고,
  그 안에서 AUTH 메시지가 아닐 때 NETWORK 로 분류.

### 문제
현재 구조에서는 HTTP `status` 가 존재할 때 NETWORK 분기 자체가 건너뛰어지므로
대부분의 경우 문제가 없으나, 메시지 패턴 매칭이 HTTP status 보다 먼저
평가되는 경로(TypeError + status undefined)에서 AUTH 메시지가 섞여 있으면
분류가 뒤엉킬 수 있다. HTTP status 는 가장 신뢰할 수 있는 분류 근거이므로
우선순위가 가장 높아야 한다.

### 권장 리팩터링 방향 (로직 미변경 — 후속 PR)
HTTP `status` 기반 분기를 **가장 먼저** 평가하도록 순서를 조정한다.

**제안 순서:**
1. status 401 → AUTH
2. status 403 + code 42501 → RLS_DENIED
3. status 403 → AUTH (또는 RLS_DENIED, 정책에 따라)
4. status 400 또는 code 23505/23502/23514 → VALIDATION
5. status 404 또는 code PGRST116 → NOT_FOUND
6. status 5xx → SERVER
7. status undefined + TypeError / 네트워크 메시지 → NETWORK
8. AUTH 메시지/코드 (status 없음) → AUTH
9. UNKNOWN (fallback)

이렇게 하면 HTTP status 가 존재하는 모든 케이스가 메시지 패턴 매칭보다 먼저
확정되어, 401/403 분류 오류를 원천 차단한다.

### 제약 (본 작업에서는 미적용)
- 본 완화 작업 범위에서는 classifyError 로직을 **변경하지 않는다** (리뷰
  범위 제약). 코드에 MX 태그만 추가한다.
- 위 리팩터링은 별도 SPEC(또는 SPEC-API-001 follow-up)에서 TDD 로 검증 후
  적용한다. 변경 시 기존 classifyError 테스트 케이스가 모두 통과해야 한다.

### 적용 시점
- SPEC-API-001 follow-up PR (또는 별도 에러 분류 개선 SPEC).

---

## 요약

| 이슈 | 위험 | 본 작업 조치 | 후속 조치 |
|------|------|------------|---------|
| H1 | Sentry 로 민감정보 유출 | 완화 계획 문서화 | redactForLogging 헬퍼 추가 (후속 PR) |
| H2 | 평문 세션 저장 | 완화 계획 문서화 | 폴백 제거/암호화 (SPEC-AUTH-001) |
| H3 | 에러 분류 순서 | 완화 계획 문서화 | status 우선 분기 (후속 PR) |
