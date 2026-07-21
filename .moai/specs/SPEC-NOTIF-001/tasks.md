## Task Decomposition
SPEC: SPEC-NOTIF-001 (Optional Goal — REQ-NOTIF-001~004 클라이언트 Expo Push)

Branch: feature/SPEC-NOTIF-001-push
Mode: solo / harness=standard / methodology=TDD (RED-GREEN-REFACTOR)
Drift baseline: 신규 소스 4 + 신규 테스트 4 + mock 1 + 설정/연결 수정 5

| Task ID | Description | Requirement | Dependencies | Planned Files | Status |
|---------|-------------|-------------|--------------|---------------|--------|
| TASK-000 | expo-notifications 설치 + app.json 플러그인/iOS infoPlist | REQ-001~004 인프라 | - | app.json, package.json | ✅ completed (PR #38) |
| TASK-001 | registerToken.ts — users.push_token UPDATE (RLS 단일진실) | REQ-NOTIF-003, N5 | TASK-000 | src/features/notification/registerToken.ts, __tests__/registerToken.test.ts | ✅ completed (PR #38) |
| TASK-002 | registerForPush.ts — 권한+토큰+Android 채널, 실패 시 null silent | REQ-NOTIF-001,002, N1,N2 | TASK-000 | src/features/notification/registerForPush.ts, __tests__/registerForPush.test.ts, __tests__/__mocks__/expo-notifications.ts, jest.config.js | ✅ completed (PR #38) |
| TASK-003 | usePushTokenRegistration.ts — 인증 시 1회 등록(멱등) | REQ-NOTIF-001~003, N1,N5 | TASK-001,002 | src/features/notification/usePushTokenRegistration.ts, __tests__/usePushTokenRegistration.test.tsx | ✅ completed (PR #38) |
| TASK-004 | useNotificationResponse.ts — 전역 핸들러 + 탭 라우팅(routeMapper 재사용) | REQ-NOTIF-004, N7,N8 | TASK-002 | src/features/notification/useNotificationResponse.ts, __tests__/useNotificationResponse.test.tsx | ✅ completed (PR #38) |
| TASK-005 | _layout.tsx RootLayout 마운트 + index.ts 배포 | 통합, N8 | TASK-003,004 | app/_layout.tsx, src/features/notification/index.ts, app/__tests__/_layout.test.tsx | ✅ completed (PR #38) |

자동화 검증: N1(token 성공)·N2(token 실패 silent)·N5(서버 등록)·N8(탭 라우팅)
수동 검증(사용자 실기기): N3(권한 허용)·N4(권한 거부)·N7(포그라운드 수신)
