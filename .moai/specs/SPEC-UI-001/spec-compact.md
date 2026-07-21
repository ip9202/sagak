---
id: SPEC-UI-001
title: "프론트엔드 파운데이션 — Compact View"
spec: SPEC-UI-001
version: "1.0.0"
status: draft
auto_generated: true
source: spec.md
created: 2026-06-14
updated: 2026-06-14
author: "강력쇠주먹"
priority: high
issue_number: 0
---

# SPEC-UI-001 Compact

> spec.md에서 요구사항, 인수기준, 수정파일, 제외만 추출한 자동 생성 요약본.
> 전체 내용은 spec.md 참조.

## 요구사항 모듈 (3개)

### Module 1: REQ-FE-FOUND — Expo 프로젝트 파운데이션

| REQ ID | 요구사항 | 주요 제약 |
|--------|---------|-----------|
| REQ-FE-001 | Expo SDK 51+ 초기화 | package.json, app/, tsconfig, babel, app.json |
| REQ-FE-002 | TypeScript strict + 절대경로 alias(@/*) | strict:true |
| REQ-FE-003 | ESLint + Prettier + Jest + @testing-library/react-native | tech.md 준수 |
| REQ-FE-004 | 표준 디렉토리 (app/, src/components, src/theme, src/types) | — |

**인수 기준 요약**:
- `npx expo start` 에러 없이 실행 (F1)
- TypeScript strict 에러 0

### Module 2: REQ-FE-TOKENS — 디자인 토큰 시스템

| REQ ID | 요구사항 | 주요 제약 |
|--------|---------|-----------|
| REQ-FE-010 | pages_11 모든 토큰을 tokens.ts 코드화 | color/typo/spacing/radius/shadow/motion/icon |
| REQ-FE-011 | light/dark 토큰셋 | pages_11 §3 (bg-base dark `#1A1208` 등) |
| REQ-FE-012 | ThemeProvider + useTheme() | useColorScheme + React Context |
| REQ-FE-013 | 폰트 매핑 | iOS Apple SD Gothic Neo / Android Noto Sans KR / 포인트 Noto Serif KR |
| REQ-FE-014 | 토큰 값 pages_11 정확 일치 | brand-500=`#C17B2F` |

**인수 기준 요약**:
- T1: dark 전환 시 useTheme() dark 토큰 반환
- T2: tokens.color.brand[500]==='#C17B2F'

### Module 3: REQ-FE-COMP — 핵심 공통 컴포넌트 6개

| REQ ID | 컴포넌트 | 핵심 |
|--------|---------|------|
| REQ-FE-020 | Button | variant(primary/secondary/ghost/destructive/disabled), size, loading |
| REQ-FE-021 | ProgressBar | gradient fill(brand-500→300) + caption 라벨 |
| REQ-FE-022 | Card | 베이스 (bg-surface + radius-lg + shadow-sm) |
| REQ-FE-023 | BookCard | 표지 80×110 + 제목 2줄 말줄 + 저자 + 진도바 |
| REQ-FE-024 | EmotionRecordCard | 아바타/본문/스티커/스포일러 blur(12px) + brand-300 강조선 |
| REQ-FE-025 | StickerReaction | 3종 empathy/touching/comforted (DB ENUM 연동) |

**인수 기준 요약**:
- C1: 데모 스크린 모든 variant 시각 일치
- C2: Button primary = brand-500/text-inverse/48dp/radius-md
- C3: 스포일러 blur(12px) + 오버레이
- C4: 접근성 label/hint + 44dp 타겟
- C5: BookCard 2줄 말줄

## 수정 대상 파일 (신규 생성 — 그린필드)

| 파일 | 유형 | 내용 |
|------|------|------|
| `package.json`, `app.json`, `tsconfig.json`, `babel.config.js` | 신규 | Expo SDK 51+ 프로젝트 설정 |
| `jest.config.js`, `.eslintrc.js`, `.prettierrc` | 신규 | 테스트/린트 설정 |
| `app/_layout.tsx`, `app/index.tsx`, `app/_dev.tsx` | 신규 | ThemeProvider 래핑, 임시 홈, 데모 스크린 |
| `src/theme/tokens.ts`, `darkTokens.ts`, `theme.tsx` | 신규 | 디자인 토큰 + 다크모드 + Provider |
| `src/components/{Button,Card,ProgressBar,BookCard,EmotionRecordCard,StickerReaction}.tsx` | 신규 | 핵심 컴포넌트 6개 |
| `src/types/index.ts` | 신규 | Book, EmotionRecord, StickerType 도메인 타입 |
| `__tests__/*.test.tsx` | 신규 | 컴포넌트 테스트 6개 |

## 제외 범위 (Exclusions)

본 SPEC은 다음을 포함하지 않는다:

1. **화면 구현** (홈/서재/모임/마이) — 별도 SPEC. 본 SPEC은 컴포넌트까지만
2. **내비게이션 라우팅 연결** — 컴포넌트는 구현하되 실제 화면 라우팅은 제외
3. **Supabase 클라이언트 연동** — 별도 SPEC. 컴포넌트는 목 데이터로 동작
4. **인증 플로우** — 별도 SPEC
5. **커스텀 아이콘 SVG 에셋** (스티커 3종, 귀접기 마스코트) 디자인 — 자리만 확보, 에셋은 별도
6. **Storybook 도입** — 데모 스크린(`app/_dev`)으로 대체 (MVP)
7. **국제화(i18n)** — 한국어 고정 (MVP)
8. **Reanimated 도입** — React Native `Animated` 기본만 (§11 모션은 토큰 정의만)

## 미결정 사항 (해결 상태)

1. 스타일링: 해결 — StyleSheet + tokens.ts
2. Expo 초기화: 해결 — 풀 파운데이션 포함
3. 다크모드: 해결 — pages_11 §3 준수
4. 컴포넌트 6번째: 해결 — StickerReaction + Card 베이스
5. 폰트 최적화: 미해결 — Noto 번들 vs 시스템 (런타임 결정, plan.md 리스크 #3)
