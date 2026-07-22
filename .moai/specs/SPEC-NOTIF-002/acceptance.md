---
id: SPEC-NOTIF-002
title: "알림 센터 실시간 갱신 — 인수 기준"
version: "0.1.0"
status: in-progress
created: 2026-07-22
updated: 2026-07-22
author: "강력쇠주먹"
priority: P2
phase: "v1.2.0"
module: "src/features/notification"
lifecycle: spec-anchored
tags: "notif, realtime, supabase, react-query, notification-center, refresh, acceptance"
tier: M
depends_on: [SPEC-NOTIF-001]
---

# SPEC-NOTIF-002: 인수 기준 (acceptance.md)

## HISTORY

| 날짜 | 버전 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 2026-07-22 | 0.1.0 | 최초 작성 — REQ-NOTIF2-001/002/003에 대한 Given-When-Then 시나리오, 품질 게이트, 검증 방법. 결함 진단은 grep 관측 기반. | 강력쇠주먹 |

---

## §1. 인수 시나리오 (Given-When-Then)

### REQ-NOTIF2-001: Realtime INSERT 이벤트 구독

#### 시나리오 N2-1: 새 알림 Realtime 자동 반영

**Given** 인증된 사용자가 알림 센터 화면을 열어 있다 (Realtime 채널 구독 중)
**And** 알림 센터에 기존 알림 5개가 표시 중이다
**When** 서버에서 해당 사용자의 `notifications` 테이블에 새 행이 INSERT 된다 (예: 다른 사용자가 감정 기록에 스티커 반응 → `send-notification` Edge Function 호출)
**Then** Realtime `postgres_changes` INSERT 이벤트가 클라이언트에 도달한다
**And** 알림 센터 목록이 앱 재시작 없이 즉시 갱신되어 새 알림이 상단에 표시된다
**And** 읽지 않은 카운트 배지가 1 증가한다

#### 시나리오 N2-2: 타인 알림 Realtime 차단 (RLS)

**Given** 사용자 A와 사용자 B가 서로 다른 세션으로 알림 센터를 열어 있다
**When** 사용자 B의 `notifications` 테이블에 새 행이 INSERT 된다
**Then** 사용자 A의 Realtime 채널은 해당 INSERT 이벤트를 수신하지 않는다 (RLS `notifications_select_own` 적용)
**And** 사용자 A의 알림 센터 목록은 변동 없다
**And** 사용자 B의 알림 센터에만 새 알림이 반영된다

#### 시나리오 N2-3: 화면 이탈 시 구독 cleanup

**Given** 사용자가 알림 센터 화면을 열어 있다 (Realtime 채널 활성)
**When** 사용자가 뒤로 가기 또는 다른 화면으로 이동한다 (컴포넌트 unmount)
**Then** Realtime 채널 구독이 해제된다 (useEffect cleanup)
**And** 이후 해당 사용자의 새 알림 INSERT가 있어도 좀비 구독으로 인한 갱신/메모리 누수가 발생하지 않는다

#### 시나리오 N2-4: 알림 센터 비활성 시 구독 부재

**Given** 사용자가 알림 센터가 아닌 다른 화면(예: 서재)에 있다
**When** 해당 사용자의 `notifications` 테이블에 새 행이 INSERT 된다
**Then** 클라이언트는 Realtime 구독을 수립하지 않는다 (알림 센터 화면 비활성)
**And** 다음 알림 센터 진입 시 `refetchOnMount` 또는 REQ-NOTIF2-002 경로로 반영된다
**And** 불필요한 WebSocket 트래픽이 발생하지 않는다

---

### REQ-NOTIF2-002: 푸시 수신/배너 클릭 시 쿼리 무효화

#### 시나리오 N2-5: 포그라운드 푸시 수신 시 목록 갱신

**Given** 사용자가 앱을 포그라운드에서 실행 중이고 알림 센터가 백그라운드에 캐시된 목록을 가지고 있다
**When** 푸시 알림이 도착하여 `Notifications.addNotificationReceivedListener`가 트리거된다
**Then** `useNotificationResponse` 훅이 `queryClient.invalidateQueries({ queryKey: [NOTIFICATION_QUERY_PREFIX] })`를 호출한다
**And** 알림 목록 쿼리가 재조회되어 새 알림이 반영된다
**And** 읽지 않은 카운트 쿼리도 무효화되어 갱신된다

#### 시나리오 N2-6: 알림 배너 탭 시 목록 갱신

**Given** 사용자가 포그라운드 heads-up 배너를 수신했다
**When** 사용자가 배너를 탭한다 (`addNotificationResponseReceivedListener` 트리거)
**Then** `queryClient.invalidateQueries`가 호출된다 (N2-5와 동일 경로)
**And** routeMapper가 type에 맞는 화면으로 라우팅한다 (SPEC-NOTIF-001 N8 동작 유지)
**And** 알림 센터 목록이 라우팅 전/후 즉시 갱신된다

#### 시나리오 N2-7: 기존 읽음 처리 패턴과 충돌 없음

**Given** 사용자가 알림 센터에서 알림을 탭하여 읽음 처리했다 (`useMarkAsRead` → invalidateQueries)
**When** 동시에 새 푸시가 도착하여 `useNotificationResponse`의 invalidateQueries가 트리거된다
**Then** 두 invalidateQueries가 충돌 없이 React Query에 의해 정규화된다 (중복 재조회 방지)
**And** 최종 목록 상태가 정합이다 (읽음 처리 + 새 알림 모두 반영)

---

### REQ-NOTIF2-003: pull-to-refresh (RefreshControl)

#### 시나리오 N2-8: 수동 갱신 (pull-to-refresh)

**Given** 사용자가 알림 센터 화면을 열어 있다
**When** 사용자가 목록 상단을 아래로 당긴다 (pull-to-refresh 제스처)
**Then** `RefreshControl`이 로딩 스피너를 표시한다 (`refreshing: true`)
**And** `useNotifications().refetch`가 호출된다
**And** 재조회 완료 시 스피너가 해제된다 (`refreshing: false`)
**And** 새 알림이 있으면 목록 상단에 반영된다

#### 시나리오 N2-9: 갱신 중 빈 목록 / 에러 처리

**Given** 알림 센터 목록이 비어 있거나 이전 재조회 에러 상태다
**When** 사용자가 pull-to-refresh를 수행한다
**Then** `RefreshControl` 스피너가 정상 표시/해제된다
**And** 에러 발생 시 사용자에게 에러가 조용히 전파되지 않고(`throw` 없음) 이전 상태가 유지되거나 빈 목록이 표시된다 (React Query 기본 에러 처리 준수)
**And** 앱 크래시가 발생하지 않는다

---

## §2. 품질 게이트 (Quality Gates)

### TRUST 5 검증

| 기축 | 기준 | 검증 방법 |
|------|------|-----------|
| Tested | 85%+ 코드 커버리지 | Jest + @testing-library/react-native. 시나리오 N2-1~N2-9 단위/통합 테스트. Realtime 구독은 모킹 채널로, invalidateQueries는 queryClient spy로 검증. |
| Readable | 명확한 명명, 한국어 주석 | ESLint, 코드 리뷰. `code_comments: ko` 준수. |
| Unified | 일관된 스타일 | Prettier, ESLint 규칙. 기존 `src/features/notification/` 스타일 준수. |
| Secured | RLS 의존, 인증된 세션만 구독 | N2-2(타인 알림 차단) 시나리오. Realtime 채널이 인증된 세션에서만 수립됨 확인. |
| Trackable | Conventional commits, SPEC 참조 | `feat(SPEC-NOTIF-002): ...` 커밋 메시지. REQ-NOTIF2-XXX 참조. |

### LSP 품질 게이트 (run 단계)

- 0 에러, 0 타입 에러, 0 린트 에러 (TypeScript strict).
- React Native / Expo 타입 정의 준수.
- `useEffect` cleanup 검증 (Realtime 채널 leak 방지).
- `RefreshControl` prop 타입 검증.

### 회귀 검증

- SPEC-NOTIF-001 기존 테스트 suite 전수 PASS (토큰 획득, 권한, 서버 등록, 읽음 처리, 라우팅, 템플릿).
- SPEC-NOTIF-001 인프라(PRESERVE §A.5) 변경 없음 — `git diff`로 확인.

---

## §3. 검증 방법 및 도구

### §3.1 단위 테스트

- **Realtime 구독 훅**: 모킹된 Supabase channel로 INSERT 이벤트 발생 → `invalidateQueries` 호출 확인 (N2-1, N2-3, N2-4). 단, 모킹된 클라이언트는 이벤트 도달 시의 클라이언트 동작(갱신/cleanup/filter 매칭)만 검증한다 — 서버 측 RLS 브로드캐스트 게이트는 단위 테스트로 검증 불가(N2-2는 §3.2 통합 테스트).
- **useNotificationResponse invalidateQueries**: `queryClient.invalidateQueries` spy로 호출 검증 (N2-5, N2-6).
- **NotificationsScreen RefreshControl**: 렌더링 + `onRefresh` → `refetch` 호출 확인 (N2-8, N2-9).

### §3.2 통합 테스트

- **Realtime E2E(로컬 Supabase)**: 인증된 세션에서 `notifications` INSERT → 클라이언트 캐시 갱신 (가능한 경우).
- **N2-2 타인 알림 RLS 브로드캐스트 차단 (통합 필수)**: 로컬 Supabase 환경에서 사용자 A/B 세션으로 검증 — B의 notifications INSERT 시 A가 이벤트를 수신하지 않음을 실제 RLS 게이트로 확인. 클라이언트 모킹으로는 서버 측 RLS 게이트를 검증할 수 없다(단위 테스트는 매칭되지 않은 이벤트 미표시만 검증 가능 — 실제 RLS 차단과 구분). RLS 브로드캐스트 게이트는 feed 선례 `supabase/migrations/20240620000001_enable_realtime_feed.sql` 주석의 팔로업 검증 시나리오 1-3(멤버/비회원/public 수신 분기)과 동일 방식으로 로컬 통합 테스트에서 검증한다.
- **SPEC-NOTIF-001 회귀**: 기존 테스트 suite 전수 PASS.

### §3.3 수동 검증 (실기기)

- **N2-1 실시간 반영**: 알림 센터 오픈 상태에서 서버(또는 Supabase Studio)에서 notifications INSERT → 앱 재시작 없이 목록 갱신 확인.
- **N2-5 포그라운드 수신 갱신**: prod 빌드(`f4a2e4b3` 또는 후속)에서 푸시 수신 시 백그라운드 캐시 목록 갱신 확인.
- **N2-8 pull-to-refresh**: 알림 센터 화면에서 아래로 당겨 스피너 표시 + 갱신 확인 (사용자가 2026-07-22 "당겨지지 않음"으로 보고한 결함 해소).

---

## §4. Definition of Done (완료 정의)

- [ ] 시나리오 N2-1 ~ N2-9 모두 통과
- [ ] 단위 테스트 커버리지 85%+ (`src/features/notification/` 신규/수정 파일)
- [ ] Realtime 구독이 인증된 사용자의 알림만 반영함을 검증 (N2-2)
- [ ] Realtime 채널 cleanup이 누수 없이 동작함을 검증 (N2-3)
- [ ] invalidateQueries가 푸시 수신/배너 클릭 양쪽에서 트리거됨을 검증 (N2-5, N2-6)
- [ ] RefreshControl이 로딩/해제 동작을 올바르게 수행함을 검증 (N2-8, N2-9)
- [ ] SPEC-NOTIF-001 기존 테스트 suite 전수 PASS (회귀 없음)
- [ ] TRUST 5 모든 기축 통과
- [ ] LSP 게이트 0 신규 에러 (baseline과 구분)
- [ ] Conventional Commits + `🗿 MoAI <email@mo.ai.kr>` 트레일러 + SPEC 참조

---

## §5. 추적성

| 시나리오 | REQ | 검증 유형 |
|----------|-----|-----------|
| N2-1 | REQ-NOTIF2-001 | 단위/수동 (Realtime 자동 반영) |
| N2-2 | REQ-NOTIF2-001 | 통합 (타인 알림 RLS 차단) |
| N2-3 | REQ-NOTIF2-001 | 단위 (구독 cleanup) |
| N2-4 | REQ-NOTIF2-001 | 단위 (비활성 시 구독 부재) |
| N2-5 | REQ-NOTIF2-002 | 단위 (포그라운드 수신 갱신) |
| N2-6 | REQ-NOTIF2-002 | 단위 (배너 탭 갱신) |
| N2-7 | REQ-NOTIF2-002 | 단위 (읽음 처리 패턴 충돌 없음) |
| N2-8 | REQ-NOTIF2-003 | 단위/수동 (pull-to-refresh) |
| N2-9 | REQ-NOTIF2-003 | 단위 (갱신 중 에러 처리) |
