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

# Acceptance Criteria — SPEC-UI-001

## 핵심 시나리오 (Given/When/Then)

### F1: Expo 부팅 (REQ-FE-001)
**Given** Expo 프로젝트가 초기화됨
**When** `npx expo start` 실행
**Then** Metro 번들러가 에러 없이 시작하고 Expo Go 연결 가능

### T1: 다크모드 전환 (REQ-FE-011, 012)
**Given** ThemeProvider가 앱을 감싸고 있음
**When** 디바이스 색상 모드를 light → dark로 전환
**Then** useTheme()이 dark 토큰셋(bg-base=`#1A1208`, text-primary=`#F0E4D0`)을 반환하고 모든 컴포넌트가 즉시 갱신

### T2: 토큰 정확성 (REQ-FE-014)
**Given** tokens.ts가 로드됨
**When** `tokens.color.brand[500]` 접근
**Then** 값이 `'#C17B2F'` (pages_11 §2.1과 정확 일치)
**And When** `tokens.spacing[4]` 접근
**Then** 값이 `16` (pages_11 §5)

### C1: 컴포넌트 데모 (REQ-FE-020~025)
**Given** `app/_dev` 데모 스크린 로드
**When** 스크린 렌더
**Then** Button 5 variant, ProgressBar, Card, BookCard, EmotionRecordCard(스포일러 on/off), StickerReaction 3종이 모두 pages_11 스펙과 시각 일치

### C2: Button variant (REQ-FE-020)
**Given** Button 컴포넌트
**When** `variant='primary'` `disabled={false}` 렌더
**Then** 배경 brand-500(`#C17B2F`), 텍스트 text-inverse(`#FDFAF5`), 높이 48dp, radius-md(10)
**And When** `loading={true}`
**Then** 텍스트 대신 ActivityIndicator(white) 표시, onPress 블록

### C3: 스포일러 블러 (REQ-FE-024)
**Given** EmotionRecordCard with `isSpoiler={true}`
**When** 렌더
**Then** 본문 영역이 `blur(12px)` + "이 기록은 내 진도를 넘었어요" 오버레이
**And** 좌측 brand-300(`#E6B96A`) 2dp 세로 강조선 유지

### C4: 접근성 (REQ-FE-020~025 공통)
**Given** 모든 컴포넌트
**When** 스크린 리더 활성화
**Then** `accessibilityLabel`/`accessibilityHint`가 의미 있게 설정됨
**And** 터치 요소가 44×44dp 이상 (Button 48dp 충족, Ghost 40dp → hitSlop 보강)

### C5: BookCard 말줄 (REQ-FE-023)
**Given** BookCard with 긴 제목
**When** 렌더
**Then** 제목이 2줄로 제한되고 말줄임(`...`) 처리

## 엣지 케이스

- **Button**: disabled + loading 동시 → disabled 우선 (loading 무시)
- **ProgressBar**: `current=0` → fill 0%, `current>=total` → 100% 캡, `total=0` → 0% + 라벨 숨김
- **BookCard**: 제목 빈 문자열 → 제목 영역 숨김, 표지 없음 → placeholder
- **EmotionRecordCard**: 본문 빈 문자열 → 본문 영역 숨김, 스티커 0개 → 반응줄 숨김
- **StickerReaction**: 이미 선택한 스티커 재선택 → 해제(토글), 미인증 상태 → 비활성
- **다크모드**: 일부 컴포넌트만 전환 → 테스트 실패 (모든 컴포넌트 useTheme 강제)

## 성능/품질 게이트

- TypeScript strict 에러 0
- ESLint 에러 0 (warn 허용)
- 컴포넌트 렌더 < 16ms (60fps 기준)
- 토큰 객체 트리쉐이킹 가능 (사용하지 않는 토큰 제외 가능한 구조)
- WCAG AA: text-primary(`#2D1F0E`) on bg-base(`#FDFAF5`) 대비비 ≥ 4.5:1 (실제 약 14:1)

## Definition of Done (§6)

1. Expo 프로젝트 구조 + 설정 완료 (REQ-FE-001~004)
2. tokens.ts (light + dark) + ThemeProvider + useTheme (REQ-FE-010~014)
3. 6개 컴포넌트: Button, Card, ProgressBar, BookCard, EmotionRecordCard, StickerReaction (REQ-FE-020~025)
4. 모든 컴포넌트 @testing-library/react-native 테스트 통과
5. 데모 스크린(`app/_dev`)에서 시각 검증 (light + dark)
6. WCAG AA 접근성 충족 (44dp, label/hint, 4.5:1)
7. TypeScript strict + ESLint 통과
8. `npx expo start` 정상 실행 (F1)
