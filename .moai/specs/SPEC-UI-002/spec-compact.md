---
id: SPEC-UI-002
title: "화면 패턴 디자인 시스템 (Compact)"
version: "1.0.0"
status: draft
created: 2026-06-14
updated: 2026-06-14
author: "강력쇠주먹"
priority: high
issue_number: 0
---

# SPEC-UI-002 Compact: 화면 패턴 디자인 시스템

> 본 문서는 spec.md의 요약본이다. 상세 내용은 spec.md, plan.md, acceptance.md를 참조.

## 핵심 목적

SPEC-UI-001(컴포넌트·토큰)과 14개 도메인 SPEC(화면) 사이의 갭을 메운다. 각 도메인 SPEC이 화면을 구현할 때 **동일한 레이아웃 템플릿, 카드 밀도, 헤더 패턴, 상태(빈/로딩/에러) 패턴, 탭바 규칙**을 따르도록 EARS 요구사항으로 고정한다. Phase 0 위치 — 모든 도메인 SPEC run의 선행 의존성.

## 선행 의존성

- **SPEC-UI-001**: tokens.ts, ThemeProvider, 6개 컴포넌트 (완료됨)
- **SPEC-NAV-001**: 4개 탭 구조, 화면 셸 (완료됨)

## 요구사항 모듈 (5개, 총 25 REQ)

### REQ-SCREEN-LAYOUT: 3계층 화면 레이아웃 (5 REQ)

| REQ ID | 요구사항 |
|--------|---------|
| REQ-SCREEN-001 | 모든 탭 화면은 StatusBar(62px) → Content Wrapper(좌우 16-20px 패딩 1회) → TabBar 3계층 구조 |
| REQ-SCREEN-002 | 단일 컬럼, 세로 스크롤 기본 (멀티 컬럼은 갤러리 등 명시적 경우만) |
| REQ-SCREEN-003 | 섹션 간격: 관련 16px, 독립(메이저) 24-32px |
| REQ-SCREEN-004 | 터치타겟 44dp 최소 (WCAG AA) |
| REQ-SCREEN-005 | 하드코딩 금지 — 모든 값 useTheme() 토큰 사용 |

### REQ-SCREEN-HEADER: 헤더 및 타이틀 (5 REQ)

| REQ ID | 요구사항 |
|--------|---------|
| REQ-SCREEN-010 | 화면 타이틀 fontSize 22 / fontWeight 700 앱 전체 균일 |
| REQ-SCREEN-011 | 헤더 우측 액션 아이콘 22-24px + 44dp 터치타겟 패딩 래퍼 |
| REQ-SCREEN-012 | 섹션 라벨 fontSize 13 / fontWeight 600 / text-tertiary |
| REQ-SCREEN-013 | 14개 도메인 SPEC 모두 동일 헤더 패턴 준수 (독자 헤더 금지) |
| REQ-SCREEN-014 | 비경쟁 원칙 — 좋아요 수/팔로워/랭킹 표시 금지 |

### REQ-SCREEN-CARD: 카드 밀도 및 간격 (5 REQ)

| REQ ID | 요구사항 |
|--------|---------|
| REQ-SCREEN-020 | 카드 cornerRadius 16, padding 16-20px |
| REQ-SCREEN-021 | 카드 간격: 동일 섹션 16px, 섹션 경계 24px |
| REQ-SCREEN-022 | 카드 남용 금지 — 의미 있을 때만 카드 사용 |
| REQ-SCREEN-023 | 카드 그림자: shadow.sm 기본, 브랜드 색조(45,31,14) 기반 |
| REQ-SCREEN-024 | 카드 접근성: 44dp 터치타겟, accessibilityLabel, accessibilityRole="button" |

### REQ-SCREEN-STATE: 빈/로딩/에러 상태 (5 REQ)

| REQ ID | 요구사항 |
|--------|---------|
| REQ-SCREEN-030 | 빈 상태 다정한 메시지 + CTA (design/spec.md 5종 준수) |
| REQ-SCREEN-031 | 로딩은 ActivityIndicator + brand-500 색상 |
| REQ-SCREEN-032 | 에러는 semantic.error 색상 + 재시도 버튼, 다정한 톤 |
| REQ-SCREEN-033 | 스포일러 블러: 진도 초과 감정 기록 blur(12px) + 라벨 오버레이 |
| REQ-SCREEN-034 | 상태 전환 motion.duration.fast(150ms) 페이드, 레이아웃 시프트 최소화 |

### REQ-SCREEN-TABBAR: 캡슐형 4탭 탭바 (5 REQ)

| REQ ID | 요구사항 |
|--------|---------|
| REQ-SCREEN-040 | 탭바 캡슐형(borderRadius=높이/2), 70% 불투명 프로스티드 글래스 |
| REQ-SCREEN-041 | 탭바 인셋: 하단 12px, 좌우 16px, 높이 약 56px |
| REQ-SCREEN-042 | 선택 탭 filled 아이콘 + brand-500 틴트, 비활성 outline + text-tertiary |
| REQ-SCREEN-043 | 4개 탭(홈/서재/모임/마이) 고정 순서, 변경/숨김/추가 불가 |
| REQ-SCREEN-044 | 탭 접근성: accessibilityLabel, accessibilityRole="tab", accessibilityState, 44dp 터치타겟 |

## 제외 범위

1. 컴포넌트 내부 구현 (SPEC-UI-001)
2. 디자인 토큰 값 정의 (tokens.ts, system.md SSOT)
3. 개별 화면 콘텐츠 (14개 도메인 SPEC)
4. 다크모드 토큰 값 (SPEC-UI-001 darkTokens.ts)
5. 모션 상세 정의 (tokens.ts motion, system.md)
6. 라우팅 로직 (SPEC-NAV-001)
7. 모달/바텀시트 패턴 (미결정)
8. 커스텀 전환 애니메이션 (Reanimated 미도입)

## 미결정 사항

1. **모달/바텀시트 패턴** — 미해결 (향후 본 SPEC 확장 또는 별도 SPEC)
2. **토스트 메시지 패턴** — 미해결 (향후 별도 패턴 정의)
3. **풀투리프레시 규칙** — 미해결 (첫 목록형 화면 시 확정)
4. **스켈레톤 로딩 UI** — 미해결 (첫 화면 구현 후 평가)

## Design Constitution FROZEN 연동

- 본 SPEC의 모든 REQ가 constitution.md Section 2 FROZEN Zone에 추가될 항목
- Learner가 수정 불가, 인간 개발자만 변경 가능
- evaluator-active "화면 패턴 일관성" must-pass 평가 항목 추가 권고

## 도메인 SPEC 소비 가이드

각 도메인 SPEC은 run할 때:
1. spec.md "선행 의존성"에 SPEC-UI-002 추가
2. 화면 구현 시 ScreenLayout, ScreenHeader, 상태 컴포넌트, TabBarShell 사용
3. 본 SPEC의 REQ-SCREEN-* 패턴 준수

## 핵심 추적 매핑

| 소스 | 활용 |
|------|------|
| `.moai/design/system.md` | 레이아웃 규칙, 타이포, 간격, Craft 원칙 (비경쟁) |
| `.moai/design/spec.md` | 17개 화면 IA, 빈 상태 5종, Acceptance Criteria |
| Pencil `.pen` F03/F04/F11/F15 | 핵심 탭 화면 시각적 레퍼런스 |
| SPEC-UI-001 | tokens.ts, 컴포넌트 (선행 의존성) |
| SPEC-NAV-001 | 4탭 구조 (협업) |

---

버전: 1.0.0 (Compact)
상태: draft
