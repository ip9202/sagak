## SPEC-UI-002 Progress

- Started: 2026-06-14 (SPEC 작성 완료)
- Mode: design-system-constitution (FROZEN zone 등록, 14개 도메인 SPEC 선행 의존성)
- Scope: 화면 패턴 디자인 시스템 (REQ-SCREEN-LAYOUT/HEADER/CARD/STATE/TABBAR, 25 REQ)
- Branch: (SPEC 자체는 구현 브랜치 없음 — 14개 도메인 SPEC이 각자 run 시 준수)
- Status: draft → 구현 PR 누적 완료 (2026-06-25 기준 PR #63, #70)

---

## SPEC 정의 상태 (2026-06-14)

### Phase 0 — SPEC 작성
- **spec.md 작성 완료**: 25 REQ, 5개 모듈(LAYOUT/HEADER/CARD/STATE/TABBAR)
- **acceptance.md 작성 완료**: 25개 REQ별 검증 기준 정의
- **plan.md 작성 완료**: Phase 0(PENCIL) → Phase 1(REQ 구현) → Phase 2(도메인 SPEC 적용 검증) 계획
- **FROZEN Zone 등록 완료**: `.claude/rules/moai/design/constitution.md` v3.4.0에 화면 패턴(FROZEN) 추가
  - REQ-SCREEN-001~005 (3계층 레이아웃)
  - REQ-SCREEN-010~014 (헤더 균일성)
  - REQ-SCREEN-020~024 (카드 밀도)
  - REQ-SCREEN-030~034 (빈/로딩/에러 상태)
  - REQ-SCREEN-040~044 (탭바 규격)
- **글로벌 선언 완료**: INDEX.md Section 8에 "모든 14개 도메인 SPEC은 SPEC-UI-002를 선행 의존성으로 가짐" 선언

### 핵심 의존성
- **SPEC-UI-001** (컴포넌트·토큰): tokens.ts, ThemeProvider, Button/Card/BookCard 등 6개 컴포넌트
- **SPEC-NAV-001** (라우팅): 4개 탭 구조(REQ-NAV-TABS), 화면 셸(REQ-NAV-STACK)
- **Pencil `.pen` 파일**: sagak.pen (핵심 화면 4종 + 재사용 컴포넌트 7개 시각적 레퍼런스)

---

## PR 누적 (2026-06-25 기준)

> SPEC-UI-002는 독자적인 구현 브랜치를 가지지 않음. 14개 도메인 SPEC이 각자 run 시 SPEC-UI-002 REQ를 준수하며, 그 과정에서 발생한 회귀/패턴 수정이 PR로 누적됨.

### PR #63 (3eefe24) — completion/emotion 하위 라우트 href:null 회귀 수정

**문맥**: SPEC-EMOTION-001/COMPLETION-001 구현 이후, completion/emotion 하위 화면(감정 기록, 완독 다이어리)의 Tabs.Screen href 설정이 누락되어 캡슐형 4탭 규격이 깨지는 회귀.

**REQ-SCREEN-TABBAR 준수 이슈**:
- **REQ-SCREEN-043 (탭바 4개 진입점 고정)**: 하위 라우트에 불필요한 탭이 추가되거나, href 누락으로 탭 선택 상태 유지 실패.
- **REQ-SCREEN-042 (탭 선택 상태 시각적 피드백)**: href:null 미설정 시 탭 전환 시 선택 상태 초기화 버그.

**해결**:
- `app/(tabs)/completion.tsx`, `app/(tabs)/emotion.tsx`의 Tabs.Screen에서 `href: null` 명시적 설정.
- 캡슐형 4탭(홈/서재/모임/마이) 규격 유지.

**회귀 맥락**: SPEC-EMOTION-001/COMPLETION-001 구현 시 Tabs.Screen href 설정 누락 → SPEC-UI-002 패턴 위반 회귀.

**검증**: 실기기에서 completion/emotion 화면 진입 시 탭바 선택 상태 정상 유지 확인.

---

### PR #70 (502f997) — 상단 노치/상태바 영역 SafeArea 처리

**문맥**: 아이폰 14 Pro 등 Dynamic Island 디바이스에서 상단 노치/상태바 영역이 콘텐츠와 겹치는 회귀. SafeArea 미적용으로 인해 UI 잘림 발생.

**REQ-SCREEN-LAYOUT 준수 이슈**:
- **REQ-SCREEN-001 (3계층 레이아웃 구조 준수)**: StatusBar 영역(62px, OS 크롬)이 콘텐츠 Wrapper와 분리되지 않음.
- **REQ-SCREEN-004 (터치타겟 최소 크기 보장)**: SafeArea 미적용으로 상단 터치타겟이 노치에 가려짐.

**해결**:
- **SafeAreaProvider 추가**: `app/_layout.tsx` 최상위에 `<SafeAreaProvider>` 감싸기.
- **StatusBar 컴포넌트 신규**: `src/components/StatusBar.tsx` 작성.
  - `useSafeAreaInsets()`(react-native-safe-area-context)로 상단 inset 가져오기.
  - inset만큼 height를 가진 뷰 렌더링으로 OS 크롬 영역 확보.
- **3계층 구조 강화**: StatusBar(62px + SafeArea) → Content Wrapper(paddingHorizontal 16-20px) → TabBar.

**REQ-SCREEN-001 준수 검증**:
- StatusBar 영역이 명시적 컴포넌트로 분리됨.
- Content Wrapper가 좌우 패딩 1회 처리함.
- SafeArea로 인해 실제 높이는 OS inset에 따라 동적으로 조정됨.

**회귀 맥락**: 초기 구현에서 SafeArea 미고려 → 실기기테스트 시 노치/상태바 겹침 발견.

**검증**: 아이폰 14 Pro 시뮬레이터에서 상단 콘텐츠가 SafeArea 내부에 렌더링됨 확인.

---

## 누적 완료 상태 (2026-06-25)

### 구현된 REQ (PR 기반)
- **REQ-SCREEN-001**: 3계층 레이아웃 구조 — PR #70에서 StatusBar 컴포넌트로 명시적 분리 완료.
- **REQ-SCREEN-042/043**: 탭바 선택 상태 시각적 피드백 및 4개 진입점 고정 — PR #63에서 href:null 설정으로 완료.

### 미구현 REQ (각 도메인 SPEC run 시 준수 필요)
- **REQ-SCREEN-002**: 단일 컬럼 세로 스크롤 기본 — SPEC-NAV-001이 준수.
- **REQ-SCREEN-003**: 섹션 간격 규칙 — SPEC-LIBRARY-001 등이 준수.
- **REQ-SCREEN-005**: 하드코딩 스타일 값 금지 — 모든 도메인 SPEC가 tokens.ts 사용 시 준수.
- **REQ-SCREEN-010~014**: 헤더 균일성 — 각 도메인 SPEC 화면이 준수.
- **REQ-SCREEN-020~024**: 카드 밀도 — SPEC-UI-001 Card/BookCard가 내부적으로 준수.
- **REQ-SCREEN-030~034**: 빈/로딩/에러 상태 — 각 도메인 SPEC가 구현 시 준수.

---

## 다음 단계 (각 도메인 SPEC run 시)

1. **도메인 SPEC run 시 spec.md 로드**: manager-spec이 각 도메인 SPEC 문서에 SPEC-UI-002 선행 의존성 선언을 추가.
2. **Pencil `.pen` 레퍼런스 제공**: run 워크플로우가 sagak.pen 경로를 에이전트 프롬프트에 주입.
3. **tokens.ts 사용 강제**: evaluator-active가 하드코딩된 스타일 값(HEX 코드, 픽셀)을 must-pass 위반으로 검출.
4. **FROZEN Zone 위반 감지**: Learner가 SPEC-UI-002 REQ를 자의적으로 수정하려는 시도를 Constitution FROZEN Guard가 차단.

---

## SPEC 완료 상태 (2026-06-25)
- status: draft → 구현 PR 누적 중 (PR #63, #70 완료)
- 본 SPEC은 "14개 도메인 SPEC의 선행 의존성"이므로, 개별 도메인 SPEC run이 완료될 때마다 본 SPEC의 준수 여부가 검증됨.
- 최종 완료: 14개 도메인 SPEC 전체 run 완료 시점.

## Pencil ↔ 앱 디자인 차이 수정 (PR #76-#78, 2026-06-26)

**문맥**: Pencil(`.pen`) 디자인을 앱에 포팅했으나 실행 결과가 디자인과 다른 구조적 차이 6종 audit → 3개 PR로 수정. 계획: `.moai/plans/stateless-prancing-squirrel.md`.

### PR #76 (811bf59) — Inter 폰트 도입 + 서재 화면 재포팅 + 책 탭 + 상태/Alert UX
- **P0 Inter 폰트**: `@expo-google-fonts/inter`(static per-weight 4종) + `useFonts` 게이트 + typography 토큰에 weight-specific fontFamily 추가(spread 자동 전파). 한글은 OS 자동 폴백.
- **서재 `.pen F04-Library` 재포팅**: 헤더 Feather search+plus 아이콘, 필터 개별 capsule(cornerRadius 18), 빈 상태 book-open 아이콘 + .pen 텍스트, BookCard Row 레이아웃 + 진행률 캡션.
- **책 탭 → 상세 이동**: Card onPress 지원(Pressable 전환), library.tsx에서 `router.push(/${book_id})`.
- **상세 상태 변경**: invalidateLibrary에 `['library-item']` 무효화 추가(chip 즉시 전환) → "완독 처리" 버튼 제거 + 세 상태 탭 Alert 확인 질문(completed 시 완독 다이어리 이동).

### PR #77 (8408da6) — 토큰 정합성
- tokens 확장: `radius.xs: 4`, `typography.buttonLabel(16/600/22)`.
- 하드코딩 → 토큰: Button(buttonLabel), ReadersScreen/HostRequestsScreen(typography 매핑 + lineHeight 정합), EmotionRecordCard(radius.xs), my.tsx(text.inverse), login.tsx(OAuth 브랜드색 예외 명시).

### PR #80 (dde48a7) — trackB 토큰화
- **대상 화면**: ClubsScreen, ClubCreateScreen, ClubDetailScreen, JoinRequestSheet(trackA 잔여) — 약 47개 지점 tokenization.
- **신규 토큰**: `plusGlyph(26/400/28)`, `displayXs(18/700/24)`, `ctaStrong(15/700/21)`, `actionLabel(14/700/20)`.
- **패턴**: trackA(ReadersScreen/HostRequestsScreen) 1:1 레퍼런스 — spread + fontWeight const 오버라이드 + 신규 토큰(반복/FROZEN 강제값).
- **검증**: tsc 0, eslint 0, jest 1225/1225(회귀 없음). manager-quality 리뷰: Critical 0, TRUST 5 4.8/5, 경고 5개(모두 의도된 token-only-FROZEN 트레이드오프).
  - `minHeight.input` 96→100(JoinRequest textarea, 4px 시각적 변경).

### PR #78 (082a7a2) — 비탭 화면 SafeArea

### PR #78 (082a7a2) — 비탭 화면 SafeArea
- PR #70 (tabs) 그룹에 이어 비탭 화면으로 SafeArea 확장: (auth)/_layout(3화면), emotion/completion ScrollView 외곽, scan 카메라(투명 spacer + ExpoStatusBar light, paddingTop 이중 제거).
- jest.setup.js: expo-status-bar noop mock.

**검증**: 전체 1225/1225, tsc/lint clean, CI 3/3 green (각 PR). 실기기(Pixel 6) 한글 폰트 폴백 + 서재/상세/scan 확인 완료.

---

## 홈/모임/마이 `.pen` 재포팅 (PR #82-#84, 2026-06-27)

**문맥**: Explore ×3 병렬 audit로 홈/모임/마이 `.pen`↔앱 gap 분석. 홈 audit의 위젯 누락/spacing 불일치는 **오보로 정정** (실제 `.pen` F03-Home에 위젯 없음 + 앱 spacing 값 일치). 홈은 구조적으로 이미 충실(bell 아이콘만 PR-1로 해결됨). 홈/모임/마이 3화면 재포팅으로 Pencil `.pen` 사양 완전 정합.

### PR #82 (3ac1156) — 전역: Feather→lucide 아이콘 전환 + Button padding 24
- **P0 lucide 마이그레이션**: `.pen`이 `library: "lucide"` 지정하므로 Feather→lucide-react-native 전면 이관. `_layout.tsx`(tabBar 4종), `index.tsx`(Bell), `library.tsx`(Search/Plus/BookOpen), `BookDetailScreen.tsx`(FEEDBACK_ICON → kind→LucideIcon 매핑: CircleCheck/TriangleAlert/Info). `lucide-react-native ^1.21.0` 추가. `@expo/vector-icons` 보존(import 0건).
- **Button padding**: paddingHorizontal 16→`theme.spacing[6]`(24) per `.pen` PrimaryButton. ghost는 12 유지.
- **Jest lucide mock**: `jest.setup.js`에 글로벌 lucide mock(ESM/.mjs + react-native-svg Jest 파싱 이슈 해결).
- **Gate**: tsc 0 · eslint . 0 · jest 1225/1225.

### PR #83 (401c2b6) — 마이(F15-My) `.pen` 재포팅
- **Header**: title `마이`→`마이페이지`(displaySm 22/700) + Settings icon(lucide).
- **Profile `.pen` 구조**: Avatar 64×64(avatar_url 있으면 Image, 없으면 $brand-200 원) + Nick displayXs(18/700) + Bio(정적 placeholder "매일 조금씩, 종이책과 함께", bodySm).
- **MenuList**: "활동" sectionLabel + 4행(Hourglass/TrendingUp/Bell/Heart lucide) + ChevronRight icon(기존 "›" 텍스트 대체).
- **Stats label**: sectionLabel 토큰화.
- **한계(@MX:TODO)**: `profile.bio` 스키마 부재(Bio 정적 placeholder), 독서 통계/완독 다이어리 리스트 라우트 부재(no-op+TODO).
- **Gate**: tsc 0 · eslint . 0 · jest 1225/1225. 테스트: tabs-shells 헤더 타이틀 단언 업데이트.

### PR #84 (21096c9) — 모임(F11-Clubs) `.pen` 재포팅
- **Header**: 텍스트 "+" 글리프 제거 → lucide Search(22)+Plus(24). 검색→/search.
- **ClubCard Meta**: `formatClubMeta`(duration_days 14일+→N주/미만→N일/null→생략 + daily_pages) = "2주 코스 · 하루 20p".
- **멤버 수**: `useHostClubs` PostgREST embedded aggregate `club_members(count)` 단일 라운드트립(N+1 제거). `HostClubWithCount` 타입. "멤버 N명"(비과시 원칙 — 운영 컨텍스트 허용).
- **Empty**: lucide Users(48) — `.pen F11-Clubs-Empty`가 EmptyState 기본 book-open을 users로 오버라이드(`.pen` 직독 정정).
- **한계(@MX:TODO)**: 진도(p.X/Track/Fill)는 clubs `current_page` 컬럼 부재로 TODO(빈 track 미렌더, 사용자 결정).
- **Gate**: tsc 0 · eslint . 0 · jest 1229/1229(hooks/ClubsScreen 테스트 4개 확장).

**검증**: 전체 1229/1229, tsc/lint clean, CI green (각 PR). lucide 마이그레이션 회귀 없음.

**잔여**: `profile.bio` 스키마 추가, 독서 통계/완독 다이어리 라우트 구현, 모임 진도(current_page) 집계, `tokens.ts plusGlyph` unused 정리, `borderWidth.hairline` 토큰화 (P3 전역 정정).

---

## Book/Auth 화면 토큰화 (PR #90, 2026-06-27)

**문맥**: SPEC-UI-002 token-only FROZEN 확대 적용 — BookSearch/BookDetail/login 화면 토큰화. 폐기된 #49/#50(06-23 주석 매핑 방식, 미달+충돌)을 PR #80(trackB) 패턴 진짜 토큰화(spread 교체)로 대체. #47/#48(CLUB)도 PR #77/#80/#84로 대체되어 close.

### PR #90 (704553e) — Book/Auth 화면 토큰화
- **신규 토큰**: `radius.cover: 8` (EVOLVABLE). BookDetailScreen cover(160×220) + `.pen` ChartZone(cornerRadius 8) 준거. sm(6)·md(10) 사이값. 표지·시각 영역 전용. token-only FROZEN 강제. @MX:NOTE [AUTO].
- **토큰화** (27곳): BookSearchScreen(10), BookDetailScreen(15, lucide FEEDBACK_ICON PR #82 보존), auth/login.tsx(2). 매핑: title→displaySm, completeButtonText→actionLabel, sectionLabel/statusChip→sectionLabel, login button→headingSm 등. PR #80 패턴(spread + fontWeight as const 오버라이드).
- **예외 유지**: login.tsx OAuth 브랜드색(#FFD400 kakao / #03C75A naver)은 기존 @MX:NOTE 예외.
- **게이트**: tsc 0 · eslint . 0 · jest 1286/1286 (회귀 없음). 하드코딩 잔존 0건.
- **PR 정리**: #47/#48/#49/#50(06-23 token-only conformance PR) close — 이후 develop에 동일 작업 PR(#77/#80/#82/#84)이 머지되어 중복/충돌, #49/#50은 주석 방식 미달. #90이 진짜 토큰화로 대체.

**검증**: 전체 1286/1286, tsc/lint clean, CI green. Book/Auth token-only conformance 달성.
