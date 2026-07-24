---
id: SPEC-UI-002
title: "화면 패턴 디자인 시스템 — 인수 기준"
version: "1.0.0"
status: completed
created: 2026-06-14
updated: 2026-07-23
author: "강력쇠주먹"
priority: high
issue_number: 0
labels: [frontend, ui, screen-pattern, acceptance, gherkin, frozen]
---

# SPEC-UI-002: 화면 패턴 디자인 시스템 — 인수 기준 (acceptance.md)

## HISTORY

| 날짜 | 버전 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 2026-06-14 | 1.0.0 | 최초 작성. REQ-SCREEN-* 25개 요구사항의 Given-When-Then 시나리오 정의. | 강력쇠주먹 |

---

## 1. 인수 기준 개요

본 문서는 SPEC-UI-002의 5개 요구사항 모듌(REQ-SCREEN-LAYOUT, REQ-SCREEN-HEADER, REQ-SCREEN-CARD, REQ-SCREEN-STATE, REQ-SCREEN-TABBAR)에 대한 인수 기준을 Given-When-Then(Gherkin) 형식으로 정의한다.

각 시나리오는 **관찰 가능한 증거**(테스트 출력, 파일 존재, 렌더링 결과)를 기반으로 작성되었다.

---

## 2. REQ-SCREEN-LAYOUT: 3계층 화면 레이아웃

### AC-SCREEN-001: 3계층 레이아웃 구조 준수 (REQ-SCREEN-001)

```gherkin
Feature: 3계층 화면 레이아웃 구조

  Scenario: 탭 화면 렌더링 시 3계층 구조 준수
    Given F03-Home 화면이 렌더링됨
    When 사용자가 홈 탭을 확인하면
    Then StatusBar 영역(62px)이 상단에 존재해야 한다
    And Content Wrapper가 좌우 패딩 spacing-4(16px) ~ spacing-5(20px)을 1회 처리해야 한다
    And TabBar가 하단에 부양 캡슐형으로 존재해야 한다

  Scenario: Content Wrapper 패딩 중복 금지
    Given 화면의 Content Wrapper가 좌우 패딩을 설정함
    When 하위 섹션 또는 카드가 렌더링되면
    Then 하위 요소가 동일 좌우 패딩을 중복 적용하지 않아야 한다
    And 하위 요소의 좌우 여백이 Content Wrapper 패딩과 일관되어야 한다
```

**증거**: 컴포넌트 트리 스냅샷; Content Wrapper의 `paddingHorizontal` 스타일 검증; 하위 요소의 `paddingHorizontal` 미존재 검증.

### AC-SCREEN-002: 단일 컬럼 세로 스크롤 (REQ-SCREEN-002)

```gherkin
Feature: 단일 컬럼 레이아웃

  Scenario: 기본 단일 컬럼 레이아웃
    Given 임의의 탭 화면이 렌더링됨
    When 화면 레이아웃을 확인하면
    Then 콘텐츠가 단일 컬럼으로 수직 배치되어야 한다
    And 세로 스크롤이 기본 동작이어야 한다

  Scenario: 멀티 컬럼 제한적 허용
    Given 책 표지 갤러리 등 명시적 멀티 컬럼이 필요한 화면
    When 해당 화면이 렌더링되면
    Then 멀티 컬럼 그리드가 허용될 수 있다
    But 일반 콘텐츠 화면은 단일 컬럼을 유지해야 한다
```

**증거**: 레이아웃 덤프; `flexDirection: 'row'`가 명시적 갤러리 화면에만 존재하는지 grep 검증.

### AC-SCREEN-003: 섹션 간격 규칙 (REQ-SCREEN-003)

```gherkin
Feature: 섹션 간격 규칙

  Scenario: 관련 섹션 간 간격
    Given 화면 내 관련된 복수 섹션이 존재함
    When 섹션 간 수직 간격을 측정하면
    Then 간격이 spacing-4(16px)이어야 한다

  Scenario: 독립 섹션(메이저 구분) 간 간격
    Given 화면 내 독립적인 메이저 섹션이 존재함
    When 섹션 간 수직 간격을 측정하면
    Then 간격이 spacing-6(24px) ~ spacing-8(32px) 범위여야 한다
```

**증거**: 섹션 간 `marginTop`/`marginBottom` 스타일 값 검증; `spacing` 토큰 사용 확인.

### AC-SCREEN-004: 터치타겟 최소 크기 (REQ-SCREEN-004)

```gherkin
Feature: 터치타겟 접근성

  Scenario: 상호작용 요소 터치타겟 크기
    Given 화면에 버튼, 탭, 아이콘 버튼, 카드 터치 영역이 존재함
    When 각 요소의 터치타겟 영역을 측정하면
    Then 모든 요소의 터치타겟이 44dp 이상이어야 한다

  Scenario: 작은 아이콘의 패딩 래퍼
    Given 22-24px 아이콘 버튼이 존재함
    When 해당 아이콘이 렌더링되면
    Then 44dp 터치타겟을 보장하는 패딩 래퍼로 감싸져야 한다
```

**증거**: 요소의 `width`/`height` 또는 `minWidth`/`minHeight` 스타일 검증; `hitSlop` 설정 확인.

### AC-SCREEN-005: 하드코딩 금지 (REQ-SCREEN-005)

```gherkin
Feature: 토큰 기반 스타일링 강제

  Scenario: 색상 하드코딩 금지
    Given 화면 컴포넌트 소스 코드를 스캔함
    When HEX 코드(예: #C17B2F) 또는 rgb() 값을 검색하면
    Then 0건이 발견되어야 한다
    And 모든 색상이 useTheme() 토큰에서 임포트되어야 한다

  Scenario: 간격/폰트 하드코딩 금지
    Given 화면 컴포넌트 소스 코드를 스캔함
    When 픽셀 리터럴(예: 16, 22)을 스타일 값으로 검색하면
    Then 0건이 발견되어야 한다 (spacing/typography 토큰 사용)
```

**증거**: 자동화된 grep/AST 스캔; CI 파이프라인 하드코딩 감지 테스트 통과.

---

## 3. REQ-SCREEN-HEADER: 헤더 및 타이틀 패턴

### AC-SCREEN-010: 타이틀 타이포그래피 균일성 (REQ-SCREEN-010)

```gherkin
Feature: 화면 타이틀 균일성

  Scenario: 모든 화면 타이틀 동일 스타일
    Given 14개 도메인 SPEC이 구현한 모든 화면이 존재함
    When 각 화면의 타이틀 스타일을 수집하면
    Then 모든 타이틀이 fontSize 22 / fontWeight 700이어야 한다
    And 화면마다 다른 타이틀 크기를 사용하는 화면이 0건이어야 한다
```

**증거**: 모든 화면의 타이틀 `Text` 스타일 수집; `fontSize`/`fontWeight` 값 비교.

### AC-SCREEN-011: 헤더 우측 액션 아이콘 (REQ-SCREEN-011)

```gherkin
Feature: 헤더 액션 아이콘

  Scenario: 우측 액션 아이콘 배치
    Given 화면에 우측 액션 아이콘(검색, 설정, 더보기)이 존재함
    When 해당 아이콘이 렌더링되면
    Then 헤더 우측에 배치되어야 한다
    And 아이콘 크기가 iconSizes.lg(24px) 또는 22-24px 범위여야 한다
    And 44dp 터치타겟을 보장하는 패딩 래퍼로 감싸져야 한다
```

**증거**: 아이콘 위치(헤더 컨테이너 내 `justifyContent`/`alignItems`); 아이콘 `width`/`height` 검증.

### AC-SCREEN-012: 섹션 라벨 타이포그래피 (REQ-SCREEN-012)

```gherkin
Feature: 섹션 라벨 스타일

  Scenario: 섹션 라벨 균일 스타일
    Given 화면 내 섹션 구분 라벨이 존재함
    When 해당 라벨이 렌더링되면
    Then fontSize 13 / fontWeight 600이어야 한다
    And 색상이 text-tertiary 토큰이어야 한다
```

**증거**: 섹션 라벨 `Text` 스타일 검증; `typography` 및 `colors.text.tertiary` 토큰 사용 확인.

### AC-SCREEN-013: 헤더 일관성 (REQ-SCREEN-013)

```gherkin
Feature: 도메인 SPEC 헤더 일관성

  Scenario: 도메인 SPEC 독자 헤더 금지
    Given 14개 도메인 SPEC이 각자 화면을 구현함
    When 각 도메인 SPEC의 화면 헤더를 검사하면
    Then 모든 화면이 공통 ScreenHeader 컴포넌트(또는 동등 패턴)를 사용해야 한다
    And 독자적인 헤더 스타일을 정의한 화면이 0건이어야 한다
```

**증거**: 각 도메인 SPEC 화면의 헤더 구현 조사; `ScreenHeader` 임포트 여부 검증.

### AC-SCREEN-014: 비경쟁 원칙 (REQ-SCREEN-014)

```gherkin
Feature: 비경쟁 원칙 헤더 준수

  Scenario: 경쟁 지표 표시 금지
    Given 임의의 화면 헤더를 검사함
    When 헤더 콘텐츠를 확인하면
    Then 좋아요 수, 팔로워 수, 랭킹, 읽기 속도 순위가 표시되지 않아야 한다

  Scenario: 경쟁 지표 소스 코드 스캔
    Given 화면 컴포넌트 소스 코드를 스캔함
    When "likeCount", "followerCount", "ranking", "speedRank" 등의 식별자를 검색하면
    Then 0건이 발견되어야 한다 (비경쟁 원칙 준수)
```

**증거**: 헤더 콘텐츠 검사; 경쟁 지표 관련 식별자 grep 스캔 0건.

---

## 4. REQ-SCREEN-CARD: 카드 밀도 및 간격

### AC-SCREEN-020: 카드 코너 반경 및 패딩 (REQ-SCREEN-020)

```gherkin
Feature: 카드 시각적 균일성

  Scenario: 카드 코너 반경 통일
    Given 화면에 Card, BookCard, EmotionRecordCard가 렌더링됨
    When 각 카드의 cornerRadius를 측정하면
    Then 모든 카드가 radius.lg(16)이어야 한다

  Scenario: 카드 내부 패딩 통일
    Given 카드가 렌더링됨
    When 카드 내부 패딩을 측정하면
    Then padding이 spacing-4(16px) ~ spacing-5(20px) 범위여야 한다
```

**증거**: 카드 `borderRadius`/`padding` 스타일 검증; `radius.lg` 및 `spacing` 토큰 사용 확인.

### AC-SCREEN-021: 카드 간격 규칙 (REQ-SCREEN-021)

```gherkin
Feature: 카드 간격 규칙

  Scenario: 동일 섹션 내 카드 간격
    Given 동일 섹션 내 복수 카드가 나열됨
    When 카드 간 수직 간격을 측정하면
    Then 간격이 spacing-4(16px)이어야 한다

  Scenario: 섹션 경계 카드 간격
    Given 서로 다른 섹션의 카드가 인접함
    When 카드 간 수직 간격을 측정하면
    Then 간격이 spacing-6(24px)이어야 한다
```

**증거**: 카드 간 `marginVertical`/`gap` 스타일 검증; `spacing` 토큰 사용 확인.

### AC-SCREEN-022: 카드 남용 금지 (REQ-SCREEN-022)

```gherkin
Feature: 카드 적절 사용

  Scenario: 의미 없는 카드 감싸기 금지
    Given 화면에 단순 텍스트 라벨이나 단일 아이콘이 존재함
    When 해당 요소가 렌더링되면
    Then 카드로 감싸지지 않아야 한다
    And 카드는 시각적 그룹핑 이점이 있는 콘텐츠에만 적용되어야 한다
```

**증거**: 화면 레이아웃 검사; 단순 요소가 `Card` 컴포넌트로 감싸지지 않았는지 확인.

### AC-SCREEN-023: 카드 그림자 토큰 (REQ-SCREEN-023)

```gherkin
Feature: 카드 그림자 토큰 준수

  Scenario: 기본 카드 그림자
    Given 일반 카드가 렌더링됨
    When 카드의 shadow 스타일을 확인하면
    Then shadow.sm 토큰(0 1px 3px rgba(45,31,14,0.08))이 적용되어야 한다

  Scenario: 강조 카드 그림자
    Given 강조 카드(CTA 카드 등)가 렌더링됨
    When 카드의 shadow 스타일을 확인하면
    Then shadow.md 또는 shadow.lg 토큰이 적용될 수 있다
    And 그림자 색상이 브랜드 색조(45,31,14) 기반이어야 한다
```

**증거**: 카드 `shadowColor`/`shadowOffset`/`shadowOpacity`/`shadowRadius` 스타일 검증; `shadow` 토큰 사용 확인.

### AC-SCREEN-024: 카드 접근성 (REQ-SCREEN-024)

```gherkin
Feature: 카드 접근성

  Scenario: 터치 가능 카드 접근성 속성
    Given 터치 상호작용을 지원하는 카드가 렌더링됨
    When 카드의 접근성 속성을 확인하면
    Then 터치타겟이 44dp 이상이어야 한다
    And accessibilityLabel이 부착되어야 한다
    And accessibilityRole="button"이 설정되어야 한다
```

**증거**: 카드 `accessible`, `accessibilityLabel`, `accessibilityRole` props 검증.

---

## 5. REQ-SCREEN-STATE: 빈/로딩/에러 상태 패턴

### AC-SCREEN-030: 빈 상태 다정한 메시지 (REQ-SCREEN-030)

```gherkin
Feature: 빈 상태 다정한 톤

  Scenario: F04 library 빈 상태
    Given 서재에 등록된 책이 없음
    When 사용자가 서재 탭을 확인하면
    Then "책장이 비어 있어요. 첫 책을 등록해볼까요?" 메시지가 표시되어야 한다
    And "책 검색하기" CTA가 제공되어야 한다

  Scenario: F09 timeline 빈 상태
    Given 감정 기록이 없음
    When 사용자가 타임라인을 확인하면
    Then "아직 기록이 없어요. 첫 페이지의 느낌을 남겨보세요" 메시지가 표시되어야 한다
    And "감정 기록하기" CTA가 제공되어야 한다

  Scenario: F11 clubs 빈 상태
    Given 사용자가 참여한 모임이 없음
    When 사용자가 모임 탭을 확인하면
    Then "아직 모임이 없어요. 직접 열어볼까요?" 메시지가 표시되어야 한다
    And "모임 만들기" CTA가 제공되어야 한다

  Scenario: F18 notifications 빈 상태
    Given 읽지 않은 알림이 없음
    When 사용자가 알림 센터를 확인하면
    Then "모든 알림을 확인했어요. 편안한 독서 되세요" 메시지가 표시되어야 한다
```

**증거**: 빈 상태 메시지 텍스트가 design/spec.md "Empty State Design" 5종과 일치; CTA 버튼 존재 확인.

### AC-SCREEN-031: 로딩 상태 ActivityIndicator (REQ-SCREEN-031)

```gherkin
Feature: 로딩 상태 패턴

  Scenario: 로딩 중 ActivityIndicator 표시
    Given 데이터 로딩 중임
    When 사용자가 화면을 확인하면
    Then ActivityIndicator가 표시되어야 한다
    And ActivityIndicator 색상이 brand-500(#C17B2F)이어야 한다

  Scenario: 로딩 완료 시 ActivityIndicator 제거
    Given 데이터 로딩이 완료됨
    When 콘텐츠가 렌더링되면
    Then ActivityIndicator가 화면에서 제거되어야 한다
```

**증거**: `ActivityIndicator` 컴포넌트 렌더링; `color` prop이 `brand-500` 토큰인지 검증.

### AC-SCREEN-032: 에러 상태 semantic-error 및 재시도 (REQ-SCREEN-032)

```gherkin
Feature: 에러 상태 패턴

  Scenario: 데이터 로딩 실패 시 에러 표시
    Given 데이터 로딩이 실패함
    When 사용자가 화면을 확인하면
    Then 에러 메시지가 semantic.error(#C94040) 색상으로 표시되어야 한다
    And 재시도 버튼이 제공되어야 한다

  Scenario: 에러 메시지 다정한 톤
    Given 에러 상태가 표시됨
    When 에러 메시지 텍스트를 확인하면
    Then 기계적 에러 코드(예: "Error 500", "404 Not Found")만 노출되지 않아야 한다
    And 다정한 어조의 메시지(예: "조금만 기다려주세요. 다시 시도해볼까요?")여야 한다
```

**증거**: 에러 메시지 `Text` 색상이 `semantic.error` 토큰인지 검증; 재시도 버튼 존재; 메시지 텍스트 톤 검사.

### AC-SCREEN-033: 스포일러 블러 (REQ-SCREEN-033)

```gherkin
Feature: 스포일러 블러 패턴

  Scenario: 진도 초과 감정 기록 블러 처리 (F09 timeline)
    Given 사용자의 현재 진도가 100페이지이고, 150페이지 감정 기록이 존재함
    When 사용자가 타임라인을 확인하면
    Then 150페이지 감정 기록이 blur(12px) 필터로 가려져야 한다
    And "스포일러가 있어요" 라벨 오버레이가 표시되어야 한다

  Scenario: 진도 초과 감정 기록 블러 처리 (F14 club-detail feed)
    Given 모임원의 현재 진도가 100페이지이고, 다른 모임원의 150페이지 기록이 피드에 존재함
    When 사용자가 모임 피드를 확인하면
    Then 해당 기록이 blur(12px) 필터로 가려져야 한다

  Scenario: 스포일러 블러 해제
    Given 블러 처리된 감정 기록이 표시됨
    When 사용자가 명시적으로 블러 해제를 탭하면
    Then 해당 기록의 내용이 노출되어야 한다
    But 다른 진도 초과 기록은 여전히 블러 처리되어야 한다
```

**증거**: 블러 대상 요소의 `filter: blur(12px)` 스타일 또는 `SpoilerBlur` 컴포넌트 사용; 라벨 오버레이 존재; 블러 해제 상호작용 동작.

### AC-SCREEN-034: 상태 전환 일관성 (REQ-SCREEN-034)

```gherkin
Feature: 상태 전환 모션

  Scenario: 로딩 → 콘텐츠 전환
    Given 화면이 로딩 상태에서 콘텐츠 상태로 전환됨
    When 상태 전환이 발생하면
    Then motion.duration.fast(150ms) 페이드 전환이 적용되어야 한다
    And 깜빡임이 최소화되어야 한다

  Scenario: 콘텐츠 → 빈 상태 전환
    Given 화면이 콘텐츠 상태에서 빈 상태로 전환됨 (예: 마지막 항목 삭제)
    When 상태 전환이 발생하면
    Then 큰 폭의 레이아웃 시프트가 지양되어야 한다
    And 부드러운 전환이 적용되어야 한다
```

**증거**: 상태 전환 시 `Animated` API 사용; `motion.duration.fast` 토큰 사용; 레이아웃 시프트 시각적 검증.

---

## 6. REQ-SCREEN-TABBAR: 탭바 규칙

### AC-SCREEN-040: 탭바 캡슐형 및 프로스티드 글래스 (REQ-SCREEN-040)

```gherkin
Feature: 탭바 캡슐형 디자인

  Scenario: 탭바 캡슐형 형태
    Given 탭바가 렌더링됨
    When 탭바의 형태를 확인하면
    Then borderRadius가 탭바 높이의 절반이어야 한다 (캡슐형)
    And 70% 불투명 프로스티드 글래스 효과가 적용되어야 한다

  Scenario: 탭바 배경 블러
    Given 탭바가 부양 상태로 렌더링됨
    When 탭바 배경을 확인하면
    Then 배경이 블러 처리된 반투명 상태여야 한다
    And 뒤의 콘텐츠가 흐릿하게 보여야 한다
```

**증거**: 탭바 컨테이너 `borderRadius`/`backgroundColor`(반투명)/`backdropFilter` 또는 `BlurView` 사용 검증.

### AC-SCREEN-041: 탭바 인셋 및 높이 (REQ-SCREEN-041)

```gherkin
Feature: 탭바 인셋

  Scenario: 탭바 인셋 값
    Given 탭바가 렌더링됨
    When 탭바의 위치를 측정하면
    Then 하단 12px 인셋이 적용되어야 한다
    And 좌우 16px 인셋이 적용되어야 한다
    And 탭바 높이가 약 56px이어야 한다
```

**증거**: 탭바 컨테이너 `marginBottom`/`marginHorizontal`/`height` 스타일 검증; `spacing` 토큰 사용 확인.

### AC-SCREEN-042: 탭 선택 상태 시각적 피드백 (REQ-SCREEN-042)

```gherkin
Feature: 탭 선택 상태 피드백

  Scenario: 활성 탭 시각적 강조
    Given 사용자가 홈 탭을 선택함
    When 홈 탭 아이콘이 렌더링되면
    Then 아이콘이 filled 스타일로 변경되어야 한다
    And brand-500(#C17B2F) 틴트가 적용되어야 한다

  Scenario: 비활성 탭 기본 스타일
    Given 사용자가 홈 탭을 선택함 (서재/모임/마이는 비활성)
    When 비활성 탭 아이콘이 렌더링되면
    Then outline 아이콘 스타일이어야 한다
    And text-tertiary(#A89585) 색상이어야 한다
```

**증거**: 탭 `focused` 상태에 따른 아이콘 variant(filled/outline) 및 색상(`brand-500`/`text-tertiary`) 검증.

### AC-SCREEN-043: 4개 탭 고정 순서 (REQ-SCREEN-043)

```gherkin
Feature: 4개 탭 고정

  Scenario: 탭 순서 고정
    Given 탭바가 렌더링됨
    When 탭 순서를 확인하면
    Then 홈 → 서재 → 모임 → 마이 순서여야 한다
    And 탭 순서 변경, 탭 숨김, 탭 추가가 불가능해야 한다
```

**증거**: 탭 라우트 배열 순서 검증; 사용자 설정 변경 UI 부재 확인.

### AC-SCREEN-044: 탭바 접근성 (REQ-SCREEN-044)

```gherkin
Feature: 탭바 접근성

  Scenario: 탭 접근성 속성
    Given 탭바의 각 탭이 렌더링됨
    When 각 탭의 접근성 속성을 확인하면
    Then accessibilityLabel(탭 레이블: 홈/서재/모임/마이)이 부착되어야 한다
    And accessibilityRole="tab"이 설정되어야 한다
    And accessibilityState={{ selected: <boolean> }}이 설정되어야 한다
    And 터치타겟이 44dp 이상이어야 한다
```

**증거**: 각 탭의 `accessibilityLabel`/`accessibilityRole`/`accessibilityState` props 검증; 터치타겟 크기 측정.

---

## 7. 통합 인수 시나리오

### AC-SCREEN-INT-01: 도메인 SPEC 화면 패턴 준수 (전체)

```gherkin
Feature: 도메인 SPEC 화면 패턴 준수

  Scenario: 14개 도메인 SPEC 화면 일관성
    Given 14개 도메인 SPEC이 각자 화면을 구현함
    When evaluator-active가 "화면 패턴 일관성"을 평가하면
    Then 모든 화면이 ScreenLayout 컴포넌트를 사용해야 한다
    And 모든 화면의 타이틀이 fontSize 22 / fontWeight 700이어야 한다
    And 모든 카드가 radius.lg(16) / spacing-4~5(16-20px) 패딩을 사용해야 한다
    And 모든 빈 상태가 다정한 톤 메시지를 사용해야 한다
    And 하드코딩 스타일 값이 0건이어야 한다
    And 비경쟁 지표(좋아요 수, 팔로워, 랭킹)가 0건이어야 한다

  Scenario: 위반 시 평가 FAIL
    Given 임의의 도메인 SPEC 화면이 본 패턴을 위반함
    When evaluator-active가 평가를 수행하면
    Then "화면 패턴 일관성" must-pass 항목으로 인해 전체 평가가 FAIL되어야 한다
    And 피드백에 위반 내역이 명시되어야 한다
```

**증거**: evaluator-active 평가 리포트; FROZEN Zone 준수 여부 자동 검증.

### AC-SCREEN-INT-02: Design Constitution FROZEN 준수

```gherkin
Feature: FROZEN Zone 불변성

  Scenario: Learner의 패턴 수정 시도 차단
    Given constitution.md Section 2에 REQ-SCREEN-*가 FROZEN으로 등록됨
    When Learner가 REQ-SCREEN-010(타이틀 균일성)을 수정하려 시도하면
    Then Frozen Guard(Layer 1)가 해당 수정을 차단해야 한다
    And 수정 시도가 로그에 기록되어야 한다
    And 사용자에게 알림이 전송되어야 한다

  Scenario: 인간 개발자의 FROZEN 항목 변경 허용
    Given constitution.md Section 2에 REQ-SCREEN-*가 FROZEN으로 등록됨
    When 인간 개발자가 constitution.md를 직접 수정하면
    Then 변경이 허용되어야 한다
    And 변경 내역이 constitution.md HISTORY에 기록되어야 한다
```

**증거**: Frozen Guard 로그; constitution.md HISTORY 섹션 업데이트.

---

## 8. 품질 게이트 요약

| 게이트 | 기준 | 검증 방법 |
|--------|------|-----------|
| 하드코딩 0건 | 모든 스타일 값이 토큰 기반 | CI 자동화 grep/AST 스캔 |
| 타이틀 균일성 | 모든 화면 타이틀 fontSize 22 / fontWeight 700 | 화면 스타일 수집 비교 |
| 카드 밀도 일관성 | radius.lg(16) / spacing-4~5(16-20px) | 카드 스타일 검증 |
| 빈 상태 다정한 톤 | design/spec.md 5종 메시지 준수 | 메시지 텍스트 비교 |
| 비경쟁 원칙 | 좋아요/팔로워/랭킹 0건 | 식별자 grep 스캔 |
| 스포일러 블러 | blur(12px) + 라벨 오버레이 | SpoilerBlur 컴포넌트 사용 검증 |
| 접근성 WCAG AA | 44dp 터치타겟, accessibilityLabel, 4.5:1 대비 | 접근성 자동화 테스트 |
| FROZEN 준수 | Learner 수정 시도 차단 | Frozen Guard 로그 |

---

## 9. Definition of Done

본 SPEC의 인수 기준이 모두 충족되려면:

1. **AC-SCREEN-001 ~ AC-SCREEN-044**: 모든 단위 인수 시나리오가 통과한다.
2. **AC-SCREEN-INT-01**: evaluator-active가 "화면 패턴 일관성" 평가를 수행할 수 있다.
3. **AC-SCREEN-INT-02**: Frozen Guard가 REQ-SCREEN-* 수정 시도를 차단한다.
4. **품질 게이트**: Section 8의 모든 게이트가 통과한다.
5. **도메인 SPEC 소비 준비**: 14개 도메인 SPEC이 본 SPEC의 패턴을 소비할 수 있는 상태이다 (컴포넌트 구현 완료, 가이드 배포).

---

버전: 1.0.0
상태: draft (14개 도메인 SPEC run의 선행 조건)
