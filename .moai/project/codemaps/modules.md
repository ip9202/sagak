# Sa-gak Module Catalog

상세 모듈 목록 — 경로, 계층, 목적, 주요 익스포트, SPEC 참조

## Presentation Layer (`app/`)

| 모듈 | 경로 | 계층 | 목적 | 주요 익스포트/특징 | SPEC 참조 |
|------|------|------|------|------------------|-----------|
| Root Layout | `app/_layout.tsx` | Presentation | 루트 레이아웃, 테마/인증/Query 제공자 설정 | ThemeProvider, QueryClientProvider, AuthProvider, Stack (headerShown: false) | AUTH-001, NAV-001, LIBRARY-001 |
| Entry Branching | `app/index.tsx` | Presentation | 진입점 분기 로직 (useSession 기반) | 인증/온보딩 상태에 따른 라우팅 | NAV-001 REQ-NAV-020 |
| Dev Demo | `app/_dev.tsx` | Presentation | 개발 전용 데모 화면 | `__DEV__` 게이트됨 | - |
| Auth Group Layout | `app/(auth)/_layout.tsx` | Presentation | 인증 그룹 레이아웃 + G5 가드 | 인증 가드, 스택 구성 | AUTH-001, NAV-001 |
| Login Screen | `app/(auth)/login.tsx` | Presentation | 로그인 화면 (래퍼) | `src/auth/login.tsx` 재내보냄 | AUTH-001 |
| Onboarding Screen | `app/(auth)/onboarding.tsx` | Presentation | 온보딩 화면 (래퍼) | `src/auth/onboarding.tsx` 재내보냄 | AUTH-001 |
| OAuth Callback | `app/(auth)/auth/callback.tsx` | Presentation | OAuth 딥링크 콜백 핸들러 | useLocalSearchParams, useSession 기반 리다이렉트 | NAV-001 REQ-NAV-031 |
| Tabs Layout | `app/(tabs)/_layout.tsx` | Presentation | 5탭 내비게이터 + 가드 + 숨김 라우트 | 인증/온보딩 가드, 탭 구성, search/scan/[bookId] 스크린 등록(href:null) | NAV-001 REQ-NAV-001/022/023 |
| Home Tab | `app/(tabs)/index.tsx` | Presentation | 홈 탭 (플레이스홀더) | 빈 컨테이너 | NAV-001 REQ-NAV-002 |
| Library Tab | `app/(tabs)/library.tsx` | Presentation | 도서관 탭 — 검색 진입 CTA | 검색 진입 `router.push('/search')` | NAV-001 REQ-NAV-002 · BOOK-001 |
| Clubs Tab | `app/(tabs)/clubs.tsx` | Presentation | 클럽 탭 (플레이스홀더) | 빈 컨테이너 | NAV-001 REQ-NAV-002 |
| My Page Tab | `app/(tabs)/my.tsx` | Presentation | 마이페이지 탭 — 사용자 정보 카드 + 로그아웃 | useSession() 기반 프로필 표시(닉네임/프로바이더/이메일) + signOut() 버튼, loading/signed-out 상태 분기, token-only 스타일링, SPEC-UI-002 준수 | AUTH-001 REQ-AUTH-014 · NAV-001 REQ-NAV-002 |
| Search Route | `app/(tabs)/search.tsx` | Presentation | 검색 라우트(href:null, 탭 비노출) | `BookSearchScreen` 위임 | BOOK-001 REQ-BOOK-005/016 |
| Scan Route | `app/(tabs)/scan.tsx` | Presentation | 바코드 스캔 라우트(href:null, 풀스크린) | `BarcodeScanner` 위임 | BOOK-001 REQ-BOOK-006~009 |
| Book Detail | `app/(tabs)/[bookId].tsx` | Presentation | 도서 상세 동적 라우트 — BookDetailScreen 통합 | 동적 세그먼트 `bookId`, SPEC-NAV-001 stub → BookDetailScreen 교체 | NAV-001 REQ-NAV-010 · BOOK-001 REQ-BOOK-015 · LIBRARY-001 REQ-LIB-003 |
| Club Detail | `app/(tabs)/clubs/[clubId].tsx` | Presentation | 클럽 상세 중첩 동적 라우트 | 동적 세그먼트 `clubId` | NAV-001 REQ-NAV-011 |

## Business Logic Layer (`src/`)

### Authentication (`src/auth/`)

| 모듈 | 경로 | 계층 | 목적 | 주요 익스포트 | SPEC 참조 |
|------|------|------|------|-------------|-----------|
| Auth Context | `src/auth/AuthContext.tsx` | Business | 인증 상태 관리, OAuth 토큰 교환 | AuthContext, AuthProvider, onAuthStateChange | AUTH-001 REQ-AUTH-010 |
| Session Hook | `src/auth/useSession.ts` | Business | 세션 훅 (사용자/프로필/상태) | useSession (반환: session, user, profile, loading, isAuthenticated, isOnboarded, signInWithProvider, signOut, refreshProfile) | AUTH-001 REQ-AUTH-030~033 |
| Auth Types | `src/auth/types.ts` | Business | 인증 타입 정의 | AuthProvider ('kakao'\|'naver'\|'google'), UserProfile, AuthContextValue | AUTH-001 |
| OAuth Utils | `src/auth/oauth.ts` | Business | OAuth 리다이렉트 URI 생성 | getOAuthRedirectUri | AUTH-001 REQ-AUTH-002 |
| Login Screen | `src/auth/login.tsx` | Business | 로그인 화면 구현 | OAuth 버튼, 폼 | AUTH-001 |
| Onboarding Screen | `src/auth/onboarding.tsx` | Business | 온보딩 화면 구현 | 닉네임 입력, 프로필 설정 | AUTH-001 |

### Theming (`src/theme/`)

| 모듈 | 경로 | 계층 | 목적 | 주요 익스포트 | SPEC 참조 |
|------|------|------|------|-------------|-----------|
| Theme Provider | `src/theme/theme.tsx` | Business | 테마 제공자, 훅 | ThemeProvider, useTheme, useManualMode (light/dark) | UI-001 |
| Design Tokens | `src/theme/tokens.ts` | Business | 디자인 토큰 (색상/간격/타이포그래피) | colors, spacing, typography | UI-001 |
| Dark Tokens | `src/theme/darkTokens.ts` | Business | 다크 모드 토큰 | 다크 모드 색상 오버라이드 | UI-001 |

### API Layer (`src/lib/api/`)

| 모듈 | 경로 | 계층 | 목적 | 주요 익스포트 | SPEC 참조 |
|------|------|------|------|-------------|-----------|
| API Barrel | `src/lib/api/index.ts` | Business | API 계층 barrel | 모든 API 모듈 재내보냄 | API-001 |
| Error Handling | `src/lib/api/errors.ts` | Business | 에러 정규화, 분류 | normalizeError, classifyError, ERROR_CATEGORIES | API-001 REQ-API-011~015 |
| Retry Logic | `src/lib/api/retry.ts` | Business | 재시도 전략 (백오프) | retryWithBackoff | API-001 REQ-API-003 |
| Edge Functions | `src/lib/api/edgeFunctions.ts` | Business | Edge Function 호출 래퍼 | invokeEdgeFunction | API-001 REQ-API-004 |

### Types (`src/types/`)

| 모듈 | 경로 | 계층 | 목적 | 주요 익스포트 | SPEC 참조 |
|------|------|------|------|-------------|-----------|
| Domain Types | `src/types/index.ts` | Business | 도메인 타입 정의 | Book, EmotionRecord, StickerType | DB-001 |
| Book Types | `src/types/book.ts` | Business | Book 도메인 타입 | SearchResult, BookRow, SearchTarget, 타입 가드(isSearchResult, isBookRow, isSearchTarget) | BOOK-001 REQ-BOOK-003/012/015 |
| Supabase Types | `src/types/supabase.ts` | Business | Supabase DB 타입 (816행, 자동생성) | Database 타입 (gen-types-with-header.js 경유), Tables, RLS Policies | API-001 REQ-API-007 |

### Book Domain (`src/features/book/`)

| 모듈 | 경로 | 계층 | 목적 | 주요 익스포트 | SPEC 참조 |
|------|------|------|------|-------------|-----------|
| Book Barrel | `src/features/book/index.ts` | Business | Book 도메인 barrel | searchBooks, getBookDetail, BookRow/SearchResult/SearchTarget | BOOK-001 |
| Search API | `src/features/book/searchApi.ts` | Business | 도서 검색 클라이언트 API | searchBooks(query, target) → SearchResult[], 빈 쿼리 차단(REQ-BOOK-005), Edge Function 호출(kakao-book-search) | BOOK-001 REQ-BOOK-001/005 |
| Detail API | `src/features/book/bookDetailApi.ts` | Business | 도서 상세 조회 API | getBookDetail(bookId) → BookRow, PostgREST 직접 조회, PGRST116→NOT_FOUND 분류 | BOOK-001 REQ-BOOK-013/015 |
| **Barcode Scanner** | `src/features/book/BarcodeScanner.tsx` | Presentation | 바코드 스캔 화면(M3) | CameraView + useCameraPermissions 권한 게이트 3상태(null/granted/denied) + onBarcodeScanned | BOOK-001 REQ-BOOK-006~009 |
| **ISBN Validator** | `src/features/book/isbn.ts` | Business (순수함수) | ISBN 체크디짓 검증(M3) | isValidIsbn, isValidIsbn13, isValidIsbn10 | BOOK-001 REQ-BOOK-007 |
| **Debounce Util** | `src/features/book/debounce.ts` | Business (순수함수) | 중복 스캔 디바운스(M3) | shouldSuppressDuplicate, DUPLICATE_DEBOUNCE_MS=2000 | BOOK-001 REQ-BOOK-009 |
| **Format Util** | `src/features/book/format.ts` | Business (순수함수) | 출판월 포맷 공유 유틸(M4) | formatPublishedMonth (YYYY.MM) | BOOK-001 REQ-BOOK-014/015 |
| **Book Search Screen** | `src/features/book/BookSearchScreen.tsx` | Presentation | 도서 검색 메인 화면(M4) | searchBooks 연동, 빈 쿼리 차단, 빈 결과 안내 | BOOK-001 REQ-BOOK-005/016 |
| **Book Detail Screen** | `src/features/book/BookDetailScreen.tsx` | Presentation | 도서 상세 화면(M4) | getBookDetail + useSession 가드(S22 RLS 거부 처리), resolveBookId 경유 서재 통합 | BOOK-001 REQ-BOOK-015 · LIBRARY-001 |
| **Camera Mock (Test)** | `src/features/book/__tests__/__mocks__/expo-camera.tsx` | Infrastructure (Test) | Jest용 expo-camera 목 | simulateBarcodeScan 헬퍼 | BOOK-001 REQ-BOOK-006 |
| **ISBN Resolver** | `src/features/book/resolveBookId.ts` | Business (순수함수) | ISBN→UUID 변환 — books.isbn UNIQUE lookup, @MX:ANCHOR | resolveBookId(isbn) → UUID, NOT_FOUND AppError (미등록 ISBN) | LIBRARY-001 TASK-002 |

### Library Domain (`src/features/library/`)

| 모듈 | 경로 | 계층 | 목적 | 주요 익스포트 | SPEC 참조 |
|------|------|------|------|-------------|-----------|
| Library Barrel | `src/features/library/index.ts` | Business | Library 도메인 barrel | useLibrary, useLibraryItem, libraryApi, progressRate, LibraryItem | LIBRARY-001 |
| Library API | `src/features/library/libraryApi.ts` | Business | 서재 CRUD API 레이어, @MX:ANCHOR | getLibrary(목록), addBook(등록), getLibraryItem(단일항목), deleteBook(삭제), updateProgress(진도), updateStatus(상태), updateVisibility(공개여부) | LIBRARY-001 REQ-LIB-CRUD/TASK-003 |
| Library Hook | `src/features/library/useLibrary.ts` | Business | 서재 목록 훅 (React Query) | useLibrary(filters) → LibraryItem[], staleTime: 0, refetchOnMount: true, useQuery + invalidateQueries | LIBRARY-001 REQ-LIB-003 |
| Library Item Hook | `src/features/library/useLibraryItem.ts` | Business | 단일 항목 훅 (useMutation) | useLibraryItem optimistic update (진도/상태/공개), rollback on error, getUserFriendlyMessage, invalidateQueries | LIBRARY-001 REQ-LIB-010/020/030 |
| Library Types | `src/features/library/types.ts` | Business | Library 도메인 타입 | LibraryItem, AddBookInput, DeleteBookInput, ProgressUpdate, StatusUpdate, VisibilityUpdate, LibraryFilter | LIBRARY-001 |
| Progress Validation | `src/features/library/progressValidation.ts` | Business (순수함수) | 진도 검증 — 페이지 상한, 음수 차단 | validatePage(current_page, total_pages) → ValidationError | LIBRARY-001 REQ-LIB-011 |
| Progress Rate | `src/features/library/progressRate.ts` | Business (순수함수) | 진도률 계산 | calcProgressRate(current_page, total_pages) → number (0~100, 정수) | LIBRARY-001 REQ-LIB-012 |

### Completion Domain (`src/features/completion/`)

| 모듈 | 경로 | 계층 | 목적 | 주요 익스포트 | SPEC 참조 |
|------|------|------|------|-------------|-----------|
| Completion Barrel | `src/features/completion/index.ts` | Business | Completion 도메인 barrel | completionApi, useCompletionReport, types | COMPLETION-001 |
| Completion Types | `src/features/completion/types.ts` | Business | Completion 도메인 타입 (DB Row derived) | ReportData, EmotionCurvePoint, Highlight, isReportData (순수 타입 가드) | COMPLETION-001 REQ-COMP-003 |
| Completion API | `src/features/completion/completionApi.ts` | Business | 완독 리포트 조회 API (PostgREST GET 래퍼 + 재시도 최대3 + 점진백오프 + normalizeError, RLS auth.uid() 신뢰) | fetchReport(userBookId) → ReportData, NETWORK/빈응답 재시도, VALIDATION/AUTH 즉시 throw, retriesExhausted 표식 | COMPLETION-001 REQ-COMP-003/004 |
| Completion Hook | `src/features/completion/useCompletionReport.ts` | Business | 완독 리포트 훅 (useState/useEffect 기반 6상태: loading/success/empty/error/data-error/auth) | useCompletionReport(userBookId) → {state, report, error}, 6상태 분기 렌더링 | COMPLETION-001 REQ-COMP-005 |
| Emotion Curve Chart | `src/features/completion/EmotionCurveChart.tsx` | Presentation | 감정 곡선 차트 (순수 SVG, 단일 brand-500 색상, 페이지별 수량) | EmotionCurveChart({emotionCurve}) — 순수 SVG, width/height props, style={{flex:1}} | COMPLETION-001 REQ-COMP-006 |
| Highlight List | `src/features/completion/HighlightList.tsx` | Presentation | 하이라이트 리스트 (FlatList, {page_number, content} 렌더링) | HighlightList({highlights}) — FlatList, text.inverse 스타일 | COMPLETION-001 REQ-COMP-007 |
| Celebration Header | `src/features/completion/CelebrationHeader.tsx` | Presentation | 축하 헤더 (정적 배지 + 축하 메시지 MVP) | CelebrationHeader({totalRecords}) — 정적 MVP, 축하 메시지 | COMPLETION-001 REQ-COMP-008 |
| Completion Diary Screen | `src/features/completion/CompletionDiaryScreen.tsx` | Presentation | 완독 다이어리 메인 화면 (6상태 분기 렌더링: loading/success/empty/error/data-error/auth) | CompletionDiaryScreen({userBookId}) — useCompletionReport + 6상태 분기 | COMPLETION-001 REQ-COMP-005 |

### Routine Domain (`src/features/routine/`)

| 모듈 | 경로 | 계층 | 목적 | 주요 익스포트 | SPEC 참조 |
|------|------|------|------|-------------|-----------|
| Routine Barrel | `src/features/routine/index.ts` | Business | Routine 도메인 barrel (공개 API) | sessionApi, alarmApi, statsApi, useReadingTimer, useActiveSession, useAlarmSettings, useReadingStats, types | ROUTINE-001 |
| Routine Types | `src/features/routine/types.ts` | Business | Routine 도메인 타입 (DB Row derived) | ReadingSessionRow, ReadingStats(total_duration/sessions/today/streak), AlarmSettings, DailyGoalSeconds | ROUTINE-001 REQ-ROUT-001~010 |
| Session API | `src/features/routine/sessionApi.ts` | Business | 독서 타이머 RPC 호출 (start/end + getActiveSession) | startSession(userBookId) → uuid, endSession(sessionId, pagesRead?) → void, getActiveSession(userBookId) → ReadingSessionRow | ROUTINE-001 REQ-ROUT-001~004 |
| Alarm API | `src/features/routine/alarmApi.ts` | Business | 다정한 알람 설정 API (get/update/toggle, HH:MM→HH:MM:SS 정규화) | getAlarmSettings(userId), updateAlarmTime(userId, HH:MM), toggleAlarmEnabled(userId, boolean), normalizeAlarmTime (VALIDATION 에러 throw) | ROUTINE-001 REQ-ROUT-005~007 |
| Stats API | `src/features/routine/statsApi.ts` | Business | 독서 습관 추적 API (클라이언트 집계: total_duration/sessions/today/streak) | getReadingStats(userId) → ReadingStats (클라이언트 집계, RPC 회피) | ROUTINE-001 REQ-ROUT-008~010 |
| Streak Calculator | `src/features/routine/streakCalculator.ts` | Business (순수함수) | 자정 기준 streak 계산 (미결정 6.1 임시방침) | calculateStreak(sessions: ReadingSessionRow[]) → number (연속 일수) | ROUTINE-001 REQ-ROUT-008 |
| Goal Storage | `src/features/routine/goalStorage.ts` | Business | AsyncStorage 일일 목표 (기본 900초=15분, 미결정 6.2) | getDailyGoal(), setDailyGoal(seconds), DEFAULT_GOAL_SECONDS=900 | ROUTINE-001 REQ-ROUT-010 |
| Reading Timer Hook | `src/features/routine/useReadingTimer.ts` | Business | 독서 타이머 훅 (started_at 기반 setInterval 1초 + AppState 복귀 재동기화 + cleanup + formatElapsed HH:MM:SS) | useReadingTimer(userBookId) → {elapsed, start, pause, end}, cleanup on unmount, AppState change resume | ROUTINE-001 REQ-ROUT-001/006/007 |
| Active Session Hook | `src/features/routine/useActiveSession.ts` | Business | 활성 세션 React Query 훅 | queryKey ['activeSession', userBookId], getActiveSession 호출, staleTime 0 | ROUTINE-001 REQ-ROUT-001~003 |
| Alarm Settings Hook | `src/features/routine/useAlarmSettings.ts` | Business | 알람 설정 React Query 훅 | queryKey ['alarmSettings', userId], getAlarmSettings 호출, mutations (updateTime/toggleEnabled), cache invalidation | ROUTINE-001 REQ-ROUT-005~007 |
| Reading Stats Hook | `src/features/routine/useReadingStats.ts` | Business | 독서 통계 React Query 훅 | queryKey ['readingStats', userId], getReadingStats 호출, staleTime 5min | ROUTINE-001 REQ-ROUT-008~010 |
| Copy Constants | `src/features/routine/copy.ts` | Business | 다정한 메시지 상수 (START_PROMPT/END_ENCOURAGEMENT/STREAK_ACHIEVEMENT/GOAL_ACHIEVED) + pickEndEncouragement(duration별) | pickEndEncouragement(durationSeconds) → string (다정한 격려 메시지) | ROUTINE-001 REQ-ROUT-009/010/021/023 |
| Timer Screen Component | `src/features/routine/components/TimerScreen.tsx` | Presentation | 독서 타이머 화면 (token-only 스타일링) | useReadingTimer + useActiveSession 통합, 타이머 표시 + 일시정지/종료 버튼, copy 메시지 노출 | ROUTINE-001 REQ-ROUT-001/006/007/009 |
| Alarm Screen Component | `src/features/routine/components/AlarmScreen.tsx` | Presentation | 알람 설정 화면 (token-only 스타일링) | useAlarmSettings 통합, HH:MM 입력 + 토글 스위치, VALIDATION 에러 표시 | ROUTINE-001 REQ-ROUT-005~007 |
| Routine Stats Widget | `src/features/routine/components/RoutineStatsWidget.tsx` | Presentation | 루틴 통계 위젯 (token-only 스타일링) | useReadingStats 통합, 연속 일수·누적 시간·세션 수 표시, 목표 달성 메시지 | ROUTINE-001 REQ-ROUT-008~010 |

### Emotion Domain (`src/features/emotion/`)

| 모듈 | 경로 | 계층 | 목적 | 주요 익스포트 | SPEC 참조 |
|------|------|------|------|-------------|-----------|
| Emotion Barrel | `src/features/emotion/index.ts` | Business | Emotion 도메인 barrel | emotionApi, stickerApi, useEmotionRecords, useStickerReaction, types | EMOTION-001 |
| Emotion Types | `src/features/emotion/types.ts` | Business | Emotion 도메인 타입 (DB Row derived) | EmotionRecordWithAuthor, StickerAggregate, Visibility (ENUM), CreateInput, UpdateInput, SortOption | EMOTION-001 REQ-EMO-001~004 |
| Emotion API | `src/features/emotion/emotionApi.ts` | Business | 감정 기록 CRUD API (PostgREST 직접) | create(사전 검증), list(users 조인 + sticker GROUP BY + client-side spoiler split), update, delete | EMOTION-001 REQ-EMO-001~004 |
| Sticker API | `src/features/emotion/stickerApi.ts` | Business | 스티커 반응 API (409 UNIQUE→VALIDATION mapping, no upsert) | precheck, create(409→VALIDATION mapping via normalizeError, no upsert), delete, aggregate | EMOTION-001 REQ-EMO-006~007 |
| Emotion Hook | `src/features/emotion/useEmotionRecords.ts` | Business | 감정 기록 React Query 훅 | queryKey ['emotion',{bookId,userId}] root, list key with sort, CRUD mutations, cache invalidation | EMOTION-001 REQ-EMO-001~004 |
| Sticker Hook | `src/features/emotion/useStickerReaction.ts` | Business | 스티커 반응 훅 (optimistic update + 409 rollback) | optimistic update, 409 rollback, useReplaceSticker(DELETE→POST) | EMOTION-001 REQ-EMO-006~007 |
| Question Prompts | `src/features/emotion/questionPrompts.ts` | Business (순수함수) | 단어 질문지 정적 풀 (round-robin by currentPage seed) | getQuestionPrompt(currentPage) → string, static pool (5개), deterministic round-robin | EMOTION-001 REQ-EMO-005 |
| Emotion Input Screen | `src/features/emotion/EmotionInputScreen.tsx` | Presentation | 감정 기록 입력 화면 | input screen (page/content/question/visibility toggle, pageNumber validation) | EMOTION-001 REQ-EMO-001/005/010 |
| Timeline Screen | `src/features/emotion/TimelineScreen.tsx` | Presentation | 타임라인 화면 (EmotionRecordCard list) | EmotionRecordCard list, sort toggle (time/page), spoiler blur via isSpoiler prop | EMOTION-001 REQ-EMO-002/008/009 |

### Notification Domain (`src/features/notification/`)
SPEC-NOTIF-001 — 알림 센터(조회/읽음/라우팅) + 6종 type별 딥링크. Optional(Expo Push 실기기)은 후속.

| 모듈 | 경로 | 계층 | 목적 | 주요 익스포트 | SPEC 참조 |
|------|------|------|------|---------------|-----------|
| Notification Barrel | `src/features/notification/index.ts` | Business | Notification 도메인 barrel | useNotifications, useUnreadCount, useMarkAsRead, useMarkAllAsRead, routeForNotification | NOTIF-001 |
| Queries | `src/features/notification/queries.ts` | Business | PostgREST 조회/카운트/읽음 변이 (RLS 의존) | getNotifications, getUnreadCount, markNotificationRead, markAllNotificationsRead | NOTIF-001 REQ-NOTIF-005~008 |
| Route Mapper | `src/features/notification/routeMapper.ts` | Business (순수함수) | 6종 type별 딥링크 + 미구현 폴백 | routeForNotification(type, refId) → path\|null | NOTIF-001 REQ-NOTIF-009 |
| Hooks | `src/features/notification/use{Notifications,UnreadCount,MarkAsRead,MarkAllAsRead}.ts` | Business | React Query 훅 (invalidate 접두사 `notification`) | useNotifications, useUnreadCount(N 배지), useMarkAsRead/useMarkAllAsRead(mutation) | NOTIF-001 REQ-NOTIF-005~008 |
| Notifications Screen | `src/features/notification/components/NotificationsScreen.tsx` | Presentation | 알림 센터 화면 | 목록 + 미읽음 배지 + 모두 읽음 + 탭(읽음/라우팅) + 로딩/에러/빈 (SPEC-UI-002) | NOTIF-001 REQ-NOTIF-005~009 |
| Notifications Route | `app/(tabs)/my/notifications.tsx` | Presentation | 알림 센터 라우트 셸 | NotificationsScreen 래핑 | NOTIF-001 |
| send-notification Edge Function | `supabase/functions/send-notification/` | Infrastructure (Deno) | 서버 알림 발송 (service_role) — `index.ts`(엔드포인트) + `logic.ts`(ENUM 검증/파서) + `templates.ts`(6종 다정한 톤) + `expo-push.ts`(Expo Push API) | notifications INSERT(RLS 우회) + push_token 조회 + 푸시 발송 | NOTIF-001 REQ-NOTIF-010~013 |

### Query Infrastructure (`src/lib/query/`)

| 모듈 | 경로 | 계층 | 목적 | 주요 익스포트 | SPEC 참조 |
|------|------|------|------|-------------|-----------|
| Query Client | `src/lib/query/queryClient.ts` | Infrastructure | React Query v5 싱글톤, @MX:ANCHOR | getQueryClient() (globalThis 캐시), resetQueryClient() (테스트), defaultOptions: staleTime 0, retry 1, mutations retry 0 | LIBRARY-001 TASK-001 |

### Supabase Client (`src/lib/supabase/`)

| 모듈 | 경로 | 계층 | 목적 | 주요 익스포트 | SPEC 참조 |
|------|------|------|------|-------------|-----------|
| Supabase Client | `src/lib/supabase/client.ts` | Infrastructure | Supabase 클라이언트 싱글톤, @MX:ANCHOR | getSupabaseClient() (createClient<Database>), 타입화된 PostgREST | API-001 REQ-API-007 |
| Storage Adapter | `src/lib/supabase/storageAdapter.ts` | Infrastructure | Supabase Storage 래퍼 (미사용) | uploadCover, getPublicUrl | DB-001 REQ-DB-005 |

### Config / Environment (`src/config/`)

| 모듈 | 경로 | 계층 | 목적 | 주요 익스포트 | SPEC 참조 |
|------|------|------|------|-------------|-----------|
| Env Validation | `src/config/env.ts` | Infrastructure | 환경 변수 검증 및 타입 안전 접근 | getEnvVar, getOptionalEnvVar (런타임 검증 — API-001), validateEnv (빌드 시점 fail-fast), MissingEnvError (전용 에러), REQUIRED_PROD (프로덕션 필수 키 집합) | API-001 REQ-API-001/002 · DEPLOY-001 REQ-DEPLOY-018/024 |

### Build / Deploy Infrastructure (SPEC-DEPLOY-001 M1+M5)

| 모듈 | 경로 | 계층 | 목적 | SPEC 참조 |
|------|------|------|------|-----------|
| App Config | `app.config.ts` | Infrastructure (빌드) | Expo 앱 설정 — 빌드 시점 `validateEnv(process.env, ENV)` 호출(환경 변수 fail-fast 게이트, REQ-DEPLOY-018) + `EXPO_PUBLIC_SENTRY_DSN`을 `extra`에 노출 | DEPLOY-001 REQ-DEPLOY-018/024 |
| EAS Build Profiles | `eas.json` | Infrastructure (빌드) | EAS Build 설정 — 3개 프로필: development / preview / production | DEPLOY-001 REQ-DEPLOY-001~005 |
| Deployment Manual | `docs/deployment.md` | Documentation | OAuth 콘솔 등록 절차(Kakao/Naver/Google) + Supabase Auth 제공자 활성화 + `.env` 가이드. OAuth 콜백 URI `sagak://auth/callback`은 `src/auth/oauth.ts`에 이미 존재(본 문서는 절차만 문서화, 재구현 아님) | DEPLOY-001 REQ-DEPLOY-019/020 |
| Env Templates | `.env.example` / `.env.staging` / `.env.production` | Infrastructure (빌드) | 환경 변수 템플릿 — `SENTRY_DSN` 플레이스홀더 포함(M3 Sentry SDK 대비) | DEPLOY-001 REQ-DEPLOY-018/024 |

> **참고**: SPEC-DEPLOY-001은 부분 진행(M1+M5 머지, PR #15 2514263). GitHub Actions CI(M2), Sentry SDK 통합(M3), EAS Submit(M4), Edge Function 배포(M6)는 미완료. M6은 SPEC-CLUB-001 / SPEC-NOTIF-001 의존으로 블로킹.

### Components (`src/components/`)

| 모듈 | 경로 | 계층 | 목적 | SPEC 참조 |
|------|------|------|------|-----------|
| Card | `src/components/Card.tsx` | Presentation | 공통 카드 컨테이너 | UI-001 |
| Book Card | `src/components/BookCard.tsx` | Presentation | 도서 카드 (검색 결과용) | BOOK-001 |
| Search Result Card | `src/components/SearchResultCard.tsx` | Presentation | 검색 결과 카드 | BOOK-001 |
| Progress Bar | `src/components/ProgressBar.tsx` | Presentation | 진행률 바 (서재 진도) | LIBRARY-001 |
| Sticker Reaction | `src/components/StickerReaction.tsx` | Presentation | 스티커 리액션 (3종 스티커: empathy/touching/comforted) | EMOTION-001 |
| Emotion Record Card | `src/components/EmotionRecordCard.tsx` | Presentation | 감상문 카드 (스포일러 블러 12px, 아바타+닉네임+페이지+본문+스티커) | EMOTION-001 |
| Button | `src/components/Button.tsx` | Presentation | 공통 버튼 | UI-001 |

## External Dependencies

| 모듈 | 경로 | 계층 | 목적 | SPEC 참조 |
|------|------|------|------|-----------|
| expo-router | `app/` | Framework | 파일 시스템 기반 라우팅 (Tabs/Stack/동적 라우트) | NAV-001 |
| expo-camera | `src/features/book/BarcodeScanner.tsx` | SDK | 카메라 권한 관리 + 바코드 스캔 | BOOK-001 REQ-BOOK-006 |
| @tanstack/react-query v5 | `app/_layout.tsx` | Library | React Query (캐싱/비동기 상태) | LIBRARY-001 TASK-001 |
| @supabase/supabase-js | `src/lib/supabase/client.ts` | Library | Supabase 클라이언트 (타입화됨) | API-001 REQ-API-007 |
| AsyncStorage/SecureStore | `src/auth/AuthContext.tsx` | SDK | 세션 토큰 지속성 | AUTH-001 REQ-AUTH-013 |
| expo-constants | `app.config.ts` → `src/config/env.ts` | SDK | 빌드 시점 환경 변수 주입 (`extra` → Constants.expoConfig.extra), validateEnv 게이트 | API-001 · DEPLOY-001 REQ-DEPLOY-018 |

## Infrastructure Scripts

| 모듈 | 경로 | 목적 | SPEC 참조 |
|------|------|------|-----------|
| gen-types-with-header | `scripts/gen-types-with-header.js` | Supabase 타입 자동생성 (816행 supabase.ts) | API-001 REQ-API-007 |
