## SPEC-NOTIF-001 Progress (Optional Goal — Push)

- Started: 2026-06-20
- Branch: feature/SPEC-NOTIF-001-push → feature/SPEC-NOTIF-001-sync
- Mode: solo / harness=standard / methodology=TDD
- Preflight complete: develop synced, feature branch created
- Phase 1 complete: manager-strategy plan approved (Decision Point 1 PASS)
- Phase 1.5 complete: 6 tasks decomposed (TASK-000~005)
- Phase 2B complete: manager-tdd TDD implementation
- Phase 2C complete: Review & Fix (evaluator-active APPROVE, fixes W1/M2/W2 applied)
- Phase 2D complete: Merge to develop (PR #38, commit 8f532d6, 2026-06-21)

### 최종 상태 (Final State - 2026-06-22)

- **구현 완료**: REQ-NOTIF-001~004 (Expo Push Token 획득·권한·서버 등록·포그라운드 핸들러)
- **자동화 검증 통과**: N1(token 성공), N2(token 실패 silent), N5(서버 등록 + WHERE 절 수정), N8(탭 라우팅)
- **수동 검증**: N3(권한 허용) **✅ 통과 (PR #41)** — Firebase sagak-dev + google-services.json 완료, `getExpoPushTokenAsync` 토큰 획득 성공. N4(권한 거부 폴백) **✅ 통과**. N7(포그라운드 수신) **⏳ Phase 5/prod 연기** — EAS identifier 등록이 keystore 강제 + eas-cli 20.x FCM V1 CLI 불가, 로컬 dev 정책 충돌 → prod 첫 EAS 빌드 시점 연기 (lesson #13)
- **리뷰 상태**: evaluator-active PASS, OWASP security audit APPROVE (Critical 0)
- **품질 게이트**: TRUST 5 5/5, tsc 0 errors, jest 1136/1136 pass, lint 0 errors
- **커버리지**: 신규 파일 93-100%, 전체 98.82%
- **머지 정보**: PR #38 (commit 8f532d6) + PR #41 (commit cc87323)

### 구현 파일 (18 files, +1053 LOC)

- **신규 소스** (4): `registerToken.ts`, `registerForPush.ts`, `usePushTokenRegistration.ts`, `useNotificationResponse.ts`
- **신규 테스트** (4): `registerToken.test.ts`, `registerForPush.test.ts`, `usePushTokenRegistration.test.tsx`, `useNotificationResponse.test.tsx`
- **mock**: `__tests__/__mocks__/expo-notifications.ts`
- **수정** (5): `app/_layout.tsx`, `src/features/notification/index.ts`, `app.json`, `jest.config.js`, `package.json`

### 주요 설계 결정

- **Token 저장**: `users.push_token` (decision 6.1 "users extension" — PR #34 migration 적용됨)
- **RLS + WHERE 이중 안전망**: PostgREST UPDATE는 WHERE 절 필수(PostgREST 21000). `.eq('id', userId)` 명시 + RLS `users_update_own_row` 이중 보호 (PR #41 lesson #12 수정 — 기존 "RLS만으로 충분" 가정 was wrong)
- **Silent 실패**: REQ-001/002 실패 시 null 반환, 알림 센터는 계속 동작
- **Foreground 핸들러**: 모듈 스코프 `setNotificationHandler` (W2 fix)
- **projectId optional**: `Constants.expoConfig.extra.eas.projectId` 안전망
- **DEV 로깅**: Token-leak-safe (M2 fix — 정적 문자열만, error object 제외)

## 실기기 검증 (2026-06-22)

- **N3 (권한 허용 → 토큰 획득)**: ✅ **통과 (PR #41)** — Firebase `sagak-dev` 프로젝트 + `com.sagak.app` 등록, google-services.json 프로젝트 루트 배치(gitignored), `app.json`에 `expo.android.googleServicesFile: "./google-services.json"` 추가. `expo prebuild --clean` → google-services gradle plugin 적용 + `processDebugGoogleServices` values.xml 생성 → APK 빌드 성공. Pixel 6 실기기: `Default FirebaseApp is not initialized` 에러 해소, `getExpoPushTokenAsync` 토큰 획득 성공.
- **N4 (권한 거부 폴백)**: ✅ 통과 — 알림 센터 빈 목록 정상 조회, silent failure, 크래시 없음 (USER_FIXED 거부 상태에서)
- **N7 (포그라운드 알림 수신)**: ⏳ **Phase 5/prod 연기 (2026-06-22)** — EAS identifier 등록 시도 중 **keystore(.jks/.p12) 업로드 강제** 발견(대시보드 New Application Identifier 마법사 Step 3/5, Generate/Skip 불가). eas-cli 20.x는 FCM V1 전용 CLI 명령 없음(credentials.json은 빌드 keystore 전용). sagak 로컬 dev 정책(EAS 클라우드 빌드 안 함)과 충돌 → **prod 첫 EAS 빌드 시점**(keystore 자동 생성 + identifier + FCM V1 동시 설정)으로 연기. Firebase Service Account Key는 생성 완료(보관, prod용). lesson #13.
- **REQ-NOTIF-003 WHERE 절 회귀 수정**: ✅ **통과 (PR #41)** — PostgREST 21000 "UPDATE requires a WHERE clause". `registerPushToken(token, userId)`에 `.eq('id', userId)` WHERE 절 추가 + `usePushTokenRegistration.ts`에 `!session.user` 가드 추가. 기존 코드/테스트가 "RLS만으로 충분, WHERE 없어도 됨"을 가정(wrong — lesson #12). 테스트 assertion 반전(eq NOT 사용 → eq 사용 확인). jest 12/12, tsc clean. 실기기 userId 01ff8d99-... 사용자 토큰 정상 등록 확인(users.push_token UPDATE 성공).
- **dev DB**: 마이그레이션 20240620000001/02/03 dev 적용 (notifications.data + users.push_token + ENUM + Realtime + RPC — 이전 dev 미적용 상태였음)
- **검증 인프라**: projectId(@ip9202/sagak) 주입, eas.json SENTRY_DSN 빈값 제거(EAS init validation)
- **회귀 (검증 중 발견/수정)**: (tabs) 하위 라우트 6개 href:null (4탭 깨짐) + my.tsx ScrollView (스크롤 불가)
- **EAS cloud build 갭 (연기)**: google-services.json gitignore로 인해 EAS cloud builds 실패 가능성. 현재는 dev client(`expo run:android`) 사용 중이므로 non-blocking. Phase 5 DEPLOY/prod release 시 해결 필요(EAS secrets 활용 또는 수동 업로드).

## N7 사전 준비 정리 (2026-07-20)

- **브랜치**: `feature/SPEC-NOTIF-001-n7-prep` (develop f1975cc 기반, 0 0 divergence)
- **작업 범위**: plan.md / progress.md / acceptance.md 업데이트. 코드 변경 없음.
- **eas-cli 21.x FCM V1 CLI 재검증 (lesson #13 정정)**:
  - 검증 출처: eas-cli CHANGELOG.md (raw.githubusercontent.com/expo/eas-cli/main/CHANGELOG.md) + Expo 공식 docs (docs.expo.dev/push-notifications/fcm-credentials/) 교차 (lessons #14 적용)
  - 결론: eas-cli v7.2.0 (2024-02-11) PR #2197부터 FCM V1 Service Account Key를 `eas credentials` 인터랙티브 메뉴로 CLI 업로드 지원. 21.0.2는 당연히 포함.
  - lesson #13 정정: "eas-cli 20.x FCM V1 CLI 불가"는 부분 정정. CLI 자체는 지원됨. 실제 블로커는 Application Identifier 최초 등록 시 keystore 강제 (별개 문제).
  - `eas credentials --help` (현재 설치된 20.x) 서브커맨드: `credentials:configure-build`만 노출되지만, 인터랙티브 `eas credentials` 메뉴 진입 시 FCM V1 경로 존재.
- **keystore 비가역 결정 — 사용자 승인 대기**:
  - [HARD] 첫 EAS prod 빌드 실행 전 사용자 명시적 승인 필요. keystore(.jks/.p12) 영구 귀속 = Play Store 서명키 고정, 교체 곤란.
  - 사용자 승인 포인트: `eas build --platform android --profile production` 실행 전 "prod 서명키 영구 귀속 + keystore 백업 책임" 명시 후 승인.
  - 본 세션에서는 실행하지 않음 (문서 안데만).
- **prod 빌드 옵션 비교 (plan.md §Optional Goal N7-C)**: EAS 클라우드 vs `--local`. google-services.json gitignore → 클라우드는 EAS Secrets 우회, 로컬은 직접 경로 사용.
- **산출**: plan.md N7 사전 검증 절차(A~F) 섹션 추가, acceptance.md N7 시나리오/수동 검증 항목 21.x 재평가 반영.

## §E.4 Sync-phase Audit-Ready Signal

- **Sync complete at**: 2026-07-21
- **Sync commit SHA**: 7e96d99 (백필 완료)
- **Version bump**: 1.0.0 → 1.1.0
- **CHANGELOG entry**: [1.1.0] 섹션 생성 (N7 완료 + 단일 백엔드 결정 + 빌드 인프라 수정)
- **交付物**:
  - spec.md frontmatter: `status: completed`, `updated: 2026-07-21`, `version: 1.1.0`
  - package.json: `version: 1.1.0`
  - CHANGELOG.md: [1.1.0] 섹션 (신규)
  - progress.md: §E.4 추가 (본 섹션)
