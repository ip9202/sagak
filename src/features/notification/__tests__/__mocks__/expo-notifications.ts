/**
 * expo-notifications Jest mock (SPEC-NOTIF-001 REQ-NOTIF-001/002)
 *
 * 실제 expo-notifications 55.x index.ts 와 동일한 flat named-export 형태.
 * (import * as Notifications from 'expo-notifications' 가 namespace 로 동작하도록)
 *
 * 각 테스트는 setXxx()/__reset() 헬퍼로 반환값/throw 동작을 제어한다.
 *
 * 노출 (실제 API 와 동일 flat 형태):
 * - getExpoPushTokenAsync(options?) -> Promise<{ type:'expo', data:string }>
 * - requestPermissionsAsync(req?) -> Promise<PermissionResponse>
 * - setNotificationHandler(handler) -> void
 * - addNotificationResponseReceivedListener(cb) -> Subscription
 * - setNotificationChannelAsync(id, channel) -> Promise<void>
 * - AndroidImportance enum
 *
 * @MX:NOTE: [AUTO] 테스트 전용 — 실제 푸시 동작은 dev client 실기기 검증 (handoff N3/N4).
 * @MX:SPEC SPEC-NOTIF-001
 */

export interface PermissionResponse {
  status: 'granted' | 'denied' | 'undetermined';
  granted: boolean;
  canAskAgain: boolean;
  expires: 'never';
}

export interface ExpoPushTokenResult {
  type: 'expo';
  data: string;
}

export interface NotificationContent {
  title?: string;
  body?: string;
  data?: Record<string, unknown> | null;
}

export interface NotificationRequest {
  content: NotificationContent;
}

export interface NotificationResponse {
  notification: { request: NotificationRequest };
}

/** 포그라운드 수신 알림(addNotificationReceivedListener) — SPEC-NOTIF-002 REQ-NOTIF2-002 N2-5 */
export interface ReceivedNotification {
  request: NotificationRequest;
}

export interface Subscription {
  remove: () => void;
}

// AndroidImportance enum (실제 expo-notifications 와 값 동일 — HIGH=4)
export enum AndroidImportance {
  HIGH = 4,
}

// --- 테스트 제어 가능한 전역 상태 ---
let mockPermissionResponse: PermissionResponse | null = null;
let mockTokenResult: ExpoPushTokenResult | null = null;
let mockTokenError: Error | null = null;
let mockAndroidChannelId: string | null = null;
let handlerRef: unknown = null;
let responseListeners: Array<(response: NotificationResponse) => void> = [];
let receivedListeners: Array<(notification: ReceivedNotification) => void> = [];

export function setPermissionResponse(resp: PermissionResponse | null): void {
  mockPermissionResponse = resp;
}
export function setTokenResult(token: ExpoPushTokenResult | null): void {
  mockTokenResult = token;
}
export function setTokenError(err: Error | null): void {
  mockTokenError = err;
}
export function getLastCreatedChannelId(): string | null {
  return mockAndroidChannelId;
}
/** 현재 setNotificationHandler 로 등록된 핸들러 반환 (테스트 검증용) */
export function getNotificationHandler(): unknown {
  return handlerRef;
}
/** addNotificationResponseReceivedListener 로 등록된 모든 리스너 반환 */
export function getResponseListeners(): Array<(response: NotificationResponse) => void> {
  return responseListeners;
}
/** 테스트 헬퍼: 등록된 리스너들에게 탭 응답 전달 */
export function emitNotificationResponse(response: NotificationResponse): void {
  for (const listener of responseListeners) {
    listener(response);
  }
}
/** addNotificationReceivedListener 로 등록된 모든 리스너 반환 (SPEC-NOTIF-002 N2-5) */
export function getReceivedListeners(): Array<(notification: ReceivedNotification) => void> {
  return receivedListeners;
}
/** 테스트 헬퍼: 등록된 포그라운드 수신 리스너들에게 알림 전달 (SPEC-NOTIF-002 N2-5) */
export function emitNotification(notification: ReceivedNotification): void {
  for (const listener of receivedListeners) {
    listener(notification);
  }
}
/** setNotificationChannelAsync 가 마지막으로 받은 channel 설정 객체 반환 */
export function getLastChannelConfig(): { name?: string; importance?: number } | null {
  return mockLastChannelConfig;
}
let mockLastChannelConfig: { name?: string; importance?: number } | null = null;
/** 내부 상태 초기화 — beforeEach 에서 호출 권장 */
export function __reset(): void {
  mockPermissionResponse = null;
  mockTokenResult = null;
  mockTokenError = null;
  mockAndroidChannelId = null;
  mockLastChannelConfig = null;
  handlerRef = null;
  responseListeners = [];
  receivedListeners = [];
  // jest.fn call history 도 reset
  getExpoPushTokenAsync.mockClear();
  requestPermissionsAsync.mockClear();
  setNotificationHandler.mockClear();
  addNotificationResponseReceivedListener.mockClear();
  addNotificationReceivedListener.mockClear();
  setNotificationChannelAsync.mockClear();
}

export const getExpoPushTokenAsync = jest.fn(
  async (_options?: { projectId?: string }): Promise<ExpoPushTokenResult> => {
    if (mockTokenError) {
      throw mockTokenError;
    }
    if (mockTokenResult) {
      return mockTokenResult;
    }
    return { type: 'expo', data: 'ExponentPushToken[default]' };
  },
);

export const requestPermissionsAsync = jest.fn(async (): Promise<PermissionResponse> => {
  if (mockPermissionResponse) {
    return mockPermissionResponse;
  }
  return { status: 'granted', granted: true, canAskAgain: true, expires: 'never' };
});

export const setNotificationHandler = jest.fn((handler: unknown): void => {
  handlerRef = handler;
});

export const addNotificationResponseReceivedListener = jest.fn(
  (cb: (response: NotificationResponse) => void): Subscription => {
    responseListeners.push(cb);
    return {
      remove: () => {
        responseListeners = responseListeners.filter((l) => l !== cb);
      },
    };
  },
);

// SPEC-NOTIF-002 REQ-NOTIF2-002 N2-5: 포그라운드 푸시 수신 리스너
export const addNotificationReceivedListener = jest.fn(
  (cb: (notification: ReceivedNotification) => void): Subscription => {
    receivedListeners.push(cb);
    return {
      remove: () => {
        receivedListeners = receivedListeners.filter((l) => l !== cb);
      },
    };
  },
);

export const setNotificationChannelAsync = jest.fn(
  async (id: string, config: { name?: string; importance?: number }): Promise<void> => {
    mockAndroidChannelId = id;
    mockLastChannelConfig = config;
  },
);
