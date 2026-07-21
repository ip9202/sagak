# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
