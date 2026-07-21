---
# NOTE: 8-field frontmatter (SPEC-DB-001 형식 준수)
id: SPEC-NOTIF-001
title: "Push Notifications & Notification Center"
version: "1.1.0"
status: completed
created: 2026-06-14
updated: 2026-07-21
author: "강력쇠주먹"
priority: medium
issue_number: 0
labels: [notif, push, expo-push, notification-center, edge-function, supabase, phase-4]
---

# SPEC-NOTIF-001: 푸시 알림 및 알림 센터

## HISTORY

| 날짜 | 버전 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 2026-06-14 | 1.0.0 | 최초 작성 — Expo Push 통합, 알림 센터(조회/읽음/type별 라우팅), send-notification Edge Function, 6종 type ENUM 매핑 정의 | 강력쇠주먹 |

---

## 1. 환경 (Environment)

- **클라이언트 런타임**: React Native 0.83.2 + Expo SDK 55 + React 19.2 (iOS/Android 모바일)
- **푸시 알림 서비스**: Expo Push Notifications (`expo-notifications` SDK)
- **백엔드**: Supabase (관리형 PostgreSQL + PostgREST + Edge Functions)
- **데이터 저장소**: `notifications` 테이블 (SPEC-DB-001 REQ-DB-012)
- **Edge Function 런타임**: Deno (Supabase Edge Functions) — `send-notification` 함수
- **외부 API**: Expo Push API (`POST https://exp.host/api/v2/push/send`)
- **인증**: Supabase Auth (JWT 세션) — 클라이언트는 `anon_key` 사용, Edge Function은 `service_role` 사용
- **타입 시스템**: TypeScript strict 모드, gen-types (`src/types/db.ts`) 기반

### 단일 출처 (Single Source of Truth)

본 SPEC의 알림 데이터 모델은 `.moai/project/db/schema.md`(SPEC-DB-001 산출물)를 단일 출처로 한다.
알림 타입 ENUM 6종은 SPEC-DB-001 REQ-DB-012에 정의되어 있으며, 본 SPEC은 이를 소비한다.
다정한 알림 문구 톤앤매너는 `.booktalk/pages_03_기능명세서.md` 5.1.2 및 `product.md` 시나리오 1에 기반한다.

### 의존성

- **SPEC-DB-001** (선행): `notifications` 테이블 스키마(REQ-DB-012), RLS 정책(REQ-DB-021), ENUM 6종, 인덱스 `(user_id, is_read)`
- **SPEC-API-001** (선행): Supabase 클라이언트 싱글톤, gen-types 타입, `invokeEdgeFunction` 래퍼
- **SPEC-AUTH-001** (선행): 인증된 사용자 식별, 푸시 토큰-사용자 매핑
- **후속/협업 SPEC**:
  - **SPEC-ROUTINE-001**: `reading_reminder` 발송 트리거 (독서 알림 시간)
  - **SPEC-CLUB-001**: `join_request_received`, `join_accepted` 발송 트리거
  - **SPEC-EMOTION-001**: `sticker_received` 발송 트리거
  - **SPEC-COMPLETION-001**: `completion` 발송 트리거 (완독 처리 시)

---

## 2. 가정 (Assumptions)

### 2.1 아키텍처 가정

1. 푸시 토큰(Expo Push Token)은 **클라이언트가 Expo 서비스에서 획득**한 후 서버에 등록한다.
   클라이언트는 `expo-notifications` SDK의 `getExpoPushTokenAsync()`를 호출하여 토큰을 받고,
   이를 Supabase `users` 테이블(또는 별도 토큰 테이블)에 저장한다. 토큰 획득은 Edge Function이
   아닌 클라이언트 책임이다 (Expo SDK 제약).

2. 푸시 발송은 **Edge Function(`send-notification`)이 Expo Push API를 호출**하여 수행한다.
   클라이언트는 Expo Push API를 직접 호출하지 않는다 (API 키 노출 방지). Edge Function은
   `service_role` 키로 Supabase 데이터에 접근하여 푸시 토큰을 조회한 뒤 Expo Push API로
   발송한다.

3. `notifications` 테이블 INSERT는 **서버 측(`service_role` 또는 SECURITY DEFINER 트리거)만**
   수행한다 (SPEC-DB-001 REQ-DB-021). 클라이언트는 `notifications`에 대해 조회(SELECT)와
   읽음 처리(UPDATE `is_read`)만 수행하며, INSERT 권한이 없다 (RLS 정책에 INSERT 없음).

4. `service_role` 키는 Edge Function(`send-notification`) 서버 측에서만 사용되며, 모든 RLS를
   우회한다 (SPEC-DB-001 가정 2.1.2). 클라이언트는 절대 `service_role` 키를 갖지 않는다.

5. 모든 알림은 `notifications` 테이블에 영속화된다. 푸시 수신 여부(기기 오프라인, 알림 꺼짐)와
   무관하게 알림 센터에서 조회 가능하다. 푸시는 "실시간 알림" 채널이며, 알림 센터는 "아카이브"
   채널이다.

6. iOS 알림 권한은 사용자가 명시적으로 허용해야 한다 (`requestPermissionsAsync`). Android는
   API 33+에서 POST_NOTIFICATIONS 런타임 권한이 필요하다.

### 2.2 비즈니스 가정

1. **알림 타입 ENUM 6종** (SPEC-DB-001 REQ-DB-012)은 각각 다음 도메인 이벤트에서 발생한다:

   | type | 발송 트리거 (도메인 SPEC) | 다정한 톤 예시 |
   |------|--------------------------|----------------|
   | `reading_reminder` | SPEC-ROUTINE-001 (독서 알림 시간) | "오늘의 첫 페이지가 당신을 기다리고 있어요" |
   | `join_request_received` | SPEC-CLUB-001 (Track A 요청 수신) | "같은 책을 읽는 누군가가 함께 읽자고 했어요" |
   | `join_accepted` | SPEC-CLUB-001 (요청 수락) | "모임에 합류했어요! 이제 함께 읽어요" |
   | `sticker_received` | SPEC-EMOTION-001 (스티커 반응) | "당신의 기록에 공감 스티커가 도착했어요" |
   | `completion` | SPEC-COMPLETION-001 (완독 처리) | "완독을 축하해요! 당신만의 다이어리가 완성됐어요" |
   | `club_signal` | 확장 단계 (실시간 시그널) | MVP에서 발송 미구현, 수신/표시만 지원 |

2. 본 SPEC은 **알림 발송 인프라(send-notification Edge Function, 템플릿 시스템)**와
   **알림 소비 인프라(알림 센터, 읽음 처리, 푸시 토큰 관리)**를 정의한다. 각 알림 타입의
   **발송 트리거 로직**은 해당 도메인 SPEC이 담당한다 (예: `reading_reminder` 발송 스케줄은
   SPEC-ROUTINE-001, `sticker_received` 발송은 SPEC-EMOTION-001).

3. `club_signal` 타입은 `notifications.type` ENUM에 정의되어 있으나(pages_03 5.2.3 확장 단계),
   MVP에서는 발송 로직을 구현하지 않는다. 알림 센터는 `club_signal` 행이 존재할 경우 표시만
   지원한다 (전방향 호환성).

4. 사용자는 알림 설정 UI를 통해 알림 수신 여부를 개인화할 수 있다 (tech.md "푸시 알림" 섹션).
   알림 설정은 `POST /users/{id}/notifications` 엔드포인트(structure.md "Users profile+notifications")
   를 통해 저장된다. 설정 스키마는 미결정 사항(6.4)이며, MVP에서는 `users.reading_alarm_enabled`
   (SPEC-DB-001 REQ-DB-001)를 재사용한다.

5. 다정한 톤앤매너(product.md 시나리오 1, pages_03 5.1.2)를 모든 알림 문구에 적용한다.
   강압적 마감("지금 읽지 않으면...")이 아닌 따뜻한 권유 톤을 사용한다.

---

## 3. 요구사항 (Requirements)

> 본 SPEC은 3개 요구사항 모듈로 구성된다: REQ-NOTIF-PUSH, REQ-NOTIF-CENTER, REQ-NOTIF-SEND.

### REQ-NOTIF-PUSH: Expo Push Notifications 통합

**목적**: 클라이언트에서 Expo Push Token을 획득하고 서버에 등록하며, 포그라운드/백그라운드
푸시 알림을 수신하는 인프라를 제공한다.

#### REQ-NOTIF-001: Expo Push Token 획득

시스템은 **항상** `expo-notifications` SDK의 `getExpoPushTokenAsync()`를 호출하여 Expo Push
Token을 획득하는 함수(`registerForPushNotifications`)를 제공해야 한다. 이 함수는 앱 최초
실행 시 또는 사용자 로그인 완료 후 호출된다.

**WHEN** 인증된 사용자가 앱에 처음 로그인하면,
**THEN** 시스템은 Expo Push Token 획득을 시도해야 한다.

**IF** 토큰 획득에 실패하면(네트워크 오류, 권한 거부),
**THEN** 시스템은 조용히 실패를 처리하고 사용자 경험을 차단하지 않아야 한다
(푸시는 부가 기능이며 알림 센터는 토큰 없이도 동작).

#### REQ-NOTIF-002: 푸시 권한 요청

시스템은 **항상** iOS/Android 플랫폼에 맞춰 알림 권한을 요청해야 한다.

**WHEN** 토큰 획득 함수가 호출되면,
**THEN** 시스템은 먼저 `Notifications.requestPermissionsAsync()`를 호출하여 권한을 요청해야 한다.

**IF** 사용자가 알림 권한을 거부하면,
**THEN** 시스템은 푸시 토큰 획득을 건너뛰고, 알림 센터(인앱 조회)는 계속 동작해야 한다.

> Android API 33+에서는 POST_NOTIFICATIONS 런타임 권한이 필요하며, `expo-notifications`가
> 자동 처리한다.

#### REQ-NOTIF-003: 푸시 토큰 서버 등록

시스템은 **항상** 획득한 Expo Push Token을 서버에 등록해야 한다. 등록은
`POST /users/{id}/notifications`(structure.md API 서피스) 또는 `users` 테이블 UPDATE로
수행된다. 토큰 저장 위치는 미결정 사항(6.1)이며, MVP 임시 방침은 `users` 테이블 확장이다.

**WHEN** 클라이언트가 Expo Push Token을 획득하면,
**THEN** 시스템은 해당 토큰을 현재 인증된 사용자 ID와 매핑하여 서버에 저장해야 한다.

**WHILE** 토큰이 서버에 등록된 상태에서,
**THEN** 시스템은 `send-notification` Edge Function이 해당 사용자에게 푸시를 발송할 수 있도록
해야 한다.

#### REQ-NOTIF-004: 포그라운드/백그라운드 알림 수신 핸들러

시스템은 **항상** 앱이 포그라운드에 있을 때 수신된 푸시 알림을 처리하는 핸들러를 등록해야
한다 (`Notifications.setNotificationHandler`). 백그라운드/종료 상태에서는 OS가 자동으로
알림을 표시한다.

**WHEN** 앱이 포그라운드에서 푸시 알림을 수신하면,
**THEN** 시스템은 인앱 배너 또는 토스트로 알림을 표시해야 한다 (OS 기본 알림 표시 억제).

**WHEN** 사용자가 알림(포그라운드 배너 또는 백그라운드 시스템 알림)을 탭하면,
**THEN** 시스템은 알림의 `type`과 `ref_id`를 기반으로 해당 화면으로 딥링크 라우팅해야 한다
(REQ-NOTIF-009와 연동).

---

### REQ-NOTIF-CENTER: 알림 센터 (조회, 읽음 처리, 라우팅)

**목적**: `notifications` 테이블에서 사용자의 알림을 조회하고 읽음 상태를 관리하며, 알림 타입별로
적절한 화면으로 라우팅하는 UI 인프라를 제공한다.

#### REQ-NOTIF-005: 알림 목록 조회

시스템은 **항상** 인증된 사용자의 알림 목록을 `notifications` 테이블에서 조회하는 함수를
제공해야 한다. 조회는 PostgREST 직접 호출로 수행된다 (Edge Function 불필요).

**WHEN** 사용자가 알림 센터 화면을 열면,
**THEN** 시스템은 `notifications` 테이블에서 `auth.uid() = user_id`인 행을 `created_at DESC`
순으로 조회해야 한다.

**WHILE** 알림 목록이 표시되는 동안,
**THEN** 시스템은 읽지 않은 알림(`is_read = false`)을 시각적으로 구분하여 표시해야 한다
(배지, 굵은 글씨, 배경색 등).

> RLS 정책(REQ-DB-021 `notifications_select_own`)이 `auth.uid() = user_id` 조건으로
> 타인 알림을 자동 차단한다. 클라이언트 권한 로직 불필요.

#### REQ-NOTIF-006: 읽지 않은 알림 카운트 (배지)

시스템은 **항상** 읽지 않은 알림 개수를 제공하여 탭바 배지나 헤더 아이콘에 표시할 수 있도록
해야 한다.

**WHEN** 알림 센터가 활성화되거나 새 알림이 도착하면,
**THEN** 시스템은 `notifications` 테이블에서 `user_id = auth.uid()` AND `is_read = false`인
행의 개수를 반환해야 한다.

> 인덱스 `(user_id, is_read)`(SPEC-DB-001 인덱스 섹션)로 카운트 쿼리가 최적화된다.

#### REQ-NOTIF-007: 개별 알림 읽음 처리

시스템은 **항상** 개별 알림의 `is_read` 상태를 `true`로 업데이트하는 함수를 제공해야 한다.

**WHEN** 사용자가 알림 목록에서 특정 알림을 탭하면,
**THEN** 시스템은 해당 `notifications` 행의 `is_read`를 `true`로 업데이트해야 한다
(`notifications_update_own` RLS 정책, `auth.uid() = user_id`).

**IF** 이미 `is_read = true`인 알림을 다시 탭하면,
**THEN** 시스템은 멱등하게 처리해야 한다 (에러 없이 무시).

#### REQ-NOTIF-008: "모두 읽음" 배치 처리

시스템은 **가능하면** 알림 센터에서 "모두 읽음" 액션을 제공하여, 읽지 않은 모든 알림을
일괄적으로 `is_read = true`로 업데이트해야 한다.

**WHEN** 사용자가 "모두 읽음" 버튼을 탭하면,
**THEN** 시스템은 `notifications` 테이블에서 `user_id = auth.uid()` AND `is_read = false`인
모든 행을 `is_read = true`로 일괄 업데이트해야 한다 (PostgREST bulk UPDATE).

> 배치 vs 개별 처리는 미결정 사항(6.3)이나, MVP에서는 둘 다 지원한다.

#### REQ-NOTIF-009: 알림 타입별 딥링크 라우팅

시스템은 **항상** 알림의 `type`과 `ref_id`를 기반으로 적절한 화면으로 라우팅하는 매퍼를
제공해야 한다.

**WHEN** 사용자가 알림(알림 센터 항목 또는 푸시 알림)을 탭하면,
**THEN** 시스템은 다음 라우팅 테이블에 따라 화면을 전환해야 한다:

| type | 라우팅 대상 | ref_id 의미 |
|------|-----------|-------------|
| `reading_reminder` | 현재 읽는 책 서재 화면 | `user_book_id` |
| `join_request_received` | 모임 관리 화면 (host) | `join_request_id` |
| `join_accepted` | 모임 피드 화면 | `club_id` |
| `sticker_received` | 감정 기록 상세 화면 | `emotion_record_id` |
| `completion` | 완독 다이어리 화면 | `completion_report_id` |
| `club_signal` | 모임 피드 화면 (확장) | `club_id` |

**IF** `ref_id`가 존재하지 않거나 라우팅 대상 화면이 구현되지 않았으면,
**THEN** 시스템은 알림 센터 화면으로 폴백해야 한다 (에러 표시 없음).

---

### REQ-NOTIF-SEND: send-notification Edge Function (서버 발송)

**목적**: 서버 측에서 알림을 생성하고 푸시를 발송하는 통합 Edge Function을 제공한다.
이 함수는 `notifications` 테이블 INSERT(RLS 우회)와 Expo Push API 호출을 단일 트랜잭션으로
수행한다.

#### REQ-NOTIF-010: Edge Function 엔드포인트

시스템은 **항상** `POST /functions/send-notification` 엔드포인트를 제공해야 한다.
이 함수는 `service_role` 키로 호출되며, 클라이언트가 직접 호출하지 않는다 (각 도메인
SPEC의 서버 측 로직 또는 SECURITY DEFINER 트리거가 호출).

**WHEN** 도메인 이벤트(완독, 스티커 수신, 가입 요청 등)가 발생하면,
**THEN** 해당 도메인 SPEC의 서버 로직이 `send-notification` Edge Function을 호출하여
알림을 발송해야 한다.

**요청 스키마**:
- `user_id` (uuid, 필수): 알림 수신자
- `type` (ENUM 6종, 필수): 알림 타입
- `ref_id` (uuid, 선택): 관련 엔터티 ID (라우팅용)
- `data` (jsonb, 선택): 템플릿 변수 (예: 책 제목, 모임명)

> 호출 주체는 서버(Edge Function, 트리거)이며, 클라이언트에 `service_role` 키 노출을
> 방지한다 (pages_08 API 명세서 보안 섹션 참조).

#### REQ-NOTIF-011: notifications INSERT (service_role RLS 우회)

시스템은 **항상** `send-notification` Edge Function이 `service_role` 키로 `notifications`
테이블에 INSERT를 수행하도록 해야 한다. 이는 RLS 정책(REQ-DB-021)에 클라이언트 INSERT가
없으므로, 서버 측 우회가 유일한 INSERT 경로이다.

**WHEN** Edge Function이 알림 발송 요청을 수신하면,
**THEN** 시스템은 먼저 `notifications` 테이블에 행을 INSERT해야 한다:
- `user_id`: 요청된 수신자 ID
- `type`: 요청된 ENUM 값 (6종 검증)
- `title`: 템플릿에서 생성된 제목 (REQ-NOTIF-013)
- `body`: 템플릿에서 생성된 본문 (REQ-NOTIF-013)
- `ref_id`: 요청된 ref_id (있는 경우)
- `is_read`: `false` (기본값)

**IF** `type`이 ENUM 6종에 해당하지 않으면,
**THEN** 시스템은 INSERT를 거부하고 400 Bad Request를 반환해야 한다.

#### REQ-NOTIF-012: Expo Push API 호출

시스템은 **항상** `notifications` INSERT 성공 후, 수신자의 Expo Push Token을 조회하여
Expo Push API로 실제 푸시를 발송해야 한다.

**WHEN** `notifications` INSERT가 성공하면,
**THEN** 시스템은 `users` 테이블(또는 토큰 저장소)에서 수신자의 Expo Push Token을 조회해야 한다.

**IF** 토큰이 존재하면,
**THEN** 시스템은 `POST https://exp.host/api/v2/push/send`로 푸시를 발송해야 한다.
페이로드는 `{ to, title, body, data: { notification_id, type, ref_id } }` 구조를 따른다.

**IF** 토큰이 존재하지 않으면(사용자가 푸시를 비활성화했거나 미등록),
**THEN** 시스템은 푸시 발송을 건너뛰고 `notifications` INSERT만 유지해야 한다
(알림 센터에서 조회 가능).

**IF** Expo Push API가 에러를 반환하면(잘못된 토큰, 만료 등),
**THEN** 시스템은 에러를 로깅하되 `notifications` INSERT는 롤백하지 않아야 한다
(알림 센터 가용성이 푸시 성공보다 우선).

#### REQ-NOTIF-013: 알림 템플릿 시스템 (6종 type, 다정한 톤)

시스템은 **항상** 6종 `type`별로 다정한 톤의 알림 제목/본문을 생성하는 템플릿 시스템을
제공해야 한다. 템플릿은 `data` 변수를 치환하여 최종 `title`/`body`를 생성한다.

**WHILE** Edge Function이 알림을 생성하는 동안,
**THEN** 시스템은 다음 템플릿 매핑을 적용해야 한다 (product.md 시나리오 1, pages_03 5.1.2 기반):

| type | title 템플릿 | body 템플릿 |
|------|-------------|------------|
| `reading_reminder` | "오늘의 첫 페이지가 당신을 기다리고 있어요" | "{book_title}의 {page}페이지, 살짝 펼쳐볼까요?" |
| `join_request_received` | "같은 책을 읽는 누군가가 함께 읽자고 했어요" | "{requester_nickname}님이 '{club_title}' 모임에서 함께 읽자고 제안했어요" |
| `join_accepted` | "모임에 합류했어요! 이제 함께 읽어요" | "'{club_title}' 모임의 일원이 되었어요" |
| `sticker_received` | "당신의 기록에 공감 스티커가 도착했어요" | "{reactor_nickname}님이 {sticker_type} 반응을 남겼어요" |
| `completion` | "완독을 축하해요! 당신만의 다이어리가 완성됐어요" | "'{book_title}'과의 여정, {total_records}개의 감정 기록이 모였어요" |
| `club_signal` | "지금 같이 읽는 독자가 있어요" (확장) | "{signal_count}명이 함께 읽고 있어요" |

> 강압적 마감 톤("지금 읽지 않으면...")은 금지된다. 다정한 권유와 따뜻한 축하 톤만 허용된다.

---

## 4. API 서피스 매핑 (API Surface Mapping)

| 엔드포인트 | 타입 | 설명 | 사용 모듈 |
|-----------|------|------|-----------|
| `GET /rest/v1/notifications` | PostgREST | 알림 목록 조회 (RLS own-row) | REQ-NOTIF-005 |
| `GET /rest/v1/notifications?is_read=eq.false` | PostgREST | 읽지 않은 알림 카운트 (count header) | REQ-NOTIF-006 |
| `PATCH /rest/v1/notifications?id=eq.{id}` | PostgREST | 개별 읽음 처리 (`is_read: true`) | REQ-NOTIF-007 |
| `PATCH /rest/v1/notifications?user_id=eq.{me}&is_read=eq.false` | PostgREST | "모두 읽음" 배치 처리 | REQ-NOTIF-008 |
| `POST /rest/v1/users?id=eq.{id}` | PostgREST | 푸시 토큰 등록 (users UPDATE) | REQ-NOTIF-003 |
| `POST /users/{id}/notifications` | structure.md API 서피스 | 알림 설정 (개인화) | REQ-NOTIF-003 보조 |
| `POST /functions/v1/send-notification` | Edge Function | 서버 측 알림 발송 (service_role) | REQ-NOTIF-010 ~ 013 |
| `POST https://exp.host/api/v2/push/send` | 외부 API (Expo Push) | 실제 푸시 발송 | REQ-NOTIF-012 |

> `POST /users/{id}/notifications`(structure.md)는 "알림 설정" 엔드포인트이며, 푸시 토큰 등록은
> `users` 테이블 UPDATE로 별도 처리된다. 본 SPEC은 두 경로를 모두 지원한다.

---

## 5. 제외 범위 (Exclusions)

본 SPEC은 다음을 포함하지 않는다:

1. **SMS/이메일 알림 채널**: 푸시와 알림 센터만 지원한다. SMS, 이메일 발송은 비목표.
2. **마케팅 푸시**: 프로모션, 광고성 푸시는 비목표(product.md 비목표 — 과시 엔진 회피).
3. **푸시 A/B 테스트**: 알림 문구/타이밍 A/B 테스트 인프라는 MVP 범위 밖이다.
4. **silent push (백그라운드 데이터 동기화)**: 푸시를 데이터 동기화 트리거로 사용하는 고급
   전략은 제외한다. 본 SPEC의 푸시는 사용자 대면 알림 전용이다.
5. **`club_signal` 발송 로직**: ENUM에 정의되어 있으나(pages_03 5.2.3 확장 단계), MVP에서는
   시그널 발송 Edge Function을 구현하지 않는다. 알림 센터 표시만 지원.
6. **각 알림 타입의 발송 트리거 로직**: `reading_reminder` 발송 스케줄(SPEC-ROUTINE-001),
   `sticker_received` 발송(SPEC-EMOTION-001), `join_request_received`/`join_accepted` 발송
   (SPEC-CLUB-001), `completion` 발송(SPEC-COMPLETION-001)은 각 도메인 SPEC의 책임이다.
   본 SPEC은 `send-notification` Edge Function 인프라와 템플릿만 제공한다.
7. **알림 설정 상세 스키마**: `POST /users/{id}/notifications`의 설정 스키마(type별 토글 등)는
   미결정 사항(6.4)이며, MVP에서는 `users.reading_alarm_enabled`를 재사용한다.
8. **알림 보관 주기 자동 삭제**: 30일/90일 경과 알림 자동 삭제 배치는 미결정 사항(6.2)이며,
   MVP에서는 무제한 보관한다.
9. **Expo Push API 응답 티켓 상세 처리**: Expo가 반환하는 티켓 ID 영속화, 만료 토큰 자동
   제거 로직은 MVP 범위 밖이다 (로그만 기록).

---

## 6. 미결정 사항 (Open Questions)

### 6.1 푸시 토큰 저장 위치 — 미해결

Expo Push Token을 `users` 테이블 확장(`push_token` 컬럼 추가)에 저장할지, 별도 테이블
(`user_push_tokens`)에 저장할지 미확정.

**후보 분석**:
- **`users` 확장**: 단순화, 1인 1기기 전제. SPEC-DB-001 migration 추가 필요.
- **별도 테이블(`user_push_tokens`)**: 다기기 지원, 토큰 이력 관리. 테이블 추가 + RLS 정책 필요.

**MVP 임시 방침**: `users` 테이블 확장(단순화). 다기기 지원은 확장 단계에서 별도 테이블로 마이그레이션.

**해결 시점**: SPEC-AUTH-001 구현 시 확정 예정 (사용자 프로필 스키마와 통합 결정).

### 6.2 알림 보관 기간 — 미해결

`notifications` 행의 보관 주기 미확정. 무제한 보관 vs 30일 vs 90일.

**MVP 임시 방침**: 무제한 보관. 사용자가 "모두 읽음" 처리하면 시각적으로 숨겨지지만, 행은 유지.

**해결 시점**: 데이터 볼륨 모니터링 후 결정. pg_cron 배치 삭제 도입 검토.

### 6.3 읽음 처리 배치 vs 개별 — 해결됨 (둘 다 지원)

**결정**: 개별 읽음 처리(REQ-NOTIF-007)와 "모두 읽음" 배치(REQ-NOTIF-008) 모두 지원.
사용자가 알림을 탭하면 개별 처리, "모두 읽음" 버튼으로 배치 처리.

### 6.4 알림 설정 스키마 상세 — 미해결

`POST /users/{id}/notifications` 엔드포인트가 저장할 설정 스키마(type별 수신 토글, 알림 시간,
문구 톤 등) 미확정.

**MVP 임시 방침**: `users.reading_alarm_enabled`(SPEC-DB-001 REQ-DB-001)와
`users.reading_alarm_time`을 재사용. type별 세부 토글은 후순위.

**해결 시점**: SPEC-PROFILE-001 구현 시 알림 설정 UI와 함께 확정.

---

## 7. 추적성 (Traceability)

| TAG | 요구사항 | 소스 |
|-----|---------|------|
| SPEC-NOTIF-001 | REQ-NOTIF-001 ~ REQ-NOTIF-013 | `.moai/project/product.md`(시나리오 1 — 다정한 독서 알림), `.moai/project/structure.md`(API 서피스 — Users profile+notifications, send-notification Edge Function), `.moai/project/tech.md`(푸시 알림 섹션), `.moai/project/db/schema.md`(notifications 테이블), `.moai/project/db/rls-policies.md`(notifications RLS), `.moai/specs/SPEC-DB-001/spec.md`(REQ-DB-012, REQ-DB-021), `.moai/specs/SPEC-API-001/spec.md`(클라이언트 API 레이어), `.moai/specs/INDEX.md`(SPEC 카탈로그), `.booktalk/pages_03_기능명세서.md`(5.1 똑똑 오늘의 페이지 알림), `.booktalk/pages_08_API명세서.md`(send-notification Edge Function) |
| REQ-NOTIF-PUSH | REQ-NOTIF-001 ~ REQ-NOTIF-004 | tech.md "푸시 알림", pages_03 5.1.1/5.1.2 |
| REQ-NOTIF-CENTER | REQ-NOTIF-005 ~ REQ-NOTIF-009 | SPEC-DB-001 REQ-DB-012/REQ-DB-021, db/schema.md notifications |
| REQ-NOTIF-SEND | REQ-NOTIF-010 ~ REQ-NOTIF-013 | structure.md "send-notification" Edge Function, pages_08 API 명세서 |
