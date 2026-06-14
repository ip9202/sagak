# Task Decomposition
SPEC: SPEC-UI-001
Generated: 2026-06-14 (Phase 1.5, post manager-strategy revise)

> SDK 55 기준. F1 검증 = `npx expo export --platform ios` (비인터랙티브, Expo Go 대체).
> 폰트: 시스템 fallback(iOS Apple SD Gothic Neo / Android Noto Sans KR 시스템). fontFamily 매핑만.
> gradient: expo-linear-gradient. blur: expo-blur(SDK 55).

## Task Table

| Task ID | Description | Requirement | Dependencies | Planned Files | Status |
|---------|-------------|-------------|--------------|---------------|--------|
| T-001 | Expo SDK 55 초기화 (managed workflow, New Arch, app.json scheme/plugins) | REQ-FE-001 | - | package.json, app.json, tsconfig.json, babel.config.js, metro.config.js | done |
| T-002 | 디렉토리 구조 + ESLint9(flat)+Prettier+Jest(jest-expo preset)+.gitignore+@/* alias | REQ-FE-002,003,004 | T-001 | .eslintrc.js, .prettierrc, jest.config.js, .gitignore, app/, src/{components,theme,hooks,types}/ | done |
| T-003 | tokens.ts light — color(brand6단계/bg4/text6/border3/semantic4/spoiler) | REQ-FE-010,014 | T-002 | src/theme/tokens.ts | done |
| T-004 | tokens.ts — typography10/spacing9/radius5/shadow3/motion(duration3+easing2)/icon + fontFamily 매핑(시스템 폰트) | REQ-FE-010,013,014 | T-003 | src/theme/tokens.ts | done |
| T-005 | darkTokens(§3 6개 명시값 + 파생 규칙 문서화) + ThemeProvider + useTheme() | REQ-FE-011,012 | T-004 | src/theme/darkTokens.ts, src/theme/theme.tsx | done |
| T-006 | Button(variant5: primary/secondary/ghost/destructive/disabled, size, loading, hitSlop) + 테스트(light+dark) | REQ-FE-020 | T-005 | src/components/Button.tsx, __tests__/Button.test.tsx | done |
| T-007 | Card 베이스(bg-surface/radius-lg/shadow-sm) + ProgressBar(expo-linear-gradient, brand-500→300, caption) + 테스트 | REQ-FE-021,022 | T-005 | src/components/Card.tsx, src/components/ProgressBar.tsx, __tests__/Card.test.tsx, __tests__/ProgressBar.test.tsx | done |
| T-008 | BookCard(표지80×110/2줄 말줄/저자/진도바) + EmotionRecordCard(expo-blur 12px/brand-300 강조선/아바타/본문/스티커) + 테스트 | REQ-FE-023,024 | T-007 | src/components/BookCard.tsx, src/components/EmotionRecordCard.tsx, __tests__/BookCard.test.tsx, __tests__/EmotionRecordCard.test.tsx | done |
| T-009 | StickerReaction(3종 empathy/touching/comforted, 토글, DB ENUM sticker_type 연동 타입) + 도메인 타입(Book/EmotionRecord/StickerType) + 테스트 | REQ-FE-025 | T-008 | src/components/StickerReaction.tsx, src/types/index.ts, __tests__/StickerReaction.test.tsx | done |
| T-010 | 데모 스크린(app/_dev, light/dark 수동 토글, 모든 variant) + _layout(ThemeProvider 래핑) + index(데모 링크) | REQ-FE-004, C1 | T-009 | app/_layout.tsx, app/index.tsx, app/_dev.tsx | done |

## Acceptance Criteria Mapping (Phase 1.6)

| AC ID | 시나리오 | 매핑 태스크 | 상태 |
|-------|---------|-----------|------|
| F1 | Expo 부팅 — `npx expo export --platform ios` 성공 | T-001, T-002 | pending |
| T1 | 다크모드 전환 — useTheme() dark 토큰셋 반환 | T-005 | pending |
| T2 | 토큰 정확성 — color.brand[500]==='#C17B2F', spacing[4]===16 | T-003, T-004 | pending |
| C1 | 데모 스크린 모든 variant 시각 일치(pages_11 스펙) | T-010 | pending |
| C2 | Button primary — brand-500/text-inverse/48dp/radius-md + loading | T-006 | pending |
| C3 | 스포일러 blur(12px) + "진도를 넘었어요" 오버레이 + brand-300 강조선 | T-008 | pending |
| C4 | 접근성 — accessibilityLabel/Hint + 44dp 타겟(Button 48dp, Ghost hitSlop) | T-006~T-009 | pending |
| C5 | BookCard 2줄 말줄임 | T-008 | pending |

## Hard Constraints (Phase 2 / manager-tdd 전달)

- SDK 55 고정, React 19.2, New Architecture. SDK 51 금지(동작 불가).
- 모든 6 컴포넌트 useTheme() 강제 소비. dark 모드 부분 적용 금지. 각 컴포넌트 테스트에 dark 케이스 필수.
- fontFamily 매핑 객체만 정의(시스템 폰트). expo-font useFonts 로딩 금지, 폰트 파일 번들 금지.
- tokens.ts = pages_11 §2-8, §11 전체. §14 예시를 §4.2 전체 스케일로 확장(typography 10단계 모두).
- darkTokens: §3의 6개 명시값(bg-base/bg-surface/bg-muted/text-primary/text-secondary/brand-500) 그대로 사용. 나머지 토큰은 파생(텍스트는 밝게 반전, 보더는 표면에 맞춤, shadow는 알파 유지) + 주석 "pages_11 미명시, 파생값".
- 6 컴포넌트 한정, YAGNI 엄수. 추가 variant/prop 금지.
- 제외 항목 엄수: Supabase 클라이언트, 인증, 네비게이션 라우팅 연결, Storybook, i18n, Reanimated, 실제 화면(홈/서재/모임/마이), 커스텀 SVG 에셋(스티커/귀접기 placeholder만).
