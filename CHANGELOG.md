# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **감정 기록 visibility `'private'`(나만 보기) 추가** (PR #173, SPEC-EMOTION-001 후속)
  - DB CHECK 확장 + RLS 정책 (`user_id = auth.uid()`) — 작성자만 조회 가능한 프라이빗 감정 기록 지원
  - 서재 책 비공개 (`is_public=false`) ↔ 감정 기록 기본 private 자동 연동 (프라이버시 기본값 일관성)
  - UI 버튼(공개/모임/나만) 토글 — `EmotionInputScreen.tsx` 가시성 선택 UX
- **진도 연동** — 감정 기록 저장 시 서재 진도(`current_page`) 업데이트 (뒤로감기 방지 로직 포함)
- **프롬프트 개선** — 무작위 질문 9개 풀 + 폰트 강조(`headingSm`) + 가운데 정렬 (`questionPrompts.ts`)
- **`expo-dev-client` 설치** — 실기기 dev client 빌드 환경

### Fixed
- **`user_id` DEFAULT `auth.uid()` 추가** (회귀 수정) — NOT NULL 제약 + DEFAULT 누락으로 인한 INSERT 실패 해소. 코드 주석과 DB 스키마 불일치 정리. 마이그레이션 `20260726000002`
- **react-query queryKey 접두사 매칭 수정** — 객체 vs 문자열 요소 불일치로 인해 `invalidateQueries`가 리스트를 갱신하지 못하던 회귀 해결. 저장 후 폼 초기화 + 리스트 자동 갱신 정상화
- **VirtualizedList 중첩 해결** — `TimelineScreen.tsx` 단일 FlatList 통합 (`ListHeaderComponent`). `contentContainerStyle flex:1` 스크롤 차단 이슈 해결
- **sync-auditor F1 — defaultVisibility race 회귀 차단** — `[bookId].tsx` libraryLoading 게이트 추가. libraryQuery 해결 전 EmotionInputScreen 마운트 차단하여 비공개 책 감정 기록이 public으로 저장되는 프라이버시 회귀 방지
- **sync-auditor F2 — 진도 업데이트 부분 실패 처리** — updateProgressMutation try/catch 비차단 처리. 진도 업데이트 실패해도 감정 기록 저장은 유지 (중복 저장 및 오도 에러 메시지 방지)
- **sync-auditor F3 — pgTAP RLS 검증 추가** — `supabase/tests/0021_emotion_records_private_rls_test.sql`. visibility=`private` 가시성 (작성자 SELECT 1건 / 타인 0건 / user_id 변조 INSERT 거부) 종단간 검증

### Changed
- **감정 기록 저장 UX 개선** — 저장 후 폼 초기화 + 타임라인 자동 갱신 (위 fix 항목 참조)
- **DB 마이그레이션** (dev 적용 완료):
  - `20260726000001_emotion_records_visibility_private.sql` — visibility `'private'` 허용 (CHECK + 복합 CHECK)
  - `20260726000002_emotion_records_user_id_default.sql` — user_id DEFAULT `auth.uid()`

### Technical Notes
- jest 114개 PASS (emotion 91 + `[bookId]` 14 + BookCard 등)
- typecheck PASS, 실기기 dev client 검증 완료
- 발견된 회귀 (함정 기록): user_id NOT NULL + DEFAULT 누락 / queryKey 접두사 매칭 실패 / contentContainerStyle flex:1 스크롤 차단

## [v1.2.3] - 2026-07-24

### Fixed
- deploy.yml parse-version dead-code 해소 — grep 실패 시 set -e 중단 방지 (SPEC-DEPLOY-001 F2, #165)

### Changed
- SPEC frontmatter status completed 동기화 — 11건 (#166 8개 일괄 + #167 CLUB-001 + #168 API-001 + #169 FEED-001 + #170 DEPLOY-001)

## [v1.2.2] - 2026-07-23

### Fixed
- **deploy tag-release CI 안정성 강화** (SPEC-DEPLOY-001 AC-DEPLOY-010 follow-up)
  - `fetch-tags: true` 추가 — remote tag 미인식 `reference already exists` 거부 수정 (CI #29909418596, PR #159)
  - 인젝션 방어 — 커밋 메시지 직접 보간 → env(COMMIT_MSG) 전환 (PR #161)
  - ls-remote defense-in-depth — cross-actor race window 닫기 + push 실패 safe-skip (PR #161)
  - sync-auditor 독립 리뷰 통과 (PASS-WITH-DEBT → F1 회귀 fix)

### Changed
- moai config compact 동기화 (PR #160)
- main↔develop 동기화 (backmerge PR #158)
- Version bump: 1.2.1 → 1.2.2

### Docs
- Git Flow × MoAI 워크플로우 치트시트 (`.moai/docs/`, PR #162)

## [v1.2.1] - 2026-07-22

### Changed
- **N2-2 타인 알림 RLS 차단 종단간 검증 강화** (runtime smoke + pgTAP 0020, PR #155) — 기능 변화 없음, 검증 강화
- **실기기 검증 확정** (빌드 c0a0b6a9, N2-1/N2-5/N2-8 PASS)
- **main↔develop 동기화** (backmerge PR #154)

### Changed
- **Version bump**: 1.2.0 → 1.2.1

## [v1.2.0] - 2026-07-22

### Added
- **알림 센터 실시간 갱신** (SPEC-NOTIF-002)
  - Realtime INSERT 이벤트 구독 (N2-1, N2-3, N2-4 PASS)
  - 포그라운드 푸시 수신/배너 탭 시 목록 갱신 (N2-5, N2-6, N2-7 PASS)
  - pull-to-refresh (RefreshControl) 구현 (N2-8, N2-9 PASS)
  - Supabase Realtime publication 구성 (`supabase_realtime` + `REPLICA IDENTITY FULL`)
  - **실기기 검증 완료 (2026-07-22, prod 빌드 `c0a0b6a9`)**: N2-1 Realtime 자동 반영 · N2-5 포그라운드 수신 · N2-8 pull-to-refresh — 단위 PASS를 넘어 실기기 PASS 확인
  - **N2-2 타인 알림 RLS 차단 (RESOLVED, 2026-07-22, PR #155)**: 로컬 Supabase 종단간 runtime smoke 완료 — 서버 SELECT RLS 게이트가 Realtime 브로드캐스트에도 적용됨 확인 (Node.js smoke + pgTAP 0020). 별도 broadcast RLS policy 불필요 (migration 주석의 open follow-up question 해결됨).
  - Implementation files:
    - `src/features/notification/useNotificationsRealtime.ts` (Realtime 구독 훅)
    - `src/features/notification/useNotificationResponse.ts` (invalidateQueries 연결)
    - `src/features/notification/components/NotificationsScreen.tsx` (RefreshControl)
    - `supabase/migrations/20260722000001_enable_realtime_notifications.sql` (publication 구성)

### Changed
- **Version bump**: 1.1.0 → 1.2.0

## [1.1.0] - 2026-07-21

### Added
- **N7 포그라운드 알림 수신 완료** (REQ-NOTIF-004)
  - In-app 배너 표시 (`shouldShowAlert: true`)
  - 포그라운드 시 시스템 알림 억제
  - 탭 → routeMapper 라우팅 (알림 센터)
  - 알림 센터 목록 추가 (3개 알림 누적)
- **단일 백엔드 스택 결정**
  - Supabase: dev=prod 단일 프로젝트 재사용 (`lqltwbpocbgoxvhlmjdo`)
  - Firebase: `sagak-dev` 프로젝트 재사용 (분리 없음)
- **빌드 인프라 수정** (PR #145)
  - `google-services.json` git-tracked (android/app/, 공개 식별자)
  - `eas.json` production profile: `environment: production` 필드 추가
  - `expo-push.ts` 엔드포인트 수정: `/api/v2` → `/--/api/v2` (버그 수정 — 404 원인)
  - FCM V1 Service Account Key 등록 (Expo Credentials: Android > production)
  - `.gitignore`: `prod-firebase-service-account.json` 추가 (FCM 개인 키 보호)

### Changed
- **Version bump**: 1.0.0 → 1.1.0

### Fixed
- **expo-push 엔드포인트 버그**: `/api/v2` → `/--/api/v2` (404 오류 수정)
- **EAS environment priority**: eas.json env보다 EAS env 우선 (production profile)

### Technical Notes
- N7 실기기 검증 통과 (prod internal build)
- 단일 백엔드 결정으로 인한 배포 단순화
- FCM V1 CLI 재검증: eas-cli v7.2.0+에서 지원 확인 (lesson #13 정정)

## [1.0.0] - 2026-06-22

### Added
- **REQ-NOTIF-001~004** 초기 구현 (Expo Push Token, 권한, 서버 등록, 포그라운드 핸들러)
- **자동화 검증**: N1(token 성공), N2(token 실패 silent), N5(서버 등록 + WHERE 절), N8(탭 라우팅)
- **수동 검증 통과**: N3(권한 허용), N4(권한 거부 폴백)
