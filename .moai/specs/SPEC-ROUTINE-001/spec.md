---
id: SPEC-ROUTINE-001
title: "독서 루틴 및 타이머"
version: "1.0.0"
status: draft
created: 2026-06-14
updated: 2026-06-14
author: "강력쇠주먹"
priority: medium
issue_number: 0
labels: [routine, timer, alarm, streak, reading-session, supabase, phase-4]
---

# SPEC-ROUTINE-001: 독서 루틴 및 타이머

## HISTORY

| 날짜 | 버전 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 2026-06-14 | 1.0.0 | 최초 작성 — 다정한 독서 알림 설정, 독서 타이머(reading_sessions 시작/종료), 독서 습관 추적(streak/누적 시간), 다정한 메시지 카피. SPEC-DB-001 REQ-DB-001/009/021 연동, SPEC-NOTIF-001 협업 경계 정의 | 강력쇠주먹 |

---

## 1. 환경 (Environment)

- **백엔드**: Supabase (관리형 PostgreSQL + PostgREST + Edge Functions)
- **데이터 엔터티**:
  - `reading_sessions` (SPEC-DB-001 REQ-DB-009) — 독서 타이머 세션 로그. 컬럼: `id(uuid PK)`, `user_id(uuid FK→users.id)`, `book_id(uuid FK→books.id)`, `started_at(timestamptz NOT NULL)`, `ended_at(timestamptz, nullable)`, `duration_seconds(integer)`, `pages_read(integer)`
  - `users` (SPEC-DB-001 REQ-DB-001) — 알림 설정. 컬럼: `reading_alarm_time(time)`, `reading_alarm_enabled(boolean default true)`. 추가: `id`, `nickname`
  - `user_books` (SPEC-DB-001 REQ-DB-003) — 책 컨텍스트. `current_page`, `book_id`
  - `books` (SPEC-DB-001 REQ-DB-002) — 책 메타데이터. `title`, `cover_url`, `total_pages`
- **성능 인덱스** (SPEC-DB-001 §4 / schema.md):
  - `reading_sessions (user_id, book_id)` — 발자국/독서 통계 집계 최적화
- **RLS 정책** (SPEC-DB-001 REQ-DB-021, 이미 구현됨):
  - `reading_sessions` 읽기/수정: `auth.uid() = user_id` 조건에서만 허용 (본인만)
- **API 서피스** (structure.md "Sessions"):
  - `POST /sessions` — 독서 세션 시작 (`started_at` 기록, `ended_at` null)
  - `PATCH /sessions/{id}/end` — 세션 종료 (`ended_at`, `duration_seconds`, `pages_read` 기록)
  - `GET /sessions/stats` — 독서 통계 (누적 시간, 루틴, streak)
- **클라이언트 타이머 환경**:
  - 포그라운드: React Native `setInterval`로 실시간 타이머 표시 (정확도 보장)
  - 백그라운드: OS 제약으로 인해 정확도 보장 불가 — 앱 재활성화 시 `started_at` 기반 재계산 (문서화만, 미결정 사항 6.3)
- **다정한 메시지 카피** (product.md 시나리오 1):
  - "오늘의 첫 페이지가 당신을 기다리고 있어요" — 독서 시작 유도 메시지
  - "오늘도 한 페이지, 잘 읽으셨어요" — 세션 종료 후 격려 메시지
  - "며칠째 책과 함께하는군요. 당신의 발자취가 예뻐요" — streak 달성 메시지
- **의존성**:
  - **SPEC-LIBRARY-001** (선행): 책 컨텍스트(`book_id`, `current_page`), 서재 조회
  - **SPEC-API-001** (선행): Supabase 클라이언트 싱글톤, 인증 헤더 자동 주입, 타입 안전 쿼리 래퍼
  - **SPEC-AUTH-001** (선행): 인증된 사용자 식별 (`auth.uid()`), 세션 관리
  - **SPEC-UI-001** (선행): 디자인 토큰, `Button`, `Card`, `ProgressBar` 컴포넌트 소비
- **협업 경계**:
  - **SPEC-NOTIF-001** (협력): 본 SPEC은 알림 "설정"(`reading_alarm_time`, `reading_alarm_enabled`)만 다룬다. 실제 알림 발송(Expo Push, 로컬 알림 스케줄링, `send-notification` Edge Function)은 SPEC-NOTIF-001 영역이다. 본 SPEC은 `users` 테이블의 설정 값을 읽고 쓰는 인터페이스만 제공한다.
- **플랫폼**: React Native + Expo SDK 55 (TypeScript strict). 클라이언트는 PostgREST 직접 호출, `service_role` 키 사용 금지
- **참조 SSOT**:
  - `.moai/project/product.md` 핵심 기능 "아날로그 루틴 헬퍼: 다정한 독서 알림, 독서 타이머", 사용 시나리오 1 "독서 지원 — 다정한 알림 + 첫 기록 보상"
  - `.moai/project/structure.md` API 서피스 "Sessions — `POST /sessions`, `PATCH /sessions/{id}/end`, `GET /sessions/stats`"
  - `.moai/project/tech.md` 푸시 알림 "다정한 독서 알림"
  - `.moai/project/db/schema.md` (reading_sessions 인덱스, RLS 정책)

---

## 2. 가정 (Assumptions)

### 2.1 아키텍처 가정

1. **타이머 정확도는 포그라운드에서만 보장**: 클라이언트 타이머(`setInterval`)는 앱이 포그라운드에 있을 때 정확하다. 백그라운드에서는 OS(iOS/Android)의 프로세스 관리 정책에 의해 타이머가 일시정지되거나 지연될 수 있다. 따라서 `duration_seconds`는 세션 종료 시 `ended_at - started_at`으로 서버 측에서 재계산하는 것을 기본 원칙으로 한다 (클라이언트 `setInterval` 카운트에 의존하지 않음).

2. **세션 시작/종료는 명시적 사용자 액션**: 독서 타이머는 사용자가 "독서 시작" 버튼을 눌러 세션을 시작하고, "독서 종료" 버튼을 눌러 종료하는 명시적 플로우를 따른다. 자동 시작(앱 실행 시 자동 세션 시작)이나 자동 종료(일정 시간 후 자동 종료)는 MVP에서 제공하지 않는다.

3. **RLS에 의존**: 모든 세션 데이터 접근 권한은 DB RLS(REQ-DB-021)가 단독 수행한다. 클라이언트는 권한 로직을 중복 구현하지 않는다. 사용자는 본인의 `reading_sessions` 행만 조회/수정할 수 있다.

4. **통계는 실시간 집계**: streak, 누적 시간 등 통계는 `reading_sessions` 테이블에서 `GET /sessions/stats` 호출 시 실시간으로 집계한다. 별도 집계 테이블(materialized view 등)은 두지 않는다. 인덱스 `(user_id, book_id)`로 집계 성능을 확보한다.

5. **알림 설정은 데이터 저장만**: 본 SPEC은 `users.reading_alarm_time` 및 `reading_alarm_enabled` 값을 읽고 쓰는 인터페이스만 제공한다. 이 값의 소비(알림 발송 스케줄링, 푸시 전송)는 SPEC-NOTIF-001이 담당한다.

### 2.2 비즈니스 가정

1. **다정한 톤앤매너**: 모든 메시지와 카피는 product.md 시나리오 1의 "오늘의 첫 페이지가 당신을 기다리고 있어요" 톤을 따른다. 강제적이거나 의무적인 표현("독서하세요", "목표 미달성")은 금지된다. 루틴은 부드러운 격려와 동기부여이지, 강제 리마인더가 아니다 (product.md 비목표 "강제 독서 리마인더").

2. **세션당 한 권의 책**: 독서 타이머 세션은 특정 책(`book_id`)에 귀속된다. 사용자는 서재에서 책을 선택한 후 타이머를 시작한다. 동시에 여러 책을 읽는 세션은 지원하지 않는다 (MVP 단순화).

3. **진행 중 세션은 하나만**: 사용자는 동시에 두 개 이상의 활성 세션(`ended_at IS NULL`)을 가질 수 없다. 새 세션 시작 시 기존 활성 세션이 있으면 자동으로 종료(ended_at 설정)한 후 새 세션을 시작한다.

4. **streak은 연속 독서 일수**: streak은 사용자가 연속으로 독서 세션을 기록한 일수이다. 하루에 한 번 이상 세션을 종료하면 streak이 유지되며, 하루라도 세션이 없으면 streak이 리셋된다. 정확한 streak 계산 기준(자정 vs 24시간 윈도우)은 미결정 사항 6.1로 연기한다.

5. **목표 설정은 클라이언트 측**: 일일/주간 독서 시간 목표는 MVP에서 클라이언트 측 설정(AsyncStorage 또는 로컬 상태)으로 관리한다. 서버 스키마(`users` 테이블)에 별도 목표 컬럼을 추가하지 않는다 (확장 단계 검토). 목표 달성 여부는 `GET /sessions/stats` 결과와 클라이언트 목표 값을 비교하여 표시한다.

---

## 3. 요구사항 (Requirements)

> 본 SPEC은 3개 요구사항 모듈로 구성된다: REQ-ROUT-TIMER, REQ-ROUT-ALARM, REQ-ROUT-STATS.

### REQ-ROUT-TIMER: 독서 타이머 (세션 시작/종료, duration_seconds 기록)

**목적**: 사용자가 특정 책에 대해 독서 세션을 시작하고 종료할 수 있게 한다. structure.md API 서피스 "`POST /sessions`", "`PATCH /sessions/{id}/end`"의 데이터 계층.

#### REQ-ROUT-001: 독서 세션 시작

**WHEN** 인증된 사용자가 서재에서 특정 책(`book_id`)을 선택하고 "독서 시작" 액션을 수행하면,
**THEN** 시스템은 `reading_sessions` 테이블에 새 행을 INSERT해야 한다. 행은 `user_id=auth.uid()`, `book_id={선택 책}`, `started_at=now()`, `ended_at=NULL`, `duration_seconds=NULL`, `pages_read=NULL` 값을 가진다.

**IF** 사용자에게 이미 활성 세션(`ended_at IS NULL`)이 존재하면,
**THEN** 시스템은 기존 활성 세션을 자동으로 종료(`ended_at=now()`, `duration_seconds=EXTRACT(EPOCH FROM (now() - started_at))` 계산)한 후, 새 세션을 시작해야 한다 (가정 2.2.3 — 세션당 하나만).

#### REQ-ROUT-002: 독서 세션 종료 및 duration 기록

**WHEN** 인증된 사용자가 활성 세션(`ended_at IS NULL`)에 대해 "독서 종료" 액션을 수행하면,
**THEN** 시스템은 해당 세션 행을 UPDATE해야 한다: `ended_at=now()`, `duration_seconds=EXTRACT(EPOCH FROM (now() - started_at))` (정수 초 단위). `pages_read`는 사용자가 입력한 경우(선택적) 기록한다.

> `duration_seconds`는 서버 측에서 `ended_at - started_at`으로 계산한다 (가정 2.1.1 — 클라이언트 타이머에 의존하지 않음). 이는 백그라운드 타이머 부정확성에 대한 방어이다.

**IF** 사용자가 `pages_read`를 입력하지 않으면,
**THEN** 시스템은 `pages_read`를 NULL로 유지한다 (선택적 필드). 세션 종료 후 `user_books.current_page` 업데이트는 SPEC-LIBRARY-001 영역이다 (본 SPEC은 세션 기록만 담당).

#### REQ-ROUT-003: 독서 타이머 포그라운드 표시

**WHILE** 활성 세션(`ended_at IS NULL`)이 존재하는 동안,
**THEN** 시스템은 포그라운드에서 실시간 타이머를 표시해야 한다. 타이머는 `started_at` 기반으로 경과 시간을 `setInterval`(1초 간격)로 표시하며, 형식은 `HH:MM:SS` 또는 `MM분 SS초`이다.

**IF** 앱이 백그라운드로 전환되었다가 포그라운드로 복귀하면,
**THEN** 시스템은 `started_at`을 기반으로 경과 시간을 재계산하여 타이머를 동기화해야 한다 (백그라운드 중 `setInterval`이 지연되었을 수 있으므로, 클라이언트 카운터가 아닌 서버 시간 기준).

#### REQ-ROUT-004: 다정한 메시지 카피 표시

**WHEN** 사용자가 세션을 종료하면,
**THEN** 시스템은 다정한 격려 메시지를 표시해야 한다. 메시지는 product.md 시나리오 1 톤앤매너를 준수하며, 세션 duration 또는 streak에 따라 변형될 수 있다 (예: "오늘도 한 페이지, 잘 읽으셨어요", 짧은 세션 시 "잠깐이라도 책을 펼친 용기가 예뻐요").

**WHERE** 사용자가 활성 세션 없이 독서 타이머 화면에 진입하면,
**THEN** 시스템은 "오늘의 첫 페이지가 당신을 기다리고 있어요" 시작 유도 메시지를 표시한다 (product.md 시나리오 1).

---

### REQ-ROUT-ALARM: 다정한 독서 알림 설정 (reading_alarm_time/enabled)

**목적**: 사용자가 다정한 독서 알림을 받을 시간과 활성화 여부를 설정할 수 있게 한다. structure.md API 서피스 "`POST /users/{id}/notifications`"의 알림 설정 인터페이스. 본 모듈은 설정 값의 저장/조회만 담당하며, 실제 발송은 SPEC-NOTIF-001이 담당한다.

#### REQ-ROUT-005: 독서 알림 시간 설정

**WHEN** 인증된 사용자가 알림 설정 화면에서 독서 알림 시간(`reading_alarm_time`)을 입력하면,
**THEN** 시스템은 `users` 테이블의 본인 행(`auth.uid() = id`)의 `reading_alarm_time` 컬럼을 업데이트해야 한다. 값은 `time` 타입(HH:MM:SS)이다.

**WHILE** `reading_alarm_time` 값이 설정 중일 때,
**THEN** 시스템은 값이 유효한 시간 형식(`00:00:00` ~ `23:59:59`)임을 클라이언트 측 검증으로 보장해야 한다. 잘못된 형식은 업데이트를 거부한다.

> 기본값은 명시되지 않는다 (SPEC-DB-001 REQ-DB-001에서 `reading_alarm_time`은 nullable). 사용자가 설정하지 않은 경우, SPEC-NOTIF-001은 알림을 발송하지 않거나 기본 시간(예: 21:00)을 적용할 수 있다 — 이는 SPEC-NOTIF-001의 결정 영역이다.

#### REQ-ROUT-006: 독서 알림 활성화/비활성화 토글

**WHEN** 인증된 사용자가 알림 설정 화면에서 독서 알림 토글(`reading_alarm_enabled`)을 on/off 하면,
**THEN** 시스템은 `users` 테이블의 본인 행의 `reading_alarm_enabled` 컬럼을 업데이트해야 한다. 값은 `boolean`이다 (기본값 `true` — SPEC-DB-001 REQ-DB-001).

**IF** `reading_alarm_enabled=false`이면,
**THEN** 시스템은 SPEC-NOTIF-001 알림 발송 계층에 "이 사용자에게는 독서 알림을 발송하지 않음" 신호를 전달해야 한다. 본 SPEC은 설정 값의 정확한 저장을 보장하며, 발송 로직의 소비는 SPEC-NOTIF-001이 검증한다.

#### REQ-ROUT-007: 알림 설정 조회

**WHEN** 인증된 사용자가 알림 설정 화면을 로드하면,
**THEN** 시스템은 본인의 `users.reading_alarm_time` 및 `reading_alarm_enabled` 값을 조회하여 표시해야 한다. RLS(REQ-DB-014)에 의해 본인 행만 조회된다.

---

### REQ-ROUT-STATS: 독서 습관 추적 (streak, 누적 시간, /sessions/stats)

**목적**: 사용자의 독서 습관(연속 일수, 누적 독서 시간, 일일/주간 통계)을 집계하여 표시한다. structure.md API 서피스 "`GET /sessions/stats` — 독서 통계 (누적 시간, 루틴)"의 데이터 계층.

#### REQ-ROUT-008: 독서 통계 조회

**WHEN** 인증된 사용자가 독서 통계 조회를 요청하면,
**THEN** 시스템은 본인의 `reading_sessions` 행을 기반으로 다음 통계를 집계하여 반환해야 한다:
- `total_duration_seconds` — 모든 종료된 세션(`ended_at IS NOT NULL`)의 `duration_seconds` 합계
- `total_sessions` — 종료된 세션 수
- `current_streak` — 현재 연속 독서 일수 (미결정 사항 6.1 계산 기준)
- `today_duration_seconds` — 오늘 날짜의 세션 duration 합계

**WHILE** 통계를 집계할 때,
**THEN** 시스템은 인덱스 `(user_id, book_id)`를 활용하여 집계 쿼리 성능을 최적화해야 한다. RLS(REQ-DB-021)에 의해 본인 세션만 집계된다.

#### REQ-ROUT-009: 연속 독서 일수(streak) 계산

**WHILE** `current_streak`를 계산할 때,
**THEN** 시스템은 종료된 세션(`ended_at IS NOT NULL`)의 `ended_at` 날짜를 기준으로 연속 일수를 산출해야 한다. 정확한 계산 기준(자정 기준 vs 24시간 윈도우)은 미결정 사항 6.1로 연기한다.

> 임시 방침: MVP에서는 자정(local timezone) 기준으로 "오늘 세션 종료 여부 → 어제 세션 종료 여부 → ..." 역순 검사로 streak를 계산한다. 하루라도 세션이 없으면 streak=0으로 리셋.

**WHEN** 사용자가 오늘 첫 세션을 종료하여 streak가 증가하면,
**THEN** 시스템은 다정한 streak 달성 메시지를 표시할 수 있다 (예: "며칠째 책과 함께하는군요. 당신의 발자취가 예뻐요" — product.md 시나리오 1 톤). 메시지 표시 시점(세션 종료 직후 vs 통계 화면 로드 시)은 구현 시 결정한다.

#### REQ-ROUT-010: 목표 대비 진행률 표시

**WHERE** 사용자가 일일/주간 독서 시간 목표를 클라이언트 측에 설정한 경우(가정 2.2.5),
**THEN** 시스템은 `today_duration_seconds`(또는 주간 합계)를 목표 값과 비교하여 진행률을 `ProgressBar`(SPEC-UI-001)로 표시해야 한다. 목표 달성 시 다정한 축하 메시지를 표시한다.

> 목표 기본값은 미결정 사항 6.2로 연기한다. MVP 임시값: 일일 15분(900초). 사용자가 설정을 변경하면 AsyncStorage에 저장한다.

---

## 4. 제외 범위 (Exclusions)

본 SPEC은 다음을 포함하지 않는다:

1. **알림 발송 로직**: Expo Push Notifications 통합, 로컬 알림 스케줄링, `send-notification` Edge Function, 알림 센터 UI는 SPEC-NOTIF-001 영역이다. 본 SPEC은 `users.reading_alarm_time` 및 `reading_alarm_enabled` 값의 저장/조회 인터페이스만 제공한다.
2. **강제 독서 리마인더**: product.md 비목표 "강제 독서 리마인더". 사용자가 설정하지 않은 시간에 강제로 알림을 보내거나, 독서를 하지 않았다고 경고하는 기능은 제공하지 않는다. 모든 알림은 다정하고 자발적이다.
3. **백그라운드 타이머 정확도 보장**: OS(iOS/Android)의 백그라운드 프로세스 관리로 인한 타이머 부정확성은 "문서화만" 수행한다 (가정 2.1.1). 백그라운드에서 정확한 타이머를 유지하기 위한 네이티브 모듈 구현은 MVP 밖이다. `duration_seconds`는 서버 측 `ended_at - started_at` 계산으로 보완한다.
4. **외부 캘린더 연동**: Google Calendar, Apple Calendar 등 외부 캘린더와의 독서 일정 동기화는 MVP 밖이다.
5. **소셜 독서 루틴 공유**: 다른 사용자와의 루틴 비교, 루틴 챌린지, 리더보드는 product.md 비목표 "좋아요/팔로워 경쟁 메커니즘" 회피로 제공하지 않는다.
6. **독서 속도 분석**: 페이지당 평균 시간, 예상 완독일 계산 등 고급 분석은 확장 단계이다.
7. **서재 진도 업데이트**: 세션 종료 후 `user_books.current_page` 업데이트는 SPEC-LIBRARY-001 영역이다. 본 SPEC은 세션 기록(`reading_sessions`)만 담당한다.
8. **Edge Function 로직**: 세션 시작/종료/통계는 PostgREST 직접 호출로 처리한다. 전용 Edge Function은 두지 않는다 (RLS + 클라이언트 직접 호출로 충분).

---

## 5. 미결정 사항 (Open Questions)

### 5.1 streak 계산 기준 (자정 vs 24시간 윈도우) — 미해결

**상태**: 연속 독서 일수(streak)를 계산할 때, "하루"의 기준이 자정(local timezone)인지, 마지막 세션 종료 시각으로부터 24시간 윈도우인지 명확하지 않다.

**임시 방침**: MVP에서는 자정(local timezone) 기준을 채택한다. "오늘 날짜(YYYY-MM-DD)에 종료된 세션이 있는가?"를 역순으로 검사하여 streak를 계산한다. 자정 기준이 사용자 직관에 부합하고 구현이 단순하다.

**해결 시점**: v1.1.0에서 사용자 피드백 기반으로 24시간 윈도우 방식 검토 (야심한 시간대 독서자에게 유리할 수 있음).

### 5.2 일일 목표 기본값 — 미해결

**상태**: 클라이언트 측 일일 독서 시간 목표의 기본값이 정의되지 않았다.

**임시 방침**: MVP 임시값은 일일 15분(900초). 사용자가 설정 화면에서 변경 가능하며, AsyncStorage에 저장된다. 서버 스키마 변경 없이 클라이언트 측 관리.

**해결 시점**: v1.1.0에서 온보딩 시 목표 설정 단계 도입 검토.

### 5.3 백그라운드 타이머 폴백 전략 — 미해결

**상태**: 앱이 백그라운드로 전환 중일 때 활성 세션의 타이머를 어떻게 처리할지(자동 종료, 알림 표시, 무시)가 정의되지 않았다.

**임시 방침**: MVP에서는 백그라운드 전환 시 세션을 자동으로 종료하지 않는다. 사용자가 앱을 재활성화하면 `started_at` 기반으로 타이머를 재동기화한다 (REQ-ROUT-003). 백그라운드 중 타이머가 멈춘 것처럼 보일 수 있으나, `duration_seconds`는 서버 측 계산으로 정확하다.

**해결 시점**: v1.1.0에서 백그라운드 진입 시 로컬 알림("독서 중이에요 — 돌아오시나요?") 표시 검토 (SPEC-NOTIF-001 협력).

---

## 6. 추적성 (Traceability)

| TAG | 요구사항 | 소스 |
|-----|---------|------|
| SPEC-ROUTINE-001 | REQ-ROUT-001 ~ REQ-ROUT-010 | `.moai/project/product.md` 핵심 기능 "아날로그 루틴 헬퍼"·사용 시나리오 1·비목표, `.moai/project/structure.md` API "Sessions — `POST /sessions`, `PATCH /sessions/{id}/end`, `GET /sessions/stats`", `.moai/project/tech.md` 푸시 알림 "다정한 독서 알림", SPEC-DB-001 REQ-DB-001/009/021, SPEC-NOTIF-001 협업 경계, `.moai/project/db/schema.md` reading_sessions 인덱스·RLS 정책 |

### 의존성 역추적

| 의존 SPEC | 본 SPEC이 소비하는 산출물 |
|-----------|--------------------------|
| SPEC-DB-001 | `reading_sessions`(REQ-DB-009 — started_at, ended_at, duration_seconds, pages_read), `users`(REQ-DB-001 — reading_alarm_time, reading_alarm_enabled), `user_books`(REQ-DB-003 — current_page 컨텍스트), RLS(REQ-DB-021 — reading_sessions 본인만), 인덱스 `(user_id, book_id)`(§4) |
| SPEC-LIBRARY-001 | 책 컨텍스트(`book_id` 식별), 서재 목록 조회, 세션 종료 후 `current_page` 업데이트 연동 |
| SPEC-API-001 | Supabase 클라이언트 싱글톤, 인증 헤더 자동 주입, 타입 안전 쿼리 래퍼 |
| SPEC-AUTH-001 | 인증된 사용자 식별(`auth.uid()`), 세션 관리 |
| SPEC-UI-001 | 디자인 토큰(light/dark), `Button`, `Card`, `ProgressBar` 컴포넌트 |

### 협업 경계 (SPEC-NOTIF-001)

| 본 SPEC 담당 | SPEC-NOTIF-001 담당 |
|-------------|---------------------|
| `users.reading_alarm_time` 값 저장/조회 | 설정된 시간에 로컬 알림 스케줄링 |
| `users.reading_alarm_enabled` 토글 저장/조회 | 토글 상태 기반 알림 발송 제어 |
| 알림 설정 화면 UI | Expo Push 토큰 관리, 알림 센터 UI |
| 다정한 메시지 카피 (세션 종료/streak) | 다정한 독서 알림 카피 (발송용) |
