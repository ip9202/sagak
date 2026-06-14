---
# NOTE: `created` is the canonical field name per MoAI plan workflow Phase 2
# (8-field frontmatter: id, version, status, created, updated, author, priority,
# issue_number). Do NOT rename to `created_at` — orchestrator ruling on MP-3.
id: SPEC-COMPLETION-001
title: "완독 다이어리 및 아카이브 시각화 — Acceptance Criteria"
spec: SPEC-COMPLETION-001
version: "1.0.0"
status: draft
created: 2026-06-14
updated: 2026-06-14
author: "강력쇠주먹"
priority: medium
issue_number: 0
labels: [completion, diary, archive, visualization, emotion-curve, frontend]
---

# SPEC-COMPLETION-001 인수 기준

## 1. 개요

본 문서는 SPEC-COMPLETION-001의 인수 기준을 Given/When/Then(Gherkin) 형식으로 정의한다.
각 시나리오는 관측 가능한 증거(observable evidence)를 요구한다.

> **추적성 메모**: spec.md의 EARS 요구사항(REQ-COMP-001 ~ REQ-COMP-010)은 아래 Gherkin
> Feature들이 검증한다. 각 Feature 헤더는 `검증 REQ: REQ-COMP-XXX` 형식으로 부모 EARS REQ를
> 명시한다. 모든 REQ-COMP-XXX는 최소 하나의 Gherkin 시나리오에 매핑된다.

### REQ → 시나리오 매핑 요약

| REQ ID | 검증 시나리오 |
|--------|---------------|
| REQ-COMP-001 | 시나리오 1, 2 |
| REQ-COMP-002 | 시나리오 3 |
| REQ-COMP-003 | 시나리오 4 |
| REQ-COMP-004 | 시나리오 5, 6 |
| REQ-COMP-005 | 시나리오 7, 8 |
| REQ-COMP-006 | 시나리오 9 |
| REQ-COMP-007 | 시나리오 10 |
| REQ-COMP-008 | 시나리오 11 |
| REQ-COMP-009 | 시나리오 12 |
| REQ-COMP-010 | 시나리오 13 |

---

## 2. 핵심 시나리오

### 시나리오 1: 완독 처리 후 리포트 조회 성공

**검증 REQ**: REQ-COMP-001

```gherkin
Feature: 완독 리포트 존재 확인

  Scenario: 완독 처리 직후 리포트를 1회 조회로 가져온다
    Given 사용자가 user_books.status를 "reading"에서 "completed"로 전환했다
    And DB 트리거가 동일 트랜잭션 커밋 시점에 completion_reports 행을 생성했다
    When 클라이언트가 "GET /rest/v1/completion_reports?user_book_id=eq.{uuid}"를 호출한다
    Then 응답에 report_data가 포함된 completion_reports 행이 반환된다
    And report_data에 emotion_curve, highlights, total_records 키가 모두 존재한다
```

### 시나리오 2: 리포트 조회 재시도 및 에러 처리

**검증 REQ**: REQ-COMP-001

```gherkin
Feature: 완독 리포트 재시도 로직

  Scenario: 일시적 실패 후 재시도로 리포트를 가져온다
    Given 사용자가 완독 처리를 완료했다
    And 첫 번째 GET 요청이 네트워크 에러로 실패했다
    When 클라이언트가 재시도 로직을 실행한다
    Then 두 번째 시도에서 리포트가 반환된다
    And 사용자에게 다이어리가 정상적으로 표시된다

  Scenario: 최대 재시도 초과 시 에러 상태를 표시한다
    Given 사용자가 완독 처리를 완료했다
    And 3회 재시도 모두 빈 응답을 반환한다
    When 재시도 한계에 도달하면
    Then 시스템은 "완독 리포트를 불러올 수 없어요" 에러 메시지를 표시한다
    And 다이어리 진입이 차단된다
    And 재시도 버튼이 노출된다
```

### 시나리오 3: 완독 다이어리 진입점 제공

**검증 REQ**: REQ-COMP-002

```gherkin
Feature: 완독 다이어리 진입점

  Scenario: 완독 상태 서재 항목에 다이어리 진입 버튼이 노출된다
    Given 사용자의 서재에 status="completed"인 항목이 있다
    When 서재 화면이 렌더링되면
    Then 해당 항목에 완독 다이어리 진입 버튼이 표시된다

  Scenario: 진입 버튼 탭 시 다이어리 화면으로 이동한다
    Given 사용자가 완독 다이어리 진입 버튼을 볼 수 있다
    When 사용자가 진입 버튼을 탭한다
    Then completion_reports에서 해당 user_book_id의 report_data가 조회된다
    And 완독 다이어리 화면으로 네비게이션된다
```

### 시나리오 4: 타인 리포트 접근 차단 (RLS)

**검증 REQ**: REQ-COMP-003

```gherkin
Feature: RLS 기반 타인 리포트 접근 차단

  Scenario: 타인의 user_book_id로 조회 시 빈 결과를 반환한다
    Given 사용자 A가 완독하여 completion_reports 행을 가지고 있다
    And 사용자 B가 별도로 인증되어 있다
    When 사용자 B가 "GET /rest/v1/completion_reports?user_book_id=eq.{A의 uuid}"를 호출한다
    Then 응답이 빈 배열을 반환한다
    And 사용자 B의 클라이언트는 이를 "리포트 없음"으로 처리한다

  Scenario: 클라이언트는 RLS를 신뢰하며 추가 검증을 수행하지 않는다
    Given RLS 정책(REQ-DB-021)이 auth.uid()=user_id 조건으로 동작한다
    When 클라이언트가 리포트를 조회하면
    Then 반환된 행은 항상 본인 소유임이 보장된다
    And 클라이언트 측 user_id 일치 검사 로직은 존재하지 않는다
```

### 시나리오 5: report_data 정상 파싱

**검증 REQ**: REQ-COMP-004

```gherkin
Feature: report_data 스키마 파싱

  Scenario: 정상 report_data를 ReportData 인터페이스로 파싱한다
    Given completion_reports.report_data에 다음 JSON이 저장되어 있다
      """
      { "emotion_curve": [{"page": 12, "emotion": "감동", "count": 3}],
        "highlights": [{"page": 12, "content": "마음이 찡해졌다", "emotion": "감동"}],
        "total_records": 47 }
      """
    When 클라이언트가 report_data를 파싱한다
    Then ReportData 타입 객체가 생성된다
    And emotion_curve[0].page가 12이다
    And highlights[0].content가 "마음이 찡해졌다"이다
    And total_records가 47이다
```

### 시나리오 6: report_data 스키마 불일치 처리

**검증 REQ**: REQ-COMP-004

```gherkin
Feature: report_data 스키마 검증 실패 처리

  Scenario: total_records 키가 누락된 report_data를 감지한다
    Given report_data에 다음 JSON이 저장되어 있다
      """
      { "emotion_curve": [], "highlights": [] }
      """
    When 클라이언트가 Zod 스키마로 파싱을 시도하면
    Then 파싱 에러가 발생한다
    And 에러가 로깅된다
    And 다이어리가 "데이터 오류" 상태로 표시된다 (빈 상태와 구분)

  Scenario: emotion_curve 요소의 page가 숫자가 아닌 경우 감지한다
    Given report_data.emotion_curve[0].page가 "12" (문자열)이다
    When 클라이언트가 Zod 스키마로 파싱을 시도하면
    Then 타입 불일치 에러가 발생한다
    And 다이어리가 "데이터 오류" 상태로 표시된다
```

### 시나리오 7: 감정 기록 0건 빈 상태 처리

**검증 REQ**: REQ-COMP-005

```gherkin
Feature: 감정 기록 0건 케이스

  Scenario: total_records=0일 때 빈 상태 메시지를 표시한다
    Given 사용자가 완독했지만 감정 기록을 1건도 남기지 않았다
    And report_data가 { emotion_curve: [], highlights: [], total_records: 0 }이다
    When 클라이언트가 다이어리를 렌더링하면
    Then "기록된 감정이 없어요" 빈 상태 메시지가 표시된다
    And 에러 상태 메시지는 표시되지 않는다
    And 감정 곡선 차트 영역이 렌더링되지 않는다
    And 하이라이트 리스트 영역이 렌더링되지 않는다
```

### 시나리오 8: 감정 기록 1건 이상 정상 시각화

**검증 REQ**: REQ-COMP-005

```gherkin
Feature: 감정 기록 존재 시 시각화

  Scenario: total_records >= 1일 때 감정 곡선과 하이라이트를 표시한다
    Given report_data가 total_records=47, emotion_curve 길이 5, highlights 길이 3이다
    When 클라이언트가 다이어리를 렌더링하면
    Then 감정 곡선 차트가 5개 포인트로 렌더링된다
    And 하이라이트 리스트가 3개 카드로 렌더링된다
    And 빈 상태 메시지는 표시되지 않는다
```

### 시나리오 9: 감정 곡선 차트 시각화

**검증 REQ**: REQ-COMP-006

```gherkin
Feature: 감정 곡선 차트

  Scenario: emotion_curve 포인트를 차트로 시각화한다
    Given report_data.emotion_curve에 3개 이상의 포인트가 있다
    When 클라이언트가 EmotionCurveChart 컴포넌트를 렌더링하면
    Then 차트가 x축(page)과 y축(count)으로 포인트를 표시한다
    And 감정 종류별로 고유한 색상 토큰이 적용된다

  Scenario: emotion_curve에 1개 포인트만 있어도 차트가 렌더링된다
    Given report_data.emotion_curve에 1개 포인트만 있다
    When 클라이언트가 EmotionCurveChart를 렌더링하면
    Then 단일 포인트가 차트에 표시된다
    And 에러가 발생하지 않는다

  Scenario: emotion_curve가 빈 배열이면 차트 영역이 렌더링되지 않는다
    Given report_data.emotion_curve가 빈 배열이다
    And total_records는 0이다
    When 클라이언트가 다이어리를 렌더링하면
    Then EmotionCurveChart 컴포넌트가 마운트되지 않는다 (빈 상태 처리)
```

### 시나리오 10: 하이라이트 카드 리스트 시각화

**검증 REQ**: REQ-COMP-007

```gherkin
Feature: 하이라이트 감정 기록 표시

  Scenario: highlights 배열을 카드 리스트로 표시한다
    Given report_data.highlights에 2개의 하이라이트가 있다
    When 클라이언트가 HighlightList 컴포넌트를 렌더링하면
    Then 2개의 카드가 리스트 형태로 표시된다
    And 각 카드에 페이지 번호, 감정, 기록 내용이 포함된다

  Scenario: 하이라이트 카드는 SPEC-UI-001 디자인 패턴을 따른다
    Given HighlightList가 렌더링된다
    Then 카드 스타일이 SPEC-UI-001의 EmotionRecordCard 디자인 패턴과 일관된다
    And 디자인 토큰(tokens.ts)의 색상·간격 값이 적용된다
```

### 시나리오 11: 총 감정 기록 수 표시

**검증 REQ**: REQ-COMP-008

```gherkin
Feature: 총 감정 기록 수 표시

  Scenario: total_records를 헤더 영역에 표시한다
    Given report_data.total_records가 47이다
    When 클라이언트가 완독 다이어리를 렌더링하면
    Then 헤더 영역에 "이 책에서 남긴 감정 47개" 텍스트가 표시된다

  Scenario: total_records=0이면 빈 상태와 함께 "0개"를 표시한다
    Given report_data.total_records가 0이다
    When 클라이언트가 다이어리를 렌더링하면
    Then 헤더 영역에 "이 책에서 남긴 감정 0개"가 표시된다
    And "기록된 감정이 없어요" 빈 상태 메시지가 함께 표시된다
```

### 시나리오 12: 완독 축하 메시지 표시

**검증 REQ**: REQ-COMP-009

```gherkin
Feature: 완독 축하 메시지

  Scenario: 다이어리 상단에 축하 메시지를 표시한다
    Given 사용자가 완독 다이어리를 연다
    When CompletionDiaryScreen이 렌더링되면
    Then 다이어리 상단에 "이 책과의 여정을 완성하셨어요" 축하 메시지가 표시된다

  Scenario: 축하 메시지는 에러 상태에서는 표시되지 않는다
    Given 리포트 조회가 최대 재시도 초과로 실패했다
    When 다이어리가 에러 상태로 렌더링되면
    Then 축하 메시지가 표시되지 않는다
    And 에러 메시지만 표시된다
```

### 시나리오 13: 완독 배지 표시

**검증 REQ**: REQ-COMP-010

```gherkin
Feature: 완독 배지

  Scenario: 축하 메시지 영역에 배지 아이콘을 표시한다
    Given 사용자가 완독 다이어리를 정상적으로 열었다
    When CelebrationHeader가 렌더링되면
    Then 완독 배지 아이콘이 축하 메시지와 함께 표시된다
    And 배지에 SPEC-UI-001 강조색(amber brown 토큰)이 적용된다
```

---

## 3. 엣지 케이스 시나리오

### 시나리오 14: 완독 → reading 복귀 → 재완독 사이클

```gherkin
Feature: 완독 사이클 멱등성

  Scenario: 완독을 취소하고 다시 완독해도 리포트가 1개만 존재한다
    Given 사용자가 첫 완독으로 completion_reports 행을 1개 가지고 있다
    And UNIQUE(user_book_id) 제약과 ON CONFLICT DO NOTHING이 적용되어 있다
    When 사용자가 status를 "completed" → "reading" → "completed"로 전환한다
    Then completion_reports 테이블에 해당 user_book_id의 행이 여전히 1개이다
    And 클라이언트는 동일한 report_data를 조회한다

  Scenario: 완독 취소 상태에서 다이어리 접근 정책은 본 SPEC 범위 밖이다
    Given 사용자가 status를 "completed"에서 "reading"으로 되돌렸다
    And completion_reports 행은 삭제되지 않았다
    Then 다이어리 숨김/표시 정책은 미결정 사항(6.3)으로 본 SPEC 범위 밖이다
    But 리포트 데이터 자체는 RLS로 조회 가능하다
```

### 시나리오 15: 대량 하이라이트 렌더링 성능

```gherkin
Feature: 하이라이트 대량 렌더링

  Scenario: highlights가 50개 이상일 때 성능을 유지한다
    Given report_data.highlights에 50개의 하이라이트가 있다
    When 클라이언트가 HighlightList를 렌더링하면
    Then 모든 카드가 스크롤 가능한 리스트로 표시된다
    And 초기 렌더링이 체감 지연 없이 완료된다 (FlatList 가상화 적용)
```

### 시나리오 16: 오프라인 상태에서 다이어리 조회

```gherkin
Feature: 오프라인 에러 처리

  Scenario: 네트워크 단절 시 명확한 에러 메시지를 표시한다
    Given 사용자의 기기가 오프라인 상태이다
    When 클라이언트가 GET /completion_reports를 호출하면
    Then 네트워크 에러가 발생한다
    And 재시도 로직이 3회 실행된 후 에러 상태로 전환된다
    And "네트워크 연결을 확인해주세요" 메시지가 표시된다
    And 재시도 버튼이 노출된다
```

### 시나리오 17: 세션 만료 시 조회 실패

```gherkin
Feature: 인증 세션 만료

  Scenario: 세션이 만료된 상태에서 리포트 조회 시 인증 에러를 처리한다
    Given 사용자의 Supabase 세션이 만료되었다
    When 클라이언트가 GET /completion_reports를 호출하면
    Then PostgREST가 401 Unauthorized를 반환한다
    And 클라이언트는 인증 에러로 처리한다
    And SPEC-AUTH-001의 재인증 플로우로 연결된다 (본 SPEC 범위 밖, 로깅만 수행)
```

---

## 4. 품질 게이트 (Quality Gates)

### TRUST 5 검증 기준

| 기둥 | 기준 | 검증 방법 |
|------|------|----------|
| Tested | 85%+ 커버리지, 모든 REQ-COMP-XXX 최소 1개 시나리오 | Jest + @testing-library/react-native |
| Readable | 한국어 주석, 명확한 변수명, SPEC-UI-001 패턴 준수 | ESLint + 코드 리뷰 |
| Unified | SPEC-UI-001 디자인 토큰 사용, TypeScript strict | Prettier + tsc --noEmit |
| Secured | RLS 신뢰(클라이언트 검증 최소화), 에러 로깅 | 시나리오 4, 6, 16, 17 검증 |
| Trackable | conventional commits, SPEC-COMPLETION-001 참조 | git log + PR 템플릿 |

### Definition of Done (DoD)

- [ ] 모든 REQ-COMP-001 ~ REQ-COMP-010이 시나리오 1~13으로 검증됨
- [ ] 엣지 케이스 시나리오 14~17 처리 로직 구현됨
- [ ] 단위 테스트 커버리지 85% 이상 달성
- [ ] 통합 테스트(완독 처리 → 다이어리 진입 → 렌더) 통과
- [ ] SPEC-UI-001 디자인 토큰 적용 확인
- [ ] 차트 라이브러리(미결정 6.1) 확정 및 호환성 검증
- [ ] SPEC-DB-001 report_data 읽기 전용 계약 준수 확인 (생성 로직 미구현)
- [ ] 빈 상태 / 에러 상태 / 데이터 오류 상태 3종 분기 처리 확인

---

## 5. 검증 도구 및 방법

| 검증 영역 | 도구 | 대상 |
|-----------|------|------|
| 단위 테스트 | Jest | completionApi, useCompletionReport, Zod 스키마 |
| 컴포넌트 테스트 | @testing-library/react-native | EmotionCurveChart, HighlightList, CelebrationHeader, CompletionDiaryScreen |
| 타입 검증 | tsc --noEmit (strict) | 전체 산출물 |
| 린트 | ESLint 9 flat config | 전체 산출물 |
| 포맷팅 | Prettier | 전체 산출물 |
| RLS 검증 | PostgREST 직접 호출 (테스트 환경) | 시나리오 4 |
| 접근성 (권장) | react-native 접근성 속성 검사 | 차트, 카드 리스트 |
