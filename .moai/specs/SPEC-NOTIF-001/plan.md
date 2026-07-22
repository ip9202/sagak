---
id: SPEC-NOTIF-001
title: "푸시 알림 및 알림 센터 — 구현 계획"
version: "1.0.0"
status: implemented
created: 2026-06-14
updated: 2026-07-20
author: "강력쇠주먹"
priority: medium
issue_number: 0
labels: [notif, push, expo-push, notification-center, edge-function, supabase, phase-4, plan]
---

> **업데이트 (2026-06-21)**: Optional Goal (3순위) 구현 완료. PR #38에서 REQ-NOTIF-001~004 (Expo Push Token 획득·권한·서버 등록·포그라운드 핸들러) 병격. 4개 신규 소스 파일(`registerToken.ts`, `registerForPush.ts`, `usePushTokenRegistration.ts`, `useNotificationResponse.ts`) + 4개 테스트 + mock 추가. tsc 0 errors, jest 1136/1136 pass, lint 0 errors, TRUST 5 5/5. Primary Goal (CENTER/SEND)는 PR #34에서 이미 완료됨.
>
> **업데이트 (2026-07-20)**: N7 사전 준비 정리 (feature/SPEC-NOTIF-001-n7-prep 브랜치). eas-cli 21.x FCM V1 CLI 지원 재검증 완료 — v7.2.0(2024-02-11)#2197부터 `eas credentials` 인터랙티브 메뉴로 Service Account Key 업로드 지원. lesson #13 "20.x FCM V1 CLI 불가" 정정 (CLI 자체는 가능, 실제 블로커는 Application Identifier 최초 등록 시 keystore 강제). Optional Goal 섹션에 N7 실행 절차(사용자 승인 대기) 추가.

# SPEC-NOTIF-001: 구현 계획 (plan.md)

## HISTORY

| 날짜 | 버전 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 2026-06-14 | 1.0.0 | 최초 작성 — 3개 마일스톤, 기술 접근, 아키텍처 방향, 리스크 대응 | 강력쇠주먹 |

---

## 1. 마일스톤 (우선순위 기반)

> 본 계획은 시간 예측을 사용하지 않으며, 우선순위 기반 마일스톤으로 진행 순서를 정의한다.

### Primary Goal (1순위): 알림 센터 조회 + 읽음 처리

**범위**: REQ-NOTIF-CENTER (REQ-NOTIF-005 ~ REQ-NOTIF-009)

**산출물**:
- `src/features/notification/queries.ts` — `GET /rest/v1/notifications` 쿼리 함수 (PostgREST 직접 호출)
- `src/features/notification/useNotifications.ts` — 알림 목록 조회 훅 (초기 로드 + 페이지네이션)
- `src/features/notification/useUnreadCount.ts` — 읽지 않은 알림 카운트 훅 (배지용)
- `src/features/notification/markAsRead.ts` — 개별 알림 읽음 처리 함수
- `src/features/notification/markAllAsRead.ts` — "모두 읽음" 배치 처리 함수
- `src/features/notification/routeMapper.ts` — type별 딥링크 라우팅 매퍼
- `src/features/notification/types.ts` — Notification, NotificationType 타입
- 알림 센터 화면 (`app/(tabs)/notifications/index.tsx` 또는 유사 경로)

**완료 기준**:
- 인증된 사용자가 자신의 알림 목록을 조회할 수 있다
- 타인의 알림은 RLS로 차단된다 (REQ-DB-021 검증)
- 읽지 않은 알림 개수가 배지에 표시된다
- 개별 알림 탭 시 `is_read`가 `true`로 갱신된다
- "모두 읽음" 버튼으로 일괄 처리된다
- type별 딥링크 라우팅이 동작한다

**의존성 완료 조건**: SPEC-API-001 (Supabase 클라이언트), SPEC-AUTH-001 (인증), SPEC-NAV-001 (라우팅)

### Secondary Goal (2순위): send-notification Edge Function + 템플릿

**범위**: REQ-NOTIF-SEND (REQ-NOTIF-010 ~ REQ-NOTIF-013)

**산출물**:
- `supabase/functions/send-notification/index.ts` — Edge Function 엔드포인트
- `supabase/functions/send-notification/templates.ts` — 6종 type별 템플릿 시스템 (다정한 톤)
- `supabase/functions/send-notification/expo-push.ts` — Expo Push API 호출 로직
- Edge Function 배포 스크립트 (`supabase functions deploy send-notification`)
- Edge Function 단위 테스트 (Deno test)

**완료 기준**:
- `POST /functions/send-notification`이 `service_role`로 호출된다
- `notifications` INSERT가 RLS 우회로 수행된다 (service_role)
- `type` ENUM 6종 검증이 동작한다 (잘못된 type 시 400)
- Expo Push API로 푸시가 발송된다 (토큰 존재 시)
- 토큰 미존재 시 INSERT만 유지된다
- 6종 템플릿이 다정한 톤으로 생성된다
- 각 도메인 SPEC(ROUTINE/CLUB/EMOTION/COMPLETION)이 이 함수를 호출할 수 있다

**의존성 완료 조건**: Primary Goal 완료, SPEC-DB-001 (notifications 테이블, RLS)

### Optional Goal (3순위): Expo Push 통합 + 미결정 해결

**범위**: REQ-NOTIF-PUSH (REQ-NOTIF-001 ~ REQ-NOTIF-004) + 미결정 사항 해결

**산출물**:
- `src/features/notification/registerForPush.ts` — Expo Push Token 획득 + 권한 요청 함수
- `src/features/notification/usePushNotification.ts` — 포그라운드 알림 수신 훅
- `src/features/notification/registerToken.ts` — 토큰 서버 등록 함수
- `app.config.ts` — `expo-notifications` 플러그인 설정
- 미결정 6.1 해결: 푸시 토큰 저장 위치 결정 (users 확장 vs 별도 테이블)
- 미결정 6.2 해결: 알림 보관 주기 정책 문서화
- 미결정 6.4 해결: 알림 설정 스키마 초안

**완료 기준**:
- Expo Push Token이 클라이언트에서 획득되어 서버에 등록된다
- 포그라운드 푸시 수신 시 인앱 배너가 표시된다
- 권한 거부 시 알림 센터는 계속 동작한다
- 푸시 탭 시 type별 라우팅이 동작한다
- 미결정 사항 3건이 해결 상태로 업데이트된다

**의존성 완료 조건**: Secondary Goal 완료, 실기기 테스트 환경(Expo Go 또는 development build)

**구현 완료 (2026-06-21 PR #38)**:
- 4개 신규 소스 파일 구현 완료: `registerToken.ts`, `registerForPush.ts`, `usePushTokenRegistration.ts`, `useNotificationResponse.ts`
- 4개 테스트 파일 + mock 추가
- 자동화 검증 N1(token 성공), N2(token 실패 silent), N5(서버 등록), N8(탭 라우팅) 통과
- 수동 검증 N3(권한 허용), N4(권한 거부), N7(포그라운드 수신) 대기 중 (실기기 필요)
- TRUST 5 5/5, tsc 0 errors, jest 1136/1136 pass, lint 0 errors

#### N7 사전 검증 절차 (2026-07-20 사전 준비 — 사용자 승인 대기)

> 본 절차는 REQ-NOTIF-004 포그라운드 알림 수신 수동 검증(N7)을 prod 첫 EAS 빌드 시점에 수행하기 위한 사전 준비 결과를 정리한다. 코드 구현은 완료되었으나 크리덴셜/빌드 파이프라인 미비로 ⏳ 상태 유지.

**A. eas-cli 21.x FCM V1 CLI 지원 재검증 (lesson #13 정정)**

- **검증 방법**: eas-cli 공식 CHANGELOG.md(raw.githubusercontent.com/expo/eas-cli/main/CHANGELOG.md) + Expo 공식 문서(docs.expo.dev/push-notifications/fcm-credentials/) 교차 검증. lessons #14(외부 문서는 설치된 패키지로 교차) 적용.
- **검증 결과**: eas-cli v7.2.0 (2024-02-11) PR #2197 (by @christopherwalter)에서 FCM V1 Service Account Key CLI 설정 지원이 추가됨. 21.0.2는 v7.2.0 이후 버전이므로 당연히 포함.
- **CLI 경로**(공식 문서 기준):
  ```
  eas credentials
  → Android > production > Google Service Account
  → Manage your Google Service Account Key for Push Notifications (FCM V1)
  → Set up a Google Service Account Key for Push Notifications (FCM V1) > Upload a new service account key
  ```
  로컬에 JSON 파일이 있으면 자동 감지, `Y`로 업로드.
- **lesson #13 정정**: 기존 "eas-cli 20.x FCM V1 CLI 불가" 진술은 부분 정정. `eas credentials` 인터랙티브 메뉴는 20.x에서도 동일하게 동작하며, 7.2.0+ 기본 탑재 기능. 실제 N7 블로커는 CLI 지원 부재가 아니라 **Application Identifier 최초 등록 시 keystore(.jks/.p12) 업로드 강제** (대시보드 New Application Identifier 마법사 Step 3/5, Generate/Skip 불가). 이는 FCM V1 설정과는 별개 문제로, 첫 EAS prod 빌드 시점에 자동 해소됨.

**B. keystore 강제 생성 — 비가역성 경고 (사용자 승인 필수)**

> [HARD] 아직 사용자 승인 미확보 상태. prod 첫 EAS 빌드 실행 전 반드시 아래 비가역성을 사용자에게 명시하고 승인받을 것.

- **비가역 귀속**: 첫 EAS prod 빌드 시 EAS가 자동 생성하는 Android keystore(또는 사용자가 업로드하는 keystore)는 prod 서명키로 영구 귀속됨. Play Store에 한 번 서명된 앱은 동일 package name에 대해 다른 keystore로 교체 불가 (Google Play App Signing에 의존하지 않는 한).
- **백업 책임**: keystore 비밀번호 + `.jks`/`.p12` 파일은 안전한 별도 보관(사용자 확보 항목). 분실 시 앱을 새 package name으로 재출시해야 함.
- **사용자 승인 포인트**: prod 첫 EAS 빌드 실행 명령(`eas build --platform android --profile production`)을 내리기 전, "이 빌드는 prod 서명키를 영구 귀속시킵니다. keystore 백업 책임이 사용자에게 있습니다"를 명시하고 승인받을 것. (이 문서는 절차만 안내하며, 실제 빌드 실행 권한은 사용자에게 있음 — 본 세션에서 실행하지 않음.)

**C. prod 빌드 실행 옵션 비교 (클라우드 vs 로컬)**

| 옵션 | 명령 | keystore 처리 | google-services.json 처리 | 비고 |
|------|------|---------------|---------------------------|------|
| EAS 클라우드 빌드 | `eas build --platform android --profile production` | EAS가 자동 생성 (원격 저장) | EAS Secrets로 업로드 필요 (gitignore 대상이므로) | 권장 — identifier + FCM V1 자동 연계 |
| 로컬 빌드 | `eas build --platform android --profile production --local` | 로컬 keystore 파일 직접 지정 (또는 새 생성) | 로컬 `android/app/google-services.json` 그대로 사용 | 클라우드 빌드 회피 시 선택. 단, identifier 등록은 여전히 EAS 서버 필요 |

- **google-services.json gitignore 제약**: 현재 `.gitignore` 추적 제외 상태. EAS 클라우드 빌드는 소스 tarball에 이 파일이 누락되므로, **EAS Secrets** 또는 **환경 변수 주입**으로 대체해야 함. 해법:
  1. EAS Secrets에 `google-services.json` 내용을 base64로 등록 → `eas-build` post-install hook에서 복원 (일반적 패턴)
  2. 또는 `app.json`의 `expo.android.googleServicesFile`을 동적 경로로 지정 후, 빌드 시 secret에서 파일로 덤프
- **Firebase Service Account Key (FCM V1)**: prod용 JSON 파일은 사용자가 별도 보관 중. `eas credentials` 실행 시 로컬에서 자동 감지되도록 빌드 머신(또는 로컬 실행 머신)에 배치.

**D. 수동 검증 체크리스트 (N7 포그라운드 수신)**

prod 빌드 실기기 설치 후 아래 단계 수행:

1. **사전 조건 확인**: `eas credentials` → Android > production 경로에서 FCM V1 service account key 등록 완료 상태 (CLI 경로 A 참조)
2. **prod 빌드 설치**: `eas build:run` 또는 생성된 APK/AAB 실기기 사이드로드
3. **앱 실행**: 로그인 → 알림 권한 허용 → Expo Push Token 획득 (N3 절차와 동일)
4. **토큰 서버 등록 확인**: Supabase `users.push_token` UPDATE 정상 (N5)
5. **포그라운드 상태 유지**: 앱을 띄운 상태에서 기기 홈으로 나가지 않음
6. **푸시 발송 트리거**: 서버에서 `send-notification` Edge Function 호출 (curl/Supabase Studio) — `type: "reading_reminder"` 등
7. **검증 항목** (2026-07-22 실기기 검증 결과 — prod-internal APK `f4a2e4b3`):
   - [x] 인앱 배너가 표시된다 (`Notifications.setNotificationHandler`의 `shouldShowAlert: true` 동작) — ✅ 포그라운드 heads-up 배너 관측
   - [x] 시스템 알림은 표시되지 않는다 (포그라운드 억제) — ✅
   - [x] 알림 탭 시 routeMapper가 type에 맞는 화면으로 라우팅한다 (N8과 동일) — ✅ 알림센터 라우팅 관측
   - [~] 알림 센터 목록에 해당 알림이 추가된다 (Realtime 또는 재조회) — **부분 통과**: DB INSERT는 ✅(행 2535584a/369e23cb 관측), 단 **실시간 반영 ❌** — 앱 재실행 시에만 `refetchOnMount`로 표시. 원인: Realtime 구독 부재 + `useNotificationResponse` invalidateQueries 미연결 + RefreshControl 부재. **→ 별개 후속 SPEC-NOTIF-002로 이관** (REQ-NOTIF2-001/002/003)
8. **실패 시 롤백**: 검증 실패 시 `Notifications.setNotificationHandler` 설정 점검 → 재검증. 크리덴셜 문제라면 `eas credentials`에서 FCM V1 키 재확인.

**E. EAS Secrets 구성 패턴 (placeholder만 — 실제 값은 사용자 주입)**

> 본 섹션은 구조/절차만 안내한다. 실제 크리덴셜 값은 다루지 않는다 (사용자 확보 후 주입).

```bash
# 1) EAS 로그인 (사용자 실행)
eas whoami   # 인증 상태 확인
eas login    # 미인증 시

# 2) prod env 변수 주입 (placeholder)
eas env:push --environment production <<EOF
EXPO_PUBLIC_SUPABASE_URL=<prod-supabase-url>
EXPO_PUBLIC_SUPABASE_ANON_KEY=<prod-anon-key>
# 그 외 prod 전용 변수
EOF

# 3) google-services.json EAS Secret 등록 (base64 인코딩 후)
base64 -i android/app/google-services.json | eas secret:push --name GOOGLE_SERVICES_JSON_B64 --stdin

# 4) FCM V1 service account key 업로드 (eas credentials 인터랙티브)
eas credentials
# → Android > production > Google Service Account > FCM V1 > Upload new key
# (로컬에 prod-firebase-service-account.json 배치 후 자동 감지)

# 5) prod 빌드 (사용자 승인 후 실행)
eas build --platform android --profile production
```

**F. 의존성**

- `eas-cli` 21.x로 업그레이드 권장 (사용자 실행 — `npm install -g eas-cli`). 20.x에서도 `eas credentials` 인터랙티브 FCM V1 경로는 동작하지만, 21.x의 버그 픽스(tmp 디렉토리 정리, 보안 의존성 업데이트)가 포함됨. 본 세션에서는 업그레이드 실행하지 않음.
- Firebase Service Account Key (prod용 JSON): 사용자가 별도 보관 중. 빌드 머신에 배치 시 `eas credentials` 자동 감지.
- `google-services.json` (prod): `android/app/` 로컬 존재 (gitignore). EAS 클라우드 빌드 시에는 EAS Secrets로 우회.

---

## 2. 기술 접근 (Technical Approach)

### 2.1 알림 센터 데이터 계층

- **PostgREST 직접 호출**: `GET /rest/v1/notifications`는 클라이언트에서 PostgREST 쿼리로 구성한다.
  별도 Edge Function은 두지 않는다 (제외 범위 5).
- **쿼리 구조**:
  - 알림 목록: `notifications` SELECT where `user_id=eq.{auth.uid()}` order by `created_at DESC`
  - 읽지 않은 카운트: `notifications` SELECT where `user_id=eq.{me}` AND `is_read=eq.false` (PostgREST `Prefer: count=exact` 헤더)
  - 개별 읽음: `PATCH /rest/v1/notifications?id=eq.{id}` body `{ is_read: true }`
  - 모두 읽음: `PATCH /rest/v1/notifications?user_id=eq.{me}&is_read=eq.false` body `{ is_read: true }`
- **인덱스 활용**: `(user_id, is_read)` 인덱스(SPEC-DB-001)로 카운트 및 필터링 최적화.
- **권한**: RLS(REQ-DB-021)가 단독 검증. 클라이언트는 권한 로직 미구현.

### 2.2 Edge Function 계층 (send-notification)

- **런타임**: Deno (Supabase Edge Functions)
- **인증**: `service_role` 키 (환경 변수 `SUPABASE_SERVICE_ROLE_KEY`) — RLS 우회
- **요청 검증**: `type` ENUM 6종 검증, `user_id` UUID 검증, 필수 필드 확인
- **처리 순서**:
  1. 요청 파싱 및 검증 (type, user_id, ref_id, data)
  2. 템플릿 적용: `data` 변수 치환으로 `title`/`body` 생성 (REQ-NOTIF-013)
  3. `notifications` INSERT (service_role, RLS 우회)
  4. 수신자 Expo Push Token 조회 (`users` 테이블 또는 토큰 저장소)
  5. 토큰 존재 시 Expo Push API 호출 (`POST https://exp.host/api/v2/push/send`)
  6. 토큰 미존재 시 INSERT만 유지 (알림 센터 가용성 우선)
  7. Expo API 에러 시 로깅 후 INSERT 유지 (롤백 없음)
- **응답**: `{ success: true, notification_id, push_sent: boolean }` 또는 `{ success: false, error }`

### 2.3 Expo Push API 연동

- **엔드포인트**: `POST https://exp.host/api/v2/push/send`
- **헤더**: `Content-Type: application/json`, `Accept: application/json`
- **페이로드**:
  ```json
  {
    "to": "ExponentPushToken[...]",
    "title": "...",
    "body": "...",
    "data": { "notification_id": "uuid", "type": "reading_reminder", "ref_id": "uuid" },
    "sound": "default",
    "_displayInForeground": false
  }
  ```
- **에러 처리**: Expo가 반환하는 `errors` 배열의 `code`를 로깅. 만료 토큰(`DeviceNotRegistered`)은
  토큰 저장소에서 제거하는 후속 처리 검토 (MVP에서는 로깅만).

### 2.4 템플릿 시스템 (다정한 톤)

- **구현**: `templates.ts`에 6종 type별 템플릿 함수를 정의.
- **변수 치환**: `{book_title}`, `{page}`, `{requester_nickname}`, `{club_title}`,
  `{reactor_nickname}`, `{sticker_type}`, `{total_records}`, `{signal_count}` 등.
- **톤 검증**: 강압적 마감 톤 금지. 다정한 권유, 따봉, 축하 톤만 허용 (product.md 시나리오 1).
- **확장성**: 새로운 type 추가 시 ENUM 마이그레이션(SPEC-DB-001) + 템플릿 함수 추가.

### 2.5 상태 관리

- **알림 목록 캐싱**: React Query(TanStack Query) 또는 로컬 상태로 알림 목록 캐싱.
  - 읽음 처리 후 optimistic update (UI 즉시 반영, 실패 시 롤백)
  - "모두 읽음" 후 전체 목록 invalidate
- **읽지 않은 카운트**: 별도 쿼리로 관리, 읽음 처리 시 decrement
- **포그라운드 푸시**: `Notifications.setNotificationHandler`로 수신, 알림 센터 목록에 추가

---

## 3. 아키텍처 설계 방향

### 3.1 모듈 구조

```
src/features/notification/
  queries.ts              # PostgREST 쿼리 함수 (GET/PATCH notifications)
  useNotifications.ts     # 알림 목록 조회 훅 (초기 로드 + 페이지네이션)
  useUnreadCount.ts       # 읽지 않은 알림 카운트 훅
  markAsRead.ts           # 개별 읽음 처리 함수
  markAllAsRead.ts        # "모두 읽음" 배치 처리 함수
  routeMapper.ts          # type별 딥링크 라우팅 매퍼
  registerForPush.ts      # Expo Push Token 획득 + 권한 요청
  registerToken.ts        # 토큰 서버 등록 함수
  usePushNotification.ts  # 포그라운드 알림 수신 훅
  types.ts                # Notification, NotificationType 타입
  index.ts                # 공개 API

supabase/functions/send-notification/
  index.ts                # Edge Function 엔드포인트 (service_role)
  templates.ts            # 6종 type별 템플릿 (다정한 톤)
  expo-push.ts            # Expo Push API 호출 로직
```

### 3.2 데이터 흐름

```
[도메인 이벤트 발생] (각 도메인 SPEC)
  예: 완독 처리 (SPEC-COMPLETION-001)
  예: 스티커 수신 (SPEC-EMOTION-001)
  예: 가입 요청 수신 (SPEC-CLUB-001)
  예: 독서 알림 시간 (SPEC-ROUTINE-001)
  → 서버 로직이 send-notification Edge Function 호출 (service_role)
  → notifications INSERT (RLS 우회)
  → Expo Push API 호출 (토큰 존재 시)
  → 사용자 기기에 푸시 도착

[사용자 알림 확인]
  → 알림 센터 화면 (GET /rest/v1/notifications)
  → 알림 탭 → type별 라우팅 (routeMapper)
  → 읽음 처리 (PATCH notifications, is_read = true)
  → 배지 카운트 갱신

[포그라운드 푸시 수신]
  → Notifications.setNotificationHandler 수신
  → 인앱 배너 표시
  → 알림 센터 목록에 추가 (Realtime 또는 재조회)
```

### 3.3 RLS 및 인덱스 연동

- **조회 권한**: RLS(REQ-DB-021 `notifications_select_own`)가 `auth.uid() = user_id` 조건으로
  타인 알림 자동 차단.
- **읽음 처리 권한**: RLS(REQ-DB-021 `notifications_update_own`)가 `auth.uid() = user_id` 조건으로
  본인 알림만 `is_read` 업데이트 허용.
- **INSERT 경로**: 클라이언트 INSERT 정책 없음. `send-notification` Edge Function이
  `service_role`로 RLS 우회 INSERT (유일한 생성 경로).
- **조회 성능**: 인덱스 `(user_id, is_read)`로 카운트 및 읽음 여부 필터링 최적화.

---

## 4. 리스크 및 대응 계획

### 리스크 1: Expo Push Token 만료/무효화

**위험**: 사용자가 앱 삭제, 기기 교체, 알림 권한 취소 시 기존 토큰이 무효화되어 푸시 발송 실패.

**대응**: `send-notification` Edge Function이 Expo Push API 에러 응답(`DeviceNotRegistered`)을
수신하면, 해당 토큰을 `users` 테이블에서 NULL로 처리(또는 별도 테이블에서 삭제). 클라이언트는
앱 재실행 시 토큰 재획득 및 재등록 시도. MVP에서는 에러 로깅만 수행, 토큰 정리는 후순위.

### 리스크 2: 포그라운드/백그라운드 알림 중복

**위험**: 포그라운드 상태에서 푸시 수신 시, 인앱 배너와 시스템 알림이 중복 표시될 수 있다.

**대응**: `Notifications.setNotificationHandler`의 `handleNotification` 콜백에서
`shouldShowAlert: true`, `shouldPlaySound: true`, `shouldSetBadge: true`을 설정하여
포그라운드에서는 인앱 배너만 표시 (OS 시스템 알림은 억제). 백그라운드에서는 OS 기본 동작.

### 리스크 3: Edge Function service_role 키 노출

**위험**: `service_role` 키가 클라이언트에 노출되면 모든 RLS가 우회되어 보안 사고 발생.

**대응**: `service_role` 키는 Edge Function 환경 변수(`SUPABASE_SERVICE_ROLE_KEY`)로만 주입.
클라이언트는 절대 `service_role` 키를 갖지 않는다 (SPEC-DB-001 가정 2.1.2, SPEC-API-001
가정 2.1.2). `.env` 파일은 `.gitignore` 추가, `.env.example`만 커밋.

### 리스크 4: 알림 과다 발송 (사용자 피로)

**위험**: tech.md "푸시 알림 과다 피로"(pages_03 5.1)가 지적한 위험. 스티커마다, 가입 요청마다
푸시가 발송되면 사용자가 알림을 끄게 된다.

**대응**:
- 다정한 톤 유지 (강압적 마감 금지)
- 알림 설정 UI로 type별 수신 토글 제공 (미결정 6.4 해결 시)
- `reading_reminder`는 하루 1회 제한 (SPEC-ROUTINE-001 트리거에서 제어)
- MVP에서는 모든 알림이 기본 활성화, 사용자가 비활성화 가능

### 리스크 5: 클럽 시그널(club_signal) 타입 미구현

**위험**: ENUM에 `club_signal`이 정의되어 있으나(pages_03 5.2.3 확장 단계), MVP에서 발송
로직이 없다. 이 타입의 알림이 도착하면 라우팅/표시가 불가능할 수 있다.

**대응**: routeMapper(REQ-NOTIF-009)에 `club_signal` 케이스를 포함하여, 확장 단계에서
발송되더라도 알림 센터에 표시되도록 전방향 호환성 확보. MVP에서는 발송 미구현, 표시만 지원.

---

## 5. 제외 범위 (구현하지 않을 항목)

본 계획은 spec.md 제외 범위를 준수한다. 추가로 다음을 구현하지 않는다:

1. **알림 발송 트리거 로직**: 각 도메인 SPEC(SPEC-ROUTINE-001, SPEC-CLUB-001,
   SPEC-EMOTION-001, SPEC-COMPLETION-001)이 담당. 본 SPEC은 `send-notification` 인프라만 제공.
2. **Expo Push API 티켓 영속화**: Expo 응답의 `ticket` ID를 DB에 저장하는 로직은 후순위.
3. **만료 토큰 자동 정리 배치**: pg_cron 또는 스케줄 함수로 무효 토큰을 정리하는 로직은 후순위.
4. **알림 설정 상세 UI**: type별 수신 토글 UI는 SPEC-PROFILE-001 알림 설정 섹션에서 처리.
5. **오프라인 알림 큐잉**: 네트워크 단절 시 알림 발송을 큐잉했다가 재전송하는 로직은 MVP 범위 밖.

---

## 6. 완료 정의 (Definition of Done)

- [ ] REQ-NOTIF-001 ~ REQ-NOTIF-013 모든 요구사항 구현
- [ ] acceptance.md 모든 시나리오 통과
- [ ] TRUST 5 품질 게이트 통과 (테스트 커버리지 85%+)
- [ ] RLS 정책이 타인 알림 접근을 차단함을 검증
- [ ] Edge Function이 `service_role`로 notifications INSERT를 수행함을 검증
- [ ] `type` ENUM 6종 검증이 동작함을 검증
- [ ] Expo Push API 호출이 정상 동작함을 실기기에서 검증
- [ ] 6종 템플릿이 다정한 톤으로 생성됨을 검증
- [ ] type별 딥링크 라우팅이 동작함을 검증
- [ ] 클라이언트가 `service_role` 키를 갖지 않음을 검증 (보안)

---

## 7. 추적성

| 계획 요소 | 연결된 REQ | 소스 |
|-----------|-----------|------|
| Primary Goal | REQ-NOTIF-005, REQ-NOTIF-006, REQ-NOTIF-007, REQ-NOTIF-008, REQ-NOTIF-009 | spec.md §3 REQ-NOTIF-CENTER |
| Secondary Goal | REQ-NOTIF-010, REQ-NOTIF-011, REQ-NOTIF-012, REQ-NOTIF-013 | spec.md §3 REQ-NOTIF-SEND |
| Optional Goal | REQ-NOTIF-001, REQ-NOTIF-002, REQ-NOTIF-003, REQ-NOTIF-004 + 미결정 6.1/6.2/6.4 | spec.md §3 REQ-NOTIF-PUSH, §6 |
