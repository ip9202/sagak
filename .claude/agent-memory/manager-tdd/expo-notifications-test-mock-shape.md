---
name: expo-notifications-test-mock-shape
description: expo-notifications 테스트 mock 은 flat named-export 형태여야 함 + NotificationBehavior 전체 필수 필드
metadata:
  type: feedback
---

sagak에서 expo-notifications 테스트 mock 작성 시 주의점.

**규칙**: `src/features/notification/__tests__/__mocks__/expo-notifications.ts` 는 실제 패키지(`node_modules/expo-notifications/build/index.d.ts`)와 동일한 **flat named-export** 형태여야 한다. `Notifications` 같은 네임스페이스 객체로 묶으면 안 된다.

**Why**: 프로덕션 코드가 `import * as Notifications from 'expo-notifications'` 로 쓴다. 이때 `Notifications.AndroidImportance`, `Notifications.getExpoPushTokenAsync` 등은 모듈 네임스페이스의 flat named export 여야 접근된다. mock 을 `{ Notifications: {...} }` 로 감싸면 `AndroidImportance is undefined` 런타임 에러.

**How to apply**:
- mock 파일은 `export const getExpoPushTokenAsync = jest.fn(...)`, `export enum AndroidImportance { HIGH = 4 }` 식 flat export.
- 테스트 제어 헬퍼(`setPermissionResponse`, `__reset`, `emitNotificationResponse`)도 같은 파일에서 named export.
- `setNotificationHandler` 의 `handleNotification` 시그니처는 `(notification) => Promise<NotificationBehavior>` — `async` 필수, 반환값은 `NotificationBehavior` 전체 필수 필드(`shouldShowAlert` + `shouldShowBanner` + `shouldShowList` + `shouldPlaySound` + `shouldSetBadge`). `shouldShowAlert` 만 주면 tsc 에러.

관련: [[jest-rn-render-pattern]], [[auth-context-test-layout]]. SPEC-NOTIF-001 TASK-002/004 에서 확립.
