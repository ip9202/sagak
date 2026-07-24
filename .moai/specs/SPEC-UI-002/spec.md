---
id: SPEC-UI-002
title: "화면 패턴 디자인 시스템 (Screen-Level Design System)"
version: "1.0.0"
status: completed
created: 2026-06-14
updated: 2026-07-23
author: "강력쇠주먹"
priority: high
issue_number: 0
labels: [frontend, ui, screen-pattern, layout, consistency, design-system, frozen]
---

# SPEC-UI-002: 화면 패턴 디자인 시스템

## HISTORY

| 날짜 | 버전 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 2026-06-14 | 1.0.0 | 최초 작성. SPEC-UI-001(컴포넌트·토큰) 위에 화면 레벨 패턴(레이아웃/헤더/카드 밀도/상태/탭바)을 정의. 14개 도메인 SPEC의 화면 구현 일관성을 강제하는 선행 의존성. | 강력쇠주먹 |

---

## 1. 환경 (Environment)

- **런타임**: React Native 0.83.2 + React 19.2 + Expo SDK 55 (SPEC-UI-001과 동일)
- **라우팅**: Expo Router ~5 (SPEC-NAV-001 `(tabs)`/`(auth)` 그룹 구조 기반)
- **스타일링**: `StyleSheet.create` + `src/theme/tokens.ts` 임포트 방식 (SPEC-UI-001 준수)
- **테마**: `ThemeProvider` + `useTheme()` (SPEC-UI-001, light/dark 전환)
- **디자인 레퍼런스**: Pencil `.pen` 파일 (`pencil-new.pen`) — 핵심 4개 탭 화면(F03-Home, F04-Library, F11-Clubs, F15-My) 및 6개 재사용 컴포넌트(StatusBar, TabBar, BookCard, PrimaryButton, GhostButton, EmotionRecordCard)가 구현됨
- **토큰 변수 시스템**: Pencil `.pen` 파일의 `$` 변수(`$brand-500`, `$bg-base` 등)는 `src/theme/tokens.ts` 값과 1:1 대응. 하드코딩 0.

### 단일 출처 (Single Source of Truth)

본 SPEC의 화면 패턴은 다음 문서를 단일 출처로 한다:

- `.moai/design/system.md` — 디자인 시스템 SSOT (design intent, craft 원칙, 색/타이포/간격 토큰 테이블, 레이아웃 규칙, 모션, 접근성)
- `.moai/design/spec.md` — 17개 화면 IA + frame-by-frame 목표 + 빈 상태 5종 + 우선순위
- `.moai/project/product.md` — 비목표(경쟁 메커니즘 회피), 가치 제안, 다정한 톤
- Pencil `.pen` 파일 — 핵심 화면 4종(F03/F04/F11/F15)의 시각적 구현 레퍼런스
- `src/theme/tokens.ts` — 색/간격/반경/타이포 실제 값 (Pencil 변수와 1:1)

### 선행 의존성

| 의존 SPEC | 제공 자산 | 본 SPEC 활용 |
|-----------|-----------|-------------|
| SPEC-UI-001 | `tokens.ts`, `ThemeProvider`, `useTheme()`, 6개 컴포넌트(Button/Card/BookCard/EmotionRecordCard/StickerReaction/ProgressBar) | 본 SPEC은 컴포넌트를 조합하는 **화면 레벨** 패턴을 정의. 컴포넌트 내부 구현은 재정의하지 않음 |
| SPEC-NAV-001 | 4개 탭 구조(REQ-NAV-TABS), 화면 셸(REQ-NAV-STACK), 인증 가드 | 본 SPEC의 탭바 규칙(REQ-SCREEN-TABBAR)은 SPEC-NAV-001의 4개 탭 구조와 협업. 라우팅 로직은 재구현하지 않음 |

> 본 SPEC은 SPEC-UI-001이 완료된 상태에서, 14개 도메인 SPEC(SPEC-AUTH-001, SPEC-LIBRARY-001, SPEC-EMOTION-001 등)이 **각자 run할 때** 준수해야 하는 화면 레벨 불변 규칙을 정의한다. Phase 0 위치 — 모든 도메인 SPEC run의 선행 의존성.

---

## 2. 가정 (Assumptions)

### 2.1 아키텍처 가정

1. **모든 탭 화면은 동일한 3계층 구조를 따른다**: StatusBar(62px, OS 크롬) → Content Wrapper(좌우 16-20px 패딩 1회 처리) → TabBar(하단 부양 캡슐형). 이 구조는 Pencil `.pen`의 F03/F04/F11/F15에서 검증되었으며, 모든 도메인 SPEC 화면에 동일하게 적용된다.
2. **`tokens.ts` 변수만 허용된다**: 색(`$brand-500`, `$bg-base` 등), 간격(`$spacing-4` 등), 반경(`$radius-lg` 등), 타이포(`typography.headingLg` 등) 모든 값은 `useTheme()`이 반환하는 토큰 객체에서 임포트한다. 하드코딩된 픽셀값, HEX 코드, 폰트 크기는 금지된다 (design/spec.md "Acceptance Criteria" 준수).
3. **콘텐츠 래퍼가 좌우 패딩을 1회 처리한다**: 각 화면의 최상위 콘텐츠 컨테이너가 `paddingHorizontal: 16~20`을 설정하며, 하위 섹션/카드는 추가 좌우 패딩을 중복 적용하지 않는다 (system.md "Layout Rules").
4. **컴포넌트 내부 구현은 SPEC-UI-001 영역이다**: 본 SPEC은 컴포넌트(Button, Card, BookCard 등)의 내부 구조를 정의하지 않는다. 본 SPEC은 컴포넌트를 **화면에 어떻게 배치하고 조합하는지**만 정의한다.
5. **다크모드는 `useTheme()`을 통해 자동 전환된다**: 모든 색상 토큰은 light/dark 양쪽 값을 가지며, 화면 코드는 토큰 참조만으로 다크모드를 지원한다. 조건부 분기(`if (isDark)`) 없이 토큰 기반 스타일링이 다크모드를 처리한다 (SPEC-UI-001 REQ-FE-012).

### 2.2 비즈니스 가정

1. **비경쟁 원칙이 모든 화면에 적용된다** (system.md "Craft Principles"): 좋아요 수, 팔로워 수, 랭킹, 읽기 속도 비교 등 경쟁·과시 요소는 어떤 화면에서도 표시되지 않는다. 이는 product.md "비목표"와 일치하며, 모든 도메인 SPEC 화면의 불변 제약이다.
2. **다정한 톤이 상태 메시지에 적용된다**: 빈 상태, 에러 메시지, 알림 메시지는 따뜻하고 부드러운 어조를 사용한다 (design/spec.md "Empty State Design" 5종 참조: "책장이 비어 있어요. 첫 책을 등록해볼까요?" 등). 기계적 에러 메시지("Error 404", "데이터 없음")는 금지된다.
3. **스포일러 블러가 진도 초과 콘텐츠에 적용된다** (product.md 핵심 기능): 감정 기록 타임라인(F09)과 모임 피드(F14)에서 현재 진도를 초과하는 페이지의 감정 기록은 `blur(12px)` + 라벨 오버레이로 가려진다. 사용자가 명시적으로 해제하기 전까지 노출되지 않는다 (SPEC-UI-001 REQ-FE-024 준수).
4. **원핸드 도달권이 주요 액션 배치를 결정한다**: 주요 CTA(PrimaryButton)는 화면 하단 영역에 배치되며, `fill_container` 폭을 가진다 (system.md "Layout Rules"). 상단에 고정된 주요 액션은 원핸드 조작이 어려워 금지된다.
5. **모든 화면은 WCAG 2.1 AA를 충족한다**: 텍스트 대비 4.5:1, 터치타겟 44dp 최소, `accessibilityLabel` 의무 부착 (system.md "Accessibility"). 이는 모든 도메인 SPEC 화면의 품질 게이트이다.

---

## 3. 요구사항 (Requirements)

> 본 SPEC은 5개 요구사항 모듈로 구성된다: REQ-SCREEN-LAYOUT, REQ-SCREEN-HEADER, REQ-SCREEN-CARD, REQ-SCREEN-STATE, REQ-SCREEN-TABBAR. 모듈당 REQ 5개 이하.

### REQ-SCREEN-LAYOUT: 3계층 화면 레이아웃

**목적**: 모든 탭 화면이 동일한 StatusBar → Content → TabBar 3계층 구조를 따르도록 강제한다.

#### REQ-SCREEN-001: 3계층 레이아웃 구조 준수

시스템은 **항상** 모든 탭 화면(F03-Home, F04-Library, F11-Clubs, F15-My 및 이에서 파생되는 하위 화면)을 StatusBar 영역(62px, OS 크론) → Content Wrapper → (옵션) TabBar의 3계층 수직 구조로 렌더링해야 한다 (system.md "Layout Rules").

**WHILE** 탭 화면이 렌더링되는 동안,
**THEN** 시스템은 Content Wrapper가 좌우 패딩 `spacing-4`(16px) ~ `spacing-5`(20px)을 1회 처리해야 하며, 하위 섹션이나 카드가 동일 좌우 패딩을 중복 적용해서는 안 된다.

#### REQ-SCREEN-002: 단일 컬럼 세로 스크롤 기본

시스템은 **항상** 화면을 단일 컬럼, 세로 스크롤 기본 레이아웃으로 구성해야 한다 (system.md "Layout Rules"). 멀티 컬럼 그리드는 책 표지 갤러리 등 명시적으로 필요한 경우에만 허용된다.

#### REQ-SCREEN-003: 섹션 간격 규칙 준수

**WHILE** 화면 내 복수 섹션이 존재하면,
**THEN** 시스템은 관련 섹션 간 간격을 `spacing-4`(16px)로, 독립 섹션(메이저 구분) 간 간격을 `spacing-6`(24px) ~ `spacing-8`(32px)로 설정해야 한다 (system.md "Spacing / Radius / Shadow").

#### REQ-SCREEN-004: 터치타겟 최소 크기 보장

시스템은 **항상** 모든 상호작용 요소(버튼, 탭, 아이콘 버튼, 카드 터치 영역)의 터치타겟을 44dp 이상으로 유지해야 한다 (system.md "Accessibility", WCAG 2.1 AA).

#### REQ-SCREEN-005: 하드코딩 스타일 값 금지

시스템은 **어떤 화면에서도** 색상 HEX 코드, 픽셀 간격, 폰트 크기를 하드코딩해서는 안 된다. 모든 스타일 값은 `useTheme()`이 반환하는 `tokens.ts` 객체에서 임포트해야 한다 (design/spec.md "Acceptance Criteria": "모든 화면이 `$` 변수만 사용 — 하드코딩 금지").

---

### REQ-SCREEN-HEADER: 헤더 및 타이틀 패턴

**목적**: 모든 화면의 헤더와 타이틀이 앱 전체에서 동일한 타이포그래피와 액션 아이콘 패턴을 따르도록 강제한다.

#### REQ-SCREEN-010: 화면 타이틀 타이포그래피 균일성

시스템은 **항상** 모든 화면의 타이틀을 `fontSize 22 / fontWeight 700`으로 통일해야 한다 (system.md "Typography": "모든 화면의 타이틀은 동일 사이즈를 사용한다" — Mobile App 가이드라인). 화면마다 다른 타이틀 크기를 사용해서는 안 된다.

> 타이틀은 `tokens.ts`의 `typography` 토큰을 기반으로 파생된 일관된 스펙을 따른다. 정확한 토큰 매핑은 SPEC-UI-001 `typography` 확장 시 확정된다. 본 SPEC은 "균일성" 요구사항만 고정한다.

#### REQ-SCREEN-011: 헤더 우측 액션 아이콘 배치

**WHERE** 화면에 우측 액션 아이콘(검색, 설정, 더보기 등)이 존재하면,
**THEN** 시스템은 해당 아이콘을 헤더 우측에 `iconSizes.lg`(24px) 또는 그에 준하는 22-24px 크기로 배치해야 하며, 터치타겟 44dp를 보장하는 패딩 래퍼로 감싸야 한다.

#### REQ-SCREEN-012: 섹션 라벨 타이포그래피

**WHERE** 화면 내 섹션 구분 라벨이 존재하면,
**THEN** 시스템은 해당 라벨을 `fontSize 13 / fontWeight 600 / text-tertiary` 색상으로 스타일링해야 한다 (Pencil `.pen` 섹션 라벨 패턴, system.md `bodySm` 기반).

#### REQ-SCREEN-013: 헤더 일관성 (모든 도메인 SPEC 준수)

시스템은 **항상** 14개 도메인 SPEC이 구현하는 모든 화면에서 동일한 헤더 패턴(타이틀 타이포그래피, 액션 아이콘 위치, 섹션 라벨 스타일)을 준수해야 한다. 도메인 SPEC이 독자적인 헤더 스타일을 정의해서는 안 된다.

#### REQ-SCREEN-014: 비경쟁 원칙 헤더 준수

시스템은 **어떤 화면의 헤더에도** 좋아요 수, 팔로워 수, 랭킹, 읽기 속도 순위 등 경쟁·과시 지표를 표시해서는 안 된다 (system.md "Craft Principles": 비경쟁, product.md "비목표").

---

### REQ-SCREEN-CARD: 카드 밀도 및 간격 규칙

**목적**: 모든 화면에서 카드의 시각적 밀도, 코너 반경, 패딩, 간격이 일관되도록 강제한다.

#### REQ-SCREEN-020: 카드 코너 반경 및 패딩 균일성

**WHILE** 카드 컴포넌트(SPEC-UI-001 Card, BookCard, EmotionRecordCard)가 화면에 렌더링되는 동안,
**THEN** 시스템은 카드의 `cornerRadius`를 `radius.lg`(16)로, 내부 패딩을 `spacing-4`(16px) ~ `spacing-5`(20px)로 통일해야 한다 (system.md "Spacing / Radius / Shadow", Pencil `.pen` 카드 패턴).

#### REQ-SCREEN-021: 카드 간격 규칙

**WHILE** 동일 섹션 내 복수 카드가 나열되면,
**THEN** 시스템은 카드 간 수직 간격을 `spacing-4`(16px)로 설정해야 한다. 섹션을 넘나드는 카드 간 간격은 `spacing-6`(24px)로 설정해야 한다 (system.md "Spacing", REQ-SCREEN-003과 일관).

#### REQ-SCREEN-022: 카드 남용 금지

시스템은 **의미 없는 카드 감싸기를 해서는 안 된다**. 모든 박스 요소를 카드로 감싸는 것이 아니라, 콘텐츠가 시각적 그룹핑 이점을 얻을 때만 카드를 사용해야 한다 (system.md "여백의 미", Pencil `.pen` 카드 사용 패턴). 단순 텍스트 라벨이나 단일 아이콘은 카드 없이 렌더링된다.

#### REQ-SCREEN-023: 카드 그림자 토큰 준수

**WHERE** 카드에 그림자가 적용되면,
**THEN** 시스템은 `tokens.ts`의 `shadow.sm`(`0 1px 3px rgba(45,31,14,0.08)`)을 기본으로 사용해야 하며, 강조 카드에만 `shadow.md` 또는 `shadow.lg`를 적용할 수 있다. 브랜드 색조(45,31,14) 기반이 아닌 그림자 색상은 금지된다 (system.md "Spacing / Radius / Shadow").

#### REQ-SCREEN-024: 카드 접근성 준수

**WHERE** 카드가 터치 상호작용(상세 화면 이동 등)을 지원하면,
**THEN** 시스템은 카드 전체에 44dp 이상 터치타겟을 보장하고, `accessibilityLabel`과 `accessibilityRole="button"`을 부착해야 한다 (SPEC-UI-001 컴포넌트 접근성 준수, system.md "Accessibility").

---

### REQ-SCREEN-STATE: 빈/로딩/에러 상태 패턴

**목적**: 모든 화면의 빈 상태, 로딩 상태, 에러 상태가 동일한 패턴과 다정한 톤을 따르도록 강제한다.

#### REQ-SCREEN-030: 빈 상태 다정한 메시지 및 CTA

**WHEN** 화면에 표시할 데이터가 없으면(빈 상태),
**THEN** 시스템은 다정하고 부드러운 어조의 메시지와(필요 시) CTA를 표시해야 한다 (design/spec.md "Empty State Design" 5종 준수). 메시지 예: "책장이 비어 있어요. 첫 책을 등록해볼까요?" (F04 library), "아직 기록이 없어요. 첫 페이지의 느낌을 남겨보세요" (F09 timeline).

#### REQ-SCREEN-031: 로딩 상태 ActivityIndicator

**WHILE** 데이터 로딩 중이면,
**THEN** 시스템은 `ActivityIndicator`를 표시해야 하며, 브랜드 색상(`brand-500`)을 사용해야 한다 (SPEC-UI-001 Button loading 패턴과 일관). 커스텀 스켈레톤 UI는 본 SPEC 범위 밖이나, 도입 시 별도 패턴 SPEC에서 정의한다.

#### REQ-SCREEN-032: 에러 상태 semantic-error 및 재시도

**IF** 데이터 로딩 또는 액션이 실패하면,
**THEN** 시스템은 `semantic.error`(`#C94040`) 색상으로 에러 메시지를 표시하고, 재시도 버튼(GhostButton 또는 PrimaryButton)을 제공해야 한다. 에러 메시지는 다정한 톤을 유지하며, 기계적 에러 코드("Error 500")만 노출해서는 안 된다.

#### REQ-SCREEN-033: 스포일러 블러 상태 패턴

**WHILE** 진도 초과 감정 기록이 표시 대상이면 (F09 timeline, F14 club-detail feed),
**THEN** 시스템은 해당 콘텐츠에 `blur(12px)` 필터와 라벨 오버레이("스포일러가 있어요")를 적용해야 한다 (SPEC-UI-001 REQ-FE-024 `spoiler.blur` 토큰 준수, product.md "스포일러 존중").

#### REQ-SCREEN-034: 상태 전환 일관성

**WHEN** 화면 상태가 로딩 → 콘텐츠, 또는 콘텐츠 → 빈 상태로 전환되면,
**THEN** 시스템은 깜빡임을 최소화하는 전환(`motion.duration.fast` 150ms 페이드 등)을 적용해야 한다 (system.md "Motion"). 상태 전환 중 레이아웃 시프트(큰 폭의 높이 변화)는 지양한다.

---

### REQ-SCREEN-TABBAR: 탭바 규칙 (캡슐형, 4탭)

**목적**: 4개 탭 진입점(홈/서재/모임/마이)을 가진 하단 부양 캡슐형 탭바의 시각적·상호작용 패턴을 고정한다.

> 본 모듈은 SPEC-NAV-001 REQ-NAV-TABS(4개 탭 라우트 구조)와 협업한다. SPEC-NAV-001은 라우팅 구조를, 본 모듈은 시각적 패턴(캡슐형, 프로스티드 글래스, 선택 상태)을 담당한다.

#### REQ-SCREEN-040: 탭바 캡슐형 및 프로스티드 글래스

**WHILE** 탭바가 렌더링되는 동안,
**THEN** 시스템은 탭바를 캡슐형(`borderRadius` = 높이/2)으로 렌더링하고, 70% 불투명 프로스티드 글래스(blur backdrop) 효과를 적용해야 한다 (system.md "Layout Rules", Pencil `.pen` TabBar 컴포넌트).

#### REQ-SCREEN-041: 탭바 인셋 및 높이

**WHILE** 탭바가 렌더링되는 동안,
**THEN** 시스템은 하단 12px, 좌우 16px 인셋을 적용하고, 탭바 높이를 약 56px(SPEC-NAV-001 REQ-NAV-001 기준)로 유지해야 한다 (system.md "Layout Rules", Pencil `.pen` TabBar 패턴).

#### REQ-SCREEN-042: 탭 선택 상태 시각적 피드백

**WHILE** 특정 탭이 활성 상태이면,
**THEN** 시스템은 해당 탭의 아이콘을 filled 스타일로 변경하고, `brand-500` 틴트를 적용해야 한다. 비활성 탭은 outline 아이콘 + `text-tertiary` 색상을 유지한다 (system.md "Iconography", SPEC-NAV-001 REQ-NAV-001과 일관).

#### REQ-SCREEN-043: 탭바 4개 진입점 고정

시스템은 **항상** 탭바에 4개 진입점(홈/서재/모임/마이)을 고정 순서로 유지해야 한다 (SPEC-NAV-001 REQ-NAV-002, design/spec.md IA). 사용자 설정 변경, 탭 숨김, 탭 추가는 MVP 범위 밖이다.

#### REQ-SCREEN-044: 탭바 접근성 준수

시스템은 **항상** 각 탭 버튼에 `accessibilityLabel`(탭 레이블), `accessibilityRole="tab"`, `accessibilityState={{ selected: boolean }}`을 부착해야 하며, 터치타겟 44dp를 보장해야 한다 (system.md "Accessibility", SPEC-UI-001 접근성 준수).

---

## 4. 제외 범위 (Exclusions)

본 SPEC은 다음을 포함하지 않는다:

1. **컴포넌트 내부 구현**: Button, Card, BookCard, EmotionRecordCard, StickerReaction, ProgressBar의 내부 구조, variant, props는 SPEC-UI-001 영역이다. 본 SPEC은 컴포넌트를 화면에 어떻게 배치하는지만 정의한다.
2. **디자인 토큰 값 정의**: 색, 간격, 반경, 타이포, 모션의 실제 값은 `tokens.ts`(SPEC-UI-001)와 `system.md`가 SSOT이다. 본 SPEC은 토큰 값을 재정의하지 않고, 토큰 사용 규칙만 정의한다.
3. **개별 화면 콘텐츠**: 각 화면이 표시하는 구체적 데이터(서재 목록, 감정 기록, 모임 정보 등)는 14개 도메인 SPEC이 구현한다. 본 SPEC은 화면의 뼈대 패턴만 제공한다.
4. **다크모드 토큰 값**: dark 모드 토큰 값(`bg-base #1A1208` 등)은 SPEC-UI-001 `darkTokens.ts` 영역이다. 본 SPEC은 "토큰 기반으로 다크모드가 자동 전환된다"는 규칙만 명시한다.
5. **모션 상세 정의**: duration, easing, spring 값은 `tokens.ts` motion 객체와 system.md "Motion"이 SSOT이다. 본 SPEC은 상태 전환에 모션 토큰을 사용한다는 규칙만 명시한다.
6. **라우팅 로직**: 4개 탭 라우트 파일, 스택 네비게이션, 인증 가드는 SPEC-NAV-001 영역이다. 본 SPEC은 탭바의 시각적 패턴만 담당한다.
7. **모달/바텀시트 패턴**: 공통 모달/바텀시트 컴포넌트 시스템은 미결정 사항(Section 5)이며, 본 SPEC 범위 밖이다.
8. **커스텀 전환 애니메이션**: Reanimated 기반 커스텀 화면 전환은 SPEC-UI-001 제외 범위와 일치하게 본 SPEC에서도 제외한다.
9. **데스크톱 웹 레이아웃**: 데스크톱 웹 버전은 비목표(product.md)이므로, 반응형 웹 레이아웃은 다루지 않는다.

---

## 5. 미결정 사항 (Open Questions — 해결 상태)

### 5.1 모달/바텀시트 패턴 — 미해결

감정 기록 입력(F08 emotion-input) 등 모달형 화면의 공통 패턴(하단 슬라이드업, 드래그 핸들, dimmed backdrop)은 아직 정의되지 않았다. 각 도메인 SPEC이 개별적으로 모달을 구현할 수 있으나, 일관성을 위해 별도 패턴 SPEC(SPEC-UI-003 또는 확장)에서 정의할 것을 권장한다.

**상태**: 미해결 — 향후 본 SPEC 확장 또는 별도 SPEC에서 정의.

### 5.2 토스트 메시지 패턴 — 미해결

비파괴적 알림(스티커 반응 수신, 저장 완료 등)을 위한 토스트 메시지 UI 패턴이 정의되지 않았다. 일시적으로 각 화면이 인라인 메시지로 처리하거나, 별도 토스트 시스템 SPEC에서 정의할 수 있다.

**상태**: 미해결 — 향후 별도 패턴 정의 필요.

### 5.3 풀투리프레시 규칙 — 미해결

서재 목록(F04), 모임 피드(F14), 알림 센터(F18) 등 목록형 화면에서 풀투리프레시(`RefreshControl`)의 시각적 패턴(로딩 인디케이터 색상, 텍스트)이 통일되지 않았다. 브랜드 색상(`brand-500`) ActivityIndicator를 기본으로 제안하나, 세부 패턴은 미정이다.

**상태**: 미해결 — 첫 목록형 화면 구현 시 확정 예정.

### 5.4 스켈레톤 로딩 UI 도입 여부 — 미해결

현재 REQ-SCREEN-031은 `ActivityIndicator`만 규정한다. 콘텐츠 영역 스켈레톤(회색 박스 플레이스홀더) 도입 여부는 미정이다. 스켈레톤이 UX에 이점이 있는지(깜빡임 감소, 레이아웃 시프트 최소화) 첫 화면 구현 시 평가한다.

**상태**: 미해결 — 첫 화면 구현 후 평가.

---

## 6. 추적성 (Traceability)

| TAG | 요구사항 | 소스 |
|-----|---------|------|
| SPEC-UI-002 / REQ-SCREEN-LAYOUT | REQ-SCREEN-001, REQ-SCREEN-002, REQ-SCREEN-003, REQ-SCREEN-004, REQ-SCREEN-005 | `.moai/design/system.md` "Layout Rules", `.moai/design/spec.md` "Acceptance Criteria" (하드코딩 금지), Pencil `.pen` F03/F04/F11/F15 레이아웃 |
| SPEC-UI-002 / REQ-SCREEN-HEADER | REQ-SCREEN-010, REQ-SCREEN-011, REQ-SCREEN-012, REQ-SCREEN-013, REQ-SCREEN-014 | `.moai/design/system.md` "Typography" (타이틀 균일성), "Iconography", "Craft Principles" (비경쟁), Pencil `.pen` 헤더 패턴 |
| SPEC-UI-002 / REQ-SCREEN-CARD | REQ-SCREEN-020, REQ-SCREEN-021, REQ-SCREEN-022, REQ-SCREEN-023, REQ-SCREEN-024 | `.moai/design/system.md` "Spacing / Radius / Shadow", Pencil `.pen` BookCard/EmotionRecordCard, `.moai/specs/SPEC-UI-001/spec.md` REQ-FE-022/023/024 |
| SPEC-UI-002 / REQ-SCREEN-STATE | REQ-SCREEN-030, REQ-SCREEN-031, REQ-SCREEN-032, REQ-SCREEN-033, REQ-SCREEN-034 | `.moai/design/spec.md` "Empty State Design" 5종, `.moai/design/system.md` "Motion", `.moai/specs/SPEC-UI-001/spec.md` REQ-FE-024 (스포일러 블러) |
| SPEC-UI-002 / REQ-SCREEN-TABBAR | REQ-SCREEN-040, REQ-SCREEN-041, REQ-SCREEN-042, REQ-SCREEN-043, REQ-SCREEN-044 | `.moai/design/system.md` "Layout Rules" (탭바), "Iconography", `.moai/specs/SPEC-NAV-001/spec.md` REQ-NAV-TABS (4탭 구조), Pencil `.pen` TabBar 컴포넌트 |
| (공통) | 본 SPEC 전체 | `.moai/project/product.md` 비목표 (비경쟁 원칙), `.moai/design/system.md` Craft Principles, `.moai/specs/SPEC-UI-001/spec.md` (컴포넌트·토큰 선행 의존성), `.moai/specs/SPEC-NAV-001/spec.md` (탭 구조 협업) |

### Pencil 화면 ↔ REQ 매핑

| Pencil Frame | 화면명 | 준수해야 할 REQ 모듈 | 담당 도메인 SPEC (참조용) |
|--------------|--------|---------------------|------------------------|
| F03 | Home (홈) | REQ-SCREEN-LAYOUT, REQ-SCREEN-HEADER, REQ-SCREEN-CARD, REQ-SCREEN-TABBAR | SPEC-NAV-001 (대시보드) |
| F04 | Library (서재) | REQ-SCREEN-LAYOUT, REQ-SCREEN-HEADER, REQ-SCREEN-CARD, REQ-SCREEN-STATE (빈 상태), REQ-SCREEN-TABBAR | SPEC-LIBRARY-001 |
| F11 | Clubs (모임) | REQ-SCREEN-LAYOUT, REQ-SCREEN-HEADER, REQ-SCREEN-CARD, REQ-SCREEN-STATE (빈 상태), REQ-SCREEN-TABBAR | SPEC-CLUB-001, SPEC-CLUB-002 |
| F15 | My (마이) | REQ-SCREEN-LAYOUT, REQ-SCREEN-HEADER, REQ-SCREEN-CARD, REQ-SCREEN-TABBAR | SPEC-PROFILE-001 |
| F09 | Timeline (감정 타임라인) | REQ-SCREEN-LAYOUT, REQ-SCREEN-STATE (스포일러 블러, 빈 상태) | SPEC-EMOTION-001 |
| F14 | Club-detail (모임 상세 피드) | REQ-SCREEN-LAYOUT, REQ-SCREEN-STATE (스포일러 블러) | SPEC-CLUB-001, SPEC-FEED-001 |

### Design Constitution FROZEN Zone 연동

본 SPEC의 모든 REQ(REQ-SCREEN-001 ~ REQ-SCREEN-044)는 `.claude/rules/moai/design/constitution.md` Section 2 FROZEN Zone에 추가될 항목으로 간주된다. 이유:

- 본 SPEC의 패턴은 모든 도메인 SPEC run이 준수해야 하는 **불변 규칙**이다.
- FROZEN Zone 등록 시, Learner(Section 6)가 이 패턴을 자의적으로 수정하는 것이 방지된다.
- evaluator-active(Section 12)가 "화면 패턴 일관성"을 must-pass 평가항목에 추가하도록 권고한다 (plan.md "Design Constitution 연동" 참조).

---

## 7. 도메인 SPEC 소비 가이드

14개 도메인 SPEC이 본 SPEC을 어떻게 소비해야 하는가:

### 각 도메인 SPEC run 시 준수 사항

1. **화면 구현 시 REQ-SCREEN-LAYOUT 준수**: 각 도메인 SPEC이 화면을 구현할 때, StatusBar → Content Wrapper(좌우 패딩 1회) → (옵션) TabBar 3계층 구조를 따른다. Content Wrapper의 패딩 중복을 피한다.
2. **헤더 구현 시 REQ-SCREEN-HEADER 준수**: 화면 타이틀은 `fontSize 22 / fontWeight 700`으로 통일한다. 우측 액션 아이콘은 22-24px + 44dp 터치타겟 패딩 래퍼를 사용한다. 섹션 라벨은 `fontSize 13 / weight 600 / text-tertiary`를 따른다.
3. **카드 배치 시 REQ-SCREEN-CARD 준수**: 카드 `cornerRadius`는 16, 패딩은 16-20px, 간격은 관련 16px / 섹션 24px를 따른다. 의미 없는 카드 감싸기를 피한다.
4. **상태 처리 시 REQ-SCREEN-STATE 준수**: 빈 상태는 다정한 메시지 + CTA, 로딩은 `brand-500` ActivityIndicator, 에러는 `semantic.error` + 재시도를 따른다. 감정 기록 화면은 스포일러 블러(`blur(12px)`)를 적용한다.
5. **탭 화면 시 REQ-SCREEN-TABBAR 준수**: 4개 탭 진입점(홈/서재/모임/마이)을 가진 캡슐형 프로스티드 글래스 탭바를 사용한다. 선택 탭은 filled 아이콘 + `brand-500` 틴트, 비활성은 outline + `text-tertiary`를 따른다.
6. **비경쟁 원칙 준수**: 어떤 화면에서도 좋아요 수, 팔로워, 랭킹을 표시하지 않는다 (REQ-SCREEN-014, system.md Craft Principles).

### 의존성 선언

각 도메인 SPEC은 자신의 spec.md "선행 의존성" 섹션에 다음을 추가해야 한다:

```
| SPEC-UI-002 | 화면 패턴 디자인 시스템 (레이아웃/헤더/카드/상태/탭바) | 본 SPEC의 화면 구현은 SPEC-UI-002의 REQ-SCREEN-* 패턴을 준수 |
```

---

버전: 1.0.0
분류: SPEC (Feature) — 화면 패턴 디자인 시스템
상태: draft (14개 도메인 SPEC run의 선행 의존성)
