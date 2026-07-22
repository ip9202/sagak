---
id: SPEC-NOTIF-002
title: "알림 센터 실시간 갱신 — Realtime 구독 + 쿼리 무효화 + pull-to-refresh"
version: "0.1.0"
status: draft
created: 2026-07-22
updated: 2026-07-22
author: "강력쇠주먹"
priority: P2
phase: "v1.2.0"
module: "src/features/notification"
lifecycle: spec-anchored
tags: "notif, realtime, supabase, react-query, notification-center, refresh"
tier: M
depends_on: [SPEC-NOTIF-001]
---

# SPEC-NOTIF-002: 알림 센터 실시간 갱신 (spec.md)

## HISTORY

| 날짜 | 버전 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 2026-07-22 | 0.1.0 | 최초 작성 — SPEC-NOTIF-001 N7 통과 검증 중 발견된 알림 센터 실시간 갱신 결함 3종(Realtime 구독 부재 + invalidateQueries 미연결 + RefreshControl 부재)을 별개 후속 SPEC으로 분리. 결함 진단은 grep 관측 기반(truth source). | 강력쇠주먹 |

---

## §A. 배경 및 목적

### §A.1 배경

SPEC-NOTIF-001 (REQ-NOTIF-004 포그라운드 알림 수신)이 2026-07-22 실기기 검증 7/7 PASS로 통과했다. 그 과정에서 **별개 결함**이 발견되었다: 알림 센터가 새 알림을 실시간으로 반영하지 못한다.

관측된 증상: 포그라운드 푸시 수신 시 heads-up 배너는 표시되고 DB INSERT도 관측되나(행 ID 2535584a/369e23cb), 알림 센터 목록은 갱신되지 않는다. 앱을 재실행해야만 `refetchOnMount`에 의해 새 알림이 표시된다. 사용자가 "당겨지지 않는다(pull-to-refresh 안 됨)"고 보고했다.

### §A.2 결함 진단 (truth source — grep 관측 기반, 추측 금지)

3개 근본 원인이 `src/features/notification/` 코드 베이스 grep 관측으로 확인되었다:

1. **Realtime 구독 부재**: `grep -rn "channel\|postgres_changes\|\.on('INSERT')\|realtime" src/features/notification/` → Realtime 구독 0건 (`channel` 매치는 Android `setNotificationChannelAsync`만 — 완전히 별개 개념).
2. **`invalidateQueries` 미연결**: `grep -n "invalidateQueries\|invalidate" src/features/notification/useNotificationResponse.ts` → 0건. 푸시 수신 및 배너 클릭 시 알림 목록 쿼리가 무효화되지 않는다.
3. **`RefreshControl` 부재**: `grep -n "RefreshControl\|ScrollView\|onRefresh" src/features/notification/components/NotificationsScreen.tsx` → `ScrollView`만 매치, `RefreshControl`/`onRefresh` 0건. 수동 갱신 경로 없음.

### §A.3 재사용 가능 기존 자산 (truth source)

- `NOTIFICATION_QUERY_PREFIX`, `NOTIFICATIONS_KEY`, `UNREAD_COUNT_KEY` 쿼리 키가 `useNotifications.ts`/`useUnreadCount.ts`에 정의되어 있다.
- `useMarkAsRead.ts`/`useMarkAllAsRead.ts`가 이미 `qc.invalidateQueries({ queryKey: [NOTIFICATION_QUERY_PREFIX] })` 패턴을 사용 중 — SPEC-NOTIF-002는 이 패턴을 `useNotificationResponse`에 동일하게 적용한다.
- Supabase RLS는 `notifications` 테이블에 이미 적용되어 있어(REQ-DB-021), Realtime `postgres_changes`도 동일 RLS 정책이 자동 적용된다.

### §A.4 목적

새 알림이 알림 센터에 3개 경로로 즉시 반영되도록 한다:
- **자동(서버 푸시)**: Realtime INSERT 이벤트 구독
- **자동(클라이언트 트리거)**: 푸시 수신 / 배너 클릭 시 쿼리 무효화
- **수동**: pull-to-refresh

---

## §B. 요구사항 (GEARS 형식)

### REQ-NOTIF2-001: Realtime INSERT 이벤트 구독 (Event-driven)

**When** `notifications` 테이블에 인증된 사용자(`auth.uid() = user_id`)의 새 행이 INSERT 되어 Realtime `postgres_changes` INSERT 이벤트가 감지되면, **the notification center** **shall** 새 알림을 화면에 표시 중인 목록에 자동으로 추가하여 앱 재시작이나 수동 재조회 없이 즉시 반영한다.

**추가 제약**:
- 알림 센터 화면 진입 시 채널을 구독하고, 화면 이탈(unmount) 시 채널을 정리(cleanup)하여 메모리 누수와 좀비 구독을 방지한다.
- RLS 정책(REQ-DB-021 `notifications_select_own`)이 자동 적용되어 타인의 알림 INSERT는 수신하지 않는다.

### REQ-NOTIF2-002: 푸시 수신/배너 클릭 시 쿼리 무효화 (Event-driven)

**When** 앱이 포그라운드에서 푸시 알림을 수신하거나(`Notifications.addNotificationResponseReceivedListener` 트리거) **또는** 사용자가 포그라운드 알림 배너를 탭할 때, **the notification center query cache** **shall** `queryClient.invalidateQueries({ queryKey: [NOTIFICATION_QUERY_PREFIX] })`를 호출하여 알림 목록 및 읽지 않은 카운트 쿼리를 즉시 재조회한다.

**추가 제약**:
- 기존 `useMarkAsRead`/`useMarkAllAsRead`의 invalidateQueries 패턴을 그대로 재사용한다(신규 패턴 도입 금지).
- invalidateQueries는 `useNotificationResponse` 훅 내에서 `useQueryClient`로 수행한다.

### REQ-NOTIF2-003: pull-to-refresh (RefreshControl) (Ubiquitous)

**The notification center screen** **shall** `RefreshControl`을 `ScrollView`에 부착하여 사용자가 아래로 당겨(pull) 알림 목록을 수동으로 갱신할 수 있게 한다.

**추가 제약**:
- `onRefresh` 핸들러는 `useNotifications`의 `refetch`를 호출한다.
- 갱신 중 로딩 스피너 표시(`refreshing` state)와 갱신 완료 후 스피너 해제가 동작한다.

---

## §C. 비기능 요건 (제약)

### §C.1 성능

- Realtime 구독은 화면 활성 시에만 유지된다(비활성 화면에서 좀비 구독 금지).
- invalidateQueries는 과도한 연쇄 트리거를 피하기 위해 디바운스나 throttle 없이 React Query 기본 동작에 맡긴다(React Query는 중복 invalidate를 자동으로 정규화).

### §C.2 보안

- Realtime 구독은 인증된 사용자 세션에서만 수립된다.
- 타인 알림은 RLS에 의해 Realtime 이벤트 수신 단계에서 차단된다(기존 `notifications_select_own` 정책이 Realtime에도 동일 적용됨 — Supabase 문서 확인 필요, plan.md §C 사전 검증 항목).

### §C.3 호환성

- SPEC-NOTIF-001의 모든 기존 동작(토큰 획득, 권한, 서버 등록, 템플릿, 라우팅)을 회귀시키지 않는다.
- 읽지 않은 카운트 배지(`useUnreadCount`)는 새 알림 반영 시 자동 갱신된다(invalidateQueries 파급).

---

## §D. 의존성

- **SPEC-NOTIF-001** (`depends_on`): 알림 센터 기반 인프라. SPEC-NOTIF-001은 2026-07-22 기준 `status: completed`(spec.md frontmatter).
- **Supabase Realtime**: `postgres_changes` 이벤트. 프로젝트에 이미 Realtime 인프라가 활성화되어 있는지 plan.md §C 사전 검증에서 확인한다.

---

## §E. 용어

- **Realtime**: Supabase의 WebSocket 기반 실시간 데이터베이스 변경사항 구독 기능.
- **`postgres_changes`**: Supabase Realtime에서 Postgres 행 변경(INSERT/UPDATE/DELETE)을 구독하는 채널 이벤트 유형.
- **invalidateQueries**: TanStack Query의 쿼리 무효화 API. 무효화된 쿼리는 활성 컴포넌트가 있으면 자동 재조회된다.
- **RefreshControl**: React Native의 pull-to-refresh UI 컴포넌트.

---

## §F. 검증 가능한 완료 조건 (요약)

상세 시나리오는 `acceptance.md`에 Given-When-Then 형식으로 정의한다. 핵심 완료 조건:
- 새 알림 서버 INSERT 시 앱 재시작 없이 알림 센터 목록에 즉시 표시 (REQ-NOTIF2-001)
- 포그라운드 푸시 수신 및 배너 클릭 시 알림 센터 목록이 즉시 갱신 (REQ-NOTIF2-002)
- 알림 센터 화면에서 아래로 당겨 수동 갱신 가능 (REQ-NOTIF2-003)
- SPEC-NOTIF-001 기능 회귀 없음

---

## §G. Out of Scope

### Out of Scope — 백그라운드 알림 수신

- 백그라운드 알림 수신 및 시스템 알림 표시는 SPEC-NOTIF-001 REQ-NOTIF-004 (N7, 2026-07-22 통과)의 영역이다. 본 SPEC은 클라이언트가 이미 수신한 알림의 "알림 센터 목록 반영" 경로만 다룬다.

### Out of Scope — 알림 배지 실시간 갱신 독립 최적화

- `useUnreadCount` 배지의 독립적인 Realtime 최적화(별도 채널, 별도 폴링 등)는 다루지 않는다. 단, REQ-NOTIF2-002의 `invalidateQueries({ queryKey: [NOTIFICATION_QUERY_PREFIX] })`가 `UNREAD_COUNT_KEY`에도 파급되어 자동 갱신되는 것은 기대 효과로 허용한다.

### Out of Scope — 알림 편집/삭제 기능

- 알림 행의 UPDATE(읽음 처리 외)/DELETE 기능은 SPEC-NOTIF-001 영역이며, 본 SPEC은 INSERT(새 알림 추가) 반영만 다룬다.

### Out of Scope — 푸시 권한/토큰/발송 인프라 변경

- Expo Push Token 획득, 권한 요청, 서버 등록, Edge Function 발송, FCM V1 크리덴셜은 모두 SPEC-NOTIF-001 영역이다. 본 SPEC은 크리덴셜/발송 계층을 건드리지 않는다.

### Out of Scope — 다른 화면의 Realtime 구독

- 알림 센터 외의 화면(감정 기록 상세, 클럽 피드 등)에 Realtime 구독을 추가하는 작업은 본 SPEC 범위 밖이다. REQ-NOTIF2-001은 알림 센터 화면의 `notifications` 테이블 INSERT 구독만 다룬다.

---

## §H. 관련 문서

- `SPEC-NOTIF-001/acceptance.md` — N7 통과 기록 + 본 SPEC 분리 근거 (§1 시나리오 N7 검증 상태, §3.3 수동 검증, §5 추적성 N7 행).
- `SPEC-NOTIF-001/plan.md` §N7-D — 수동 검증 체크리스트 4번째 항목 "알림 센터 목록에 해당 알림이 추가된다(Realtime 또는 재조회)" 부분 통과 표시 + 본 SPEC 이관 명시.
- `.moai/project/tech.md` — Supabase / Expo / React Native / TanStack Query 스택 검증 (plan-phase 사전 확인).
