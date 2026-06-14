# Implementation Plan — SPEC-UI-001

> 프론트엔드 파운데이션 구현 계획. TDD (RED-GREEN-REFACTOR).
> SSOT: `.booktalk/pages_11_디자인시스템.md`

## 태스크 분해

| Task | 설명 | 의존성 | 주요 파일 |
|------|------|--------|-----------|
| T-001 | Expo 프로젝트 초기화 (SDK 51+, TypeScript strict, Expo Router) | — | package.json, app.json, tsconfig.json, babel.config.js |
| T-002 | 디렉토리 구조 + lint/format/test 설정 | T-001 | .eslintrc, .prettierrc, jest.config.js, src/, app/ |
| T-003 | tokens.ts — color(light) + bg/text/border/semantic/spoiler 전체 | T-002 | src/theme/tokens.ts |
| T-004 | tokens.ts — typography/spacing/radius/shadow/motion/icon | T-003 | src/theme/tokens.ts |
| T-005 | dark 토큰셋 + ThemeProvider + useTheme() | T-004 | src/theme/theme.tsx, src/theme/darkTokens.ts |
| T-006 | Button 컴포넌트 + 테스트 | T-005 | src/components/Button.tsx, __tests__/Button.test.tsx |
| T-007 | Card 베이스 + ProgressBar 컴포넌트 + 테스트 | T-005 | src/components/Card.tsx, ProgressBar.tsx |
| T-008 | BookCard + EmotionRecordCard 컴포넌트 + 테스트 | T-007 | src/components/BookCard.tsx, EmotionRecordCard.tsx |
| T-009 | StickerReaction(3종) + 도메인 타입(Book/EmotionRecord/StickerType) + 테스트 | T-008 | src/components/StickerReaction.tsx, src/types/index.ts, __tests__/StickerReaction.test.tsx |
| T-010 | 데모 스크린(app/_dev, light/dark 토글) + _layout(ThemeProvider) + index | T-009 | app/_layout.tsx, app/index.tsx, app/_dev.tsx |

## 파일 구조 (신규 생성, 그린필드)

```
sagak/
├── package.json
├── app.json
├── tsconfig.json
├── babel.config.js
├── jest.config.js
├── .eslintrc.js
├── .prettierrc
├── app/
│   ├── _layout.tsx          # ThemeProvider 래핑
│   ├── index.tsx            # 임시 홈 (데모 링크)
│   └── _dev.tsx             # 컴포넌트 데모 스크린 (모든 variant)
├── src/
│   ├── theme/
│   │   ├── tokens.ts        # 모든 디자인 토큰 (pages_11 §2-8, §11 기반)
│   │   ├── darkTokens.ts    # 다크모드 오버라이드 (pages_11 §3)
│   │   └── theme.tsx        # ThemeProvider + useTheme()
│   ├── components/
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── ProgressBar.tsx
│   │   ├── BookCard.tsx
│   │   ├── EmotionRecordCard.tsx
│   │   └── StickerReaction.tsx
│   ├── types/
│   │   └── index.ts         # Book, EmotionRecord, StickerType 등 도메인 타입
│   └── hooks/               # (확장용)
└── __tests__/
    └── *.test.tsx           # 컴포넌트별 테스트
```

## 기술 스택 (프로덕션 안정 버전 — SDK 55, 2026-06 기준)

> Phase 1 검증(manager-strategy, Context7 교차 검증) 결과: SDK 51은 2025년 iOS Expo Go 중단으로 동작 불가.
> SDK 55로 상향 — SPEC "SDK 51+" 최소 요구를 준수하며 New Architecture 전용(그린필드라 호환성 이슈 없음).

- `expo`: ~55.0.0 (SDK 55)
- `react`: 19.2.0
- `react-native`: 0.83.2 (SDK 55 고정)
- `expo-router`: ~5.0.x
- `babel-preset-expo`: ~55.0.x (필수)
- `metro.config.js`: expo-router getDefaultConfig (필수)
- `jest-expo`: ~55.0.x (preset)
- `jest`: ^29.7.0
- `@testing-library/react-native`: ^13.3.x
- `typescript`: ~5.7.x (strict)
- `@expo/vector-icons`: ~55.0.x (Feather)
- `expo-linear-gradient`: ~55.0.x (ProgressBar gradient, §9.5)
- `expo-blur`: ~55.0.x (스포일러 blur, §9.3 — SDK 55 Android stable)
- `eslint`: ^9.x + eslint-config-expo (flat config)
- `prettier`: ^3.5.x

F1 비인터랙티브 검증: `npx expo export --platform ios` 성공으로 Metro 번들 검증 (Expo Go 대체).

## 리스크 분석

| # | 리스크 | 심각도 | 대응 |
|---|--------|--------|------|
| 1 | pages_11 토큰 값 누락/오타로 일관성 깨짐 | High | tokens.ts를 pages_11 §2-7과 1:1 매핑, 코드 리뷰 |
| 2 | 다크모드 전환이 일부 컴포넌트에서 누락 | Medium | useTheme() 강제, 모든 컴포넌트 테스트에 dark 케이스 |
| 3 | ~~Noto 폰트 번들 크기 증가~~ | ~~Medium~~ | **해결** — 사용자 결정(시스템 폰트 fallback)으로 폐기 |
| 4 | 스포일러 blur(12px) Android 차이 | Low | **완화** — expo-blur 도입(SDK 55 Android stable) |
| 5 | 컴포넌트 과잉 추상화 (YAGNI 위반) | Medium | 6개 한정, 과도한 variant/prop 금지 |
| 6 | ~~pages_11 토큰 미정의값 (disabled 텍스트 등)~~ | ~~Low~~ | **해소** — text-disabled=#C8B8A8이 §2.3에 정의됨 확인 |
| 7 | SDK 55 New Arch 전용 — 서드파티 호환성 | Medium | 그린필드 + 표준 Expo 패키지만 사용으로 완화 |
| 8 | darkTokens 누락값(§3 6개 외)이 디자이너 미검증 추정값 | Medium | 합리적 파생 규칙 적용 + 주석 "pages_11 미명시, 파생값" 문서화 |
| 9 | ProgressBar gradient 단일 용도 번들 영향 | Low | expo-linear-gradient 도입(사용자 결정), 단일 용도라 미미 |

## Definition of Done

- [ ] Expo 프로젝트 `npx expo start` 정상 실행
- [ ] TypeScript strict 에러 0
- [ ] tokens.ts가 pages_11 모든 값 포함 (color/typo/spacing/radius/shadow/motion/icon)
- [ ] ThemeProvider로 light/dark 전환 동작
- [ ] 6개 컴포넌트 모두 토큰 기반 + 다크모드 지원 (하드코딩 금지)
- [ ] @testing-library/react-native 테스트 통과
- [ ] 데모 스크린(_dev)에서 모든 컴포넌트/variant 시각 확인
- [ ] WCAG AA (44dp 터치타겟, 4.5:1 대비) 충족

## MX 태그 계획

- TypeScript 컴포넌트이므로 @MX 태그 대상
- `useTheme()`: fan_in >= 3 예상 → `@MX:ANCHOR` (모든 컴포넌트가 호출)
- `tokens` 객체: `@MX:ANCHOR` (단일 진실 원천)
- 컴포넌트별 위험 패턴 없음 (동기 렌더) → `@MX:WARN` 불필요
- 각 컴포넌트 exported → `@MX:NOTE` 권장
