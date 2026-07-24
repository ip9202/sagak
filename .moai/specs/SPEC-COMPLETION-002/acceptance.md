---
# NOTE: `created` is the canonical field name per MoAI plan workflow Phase 2
# (8-field frontmatter: id, version, status, created, updated, author, priority,
# issue_number). Do NOT rename to `created_at` — orchestrator ruling on MP-3.
id: SPEC-COMPLETION-002
title: "완독 다이어리 아카이브(리스트) + 상세 재설계 — Acceptance Criteria"
spec: SPEC-COMPLETION-002
version: "1.0.0"
status: completed
created: 2026-06-27
updated: 2026-07-23
author: "강력쇠주먹"
priority: medium
issue_number: 0
labels: [completion, diary, archive, list, redesign, frontend, pencil]
---

# SPEC-COMPLETION-002 인수 기준

## 1. 개요

본 문서는 SPEC-COMPLETION-002의 인수 기준을 Given/When/Then(Gherkin) 형식으로 정의한다.
각 시나리오는 관측 가능한 증거(observable evidence)를 요구한다.

> **추적성 메모**: spec.md의 EARS 요구사항(REQ-COMP2-001 ~ REQ-COMP2-016)은 아래 Gherkin
> Feature들이 검증한다. 각 Feature 헤더는 `검증 REQ: REQ-COMP2-XXX` 형식으로 부모 EARS REQ를
> 명시한다. 모든 REQ-COMP2-XXX는 최소 하나의 Gherkin 시나리오에 매핑된다.

### REQ → 시나리오 매핑 요약

| REQ ID | 검증 시나리오 |
|--------|---------------|
| REQ-COMP2-001 | 시나리오 1 |
| REQ-COMP2-002 | 시나리오 2, 3 |
| REQ-COMP2-003 | 시나리오 4 |
| REQ-COMP2-004 | 시나리오 5 |
| REQ-COMP2-005 | 시나리오 6 |
| REQ-COMP2-006 | 시나리오 7 |
| REQ-COMP2-007 | 시나리오 8 |
| REQ-COMP2-008 | 시나리오 9 |
| REQ-COMP2-009 | 시나리오 10 |
| REQ-COMP2-010 | 시나리오 11 |
| REQ-COMP2-011 | 시나리오 12 |
| REQ-COMP2-012 | 시나리오 13 |
| REQ-COMP2-013 | 시나리오 14 |
| REQ-COMP2-014 | 시나리오 15 |
| REQ-COMP2-015 | 시나리오 16 |
| REQ-COMP2-016 | 시나리오 17 |

---

## 2. 핵심 시나리오

### 시나리오 1: 완독 다이어리 리스트 라우트 존재

**검증 REQ**: REQ-COMP2-001

```gherkin
Feature: 완독 다이어리 리스트 라우트

  Scenario: 리스트 라우트가 노출된다
    Given Expo Router가 라우트 맵을 구성했다
    When 앱이 시작되면
    Then 완독 다이어리 리스트 라우트(/completion 또는 동등 my 서브 라우트)가 노출된다
    And 기존 상세 라우트 /completion/{bookId}(SPEC-COMPLETION-001)와 공존한다

  Scenario: 리스트 라우트에 접근하면 리스트 화면이 렌더링된다
    Given 인증된 사용자가 완독 다이어리 리스트 라우트로 이동했다
    When 리스트 화면이 마운트되면
    Then StatusBar + Header("완독 다이어리") + Content 3계층 레이아웃이 렌더링된다 (SPEC-UI-002)
```

### 시나리오 2: 완독 다이어리 리스트 쿼리 성공

**검증 REQ**: REQ-COMP2-002

```gherkin
Feature: 완독 다이어리 리스트 쿼리

  Scenario: completed 항목을 books + completion_reports 조인으로 가져온다
    Given 사용자에게 status='completed'인 user_books 항목이 3개 있다
    And 각 항목에 completion_reports 행이 1개씩 존재한다 (UNIQUE user_book_id)
    When 리스트 화면이 fetchCompletionDiaryList를 호출한다
    Then 3개의 CompletionDiaryListItem이 반환된다
    And 각 항목은 userBookId, bookId, title, author, coverUrl, completedAt, totalRecords, recentHighlight 필드를 가진다
    And 항목이 completed_at DESC 순으로 정렬된다

  Scenario: RLS가 본인 completed 항목만 반환한다
    Given 사용자 A와 사용자 B가 각각 completed 항목을 가지고 있다
    When 사용자 A가 리스트 쿼리를 호출하면
    Then 사용자 A의 항목만 반환된다 (RLS auth.uid()=user_id 자동 필터링)
    And 클라이언트는 user_id를 별도 전송하지 않는다
```

### 시나리오 3: 리스트 쿼리 데이터 셰이프 파싱

**검증 REQ**: REQ-COMP2-002

```gherkin
Feature: CompletionDiaryListItem 파싱

  Scenario: report_data에서 totalRecords와 recentHighlight를 추출한다
    Given completion_reports.report_data에 다음 JSON이 저장되어 있다
      """
      { "emotion_curve": [{"page_number": 42, "emotion_count": 3}],
        "highlights": [{"page_number": 42, "content": "마음이 찡해졌다"}, {"page_number": 118, "content": "두 번째"}],
        "total_records": 12 }
      """
    When 리스트 쿼리가 항목을 파싱하면
    Then totalRecords가 12이다
    And recentHighlight가 "마음이 찡해졌다"이다 (highlights[0].content — 가장 최근 기록)

  Scenario: completion_reports 행이 없는 completed 항목을 안전하게 처리한다
    Given user_books.status='completed'이지만 completion_reports 행이 아직 없는 항목이 있다 (트리거 지연)
    When 리스트 쿼리가 항목을 파싱하면
    Then totalRecords가 0으로 폴백된다
    And recentHighlight가 null이다
    And 항목이 리스트에서 누락되지 않고 렌더링된다 (LEFT JOIN 동작)
```

### 시나리오 4: DiaryCard 렌더링

**검증 REQ**: REQ-COMP2-003

```gherkin
Feature: DiaryCard 시각화

  Scenario: DiaryCard가 F08 구조로 렌더링된다
    Given CompletionDiaryListItem에 title, coverUrl, completedAt, totalRecords, recentHighlight가 있다
    When DiaryCard가 렌더링되면
    Then Cover(60x84, cornerRadius 6), BookTitle(fontSize 15 weight 600), Meta 행이 표시된다
    And Meta 행에 "완독 {completedAt}"과 "기록 {totalRecords}개"가 표시된다
    And Highlight 미리보기가 최대 2줄(numberOfLines=2)로 표시된다
    And Chevron(chevron-right)이 우측에 표시된다
    And 카드 스타일이 SPEC-UI-002 FROZEN 패턴(bg-surface, cornerRadius 16, padding 16)을 따른다

  Scenario: coverUrl이 null이면 플레이스홀더를 표시한다
    Given CompletionDiaryListItem.coverUrl이 null이다
    When DiaryCard가 렌더링되면
    Then Cover 영역에 brand-200 플레이스홀더가 표시된다

  Scenario: recentHighlight가 null이면 미리보기 줄을 생략한다
    Given totalRecords=0이고 recentHighlight=null이다
    When DiaryCard가 렌더링되면
    Then Highlight 미리보기 줄이 렌더링되지 않는다
    And Meta 행("기록 0개")은 표시된다
```

### 시나리오 5: 완독 권수 요약 통계 (비경쟁)

**검증 REQ**: REQ-COMP2-004

```gherkin
Feature: 완독 권수 요약

  Scenario: 리스트 상단에 N권 완독 통계를 표시한다
    Given 사용자가 12권의 책을 완독했다 (completed 항목 12개)
    When 리스트 화면이 렌더링되면
    Then 리스트 상단에 "지금까지 12권 완독" 통계가 표시된다 (text-secondary, fontSize 13, weight 500, 중앙 정렬)

  Scenario: 타인 비교 지표를 포함하지 않는다
    Given 리스트 화면이 렌더링된다
    Then 요약 통계에 좋아요 수, 팔로워 수, 랭킹, 리더보드가 포함되지 않는다 (constitution Non-competition)
```

### 시나리오 6: 리스트 빈 상태 + CTA 재지정

**검증 REQ**: REQ-COMP2-005

```gherkin
Feature: 리스트 빈 상태

  Scenario: 완독한 책이 0권이면 EmptyState를 표시한다
    Given 사용자의 completed 항목이 0개이다
    When 리스트 화면이 렌더링되면
    Then EmptyState 컴포넌트가 F08-Empty 오버라이드로 표시된다
    And 아이콘이 "sparkles"이다
    And 타이틀이 "완독한 책이 아직 없어요"이다
    And 서브가 "첫 책을 끝까지 읽어보세요"이다

  Scenario: 빈 상태 CTA가 서재 탭(읽는중)으로 이동한다
    Given 사용자가 빈 상태의 CTA 버튼을 볼 수 있다
    When 사용자가 CTA를 탭한다
    Then CTA 라벨이 "읽으러 가기"이다
    And 서재 탭의 읽는중 필터로 네비게이션한다
```

### 시나리오 7: 리스트 → 상세 네비게이션

**검증 REQ**: REQ-COMP2-006

```gherkin
Feature: 리스트 카드 탭 네비게이션

  Scenario: DiaryCard 탭 시 상세 라우트로 이동한다
    Given 사용자가 DiaryCard를 볼 수 있다
    When 사용자가 DiaryCard를 탭한다
    Then 완독 다이어리 상세 라우트(/completion/{bookId})로 이동한다
    And bookId 파라미터가 항목의 bookId로 전달된다

  Scenario: 상세 라우트는 bookId를 userBookId로 변환한다
    Given 리스트에서 전달된 bookId가 있다
    When 상세 라우트 app/(tabs)/completion/[bookId].tsx가 마운트되면
    Then useLibraryItem이 bookId/userId로 userBookId를 조회한다 (SPEC-COMPLETION-001)
    And CompletionDiaryScreen이 userBookId로 리포트를 조회한다
```

### 시나리오 8: 리스트 당겨서 새로고침

**검증 REQ**: REQ-COMP2-007

```gherkin
Feature: 리스트 새로고침

  Scenario: 아래로 당기면 리스트 쿼리를 다시 실행한다
    Given 사용자가 완독 다이어리 리스트를 보고 있다
    When 사용자가 아래로 당겨서 새로고침 제스처를 수행한다
    Then fetchCompletionDiaryList가 다시 실행된다
    And 최신 완독 상태가 반영된다 (새로 완독한 책이 있으면 추가됨)
```

### 시나리오 9: 상세 화면 F09 구조 정합

**검증 REQ**: REQ-COMP2-008

```gherkin
Feature: 상세 화면 F09 재설계

  Scenario: success 상태에서 4개 섹션이 F09 구조로 배치된다
    Given 상세 화면이 success 상태로 렌더링된다 (total_records >= 1)
    When CompletionDiaryScreen이 렌더링되면
    Then CelebrationHeader 카드(brand-50, cornerRadius 16)가 표시된다
    And CelebrationHeader에 Cover(72x100), 완독 Badge(pill, brand-500, "완독"), Message("이 책과의 여정을 완성하셨어요"), CompletedDate("{date} 완독")가 포함된다
    And RecordsHeader("이 책에 남긴 감정 기록 {N}개")가 표시된다
    And EmotionCurveChart 카드(bg-surface, cornerRadius 16)가 표시된다
    And HighlightList 카드(bg-surface, cornerRadius 16)가 표시된다
    And 섹션들이 vertical gap 24로 배치된다

  Scenario: 데이터 로직(001)은 유지된다
    Given 상세 화면이 렌더링된다
    Then useCompletionReport(001)가 6상태 분기를 담당한다
    And fetchReport(001)가 리포트를 조회한다
    And ReportData 타입(001)이 재사용된다
```

### 시나리오 10: EmotionCurveChart 카드 컨트랙트

**검증 REQ**: REQ-COMP2-009

```gherkin
Feature: EmotionCurveChart F09 카드

  Scenario: 차트 카드에 라벨과 캡션이 포함된다
    Given report_data.emotion_curve에 1개 이상의 포인트가 있다
    When EmotionCurveChart 카드가 렌더링되면
    Then 카드 라벨 "감정 곡선"(text-tertiary, 11, weight 600)이 표시된다
    And 캡션(text-tertiary, fontSize 10)이 표시된다
    And 차트 영역(height 120, bg-muted, cornerRadius 8)이 표시된다

  Scenario: 차트는 page × emotion_count를 단일 brand-500으로 시각화한다
    Given report_data.emotion_curve에 [{page_number: 10, emotion_count: 2}, {page_number: 50, emotion_count: 5}]가 있다
    When EmotionCurveChart가 렌더링되면
    Then x축이 page_number, y축이 emotion_count로 바인딩된다
    And 단일 brand-500(#C17B2F) 컬러가 적용된다 (001 REQ-COMP-006 재사용)
    And peak(emotion_count=5 포인트)가 점으로 강조 표시된다

  Scenario: emotion_curve가 1개 포인트여도 차트가 렌더링된다
    Given report_data.emotion_curve에 1개 포인트만 있다
    When EmotionCurveChart가 렌더링되면
    Then 단일 포인트가 차트에 표시된다
    And 에러가 발생하지 않는다 (001 시나리오 9와 일관)
```

### 시나리오 11: 상세 화면 빈 상태 (F09-Empty)

**검증 REQ**: REQ-COMP2-010

```gherkin
Feature: 상세 화면 빈 상태

  Scenario: total_records=0이면 CelebrationHeader는 유지하고 차트/리스트는 생략한다
    Given report_data.total_records=0, emotion_curve=[], highlights=[]이다
    When 상세 화면이 empty 상태로 렌더링되면
    Then CelebrationHeader 카드(완독 자체 축하)는 유지된다
    And EmotionCurveChart 카드는 렌더링되지 않는다
    And HighlightList 카드는 렌더링되지 않는다
    And "기록된 감정이 없어요" 메시지가 표시된다 (001 REQ-COMP-005 정합)

  Scenario: 빈 상태는 에러 상태가 아니다
    Given total_records=0 상태이다
    When 상세 화면이 렌더링되면
    Then 에러 메시지는 표시되지 않는다
    And 빈 상태 메시지만 표시된다
```

### 시나리오 12: 상세 화면 뒤로 가기

**검증 REQ**: REQ-COMP2-011

```gherkin
Feature: 상세 화면 Back 네비게이션

  Scenario: Back 버튼 탭 시 리스트로 돌아간다
    Given 사용자가 리스트에서 상세로 진입했다
    When 사용자가 헤더의 Back 버튼(chevron-left)을 탭한다
    Then 완독 다이어리 리스트 화면으로 돌아간다 (또는 router.back()으로 이전 화면)

  Scenario: F08/F09 헤더 모두 Back chevron을 포함한다
    Given 리스트 또는 상세 화면이 렌더링된다
    Then 헤더 좌측에 chevron-left Back 아이콘(24x24, text-primary)이 표시된다
```

### 시나리오 13: 마이 메뉴 진입점 연결

**검증 REQ**: REQ-COMP2-012

```gherkin
Feature: 마이 진입점 (REQ-COMP-002 이행)

  Scenario: 마이 "완독 다이어리" 행 탭 시 리스트로 이동한다
    Given 사용자가 마이 탭을 보고 있다
    And app/(tabs)/my.tsx:539의 "완독 다이어리" 행이 노출된다
    When 사용자가 "완독 다이어리" 행을 탭한다
    Then 완독 다이어리 리스트 라우트(/completion)로 이동한다
    And @MX:TODO 주석이 제거되고 onPress 핸들러가 구현된다

  Scenario: 기존 no-op 동작이 제거된다
    Given my.tsx:539의 onPress가 구현 전이다
    When SPEC-COMPLETION-002 구현이 완료되면
    Then onPress가 router.push('/completion') 또는 동등 네비게이션을 수행한다
```

### 시나리오 14: 서재 completed 항목 진입점

**검증 REQ**: REQ-COMP2-013

```gherkin
Feature: 서재 completed 진입점 (선택)

  Scenario: 서재 completed 항목에서 상세 다이어리로 진입한다
    Given 서재 화면(SPEC-LIBRARY-001)에 status='completed'인 항목이 표시된다
    When 사용자가 해당 항목의 완독 다이어리 진입 액션을 탭한다
    Then 완독 다이어리 상세 라우트(/completion/{bookId})로 이동한다

  Scenario: 진입 액션 UI는 SPEC-LIBRARY-001과 협력하여 확정한다
    Given 서재 completed 항목이 표시된다
    Then 완독 다이어리 진입 액션(아이콘 또는 행 탭)이 노출된다
    But 정확한 UI(아이콘 종류, 배치)는 SPEC-LIBRARY-001 서재 설계와 협력하여 확정한다
```

### 시나리오 15: 로딩 상태

**검증 REQ**: REQ-COMP2-014

```gherkin
Feature: 리스트/상세 로딩 상태

  Scenario: 리스트 쿼리 로딩 중에 로딩 표시를 렌더링한다
    Given 리스트 쿼리가 실행 중이다
    When 리스트 화면이 렌더링되면
    Then 로딩 표시(스켈레톤 또는 ActivityIndicator)가 표시된다
    And StatusBar와 Header 영역은 유지된다 (SPEC-UI-002 REQ-SCREEN-STATE FROZEN)

  Scenario: 상세 리포트 조회 로딩은 001 패턴을 따른다
    Given 상세 화면의 useCompletionReport가 loading 상태이다
    When 상세 화면이 렌더링되면
    Then 001의 로딩 상태 분기가 그대로 동작한다
```

### 시나리오 16: 에러 상태

**검증 REQ**: REQ-COMP2-015

```gherkin
Feature: 리스트/상세 에러 상태

  Scenario: 리스트 쿼리 실패 시 에러 메시지와 재시도 버튼을 표시한다
    Given 리스트 쿼리가 네트워크 에러로 실패했다
    When 리스트 화면이 렌더링되면
    Then 에러 메시지가 표시된다
    And 재시도 버튼이 노출된다

  Scenario: 상세 리포트 에러는 001 패턴을 따른다
    Given 상세 화면의 useCompletionReport가 error/data-error/auth 상태이다
    When 상세 화면이 렌더링되면
    Then 001의 6상태 분기(error/data-error/auth)가 그대로 동작한다

  Scenario: 인증 만료(401) 시 로그인으로 유도한다
    Given 리스트 또는 상세 쿼리가 401 에러를 반환한다
    When 화면이 렌더링되면
    Then 001의 auth 상태 분기와 일관되게 로그인 라우트로 유도된다
```

### 시나리오 17: 비경쟁 원칙 준수

**검증 REQ**: REQ-COMP2-016

```gherkin
Feature: 비경쟁 원칙 (constitution)

  Scenario: 리스트/상세에 타인 비교 지표가 없다
    Given 완독 다이어리 리스트 또는 상세 화면이 렌더링된다
    Then 좋아요 수, 팔로워 수, 랭킹, 리더보드가 표시되지 않는다
    And "N권 완독" 요약은 개인 기록이며 타인 비교가 아니다
```

---

## 3. 엣지 케이스 시나리오

### 시나리오 18: completion_reports 행 누락 (트리거 지연)

```gherkin
Feature: 리포트 없는 completed 항목

  Scenario: LEFT JOIN으로 리포트 없는 항목도 리스트에 표시한다
    Given user_books.status='completed'이지만 completion_reports 행이 없는 항목이 있다
    When 리스트 쿼리가 실행되면
    Then 해당 항목이 totalRecords=0, recentHighlight=null로 리스트에 표시된다
    And 항목이 누락되지 않는다

  Scenario: 리포트 없는 항목의 상세 진입 시 001 재시도 동작
    Given DiaryCard(totalRecords=0)를 탭하여 상세로 진입했다
    When 상세 화면이 fetchReport를 호출하면
    Then 001의 재시도 로직(최대 3회)이 실행된다
    And 재시도 후에도 없으면 001의 error 상태로 표시된다
```

### 시나리오 19: 대량 완독 항목 렌더링 성능

```gherkin
Feature: 대량 완독 리스트 성능

  Scenario: 완독 항목이 50개 이상이어도 성능을 유지한다
    Given 사용자가 50권 이상 완독했다
    When 리스트 화면이 렌더링되면
    Then 모든 DiaryCard가 스크롤 가능한 리스트로 표시된다
    And FlatList 가상화가 적용되어 초기 렌더링이 체감 지연 없이 완료된다
```

### 시나리오 20: 오프라인 상태에서 리스트 조회

```gherkin
Feature: 오프라인 에러 처리

  Scenario: 네트워크 단절 시 에러 메시지를 표시한다
    Given 사용자의 기기가 오프라인 상태이다
    When 리스트 쿼리가 실행되면
    Then 네트워크 에러가 발생한다
    And 에러 메시지와 재시도 버튼이 표시된다 (REQ-COMP2-015)
```

### 시나리오 21: 완독 → reading 복귀 → 리스트 갱신

```gherkin
Feature: 완독 취소 후 리스트 반영

  Scenario: 완독을 취소(reading 복귀)하면 리스트에서 사라진다
    Given 사용자가 리스트를 보고 있다
    When 사용자가 특정 책의 완독을 취소하고 status를 reading으로 되돌린다
    Then 당겨서 새로고침 후 해당 항목이 리스트에서 제거된다
    And completion_reports 행은 삭제되지 않지만(001 제외 범위) status='completed' 조건으로 필터링된다
```

---

## 4. 품질 게이트 (Quality Gates)

### TRUST 5 검증 기준

| 기둥 | 기준 | 검증 방법 |
|------|------|----------|
| Tested | 85%+ 커버리지, 모든 REQ-COMP2-XXX 최소 1개 시나리오 | Jest + @testing-library/react-native |
| Readable | 한국어 주석, 명확한 변수명, SPEC-UI-002 FROZEN 패턴 준수 | ESLint + 코드 리뷰 |
| Unified | SPEC-UI-001/002 디자인 토큰 사용, TypeScript strict | Prettier + tsc --noEmit |
| Secured | RLS 신뢰(클라이언트 user_id 미전송), 에러 로깅 | 시나리오 2, 16, 20 검증 |
| Trackable | conventional commits, SPEC-COMPLETION-002 참조 | git log + PR 템플릿 |

### Definition of Done (DoD)

- [ ] 모든 REQ-COMP2-001 ~ REQ-COMP2-016이 시나리오 1~17로 검증됨
- [ ] 엣지 케이스 시나리오 18~21 처리 로직 구현됨
- [ ] 단위 테스트 커버리지 85% 이상 달성 (리스트 쿼리, DiaryCard, F09 정합)
- [ ] 통합 테스트(마이 진입 → 리스트 → 상세 → 뒤로 가기) 통과
- [ ] SPEC-UI-002 FROZEN 화면 패턴(3계층, 카드, 빈/로딩/에러) 적용 확인
- [ ] SPEC-COMPLETION-001 데이터 계약(ReportData, fetchReport, useCompletionReport) 재사용 확인 (재정의 없음)
- [ ] `.pen` F08/F09 4프레임과 시각적 정합 확인 (Pencil CLI grep 검증)
- [ ] 마이 `@MX:TODO`(my.tsx:539) 제거 및 네비게이션 구현 확인
- [ ] 비경쟁 원칙 준수 확인 (좋아요/팔로워/랭킹 없음)

---

## 5. 검증 도구 및 방법

| 검증 영역 | 도구 | 대상 |
|-----------|------|------|
| 단위 테스트 | Jest | fetchCompletionDiaryList, CompletionDiaryListItem 파싱, DiaryCard |
| 컴포넌트 테스트 | @testing-library/react-native | DiaryCard, 리스트 화면, F09 정합 상세 화면 |
| 통합 테스트 | @testing-library/react-native | 마이 진입 → 리스트 → 상세 플로우 |
| 타입 검증 | tsc --noEmit (strict) | 전체 산출물 |
| 린트 | ESLint 9 flat config | 전체 산출물 |
| 포맷팅 | Prettier | 전체 산출물 |
| RLS 검증 | PostgREST 직접 호출 (테스트 환경) | 시나리오 2 |
| `.pen` 정합 | Pencil CLI (grep/Edit) | F08/F09 4프레임 시각적 계약 |
| 접근성 (권장) | react-native 접근성 속성 검사 | DiaryCard 탭 영역, 차트 라벨 |
