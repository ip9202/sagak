# Design System

> **SSOT**: 본 문서의 토큰 값은 `src/theme/tokens.ts`(SPEC-UI-001 구현체)와 `.booktalk/pages_11_디자인시스템.md`에 기반. 충돌 시 tokens.ts가 우선. Pencil `.pen` 파일은 동일 변수명(`$brand-500` 등)을 사용해 코드와 시각이 1:1로 대응한다.

## Design Intent

종이책 독서의 감정을 아카이브하는 다정한 독서 동반자. 따뜻한 크림색 배경 위 암버 브라운 강조색으로 "책장을 넘기는" 종이 질감의 차분한 경험을 연출한다. 화면은 여백의 미를 강조하고, 경쟁·과시 요소(좋아요·팔로워)를 배제하며, 감정 표현을 안전한 울타리(단어 질문지·공감 스티커) 안에서 돕는다.

## Domain Vocabulary

| 용어 | 정의 |
|------|------|
| 감정 아카이브 | 페이지별 짧은 감정 기록(단어/한 줄)의 누적 |
| 완독 다이어리 | 완독 시 자동 생성되는 "이 책과의 여정" 시각화 |
| Track A | 같은 책 독자에게 보내는 비동기 합류 요청 |
| Track B | 0명이어도 출발하는 함께 읽기 모임 |
| 스포일러 블러 | 현재 진도 초과 페이지의 감정 기록 가림 |
| 공감 스티커 | empathy/touching/comforted 3종 비경쟁 반응 |
| 다정한 알림 | 경쟁·강압 아닌 따뜻한 독서 유도 메시지 |

## Craft Principles

- **비경쟁**: 좋아요 수·팔로워·랭킹 노출 금지 (과시 엔진 회피)
- **짧은 표현 우선**: 긴 독후감이 아닌 단어/한 줄 입력이 기본 경로
- **안전한 울타리**: 감정 입력은 단어 질문지로 유도, 거절 부담 최소화
- **여백의 미**: 넉넉한 간격(spacing-4~6 기본), 밀집 레이아웃 지양
- **스포일러 존중**: 진도 초과 콘텐츠는 기본 블러, 사용자 선택 시만 노출
- **파괴적 행동 확인**: 삭제·탈퇴 등은 명시적 2단계 확인
- **WCAG 2.1 AA**: text/bg 대비 4.5:1, 터치타겟 44dp 최소

## Color Tokens

| Token | 값 | 용도 |
|-------|-------|-------|
| `$brand-500` | #C17B2F | 주요 CTA, 강조, 링크 |
| `$brand-400` | #D4943D | 호버/보조 강조 |
| `$brand-300` | #E6B96A | 감정카드 좌측 강조선, 진행률 그라데이션 |
| `$brand-50` | #FDF7EE | 브랜드 틴트 배경 |
| `$bg-base` | #FDFAF5 | 화면 기본 배경 (따뜻한 크림) |
| `$bg-surface` | #FFFFFF | 카드/컴포넌트 배경 |
| `$bg-muted` | #F4EFE8 | 입력필드, 구분 영역 |
| `$text-primary` | #2D1F0E | 본문/헤딩 (다크 브라운) |
| `$text-secondary` | #7A6350 | 보조 텍스트 |
| `$text-tertiary` | #A89585 | 캡션, 플레이스홀더 |
| `$text-inverse` | #FDFAF5 | brand 배경 위 텍스트 |
| `$border-default` | #E8DDD0 | 기본 테두리 |
| `$semantic-success/error/warning/info` | #4A8C6A/#C94040/#E8A020/#3A7DB5 | 상태 표시 |

> 다크모드: `bg-base #1A1208`, `text-primary #F0E4D0` 등 (pages_11 §3, `darkTokens.ts` 구현)

## Typography

폰트: iOS Apple SD Gothic Neo / Android Noto Sans KR, 포인트 서체 Noto Serif KR(선택).

| Role | Size | Weight | Line |
|------|------|--------|------|
| displayLg | 28 | 700 | 36 |
| displayMd | 24 | 700 | 32 |
| headingLg | 20 | 700 | 28 |
| headingMd | 18 | 600 | 26 |
| headingSm | 16 | 600 | 23 |
| bodyLg | 16 | 400 | 26 |
| bodyMd | 14 | 400 | 22 |
| bodySm | 13 | 400 | 20 |
| caption | 12 | 400 | 17 |
| label | 11 | 500 | 14 |

> **모든 화면의 타이틀은 동일 사이즈를 사용한다** (Mobile App 가이드라인 — 앱 전체 타이틀 균일성).

## Spacing / Radius / Shadow

- Base spacing: 4px 스케일 (`$spacing-1`~`$spacing-12`: 4/8/12/16/20/24/32/40/48)
- 콘텐츠 좌우 패딩: 16–20px (래퍼가 1회 처리)
- 섹션 간격: 24–32px(major), 12–16px(related)
- Radius: sm 6 / md 10 / lg 16 / xl 24 / full 9999
- Shadow: sm `0 1px 3px rgba(45,31,14,0.08)` / md / lg — 브랜드 색조(45,31,14) 기반

## Iconography

- 라이브러리: `@expo/vector-icons` (Feather) + 커스텀(스티커 3종, 귀접기 마스코트)
- 사이즈: sm 16 / md 20 / lg 24 / xl 32
- 탭바 아이콘: ~22px, 선택 시 filled + 브랜드 틴트

## Layout Rules (Mobile)

- 단일 컬럼, 세로 스크롤 기본
- 콘텐츠 래퍼가 좌우 패딩을 1회 처리 (섹션별 패딩 중복 금지)
- 상태바 62px( OS 크롬) → 콘텐츠 래퍼 → (옵션) 탭바 순
- 탭바: 하단 부양 캡슐형, 좌우 16px/하단 12px 인셋, ~56px 높이, 70% 불투명 프로스티드 글래스
- 주요 액션은 하단 영역(원핸드 도달권) 배치
- 터치타겟 44dp 최소

## Motion

- duration: fast 150ms / normal 250ms / slow 400ms
- easing: `cubic-bezier(0.4,0,0.2,1)` 기본 / spring(tension:60,friction:12) 강조
- "사각사각" 타일 감각 인터랙션 (브랜드 모션)

## Accessibility

- WCAG 2.1 AA (대비 4.5:1)
- 터치타겟 44dp
- accessibilityLabel 의무 (SPEC-UI-001 컴포넌트 준수)
- 스포일러 블러 해제는 스크린리더 접근성 별도 고려

---
_Last updated: 2026-06-14_
_Populated by: tokens.ts SSOT 기반 (brand interview 대체)_
