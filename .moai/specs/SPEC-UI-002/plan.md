---
id: SPEC-UI-002
title: "화면 패턴 디자인 시스템 — 구현 계획"
version: "1.0.0"
status: draft
created: 2026-06-14
updated: 2026-06-14
author: "강력쇠주먹"
priority: high
issue_number: 0
labels: [frontend, ui, screen-pattern, layout, plan, frozen]
---

# SPEC-UI-002: 화면 패턴 디자인 시스템 — 구현 계획 (plan.md)

## HISTORY

| 날짜 | 버전 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 2026-06-14 | 1.0.0 | 최초 작성. 화면 패턴 디자인 시스템 구현 계획 수립. | 강력쇠주먹 |

---

## 1. 구현 개요

본 SPEC은 **문서 중심 SPEC**이다. 즉, 본 SPEC 자체가 대량의 코드를 구현하는 것이 아니라, **14개 도메인 SPEC이 run할 때 준수해야 하는 화면 레벨 불변 규칙**을 정의한다. 따라서 본 plan.md의 "구현"은 다음을 의미한다:

1. **공유 화면 레이아웃 컴포넌트 구현** (Primary Goal): `ScreenLayout`, `ScreenHeader`, `TabBarShell` 등 모든 도메인 SPEC이 재사용하는 화면 뼈대 컴포넌트를 구현한다. 이 컴포넌트들은 본 SPEC의 REQ를 코드로 강제한다.
2. **상태 패턴 유틸리티 구현** (Primary Goal): `EmptyState`, `LoadingState`, `ErrorState` 공통 컴포넌트를 구현하여, 빈/로딩/에러 상태의 일관성을 보장한다.
3. **Design Constitution FROZEN Zone 확장** (Primary Goal): 본 SPEC의 REQ를 `.claude/rules/moai/design/constitution.md` Section 2 FROZEN Zone에 추가한다.
4. ** evaluator-active 평가 항목 확장 권고** (Secondary Goal): "화면 패턴 일관성"을 must-pass 평가 항목에 추가하도록 design.yaml / evaluator 프로필을 갱신한다.

> 본 SPEC의 "구현"은 SPEC-UI-001(컴포넌트·토큰)이 제공한 자산 위에 화면 레벨 패턴을 얹는 작업이다. tokens.ts 재정의, 컴포넌트 내부 재구현은 포함하지 않는다.

---

## 2. 마일스톤 (우선순위 기반)

> 시간 추정은 사용하지 않는다 (CLAUDE.md "Time Estimation" 금지). 의존성 기반 순서만 명시.

### Primary Goal — 화면 패턴 인프라 (14개 도메인 SPEC run의 선행 조건)

#### 마일스톤 M1: 공유 화면 레이아웃 컴포넌트

- **목적**: REQ-SCREEN-LAYOUT, REQ-SCREEN-HEADER를 코드로 강제하는 재사용 컴포넌트 구현
- **산출물**:
  - `src/components/screen/ScreenLayout.tsx` — 3계층 레이아웃 래퍼 (StatusBar 영역 + Content Wrapper 좌우 패딩 1회 처리 + 옵션 TabBar)
  - `src/components/screen/ScreenHeader.tsx` — 균일 타이틀 타이포그래피(`fontSize 22 / fontWeight 700`) + 우측 액션 아이콘 슬롯
  - `src/components/screen/SectionLabel.tsx` — 섹션 라벨(`fontSize 13 / weight 600 / text-tertiary`)
- **의존**: SPEC-UI-001 `tokens.ts`, `useTheme()` (완료됨)
- **검증**: 컴포넌트가 모든 토큰을 `useTheme()`에서 임포트하는지 grep 검증; 하드코딩 픽셀값 0건

#### 마일스톤 M2: 상태 패턴 공통 컴포넌트

- **목적**: REQ-SCREEN-STATE를 코드로 강제하는 재사용 컴포넌트 구현
- **산출물**:
  - `src/components/state/EmptyState.tsx` — 다정한 메시지 + CTA 슬롯 (design/spec.md 빈 상태 5종 메시지 사전 정의)
  - `src/components/state/LoadingState.tsx` — `brand-500` ActivityIndicator 래퍼
  - `src/components/state/ErrorState.tsx` — `semantic.error` 메시지 + 재시도 버튼 슬롯
  - `src/components/state/SpoilerBlur.tsx` — `blur(12px)` + 라벨 오버레이 (REQ-FE-024 토큰 소비)
- **의존**: M1 (ScreenLayout에 상태 컴포넌트가 렌더링됨), SPEC-UI-001 Button/Card
- **검증**: 각 상태 컴포넌트가 design/spec.md 빈 상태 메시지 5종을 지원하는지 검증

#### 마일스톤 M3: 탭바 셸 컴포넌트

- **목적**: REQ-SCREEN-TABBAR를 코드로 강제하는 캡슐형 탭바 셸 구현
- **산출물**:
  - `src/components/screen/TabBarShell.tsx` — 캡슐형(borderRadius=높이/2), 70% 불투명 프로스티드 글래스, 하단 12px/좌우 16px 인셋, 4개 탭 슬롯
- **의존**: SPEC-NAV-001 REQ-NAV-TABS (4탭 라우트 구조, 완료됨), M1
- **검증**: 4개 탭(홈/서재/모임/마이) 고정 순서, 선택 상태 `brand-500` 틴트 + filled 아이콘

### Secondary Goal — Constitution 및 평가 연동

#### 마일스톤 M4: Design Constitution FROZEN Zone 확장

- **목적**: 본 SPEC의 REQ를 constitution.md Section 2 FROZEN Zone에 추가
- **산출물**:
  - `.claude/rules/moai/design/constitution.md` Section 2 FROZEN Zone 업데이트 — REQ-SCREEN-001 ~ REQ-SCREEN-044 불변 규칙 등록
  - constitution.md HISTORY 섹션 업데이트 (SPEC-UI-002 FROZEN 확장 기록)
- **의존**: M1, M2, M3 완료 (코드가 먼저 존재해야 FROZEN 등록이 의미 있음)
- **검증**: constitution.md Section 2에 REQ-SCREEN-* 항목이 명시됨; Learner가 해당 항목을 수정할 수 없음 (Frozen Guard 검증)

#### 마일스톤 M5: evaluator-active 평가 항목 확장

- **목적**: "화면 패턴 일관성"을 evaluator-active must-pass 평가 항목에 추가
- **산출물**:
  - `.moai/config/evaluator-profiles/` (또는 design.yaml) 업데이트 — "화면 패턴 일관성" 평가 기준 추가
  - 평가 기준: 모든 화면이 ScreenLayout, ScreenHeader, 상태 컴포넌트, TabBarShell을 사용하는지; 하드코딩 스타일 값이 0건인지; 비경쟁 원칙이 준수되는지
- **의존**: M4 (FROZEN 등록 후 평가 기준이 유효)
- **검증**: evaluator-active가 도메인 SPEC run 결과를 평가할 때 "화면 패턴 일관성" 항목으로 점수를 매김

### Optional Goal — 미결정 사항 해결

#### 마일스톤 M6: 모달/바텀시트 패턴 정의 (Optional)

- **목적**: 미결정 사항 5.1 해결 — 모달형 화면 공통 패턴 정의
- **산출물**: 본 SPEC 확장(REQ-SCREEN-MODAL 모듈 추가) 또는 별도 SPEC(SPEC-UI-003)
- **의존**: 첫 모달형 화면 구현 시점 (SPEC-EMOTION-001 F08 emotion-input)
- **상태**: 미해결 — 첫 모달 화면 구현 시 평가

#### 마일스톤 M7: 토스트/풀투리프레시 패턴 정의 (Optional)

- **목적**: 미결정 사항 5.2, 5.3 해결
- **산출물**: 본 SPEC 확장 또는 별도 패턴 문서
- **의존**: 첫 목록형 화면 구현 시점
- **상태**: 미해결 — 첫 목록형 화면 구현 시 평가

---

## 3. 기술 접근

### 아키텍처 원칙

1. **컴포넌트 조합 방식**: 화면 패턴은 개별 화면 코드가 아니라 **재사용 컴포넌트**(`ScreenLayout`, `ScreenHeader`, `EmptyState` 등)로 구현된다. 각 도메인 SPEC은 이 컴포넌트를 조립하여 화면을 구성한다.
2. **토큰 기반 강제**: 모든 컴포넌트는 `useTheme()`에서 토큰을 임포트한다. 하드코딩된 스타일 값은 lint 규칙(또는 코드 리뷰)으로 차단한다.
3. **선행 의존성 존중**: 본 SPEC은 SPEC-UI-001(tokens.ts, ThemeProvider)과 SPEC-NAV-001(4탭 구조) 위에 구축된다. 이 두 SPEC의 인터페이스를 소비하기만 하며, 재구현하지 않는다.
4. **FROZEN Zone 불변성**: 본 SPEC의 REQ가 constitution.md FROZEN에 등록되면, Learner(디자인 시스템 자가 진화)가 이를 수정할 수 없다. 오직 인간 개발자만 FROZEN 항목을 변경할 수 있다.

### 디렉토리 구조

```
src/
├── components/
│   ├── screen/           # 화면 레벨 레이아웃 컴포넌트 (M1, M3)
│   │   ├── ScreenLayout.tsx
│   │   ├── ScreenHeader.tsx
│   │   ├── SectionLabel.tsx
│   │   └── TabBarShell.tsx
│   └── state/            # 상태 패턴 컴포넌트 (M2)
│       ├── EmptyState.tsx
│       ├── LoadingState.tsx
│       ├── ErrorState.tsx
│       └── SpoilerBlur.tsx
└── theme/
    └── tokens.ts         # SPEC-UI-001 (재구현 안 함)
```

### 테스트 전략

1. **컴포넌트 단위 테스트**: 각 화면 패턴 컴포넌트가 올바른 토큰을 사용하는지, 올바른 레이아웃을 렌더링하는지 Jest + @testing-library/react-native로 검증.
2. **하드코딩 감지 테스트**: 컴포넌트 소스 코드를 grep하여 HEX 코드, 픽셀값 리터럴이 없는지 자동 검증 (CI 게이트).
3. **접근성 테스트**: 각 컴포넌트가 44dp 터치타겟, `accessibilityLabel`을 갖추고 있는지 검증.
4. **빈 상태 메시지 검증**: EmptyState 컴포넌트가 design/spec.md 빈 상태 5종 메시지를 지원하는지 검증.

### 리스크 및 대응

| 리스크 | 확률 | 영향 | 대응 |
|--------|------|------|------|
| 도메인 SPEC이 본 패턴을 무시하고 독자적 화면 구현 | 중 | 높음 | FROZEN Zone 등록 + evaluator-active "화면 패턴 일관성" 평가로 강제; 코드 리뷰 게이트 |
| Pencil `.pen` 패턴과 코드 패턴 불일치 | 낮음 | 중간 | FROZEN 등록 전 Pencil F03/F04/F11/F15와 코드 컴포넌트를 대조 검증; 불일치 시 Pencil 또는 코드 중 SSOT(system.md) 기준으로 정렬 |
| 모달/토스트 패턴 미정으로 인해 도메인 SPEC이 임의 구현 | 높음 | 중간 | M6, M7을 가능한 빨리 수행; 또는 각 도메인 SPEC이 모달 도입 시 본 SPEC 확안을 트리거하도록 가이드라인 명시 |
| evaluator-active 평가 항목 과도한 엄격함 | 낮음 | 낮음 | M5에서 평가 기준을 "필수 패턴 준수 여부"로 한정; 스타일 취향 영역은 평가에서 제외 |

---

## 4. Design Constitution 연동

### FROZEN Zone 확장 명세

본 SPEC의 REQ가 `.claude/rules/moai/design/constitution.md` Section 2 "FROZEN Zone"에 다음 항목으로 추가된다:

```
- [FROZEN] SPEC-UI-002 REQ-SCREEN-LAYOUT: 3계층 화면 레이아웃 (StatusBar → Content Wrapper → TabBar)
- [FROZEN] SPEC-UI-002 REQ-SCREEN-HEADER: 화면 타이틀 균일성 (fontSize 22 / fontWeight 700)
- [FROZEN] SPEC-UI-002 REQ-SCREEN-CARD: 카드 밀도 규칙 (cornerRadius 16, padding 16-20, 간격 16/24)
- [FROZEN] SPEC-UI-002 REQ-SCREEN-STATE: 빈/로딩/에러 상태 패턴 (다정한 톤, brand-500 ActivityIndicator, semantic.error)
- [FROZEN] SPEC-UI-002 REQ-SCREEN-TABBAR: 캡슐형 4탭 탭바 (프로스티드 글래스, 선택 시 brand 틴트)
- [FROZEN] SPEC-UI-002 비경쟁 원칙: 좋아요 수·팔로워·랭킹 표시 금지 (모든 화면)
```

이 항목들이 FROZEN에 등록되면:

- **Frozen Guard (Layer 1)**: Learner가 이 REQ를 수정하려 하면 차단되고 로그에 기록된다.
- **Canary Check (Layer 2)**: Learner가 제안한 변경이 최근 3개 프로젝트 평가 점수를 0.10 이상 하락시키면 거부된다.
- **Human Oversight (Layer 5)**: 오직 인간 개발자만 constitution.md FROZEN 항목을 변경할 수 있다.

### evaluator-active 평가 항목 권고

constitution.md Section 12 "Evaluator Leniency Prevention"의 Must-Pass Firewall에 다음 항목을 추가하도록 권고한다:

```
- [MUST-PASS] 화면 패턴 일관성: 모든 화면이 ScreenLayout, ScreenHeader, 상태 컴포넌트(EmptyState/LoadingState/ErrorState), TabBarShell을 사용하는지; 하드코딩 스타일 값이 0건인지; 비경쟁 원칙이 준수되는지 (SPEC-UI-002 REQ-SCREEN-*)
```

이 항목이 must-pass에 등록되면:

- 어떤 화면이 본 패턴을 위반하면, 다른 평가 차원에서 높은 점수를 받아도 전체 평가가 FAIL된다 (Mechanism 3: Must-Pass Firewall).
- evaluator-active는 Rubric Anchoring(Mechanism 1)을 통해 "화면 패턴 일관성" 0.25/0.50/0.75/1.0 기준을 명시해야 한다.

---

## 5. 검증 계획

### 완료 기준 (Definition of Done)

본 SPEC의 구현(M1 ~ M5)이 완료되려면:

1. **M1 완료**: `ScreenLayout`, `ScreenHeader`, `SectionLabel` 컴포넌트가 구현되고, 모든 토큰이 `useTheme()`에서 임포트됨 (grep 검증: 하드코딩 0건).
2. **M2 완료**: `EmptyState`, `LoadingState`, `ErrorState`, `SpoilerBlur` 컴포넌트가 구현되고, design/spec.md 빈 상태 메시지 5종을 지원함.
3. **M3 완료**: `TabBarShell` 컴포넌트가 구현되고, 4개 탭 고정 순서 + 캡슐형 + 프로스티드 글래스 + 선택 상태 `brand-500` 틴트를 지원함.
4. **M4 완료**: `.claude/rules/moai/design/constitution.md` Section 2 FROZEN Zone에 REQ-SCREEN-* 항목이 등록됨.
5. **M5 완료**: evaluator-active 평가 프로필에 "화면 패턴 일관성" must-pass 항목이 추가됨.
6. **문서화**: 본 SPEC의 REQ가 14개 도메인 SPEC에 의해 소비될 준비가 완료됨 (Section 7 소비 가이드 배포).

### 품질 게이트 (TRUST 5)

- **Tested**: 각 화면 패턴 컴포넌트의 단위 테스트 커버리지 85% 이상; 하드코딩 감지 자동화 테스트 포함.
- **Readable**: 컴포넌트 명명 규칙(Screen*, State*) 준수; 한국어 주석(code_comments 설정 준수).
- **Unified**: 모든 컴포넌트가 동일한 토큰 소스(`useTheme()`)를 사용; 스타일 일관성.
- **Secured**: 본 SPEC은 UI 패턴이므로 보안 민감 정보 없음; 다만, 접근성(WCAG AA) 준수가 의무.
- **Trackable**: 모든 커밋이 `feature/SPEC-UI-002-screen-patterns` 브랜치에서 진행; conventional commit 메시지.

---

## 6. 14개 도메인 SPEC 연동 가이드

본 SPEC이 완료된 후, 14개 도메인 SPEC이 run할 때:

1. **spec.md "선행 의존성" 업데이트**: 각 도메인 SPEC이 SPEC-UI-002를 선행 의존성으로 선언.
2. **run 시 컴포넌트 소비**: 각 도메인 SPEC이 `ScreenLayout`, `ScreenHeader`, 상태 컴포넌트, `TabBarShell`을 임포트하여 화면을 구성.
3. **평가 시 일관성 검증**: evaluator-active가 "화면 패턴 일관성" must-pass 항목으로 각 도메인 SPEC run 결과를 평가.

### 도메인 SPEC별 소비 예상

| 도메인 SPEC | 주요 소비 REQ 모듈 | 비고 |
|-------------|-------------------|------|
| SPEC-AUTH-001 | REQ-SCREEN-LAYOUT (로그인/온보딩), REQ-SCREEN-STATE | 탭바 없는 전체 화면 |
| SPEC-LIBRARY-001 | REQ-SCREEN-LAYOUT, REQ-SCREEN-HEADER, REQ-SCREEN-CARD, REQ-SCREEN-STATE (빈 상태), REQ-SCREEN-TABBAR | F04, F05 |
| SPEC-BOOK-001 | REQ-SCREEN-LAYOUT, REQ-SCREEN-HEADER, REQ-SCREEN-STATE | F06, F07 |
| SPEC-EMOTION-001 | REQ-SCREEN-LAYOUT, REQ-SCREEN-STATE (스포일러 블러, 빈 상태) | F08, F09 (블러 핵심) |
| SPEC-COMPLETION-001 | REQ-SCREEN-LAYOUT, REQ-SCREEN-HEADER, REQ-SCREEN-CARD | F10 |
| SPEC-CLUB-001 | REQ-SCREEN-LAYOUT, REQ-SCREEN-HEADER, REQ-SCREEN-CARD, REQ-SCREEN-TABBAR | F13 |
| SPEC-CLUB-002 | REQ-SCREEN-LAYOUT, REQ-SCREEN-HEADER, REQ-SCREEN-CARD, REQ-SCREEN-STATE (빈 상태), REQ-SCREEN-TABBAR | F11, F12 |
| SPEC-FEED-001 | REQ-SCREEN-LAYOUT, REQ-SCREEN-STATE (스포일러 블러) | F14 (블러 핵심) |
| SPEC-ROUTINE-001 | REQ-SCREEN-LAYOUT, REQ-SCREEN-HEADER, REQ-SCREEN-CARD | F17 |
| SPEC-NOTIF-001 | REQ-SCREEN-LAYOUT, REQ-SCREEN-HEADER, REQ-SCREEN-STATE (빈 상태) | F18 |
| SPEC-PROFILE-001 | REQ-SCREEN-LAYOUT, REQ-SCREEN-HEADER, REQ-SCREEN-CARD, REQ-SCREEN-TABBAR | F15, F16 |

---

버전: 1.0.0
상태: draft (M1 ~ M5가 14개 도메인 SPEC run의 선행 조건)
