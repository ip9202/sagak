---
id: SPEC-NOTIF-001
title: "푸시 알림 및 알림 센터 — 인수 기준"
version: "1.0.1"
status: completed
created: 2026-06-14
updated: 2026-07-22
author: "강력쇠주먹"
priority: medium
issue_number: 0
labels: [notif, push, expo-push, notification-center, edge-function, supabase, phase-4, acceptance]
---

> **업데이트 (2026-07-22)**: ✅ **N7 포그라운드 알림 수신 통과** — FCM V1 service account key 업로드(sagak-dev, `eas credentials` 인터랙티브) + prod-internal APK `f4a2e4b3` 실기기 검증 7/7 PASS(`push_sent:true`, DB INSERT 2535584a/369e23cb, 포그라운드 heads-up 배너, 탭 시 알림센터 라우팅, 알림센터 조회). 빌드 인프라 회귀 정리(5a9c3a2 → 9498baf → a50bdb2). **별개 결함**: 알림센터 실시간 갱신 미구현(Realtime 구독 부재 + invalidateQueries 미연결 + RefreshControl 부재)은 후속 **SPEC-NOTIF-002**로 분리. 상세는 §1 시나리오 N7 검증 상태 및 HISTORY 참조.
>
> **업데이트 (2026-06-21)**: Optional Goal (REQ-NOTIF-001~004) 구현 완료(PR #38). 자동화 N1/N2/N5/N8 통과. **수동 검증: N4 통과**(권한 거부 폴백 — 알림 센터 정상 동작, silent, 크래시 없음). **N3/N7 보류**(Android FCM 자격증명 미설정 — projectId 주입 완료, FCM credentials가 전제; lesson #4 사례). dev 마이그레이션 20240620000001/02/03 적용(notifications.data + users.push_token + ENUM).
>
> **업데이트 (2026-06-22)**: PR #41 머지. **N3 해소**(Android FCM 자격증명 완료 — Firebase sagak-dev 프로젝트 + google-services.json 구성, `Default FirebaseApp is not initialized` 에러 해소, `getExpoPushTokenAsync` 토큰 획득 성공). **REQ-NOTIF-003 회귀 수정**(PostgREST 21000 — WHERE 절 `.eq('id', userId)` 추가, 기존 "RLS만으로 충분" 가정 was wrong, lesson #12 참조). **N7 Phase 5/prod 연기**(포그라운드 알림 수신 — EAS identifier 등록이 keystore 강제 + eas-cli 20.x FCM V1 CLI 불가, 로컬 dev 정책 충돌 → prod 첫 EAS 빌드 시점으로 연기, lesson #13).
>
> **업데이트 (2026-07-20)**: N7 사전 준비 정리(feature/SPEC-NOTIF-001-n7-prep). eas-cli 21.x FCM V1 CLI 재검증 — v7.2.0(2024-02-11)#2197부터 `eas credentials` 인터랙티브 메뉴로 FCM V1 service account key 업로드 지원 확인(CHANGELOG.md + 공식 docs 교차, lessons #14). lesson #13 "20.x FCM V1 CLI 불가" 부분 정정(CLI 자체는 가능, 실제 블로커는 Application Identifier 최초 등록 시 keystore 강제). N7 ⏳ 상태 유지하되 "사전 준비 진행(2026-07-20)" 서브상태 추가. keystore 비가역 결정은 사용자 승인 대기.

# SPEC-NOTIF-001: 인수 기준 (acceptance.md)

## HISTORY

| 날짜 | 버전 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 2026-06-14 | 1.0.0 | 최초 작성 — 13개 REQ에 대한 Given-When-Then 시나리오, 품질 게이트, 검증 방법 | 강력쇠주먹 |
| 2026-07-22 | 1.0.1 | N7 포그라운드 알림 수신 통과 반영 — FCM V1 service account key 업로드(sagak-dev, `eas credentials` 인터랙티브) + prod-internal APK `f4a2e4b3` 실기기 검증 7/7 PASS(`push_sent:true`, DB INSERT 2535584a/369e23cb 관측, 포그라운드 heads-up 배너 `shouldShowAlert:true`, 탭 시 알림센터 라우팅, 알림센터 조회). 빌드 인프라 회귀 정리(5a9c3a2 gitignore → 9498baf post-install 미작동 → a50bdb2 git 추적 회귀). **별개 결함**: 알림센터 실시간 갱신 미구현(Realtime 구독 부재 + `useNotificationResponse` invalidateQueries 미연결 + RefreshControl 부재)은 후속 SPEC-NOTIF-002로 분리. | 강력쇠주먹 |

---

## 1. 인수 시나리오 (Given-When-Then)

### REQ-NOTIF-001: Expo Push Token 획득

#### 시나리오 N1: 토큰 획득 성공

**Given** 인증된 사용자가 앱에 처음 로그인했다
**And** 사용자가 알림 권한을 허용했다
**When** 시스템이 `registerForPushNotifications()`를 호출한다
**Then** 시스템은 `expo-notifications` SDK로부터 Expo Push Token을 획득한다
**And** 획득한 토큰을 반환한다 (서버 등록용)

#### 시나리오 N2: 토큰 획득 실패 (조용히 처리)

**Given** 인증된 사용자가 앱에 처음 로그인했다
**And** 네트워크 연결이 불안정하거나 Expo 서비스가 응답하지 않는다
**When** 시스템이 `registerForPushNotifications()`를 호출한다
**Then** 시스템은 토큰 획득 실패를 조용히 처리한다 (에러 throw 없음)
**And** 알림 센터 기능은 정상 동작한다 (푸시만 비활성)

---

### REQ-NOTIF-002: 푸시 권한 요청

#### 시나리오 N3: 권한 허용

**Given** 인증된 사용자가 iOS/Android 기기에서 앱을 실행 중이다
**When** 시스템이 `Notifications.requestPermissionsAsync()`를 호출한다
**Then** OS가 사용자에게 알림 권한 대화상자를 표시한다
**And** 사용자가 허용하면 시스템은 권한을 획득하고 토큰 획득을 진행한다

**검증 상태**: ✅ **통과 (2026-06-22 PR #41)** — Firebase `sagak-dev` 프로젝트 + `com.sagak.app` 등록, google-services.json 구성 완료. Pixel 6 실기기: `Default FirebaseApp is not initialized` 에러 해소, `getExpoPushTokenAsync` 토큰 획득 성공. N3(권한 허용 → 토큰 획득) 만족.

#### 시나리오 N4: 권한 거부

**Given** 사용자가 알림 권한 대화상자에서 "거부"를 선택한다
**When** 시스템이 권한 요청 결과를 수신한다
**Then** 시스템은 푸시 토큰 획득을 건너뛴다
**And** 알림 센터(인앱 조회)는 계속 동작한다
**And** 사용자에게 권한 거부 에러를 표시하지 않는다 (조용히 처리)

---

### REQ-NOTIF-003: 푸시 토큰 서버 등록

#### 시나리오 N5: 토큰 서버 등록 성공

**Given** 클라이언트가 Expo Push Token을 획득했다
**And** 사용자가 인증되어 있다 (`auth.uid()` 존재)
**When** 시스템이 `registerToken(token)`을 호출한다
**Then** 시스템은 토큰을 현재 사용자 ID와 매핑하여 서버에 저장한다
**And** `send-notification` Edge Function이 해당 사용자에게 푸시를 발송할 수 있게 된다

**검증 상태**: ✅ **통과 (2026-06-22 PR #41)** — PostgREST 21000 코드 21000 "UPDATE requires a WHERE clause" 회귀 수정. `registerPushToken(token, userId)`에 `.eq('id', userId)` WHERE 절 추가 (기존 "RLS만으로 충분" 가정 was wrong — lesson #12). 실기기 userId 01ff8d99-... 사용자 토큰 정상 등록 확인.

#### 시나리오 N6: 토큰 미등록 상태에서 알림 발송

**Given** 사용자 A가 푸시 토큰을 서버에 등록하지 않았다 (권한 거부 또는 미획득)
**When** 도메인 이벤트가 발생하여 `send-notification`이 사용자 A에게 알림을 발송하려 한다
**Then** 시스템은 `notifications` 테이블 INSERT는 수행한다
**And** Expo Push API 호출은 건너뛴다 (토큰 없음)
**And** 사용자 A는 알림 센터에서 해당 알림을 조회할 수 있다

---

### REQ-NOTIF-004: 포그라운드/백그라운드 알림 수신 핸들러

#### 시나리오 N7: 포그라운드 알림 수신

**Given** 사용자가 앱을 포그라운드에서 실행 중이다
**And** `Notifications.setNotificationHandler`가 등록되어 있다
**When** 푸시 알림이 도착한다
**Then** 시스템은 인앱 배너 또는 토스트로 알림을 표시한다
**And** OS 시스템 알림은 표시하지 않는다 (포그라운드 억제)

**검증 상태**: ✅ **통과 (2026-07-22)** — REQ-NOTIF-004 포그라운드 알림 수신 검증 7/7 PASS. N7 해소 조건 4개 전부 완료:
- **(1) keystore 비가역 결정 승인**: ✅ — 사용자 서명 keystore 귀속 승인.
- **(2) prod 빌드**: ✅ — `eas build --platform android --profile production` 실행, Application Identifier + keystore 자동 등록 완료 (빌드 ID `3e8d5511`, AAB 산출).
- **(3) FCM V1 service account key 업로드**: ✅ — `eas credentials` 인터랙티브 메뉴로 sagak-dev 프로젝트 FCM V1 키 업로드 완료.
- **(4) 실기기 검증**: ✅ — prod-internal APK `f4a2e4b3` 실기기 설치 후 포그라운드 알림 수신 수동 검증 체크리스트(plan.md §N7-D) 수행.
- **관측 증거**: `push_sent:true` 응답 + DB INSERT 관측(행 ID 2535584a / 369e23cb) + 포그라운드 heads-up 배너(`shouldShowAlert:true` 동작) + 알림 탭 시 알림센터 라우팅 + 알림센터 조회(앱 재실행 후 오늘 알림 2개 표시, 사용자 확인).
- **빌드 인프라 회귀 정리**: `5a9c3a2`(gitignore) → `9498baf`(eas-build-post-install 미작동) → `a50bdb2`(google-services.json git 추적 회귀).
- **별개 결함 (SPEC-NOTIF-002 이관)**: 알림센터 실시간 갱신 미구현 — (a) Realtime 구독 부재(`src/features/notification/`에서 `channel`/`postgres_changes`/`.on('INSERT')` grep 0건, `channel` 매치는 Android `setNotificationChannelAsync`만), (b) `useNotificationResponse.ts`에서 `invalidateQueries` 미연결(grep 0건), (c) `NotificationsScreen.tsx`가 `ScrollView` 사용 중 `RefreshControl` 부재. N7 자체(REQ-NOTIF-004 포그라운드 수신)는 통과이나, plan.md §N7-D 체크리스트 항목 "알림 센터 목록에 해당 알림이 추가된다(Realtime 또는 재조회)"의 실시간 반영 부분은 미충족(앱 재실행 시에만 `refetchOnMount`로 표시) → 별개 후속 SPEC-NOTIF-002로 분리.

#### 시나리오 N8: 알림 탭 시 딥링크 라우팅

**Given** 사용자가 포그라운드 배너 또는 백그라운드 시스템 알림을 수신했다
**When** 사용자가 알림을 탭한다
**Then** 시스템은 알림의 `type`과 `ref_id`를 추출한다
**And** routeMapper(REQ-NOTIF-009)를 통해 해당 화면으로 라우팅한다

---

### REQ-NOTIF-005: 알림 목록 조회

#### 시나리오 N9: 알림 센터 조회 (정상)

**Given** 인증된 사용자에게 `notifications` 행이 10개 존재한다 (`user_id = auth.uid()`)
**When** 사용자가 알림 센터 화면을 연다
**Then** 시스템은 `GET /rest/v1/notifications`를 호출한다
**And** 10개의 알림을 `created_at DESC` 순으로 반환한다
**And** 각 알림은 `id`, `type`, `title`, `body`, `ref_id`, `is_read`, `created_at`를 포함한다

#### 시나리오 N10: 타인 알림 RLS 차단

**Given** 사용자 A와 사용자 B가 서로 다른 알림을 가지고 있다
**When** 사용자 A가 알림 센터를 조회한다
**Then** 시스템은 사용자 A의 알림만 반환한다 (`auth.uid() = user_id`)
**And** 사용자 B의 알림은 RLS(REQ-DB-021 `notifications_select_own`)로 차단된다
**And** 사용자 B의 알림 행은 결과에 포함되지 않는다

#### 시나리오 N11: 읽지 않은 알림 시각적 구분

**Given** 사용자의 알림 목록에 `is_read = false`인 알림 3개와 `is_read = true`인 알림 5개가 섞여 있다
**When** 알림 센터가 목록을 렌더링한다
**Then** 읽지 않은 알림(`is_read = false`)은 시각적으로 구분된다 (배지, 굵은 글씨, 배경색)
**And** 읽은 알림은 일반 스타일로 표시된다

---

### REQ-NOTIF-006: 읽지 않은 알림 카운트 (배지)

#### 시나리오 N12: 읽지 않은 알림 카운트 조회

**Given** 사용자에게 `is_read = false`인 알림이 4개 존재한다
**When** 시스템이 `useUnreadCount()` 훅을 호출한다
**Then** 시스템은 `notifications` 테이블에서 `user_id = auth.uid()` AND `is_read = false`인 행 개수를 반환한다
**And** 반환값은 `4`이다
**And** 탭바 배지 또는 헤더 아이콘에 `4`가 표시된다

#### 시나리오 N13: 읽지 않은 알림 0건

**Given** 사용자의 모든 알림이 `is_read = true`이다
**When** 시스템이 `useUnreadCount()` 훅을 호출한다
**Then** 반환값은 `0`이다
**And** 배지가 표시되지 않는다

---

### REQ-NOTIF-007: 개별 알림 읽음 처리

#### 시나리오 N14: 알림 탭 시 읽음 처리

**Given** 사용자의 알림 목록에 `id = notif-1`, `is_read = false`인 알림이 있다
**When** 사용자가 해당 알림을 탭한다
**Then** 시스템은 `PATCH /rest/v1/notifications?id=eq.notif-1`을 호출한다
**And** 요청 본문은 `{ "is_read": true }`이다
**And** `notifications` 행의 `is_read`가 `true`로 갱신된다
**And** 읽지 않은 카운트가 1 감소한다

#### 시나리오 N15: 이미 읽은 알림 재탭 (멱등)

**Given** 사용자의 알림 `notif-1`이 이미 `is_read = true`이다
**When** 사용자가 해당 알림을 다시 탭한다
**Then** 시스템은 에러 없이 처리한다 (멱등)
**And** `is_read`는 여전히 `true`이다
**And** 카운트는 변하지 않는다

#### 시나리오 N16: 타인 알림 읽음 처리 차단 (RLS)

**Given** 사용자 A가 사용자 B의 알림 `notif-B1`의 `id`를 알고 있다
**When** 사용자 A가 `PATCH /rest/v1/notifications?id=eq.notif-B1`을 시도한다
**Then** RLS 정책(REQ-DB-021 `notifications_update_own`)이 `auth.uid() = user_id` 조건으로 차단한다
**And** 사용자 B의 알림은 수정되지 않는다
**And** 0행이 갱신된다 (에러 없이 무시)

---

### REQ-NOTIF-008: "모두 읽음" 배치 처리

#### 시나리오 N17: 모두 읽음 일괄 처리

**Given** 사용자에게 `is_read = false`인 알림이 5개 존재한다
**When** 사용자가 "모두 읽음" 버튼을 탭한다
**Then** 시스템은 `PATCH /rest/v1/notifications?user_id=eq.{me}&is_read=eq.false`를 호출한다
**And** 요청 본문은 `{ "is_read": true }`이다
**And** 5개의 행이 일괄적으로 `is_read = true`로 갱신된다
**And** 읽지 않은 카운트가 `0`이 된다

#### 시나리오 N18: 읽지 않은 알림 없음 시 모두 읽음

**Given** 사용자의 모든 알림이 이미 `is_read = true`이다
**When** 사용자가 "모두 읽음" 버튼을 탭한다
**Then** 시스템은 0행을 갱신한다 (에러 없음)
**And** UI는 변하지 않는다

---

### REQ-NOTIF-009: 알림 타입별 딥링크 라우팅

#### 시나리오 N19: reading_reminder 라우팅

**Given** 사용자가 `type = reading_reminder`, `ref_id = user-book-1`인 알림을 탭한다
**When** routeMapper가 호출된다
**Then** 시스템은 현재 읽는 책 서재 화면으로 라우팅한다
**And** `user_book_id = user-book-1` 컨텍스트를 전달한다

#### 시나리오 N20: sticker_received 라우팅

**Given** 사용자가 `type = sticker_received`, `ref_id = record-1`인 알림을 탭한다
**When** routeMapper가 호출된다
**Then** 시스템은 감정 기록 상세 화면으로 라우팅한다
**And** `emotion_record_id = record-1` 컨텍스트를 전달한다

#### 시나리오 N21: completion 라우팅

**Given** 사용자가 `type = completion`, `ref_id = report-1`인 알림을 탭한다
**When** routeMapper가 호출된다
**Then** 시스템은 완독 다이어리 화면으로 라우팅한다
**And** `completion_report_id = report-1` 컨텍스트를 전달한다

#### 시나리오 N22: ref_id 없음 또는 화면 미구현 폴백

**Given** 사용자가 `type = club_signal`, `ref_id = null`인 알림을 탭한다
**Or** 라우팅 대상 화면이 아직 구현되지 않았다
**When** routeMapper가 호출된다
**Then** 시스템은 에러를 표시하지 않고 알림 센터 화면으로 폴백한다

---

### REQ-NOTIF-010: Edge Function 엔드포인트

#### 시나리오 N23: Edge Function 정상 호출

**Given** 도메인 SPEC(예: SPEC-EMOTION-001)의 서버 로직이 알림 발송을 결정했다
**When** 서버 로직이 `POST /functions/send-notification`을 `service_role` 키로 호출한다
**And** 요청 본문은 `{ "user_id": "uuid", "type": "sticker_received", "ref_id": "record-1", "data": {...} }`이다
**Then** Edge Function은 요청을 수신하고 처리를 시작한다
**And** 응답으로 `{ "success": true, "notification_id": "uuid", "push_sent": true }`를 반환한다

#### 시나리오 N24: 클라이언트 직접 호출 차단

**Given** 클라이언트가 `anon_key`만 가지고 있다 (`service_role` 없음)
**When** 클라이언트가 `POST /functions/send-notification`을 호출하려 한다
**Then** Edge Function이 `service_role` 검증을 수행한다
**And** `anon_key` 호출은 거부된다 (인증 실패)
**And** 클라이언트는 알림을 임의로 생성할 수 없다

---

### REQ-NOTIF-011: notifications INSERT (service_role RLS 우회)

#### 시나리오 N25: notifications INSERT 성공

**Given** Edge Function이 유효한 알림 발송 요청을 수신했다
**When** Edge Function이 `notifications` 테이블에 INSERT를 수행한다
**Then** `service_role` 키로 RLS가 우회된다
**And** `notifications` 행이 생성된다 (`is_read = false` 기본값)
**And** 생성된 행의 `id`, `title`, `body`가 템플릿에서 생성된다

#### 시나리오 N26: 잘못된 type ENUM 검증

**Given** Edge Function이 `type = "invalid_type"`인 요청을 수신했다
**When** Edge Function이 `type` ENUM 검증을 수행한다
**Then** 시스템은 INSERT를 거부한다
**And** 400 Bad Request 응답을 반환한다
**And** 에러 메시지는 `"Invalid notification type: invalid_type"`를 포함한다

---

### REQ-NOTIF-012: Expo Push API 호출

#### 시나리오 N27: 푸시 발송 성공

**Given** `notifications` INSERT가 성공했다
**And** 수신자의 Expo Push Token이 서버에 등록되어 있다
**When** Edge Function이 Expo Push API를 호출한다
**Then** 시스템은 `POST https://exp.host/api/v2/push/send`로 페이로드를 전송한다
**And** 페이로드는 `{ to, title, body, data: { notification_id, type, ref_id } }` 구조를 따른다
**And** Expo가 200 OK를 반환하면 `push_sent: true`를 응답한다

#### 시나리오 N28: 토큰 미존재 시 INSERT만 유지

**Given** `notifications` INSERT가 성공했다
**And** 수신자의 Expo Push Token이 서버에 없다 (미등록 또는 권한 거부)
**When** Edge Function이 토큰을 조회한다
**Then** 시스템은 Expo Push API 호출을 건너뛴다
**And** `notifications` INSERT는 유지된다 (롤백 없음)
**And** 응답은 `{ success: true, notification_id, push_sent: false }`이다

#### 시나리오 N29: Expo Push API 에러 시 INSERT 유지

**Given** `notifications` INSERT가 성공했다
**And** 수신자의 Expo Push Token이 존재한다
**When** Edge Function이 Expo Push API를 호출한다
**And** Expo가 에러를 반환한다 (예: `DeviceNotRegistered`)
**Then** 시스템은 에러를 로깅한다
**And** `notifications` INSERT는 롤백하지 않는다 (알림 센터 가용성 우선)
**And** 응답은 `{ success: true, notification_id, push_sent: false, push_error: "..." }`이다

---

### REQ-NOTIF-013: 알림 템플릿 시스템 (6종, 다정한 톤)

#### 시나리오 N30: reading_reminder 템플릿 적용

**Given** Edge Function이 `type = reading_reminder`, `data = { book_title: "데미안", page: 42 }`인 요청을 수신했다
**When** 템플릿 시스템이 `title`/`body`를 생성한다
**Then** `title`은 `"오늘의 첫 페이지가 당신을 기다리고 있어요"`이다
**And** `body`는 `"데미안의 42페이지, 살짝 펼쳐볼까요?""`이다
**And** 강압적 마감 톤이 포함되지 않는다

#### 시나리오 N31: sticker_received 템플릿 적용

**Given** Edge Function이 `type = sticker_received`, `data = { reactor_nickname: "책벌레", sticker_type: "empathy" }`인 요청을 수신했다
**When** 템플릿 시스템이 `title`/`body`를 생성한다
**Then** `title`은 `"당신의 기록에 공감 스티커가 도착했어요"`이다
**And** `body`는 `"책벌레님이 empathy 반응을 남겼어요"`이다

#### 시나리오 N32: completion 템플릿 적용

**Given** Edge Function이 `type = completion`, `data = { book_title: "데미안", total_records: 15 }`인 요청을 수신했다
**When** 템플릿 시스템이 `title`/`body`를 생성한다
**Then** `title`은 `"완독을 축하해요! 당신만의 다이어리가 완성됐어요"`이다
**And** `body`는 `"'데미안'과의 여정, 15개의 감정 기록이 모였어요"`이다

#### 시나리오 N33: 템플릿 변수 누락 처리

**Given** Edge Function이 `type = reading_reminder`, `data = {}`인 요청을 수신했다 (변수 누락)
**When** 템플릿 시스템이 `title`/`body`를 생성한다
**Then** 시스템은 누락된 변수를 기본값(빈 문자열 또는 플레이스홀더)으로 치환한다
**And** 에러를 발생시키지 않는다 (graceful degradation)

---

## 2. 품질 게이트 (Quality Gates)

### TRUST 5 검증

| 기둥 | 기준 | 검증 방법 |
|------|------|-----------|
| Tested | 85%+ 코드 커버리지 | Jest + @testing-library/react-native (클라이언트), Deno test (Edge Function), 모든 시나리오 N1-N33 단위/통합 테스트 |
| Readable | 명확한命名, 영어 주석 | ESLint, 코드 리뷰, 한국어 문서화 주석은 code_comments 설정(ko) 준수 |
| Unified | 일관된 스타일 | Prettier, ESLint 규칙, tokens.ts 기반 스타일링 (색/간격 하드코딩 금지) |
| Secured | RLS 의존, service_role 서버 전용 | RLS 정책 검증 테스트(N10, N16), service_role 키 클라이언트 노출 없음 검증(N24) |
| Trackable | Conventional commits, SPEC 참조 | `feature/SPEC-NOTIF-001-push-notifications` 브랜치, 커밋 메시지에 REQ-NOTIF-XXX 참조 |

### LSP 품질 게이트 (run 단계)

- 0 에러, 0 타입 에러, 0 린트 에러 (TypeScript strict)
- Edge Function Deno 타입 검증 통과
- `routeMapper`의 exhaustive switch 검증 (6종 type + default 폴백)
- `Notifications.setNotificationHandler` useEffect cleanup 검증 (메모리 누수 방지)

### 보안 검증

- `service_role` 키가 클라이언트 번들에 포함되지 않음 확인 (빌드 산출물 grep)
- Edge Function이 `anon_key` 호출을 거부함 확인 (N24)
- 클라이언트가 `notifications` INSERT를 수행할 수 없음 확인 (RLS 정책에 INSERT 없음)

---

## 3. 검증 방법 및 도구

### 3.1 단위 테스트

- **queries**: PostgREST 쿼리 빌더 검증 — N9, N10 시나리오
- **markAsRead/markAllAsRead**: 읽음 처리 로직 — N14, N15, N17 시나리오
- **useUnreadCount**: 카운트 쿼리 — N12, N13 시나리오
- **routeMapper**: type별 라우팅 맵 — N19, N20, N21, N22 시나리오
- **templates (Edge Function)**: 6종 템플릿 변수 치환 — N30, N31, N32, N33 시나리오
- **expo-push (Edge Function)**: Expo Push API 페이로드 구성 — N27 시나리오

### 3.2 통합 테스트

- **RLS 검증**: Supabase 로컬 개발 환경에서 사용자 A 세션으로 사용자 B 알림 조회 시 빈 결과 확인 — N10
- **RLS UPDATE 검증**: 사용자 A가 사용자 B 알림 읽음 처리 시 0행 갱신 확인 — N16
- **Edge Function E2E**: `service_role`로 `send-notification` 호출 → notifications INSERT + Expo Push API 호출(모킹) 확인 — N23, N25, N27
- **ENUM 검증**: 잘못된 type 전송 시 400 반환 확인 — N26

### 3.3 수동 검증 (실기기)

- **Expo Push Token 획득**: 실기기 로그인 후 토큰 획득 — N1: ✅ **통과 (2026-06-22 PR #41)** — Pixel 6: `getExpoPushTokenAsync` 토큰 반환 성공. google-services.json + `expo.android.googleServicesFile` 구성 완료.
- **포그라운드 알림 수신**: 앱 실행 중 푸시 도착 시 인앱 배너 — N7: ✅ **통과 (2026-07-22)** — FCM V1 service account key 업로드(sagak-dev, `eas credentials` 인터랙티브) + prod-internal APK `f4a2e4b3` 실기기 검증 7/7 PASS. 관측 증거: `push_sent:true` 응답 + DB INSERT(행 ID 2535584a/369e23cb) + 포그라운드 heads-up 배너(`shouldShowAlert:true`) + 알림 탭 시 알림센터 라우팅. 단, **알림센터 실시간 갱신**은 별개 결함(Realtime 구독 부재 + invalidateQueries 미연결 + RefreshControl 부재)으로 후속 SPEC-NOTIF-002 이관.
- **백그라운드 알림 수신**: 시스템 알림 표시: ✅ **통과 (2026-07-22)** — 동일 전제(N7)로 활성화. FCM V1 key + Application Identifier 등록 완료로 백그라운드 시스템 알림 수신 자동 활성화 (N7 검증 경로와 동일 크리덴셜 전제).
- **알림 탭 라우팅**: 알림 탭 시 화면 이동 — N19-N22: 단위 테스트 커버
- **권한 거부 폴백**: 알림 권한 거부 후 알림 센터 동작 — N4: ✅ **통과**(빈 알림 센터 정상 조회, silent failure, 크래시 없음)
- **서버 등록**: 실기기 userId 01ff8d99-... 토큰 등록 확인 — N5: ✅ **통과 (2026-06-22 PR #41)** — users.push_token UPDATE 성공. PostgREST 21000 WHERE 절 수정 적용.

---

## 4. Definition of Done (완료 정의)

- [ ] 시나리오 N1-N33 모두 통과
- [ ] 단위 테스트 커버리지 85%+
- [ ] RLS 정책이 타인 알림 접근을 차단함을 통합 테스트로 검증 (N10, N16)
- [ ] Edge Function이 `service_role`로 notifications INSERT를 수행함을 검증 (N25)
- [ ] `type` ENUM 6종 검증이 동작함을 검증 (N26)
- [ ] Expo Push API 호출이 실기기에서 동작함을 검증 (N27)
- [ ] 6종 템플릿이 다정한 톤으로 생성됨을 검증 (N30-N33)
- [ ] type별 딥링크 라우팅이 동작함을 검증 (N19-N22)
- [ ] 클라이언트가 `service_role` 키를 갖지 않음을 검증 (N24)
- [ ] 다크모드 지원 확인 (알림 센터 화면)
- [ ] TRUST 5 모든 기둥 통과
- [ ] LSP 게이트 0 에러
- [ ] conventional commits + SPEC 참조

---

## 5. 추적성

| 시나리오 | REQ | 검증 유형 |
|----------|-----|-----------|
| N1 | REQ-NOTIF-001 | 단위 (토큰 획득 성공) |
| N2 | REQ-NOTIF-001 | 단위 (토큰 획득 실패) |
| N3 | REQ-NOTIF-002 | 수동 (권한 허용) |
| N4 | REQ-NOTIF-002 | 수동 (권한 거부) |
| N5 | REQ-NOTIF-003 | 통합 (토큰 등록) |
| N6 | REQ-NOTIF-003 | 통합 (토큰 미등록) |
| N7 | REQ-NOTIF-004 | 수동 (포그라운드 수신) ✅ 통과 (2026-07-22) |
| N8 | REQ-NOTIF-004 | 통합 (알림 탭 라우팅) |
| N9 | REQ-NOTIF-005 | 통합 (목록 조회) |
| N10 | REQ-NOTIF-005 | 통합 (RLS 차단) |
| N11 | REQ-NOTIF-005 | 단위 (읽음 시각 구분) |
| N12 | REQ-NOTIF-006 | 단위 (카운트 조회) |
| N13 | REQ-NOTIF-006 | 단위 (카운트 0) |
| N14 | REQ-NOTIF-007 | 통합 (읽음 처리) |
| N15 | REQ-NOTIF-007 | 단위 (멱등) |
| N16 | REQ-NOTIF-007 | 통합 (RLS UPDATE 차단) |
| N17 | REQ-NOTIF-008 | 통합 (모두 읽음) |
| N18 | REQ-NOTIF-008 | 단위 (빈 배치) |
| N19 | REQ-NOTIF-009 | 단위 (reading_reminder 라우팅) |
| N20 | REQ-NOTIF-009 | 단위 (sticker_received 라우팅) |
| N21 | REQ-NOTIF-009 | 단위 (completion 라우팅) |
| N22 | REQ-NOTIF-009 | 단위 (폴백) |
| N23 | REQ-NOTIF-010 | 통합 (Edge Function 호출) |
| N24 | REQ-NOTIF-010 | 통합 (클라이언트 차단) |
| N25 | REQ-NOTIF-011 | 통합 (INSERT 성공) |
| N26 | REQ-NOTIF-011 | 단위 (ENUM 검증) |
| N27 | REQ-NOTIF-012 | 통합 (푸시 발송 성공) |
| N28 | REQ-NOTIF-012 | 통합 (토큰 미존재) |
| N29 | REQ-NOTIF-012 | 통합 (Expo 에러 시 INSERT 유지) |
| N30 | REQ-NOTIF-013 | 단위 (reading_reminder 템플릿) |
| N31 | REQ-NOTIF-013 | 단위 (sticker_received 템플릿) |
| N32 | REQ-NOTIF-013 | 단위 (completion 템플릿) |
| N33 | REQ-NOTIF-013 | 단위 (변수 누락 처리) |
