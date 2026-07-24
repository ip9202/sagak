---
id: SPEC-UI-001
version: 1.0.0
status: completed
created: 2026-06-14
updated: 2026-07-23
author: 강력쇠주먹
priority: high
issue_number: 0
---

# HISTORY
- 2026-06-14 v1.0.0: 최초 작성. 프론트엔드 파운데이션 (완전 그린필드, pages_11 기반).

# 프론트엔드 파운데이션 — 디자인 토큰 시스템 및 핵심 공통 컴포넌트

## 개요

사각 앱의 프론트엔드 0단계 파운데이션을 구축한다. React Native + Expo SDK 51+ 환경에서
디자인 시스템 SSOT(`.booktalk/pages_11_디자인시스템.md`)를 코드(`tokens.ts` + 다크모드
`ThemeProvider`)로 변환하고, 모든 화면이 공유하는 핵심 공통 컴포넌트 6개를 구현한다.
본 SPEC은 완전 그린필드(기존 프론트엔드 코드 전무)에서 출발한다.

스타일링은 `StyleSheet.create` + `tokens.ts` 임포트 방식(pages_11 §14 구현 예시 준수).
다크모드는 `useColorScheme` + React Context 기반 토큰 스위칭(pages_11 §3).

## 요구사항 모듈

### Module 1: REQ-FE-FOUND — Expo 프로젝트 파운데이션

| REQ ID | 요구사항 (EARS) | 주요 제약 |
|--------|----------------|-----------|
| REQ-FE-001 | 시스템은 Expo SDK 51+ 프로젝트를 초기화해야 한다 | package.json, app/ (Expo Router 파일 라우팅), tsconfig, babel.config, app.json |
| REQ-FE-002 | 시스템은 TypeScript strict 모드를 적용해야 한다 | tsconfig strict:true, 절대경로 alias(@/*) |
| REQ-FE-003 | 시스템은 ESLint + Prettier + Jest + @testing-library/react-native를 설정해야 한다 | tech.md 개발환경 요구사항 준수 |
| REQ-FE-004 | 시스템은 표준 디렉토리 구조를 사용해야 한다 | app/(screens), src/components, src/theme, src/hooks, src/types |

**인수 기준 요약**:
- `npx expo start`가 에러 없이 실행된다 (시나리오 F1)
- TypeScript strict 컴파일 에러 0건
- `jest`가 테스트 스켈레톤을 실행한다

### Module 2: REQ-FE-TOKENS — 디자인 토큰 시스템

| REQ ID | 요구사항 (EARS) | 주요 제약 |
|--------|----------------|-----------|
| REQ-FE-010 | 시스템은 pages_11의 모든 디자인 토큰을 `src/theme/tokens.ts`에 코드화해야 한다 | color(brand 6단계, bg 4종, text 6종, border 3종, semantic 4종, spoiler), typography(10단계), spacing(9단계), radius(5단계), shadow(3단계), motion(duration 3 + easing 2), icon sizes |
| REQ-FE-011 | 시스템은 light/dark 양쪽 토큰셋을 정의해야 한다 | pages_11 §3 다크모드 대응값 (bg-base `#1A1208`, text-primary `#F0E4D0` 등) |
| REQ-FE-012 | 시스템은 `ThemeProvider` + `useTheme()` 훅으로 다크모드 전환을 제공해야 한다 | useColorScheme + React Context, `useTheme()`가 현재 모드의 토큰을 반환 |
| REQ-FE-013 | 시스템은 폰트 패밀리 매핑을 제공해야 한다 | iOS: Apple SD Gothic Neo, Android: Noto Sans KR, 포인트 서체: Noto Serif KR(선택) |
| REQ-FE-014 | 토큰 값은 pages_11과 정확히 일치해야 한다 | brand-500=`#C17B2F`, bg-base=`#FDFAF5`, text-primary=`#2D1F0E` 등 (pages_11 §2 참조) |

**인수 기준 요약**:
- tokens.ts가 pages_11 모든 색/타이포/간격/반경/그림자/모션 값을 포함한다
- `useTheme()`이 light/dark 전환 시 올바른 토큰을 반환한다 (시나리오 T1)
- WCAG AA 대비(4.5:1) 충족 — text-primary/bg-base 조합 검증

### Module 3: REQ-FE-COMP — 핵심 공통 컴포넌트 6개

| REQ ID | 컴포넌트 | 요구사항 (EARS) | pages_11 스펙 |
|--------|---------|----------------|---------------|
| REQ-FE-020 | Button | 시스템은 variant(primary/secondary/ghost/destructive/disabled) + size + loading 상태를 지원하는 버튼을 제공해야 한다 | §9.1: 높이 48dp(ghost 40dp), radius-md, loading=ActivityIndicator |
| REQ-FE-021 | ProgressBar | 시스템은 gradient fill + label을 가진 진행률 바를 제공해야 한다 | §9.5: track bg-muted 4dp, fill brand-500→300 gradient, caption 라벨 |
| REQ-FE-022 | Card | 시스템은 재사용 가능한 베이스 카드(bg-surface, radius-lg, shadow-sm)를 제공해야 한다 | §9.2/9.3 공통 베이스 |
| REQ-FE-023 | BookCard | 시스템은 표지(80×110dp) + 제목(2줄 말줄) + 저자 + 진도바를 가진 도서 카드를 제공해야 한다 | §9.2 |
| REQ-FE-024 | EmotionRecordCard | 시스템은 아바타 + 닉네임 + 페이지 + 본문 + 스티커 반응 + 스포일러 블러를 가진 감정 기록 카드를 제공해야 한다 | §9.3: 좌측 brand-300 강조선, spoiler blur(12px) |
| REQ-FE-025 | StickerReaction | 시스템은 3종 스티커(empathy/touching/comforted) 반응 컴포넌트를 제공해야 한다 | §9.4 + DB ENUM sticker_type 연동 |

**인수 기준 요약**:
- 6개 컴포넌트가 모두 tokens.ts 기반으로 스타일링된다 (색/간격 하드코딩 금지)
- 각 컴포넌트가 다크모드를 지원한다 (useTheme)
- 각 컴포넌트가 WCAG AA 접근성(44dp 터치타겟, accessibilityLabel)을 충족한다
- 데모 스크린(`app/_dev`)에서 모든 variant를 시각 검증한다 (시나리오 C1)

## 기술 접근

- **프레임워크**: React Native + Expo SDK 51+ (managed workflow)
- **라우팅**: Expo Router (파일 시스템 기반)
- **스타일링**: `StyleSheet.create` + `tokens.ts` 임포트 (의존성 최소, pages_11 §14 준수)
- **테마**: React Context + `useColorScheme` (다크모드)
- **타입**: TypeScript strict
- **아이콘**: `@expo/vector-icons` (Feather) + 커스텀(스티커 3종, 귀접기 마스코트 — 자리만)
- **테스트**: Jest + @testing-library/react-native
- **참조 SSOT**: `.booktalk/pages_11_디자인시스템.md`, `.moai/project/brand/visual-identity.md`, `.moai/project/tech.md`

## 제외 범위 (What NOT to Build)

1. 화면 구현(홈/서재/모임/마이) — 별도 SPEC. 본 SPEC은 컴포넌트까지만
2. 내비게이션(탭바, 스택) 라우팅 연결 — 컴포넌트는 구현하되 실제 화면 라우팅은 제외
3. Supabase 클라이언트 연동 — 별도 SPEC(SPEC-API-*). 컴포넌트는 목 데이터로 동작
4. 인증 플로우 — 별도 SPEC
5. 커스텀 아이콘 SVG 에셋(스티커 3종, 귀접기) 디자인 — 자리만 확보, 에셋은 별도
6. Storybook 도입 — 데모 스크린(`app/_dev`)으로 대체 (MVP)
7. 국제화(i18n) — 한국어 고정 (MVP)
8. Reanimated 도입 — React Native `Animated` 기본만 (MVP, §11 모션은 토큰 정의만)

## 미결정 사항 (해결 상태)

1. **스타일링 방식**: 해결됨 — StyleSheet + tokens.ts (사용자 결정 2026-06-14)
2. **Expo 초기화 포함**: 해결됨 — 풀 파운데이션 포함 (사용자 결정)
3. **다크모드**: 해결됨 — pages_11 §3 준수, ThemeProvider 포함
4. **컴포넌트 6번째**: 해결됨 — StickerReaction(도메인 핵심) + Card 베이스 (총 6개)
5. **폰트 최적화**: 미해결 — Noto Sans KR/Serif 번들 vs 시스템 폰트 (런타임 결정, plan.md 리스크 #3)
