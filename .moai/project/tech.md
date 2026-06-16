# 기술 스택 — 사각 (Sa-gak)

## 개요

사각은 TypeScript로 개발된 모바일 앱으로, React Native와 Expo SDK 55를 사용하며 백엔드로는 Supabase를 통합한 완전한 서버리스 아키텍처를 채택한다. 실시간 동기화, 자동 백업, 확장성을 제공하는 Supabase의 PostgreSQL 데이터베이스와 PostgREST API, Edge Functions, Realtime 기능을 활용하며, 행수 기반 보안(RLS)을 통해 데이터 보안을 확보한다. 모든 기능이 모바일 앱에 최적화되어 있으며, 개발부터 배포까지 Expo 생태계를 통일된 환경으로 관리한다.

## 프론트엔드

React Native + Expo SDK 55를 주요 프레임워크로 사용하며 React 19.2와 함께 개발되며 TypeScript strict 모드로 타입 안정성을 확보한다. 네이티브 모듈 의존성을 최소화하고 크로스 플랫폼 호환성을 극대화하기 위해 Expo의 빌드 시스템을 활용하며, 네비게이션은 Expo Router(~5)를 사용하여 파일 시스템 기반 라우팅을 구현한다. UI 컴포넌트는 React Native 기본 컴포넌트와 6가지 커스텀 컴포넌트(Button/Card/ProgressBar/BookCard/EmotionRecordCard/StickerReaction)로 구성되어 로딩 성능과 초기화 속도를 최적화하며, 클라이언트 상태 관리는 React Context API와 ThemeProvider, useTheme, useManualMode(dark 토글) 패턴을 조합한다. 서버 상태(데이터 페칭·캐싱·동기화)는 TanStack React Query(@tanstack/react-query)로 관리하며 DevTools를 통해 쿼리 디버깅을 지원하고, 감정 곡선 등 커스텀 데이터 시각화는 react-native-svg 기반으로 자체 구현하여 번들 크기를 최적화한다. 성능 모니터링과 에러 추적을 위해 Sentry를 통합하여 배포 후 운영 품질을 관리한다.

### 네비게이션 구조 (SPEC-NAV-001)

Expo Router의 그룹 라우팅 기능을 활용하여 `(tabs)`와 `(auth)` 그룹을 정의하며, 4개 탭(홈/서재/모임/마이) 네비게이션과 인증 가드를 구현한다. 인증 상태는 SPEC-AUTH-001의 `useSession()` 훅을 통해 소비되며 `null`(loading) 또는 `{ isAuthenticated, isOnboarded, ... }` 객체를 기반으로 `(tabs)`/`(auth)` 간 양방향 리다이렉트가 수행된다. 딥링크는 `sagak://` 스킴을 통해 카카오/애플/구글 OAuth 콜백을 처리한다.

### 의존성 라이브러리 (SPEC-API-001 + SPEC-AUTH-001 추가)

**백엔드 통합 (Supabase)**:
- `@supabase/supabase-js` ^2.45.0 — Supabase 클라이언트 라이브러리 (PostgreSQL, PostgREST, Realtime, Storage, Auth 통합)
- `expo-secure-store` ~13.0.0 — iOS Keychain/Android Keystore 세션 영속화 (JWT, refreshToken)
- `expo-constants` ~17.0.0 — 빌드 시점 환경 변수 주입 (`app.config.ts` extra → Constants.expoConfig.extra)
- `@react-native-async-storage/async-storage` 2.2.0 — SecureStore 2KB 초과 시 폴백 세션 저장소

**OAuth 인증 (SPEC-AUTH-001)**:
- `expo-linking` ~7.0.0 — OAuth 딥링크 콜백 URL 생성 (`makeRedirectUri`) 및 처리

**바코드 스캔 (SPEC-BOOK-001 M3)**:
- `expo-camera` ~55.0.19 — 카메라 권한 요청 및 ISBN(EAN-13) 바코드 인식. `CameraView`(active/barcodeScannerSettings/onBarcodeScanned API)와 `useCameraPermissions` 훅 사용. SDK 55 호환. 권한 게이트 3상태(loading/granted/denied) 처리.

### 데이터 플로우 (SPEC-API-001)

**환경 변수 초기화 파이프라인**:
1. `app.config.ts` extra.eas → SUPABASE_URL/SUPABASE_ANON_KEY 정의
2. EAS Build 빌드 시점 → 환경별 값 주입 (dev/staging/prod)
3. 런타임 → Constants.expoConfig.extra로 값 읽기
4. env.ts → getEnvVar/getOptionalEnvVar로 런타임 검증
5. client.ts → 검증된 값으로 createClient() 호출
6. 전역 싱글톤 → 모든 모듈에서 동일 인스턴스 공유

**에러 처리 파이프라인**:
1. API/Edge Function 호출 → 원본 에러 수신
2. normalizeError → 표준화된 AppError 계층 구조로 변환
3. classifyError → NetworkError/AuthError/ValidationError 등 카테고리 분류
4. retryWithBackoff → 일시적 오류 시 지수 백오프로 재시도 (최대 3회)
5. getUserFriendlyMessage → 사용자 표시용 메시지 생성
6. logToSentry → 프로덕션 에러 Sentry 전송 (사용자 PII 제거)

## 백엔드 / 데이터베이스

백엔드는 Supabase를 통해 서버리스 아키텍처를 구현하며, 데이터베이스는 PostgreSQL을 사용하고 API 계층은 PostgREST를 통해 자동 생성된 RESTful API를 활용한다. 비즈니스 로직 처리와 외부 API 연동은 Supabase Edge Functions(Deno 런타임)에서 처리하며, 실시간 동기화 기능을 통해 사용자 간의 감정 공유와 모임 활동을 실시간으로 처리한다. 보안은 PostgreSQL의 RLS(Row Level Security)를 통해 구현하며, 모든 API 요청이 인증된 사용자에게만 접근 권한을 부여하고, 데이터는 자동으로 백업되고 복제되어 안정성을 보장한다. 스토리지는 Supabase Storage를 사용하여 책 표지 이미지와 사용자 업로드 파일을 관리한다.

### Edge Function 런타임 (Deno) — SPEC-BOOK-001 M1 완료

Supabase Edge Functions는 Deno 런타임을 사용하여 서버 측 비즈니스 로직을 실행한다. 2026-06-16 기준 `kakao-book-search` Edge Function이 구현 완료되었으며:
- **순수 로직 모듈**: `normalizer.ts`, `mapper.ts`, `cacheManager.ts` — Deno globals 없이 Jest로 DI 테스트
- **얇은 Deno 셸**: `index.ts` — HTTP 요청/응답 처리만
- **보안**: `KAKAO_REST_API_KEY` + `SUPABASE_SERVICE_ROLE_KEY`는 Edge Function 환경 변수만 (클라이언트 노출 금지)
- **캐싱 전략**: `books` 테이블 먼저 조회 → 캐시 미스 시 Kakao API 호출 후 업서트 (할당량 절약)
- **N+1 해결**: `upsertBooks` 배치 업서트 (PostgREST `.upsert(rows[])`)

## 인증

Supabase Auth를 핵심 인증 엔진으로 사용하며 카카오톡, Apple, Google OAuth 제공자를 통한 간편 로그인을 지원한다. 사용자 이메일 기반 계정과 소셜 로그인을 통합하여 원활한 로그인 경험을 제공하며, 세션 관리는 JWT 토큰을 사용한다. 세션 토큰 등 민감 정보는 expo-secure-store(iOS Keychain/Android Keystore)에 암호화하여 저장하여 보안을 강화하며, 비민감 설정값만 AsyncStorage를 사용한다. 소셜 로그인 연동은 사용자 편의성을 극대화한다. 인증 상태는 React Context를 통해 전역 관리되며, 자동 로그인 기능을 사용자 경험을 개선한다. `useSession()` 훅은 `null`(loading) 또는 `{ isAuthenticated, isOnboarded, session, user, profile, ... }` 객체를 반환하며, SPEC-NAV-001의 인증 가드가 이를 소비하여 라우팅 분기를 수행한다.

## 외부 API

도서 검색 기능은 Kakao Book Search API를 통해 구현하며 ISBN, 제목, 저자를 통한 정확한 도서 정보 검색을 지원한다. API 호출은 Supabase Edge Functions(`kakao-book-search`, M1 완료)를 통해 프록시되어 CORS 문제를 해결하고 API 키를 보호한다(클라이언트 노출 금지). 검색 결과는 `books` 테이블 캐싱을 통해 중복 호출을 최소화하며, Edge Function이 캐시 우선 조회 → 미스 시 Kakao API 호출 후 업서트 전략을 사용한다. 도서 정보는 주기적으로 동기화하여 최신 정보를 유지한다. Kakao API의 제한된 사용량을 관리하기 위해 요청 효율을 최적화하며, 오류 발생 시 대체 검색 방식을 제공한다.

**참고**: 실제 Kakao REST API 키 배포 및 Kakao Developers 설정은 SPEC-DEPLOY-001 인프라 영역이다.

## 푸시 알림

Expo Push Notifications를 통해 사용자 참여도를 높이는 맞춤형 알림을 제공한다. 다정한 독서 알림, 새로운 모임 초대, 공감 반응 알림 등 시기 적절한 푸시를 통해 사용자 리텐션을 관리하며, 알림 설정은 사용자 개인화를 통해 불필요한 알림을 최소화한다. 푸시 토큰 관리는 자동으로 처리되며, 알림 템플릿 시스템을 통해 다양한 콘텐츠를 유연하게 발송한다.

## 빌드 및 배포

Expo EAS Build를 통한 크로스 플랫폼 빌드와 EAS Submit을 통한 앱 스토어 배포를 자동화한다. 개발 환경은 Expo Go 앱을 사용한 빠른 테스팅과 프리빌드 프로세스를 통해 실제 기기에서의 검증을 병행하며, CI/CD 파이프라인은 GitHub Actions를 통해 구현하여 코드 푸시 시 자동으로 빌드, 테스트, 배포 프로세스를 실행한다. 앱 스토어 배포는 자동화된 스크립트를 통해 TestFlight와 Google Play Console에 배포하며, 버전 관리는 자동화된 태깅 시스템을 통해 관리된다.

## 개발 환경 요구사항

Node.js LTS 버전(20.x 이상)을 필수로 하며 npm을 통해 패키지를 관리한다. Expo CLI는 전역 설치되어 있어야 하며, Supabase CLI는 로컬 개발 환경 설정에 필요하다. iOS 개발을 위해서는 Xcode와 iOS SDK가 macOS 환경에서 필수이며, Android 개발을 위해서는 Android Studio와 SDK가 필요하다. 코드 품질 관리를 위해 ESLint 9 flat config, Prettier, TypeScript 설정을 통합하며, 테스트 프레임워크는 Jest와 @testing-library/react-native를 사용한다. 디버깅은 Expo 개발자 메뉴와 React DevTools를 통해 지원되며, 에러 추적을 위해 Sentry를 통합한다. iOS 개발을 위해서는 Xcode와 iOS SDK가 macOS 환경에서 필수이며, Android 개발을 위해서는 Android Studio와 SDK가 필요하다. 코드 품질 관리를 위해 ESLint, Prettier, TypeScript 설정을 통합하며, 테스트 프레임워크는 Jest와 React Native Testing Library(`@testing-library/react-native`)를 사용한다. 디버깅은 Expo 개발자 메뉴와 React DevTools를 통해 지원되며, 에러 추적을 위해 Sentry를 통합한다.

## 디자인 시스템 토큰

기본 배경색으로 따뜻한 크림색 (#FDFAF5)을 사용하여 부드러운 독서 환경을 연출하며, 주요 강조색으로는 암버 브라운 (#C17B2F)을 사용해 따뜻하고 차분한 분위기를 생성한다. 텍스트는 다크 브라운 (#2D1F0E)으로 가독성을 확보하며, 보조색으로는 부드러운 갈색 (#7A6350)을 사용한다. 시각적 계층 구조를 위해 여백의 미를 적용하고, "사각사각"이라는 타일 감각의 인터랙션 모션을 적용하며, 종이 질감의 브랜드 철학을 통해 책과의 연결감을 강조한다. 컴포넌트 간의 간격은 넉넉하게 설정하여 편안한 시각적 경험을 제공한다.

> **참고**: 본 토큰 값은 기획 문서(`.booktalk/pages_11_디자인시스템.md`) 기반이며, `brand/visual-identity.md` 구체화 후 해당 문서가 단일 진실 원천이 됩니다.

## 제약사항

1인(풀스택) 운영 전제하 MVP 범위로 개발되며, 실시간 매칭, 팝업 채팅, 실시간 독서실 등 확장 기능은 후순위로 고려된다. 대중 스케일 서비스보다는 니치 시장 집중 전략을 따르며, 지식/토론 중심 UX 대신 감정 공유에 집중한다. 좋아요 경쟁 메커니즘은 과시 엔진 함정을 회피하기로 결정되었으며, 수익화는 완독률·감정 반응 데이터 축적 우선 전략을 채택한다. 모든 기능은 모바일 환경에 최적화되어 있으며, 데스크톱 웹 버전은 현재 개발 계획에 포함되지 않는다.