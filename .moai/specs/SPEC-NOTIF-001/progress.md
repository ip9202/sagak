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
- **수동 검증**: N3(권한 허용) **✅ 통과 (PR #41)** — Firebase sagak-dev + google-services.json 완료, `getExpoPushTokenAsync` 토큰 획득 성공. N4(권한 거부 폴백) **✅ 통과**. N7(포그라운드 수신) **⏳ 보류** — Service Account Key 필요 (google-services.json과는 별개)
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
- **N7 (포그라운드 알림 수신)**: ⏳ **보류** — Service Account Key(서버 credential) 필요. google-services.json(클라이언트 credential)와는 별개 파일. EAS credentials 업로드 → 실제 푸시 발송/수신 테스트 필요.
- **REQ-NOTIF-003 WHERE 절 회귀 수정**: ✅ **통과 (PR #41)** — PostgREST 21000 "UPDATE requires a WHERE clause". `registerPushToken(token, userId)`에 `.eq('id', userId)` WHERE 절 추가 + `usePushTokenRegistration.ts`에 `!session.user` 가드 추가. 기존 코드/테스트가 "RLS만으로 충분, WHERE 없어도 됨"을 가정(wrong — lesson #12). 테스트 assertion 반전(eq NOT 사용 → eq 사용 확인). jest 12/12, tsc clean. 실기기 userId 01ff8d99-... 사용자 토큰 정상 등록 확인(users.push_token UPDATE 성공).
- **dev DB**: 마이그레이션 20240620000001/02/03 dev 적용 (notifications.data + users.push_token + ENUM + Realtime + RPC — 이전 dev 미적용 상태였음)
- **검증 인프라**: projectId(@ip9202/sagak) 주입, eas.json SENTRY_DSN 빈값 제거(EAS init validation)
- **회귀 (검증 중 발견/수정)**: (tabs) 하위 라우트 6개 href:null (4탭 깨짐) + my.tsx ScrollView (스크롤 불가)
- **EAS cloud build 갭 (연기)**: google-services.json gitignore로 인해 EAS cloud builds 실패 가능성. 현재는 dev client(`expo run:android`) 사용 중이므로 non-blocking. Phase 5 DEPLOY/prod release 시 해결 필요(EAS secrets 활용 또는 수동 업로드).
