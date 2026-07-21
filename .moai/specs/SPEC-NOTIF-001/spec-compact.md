---
id: SPEC-NOTIF-001
title: "푸시 알림 및 알림 센터 — Compact"
version: "1.0.0"
status: draft
created: 2026-06-14
updated: 2026-06-14
author: "강력쇠주먹"
priority: medium
issue_number: 0
labels: [notif, push, expo-push, notification-center, edge-function, supabase, phase-4, compact]
---

# SPEC-NOTIF-001: Compact 요약

> 본 문서는 spec.md의 핵심만 추약한 실행용 요약이다. 상세는 spec.md를 참조한다.

## 핵심 범위

Expo Push Notifications 통합(토큰 관리, 권한 요청)과 알림 센터(`notifications` 테이블 조회/읽음
처리)를 구축한다. `send-notification` Edge Function이 서버 측에서 `service_role`로 알림을
생성(INSERT)하고 Expo Push API로 푸시를 발송한다. 6종 알림 타입(ENUM)별로 다정한 톤의
템플릿을 제공한다.

## 데이터 흐름

```
[도메인 이벤트] (각 도메인 SPEC 서버 로직)
  → POST /functions/send-notification (service_role)
  → type ENUM 검증 (6종)
  → templates.ts → title/body 생성 (다정한 톤)
  → notifications INSERT (service_role, RLS 우회 — REQ-DB-021)
  → users 테이블에서 Expo Push Token 조회
  → 토큰 존재: POST https://exp.host/api/v2/push/send (Expo Push API)
  → 토큰 미존재: INSERT만 유지 (알림 센터 가용성 우선)

[사용자 알림 확인]
  → GET /rest/v1/notifications (RLS: auth.uid() = user_id)
  → 읽지 않은 카운트 (user_id, is_read) 인덱스 최적화
  → 알림 탭 → routeMapper (type별 딥링크) → 읽음 처리 (is_read UPDATE)
```

## 요구사항 (13개)

### REQ-NOTIF-PUSH (Expo Push 통합 — 4개)

| REQ | 요약 |
|-----|------|
| REQ-NOTIF-001 | 클라이언트가 `getExpoPushTokenAsync()`로 토큰 획득. 실패 시 조용히 처리 (알림 센터는 계속 동작) |
| REQ-NOTIF-002 | `requestPermissionsAsync()`로 iOS/Android 권한 요청. 거부 시 푸시 건너뛰기, 센터는 동작 |
| REQ-NOTIF-003 | 획득한 토큰을 서버에 등록 (`POST /users/{id}/notifications` 또는 users UPDATE). 토큰-사용자 매핑 |
| REQ-NOTIF-004 | 포그라운드 알림 수신 핸들러 (`setNotificationHandler`). 알림 탭 시 type/ref_id 기반 라우팅 |

### REQ-NOTIF-CENTER (알림 센터 — 5개)

| REQ | 요약 |
|-----|------|
| REQ-NOTIF-005 | `GET /rest/v1/notifications`로 본인 알림 목록 조회 (RLS own-row, `created_at DESC`). 읽지 않은 알림 시각 구분 |
| REQ-NOTIF-006 | 읽지 않은 알림 카운트 (`is_read=false`, 인덱스 `(user_id, is_read)` 최적화). 배지 표시 |
| REQ-NOTIF-007 | 개별 알림 읽음 처리 (`PATCH notifications?id=eq.{id}`, `is_read: true`). 멱등 |
| REQ-NOTIF-008 | "모두 읽음" 배치 처리 (`PATCH notifications?user_id=eq.{me}&is_read=eq.false`) |
| REQ-NOTIF-009 | type별 딥링크 라우팅 매퍼 (6종 type → 화면). ref_id 없거나 화면 미구현 시 센터로 폴백 |

### REQ-NOTIF-SEND (send-notification Edge Function — 4개)

| REQ | 요약 |
|-----|------|
| REQ-NOTIF-010 | `POST /functions/send-notification` 엔드포인트. `service_role`로 호출, 클라이언트 직접 호출 차단 |
| REQ-NOTIF-011 | `notifications` INSERT (service_role RLS 우회). type ENUM 6종 검증 (잘못된 type 시 400) |
| REQ-NOTIF-012 | Expo Push API 호출 (`POST https://exp.host/api/v2/push/send`). 토큰 미존재 시 INSERT만 유지. 에러 시 로깅, INSERT 롤백 없음 |
| REQ-NOTIF-013 | 6종 type별 템플릿 시스템 (다정한 톤). 변수 치환 `{book_title}`, `{requester_nickname}` 등 |

## ENUM 6종 매핑 (SPEC-DB-001 REQ-DB-012)

| type | 발송 트리거 (도메인 SPEC) | 다정한 톤 예시 |
|------|--------------------------|----------------|
| `reading_reminder` | SPEC-ROUTINE-001 | "오늘의 첫 페이지가 당신을 기다리고 있어요" |
| `join_request_received` | SPEC-CLUB-001 | "같은 책을 읽는 누군가가 함께 읽자고 했어요" |
| `join_accepted` | SPEC-CLUB-001 | "모임에 합류했어요! 이제 함께 읽어요" |
| `sticker_received` | SPEC-EMOTION-001 | "당신의 기록에 공감 스티커가 도착했어요" |
| `completion` | SPEC-COMPLETION-001 | "완독을 축하해요! 당신만의 다이어리가 완성됐어요" |
| `club_signal` | 확장 단계 (미구현) | 수신/표시만 지원, 발송은 제외 |

## 핵심 가정

1. **푸시 토큰은 클라이언트가 획득 후 서버에 등록** — Edge Function이 아닌 클라이언트 책임
2. **푸시 발송은 Edge Function이 수행** — 클라이언트는 Expo Push API 직접 호출 금지 (키 노출 방지)
3. **notifications INSERT는 서버(service_role/트리거)만** — 클라이언트는 조회/읽음만 (RLS)
4. **알림은 영속화** — 푸시 수신 여부와 무관하게 알림 센터에서 조회 가능
5. **발송 트리거는 각 도메인 SPEC** — 본 SPEC은 발송 인프라(send-notification)와 소비 인프라(센터)만

## 제외 범위

- SMS/이메일 알림 채널
- 마케팅 푸시 (비목표)
- 푸시 A/B 테스트
- silent push (백그라운드 데이터 동기화)
- `club_signal` 발송 로직 (MVP 미구현, 표시만 지원)
- 각 알림 타입의 발송 트리거 로직 (각 도메인 SPEC 담당)
- 알림 설정 상세 스키마 (type별 토글 — 미결정 6.4)
- 알림 보관 주기 자동 삭제 배치 (미결정 6.2)
- Expo Push API 티켓 영속화 및 만료 토큰 자동 제거 (후순위)

## 미결정 사항

| ID | 이슈 | 임시 방침 | 해결 시점 |
|----|------|-----------|-----------|
| 6.1 | 푸시 토큰 저장 위치 (users 확장 vs 별도 테이블) | `users` 테이블 확장 (1인 1기기) | SPEC-AUTH-001 구현 시 |
| 6.2 | 알림 보관 기간 | 무제한 보관 | 데이터 볼륨 모니터링 후 |
| 6.3 | 읽음 처리 배치 vs 개별 | 둘 다 지원 (개별 + "모두 읽음") | 해결됨 |
| 6.4 | 알림 설정 스키마 상세 | `users.reading_alarm_enabled` 재사용 | SPEC-PROFILE-001 구현 시 |

## 의존성

| 선행 SPEC | 소비 산출물 |
|-----------|-------------|
| SPEC-DB-001 | notifications(REQ-DB-012, type ENUM 6종), RLS(REQ-DB-021), 인덱스 (user_id, is_read) |
| SPEC-API-001 | Supabase 클라이언트, gen-types 타입, `invokeEdgeFunction` 래퍼 |
| SPEC-AUTH-001 | 인증된 사용자 식별, 푸시 토큰-사용자 매핑 |
| SPEC-ROUTINE-001 | `reading_reminder` 발송 트리거 (협업 경계) |
| SPEC-CLUB-001 | `join_request_received`, `join_accepted` 발송 트리거 (협업 경계) |
| SPEC-EMOTION-001 | `sticker_received` 발송 트리거 (협업 경계) |
| SPEC-COMPLETION-001 | `completion` 발송 트리거 (협업 경계) |

## 구현 산출물 (참고)

```
src/features/notification/
  queries.ts              # GET/PATCH notifications (PostgREST)
  useNotifications.ts     # 알림 목록 조회 훅
  useUnreadCount.ts       # 읽지 않은 카운트 훅
  markAsRead.ts           # 개별 읽음 처리
  markAllAsRead.ts        # "모두 읽음" 배치
  routeMapper.ts          # type별 딥링크 라우팅
  registerForPush.ts      # Expo Push Token 획득 + 권한 요청
  registerToken.ts        # 토큰 서버 등록
  usePushNotification.ts  # 포그라운드 알림 수신 훅
  types.ts                # Notification, NotificationType

supabase/functions/send-notification/
  index.ts                # Edge Function (service_role)
  templates.ts            # 6종 type별 템플릿 (다정한 톤)
  expo-push.ts            # Expo Push API 호출
```

알림 센터 화면, 탭바 배지 연동.
