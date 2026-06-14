---
id: SPEC-ROUTINE-001
title: "독서 루틴 및 타이머 — 구현 계획"
version: "1.0.0"
status: draft
created: 2026-06-14
updated: 2026-06-14
author: "강력쇠주먹"
priority: medium
issue_number: 0
labels: [routine, timer, alarm, streak, reading-session, supabase, phase-4, plan]
---

# SPEC-ROUTINE-001: 구현 계획 (plan.md)

## HISTORY

| 날짜 | 버전 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 2026-06-14 | 1.0.0 | 최초 작성 — 3개 마일스톤, 기술 접근, 아키텍처 방향, 리스크 대응 | 강력쇠주먹 |

---

## 1. 마일스톤 (우선순위 기반)

> 본 계획은 시간 예측을 사용하지 않으며, 우선순위 기반 마일스톤으로 진행 순서를 정의한다.

### Primary Goal (1순위): 독서 타이머 핵심 기능

**범위**: REQ-ROUT-TIMER (REQ-ROUT-001 ~ REQ-ROUT-004)

**산출물**:
- `src/features/routine/sessionApi.ts` — PostgREST 세션 시작/종료 쿼리 함수
  - `startSession(bookId)` — `POST /sessions` (또는 PostgREST INSERT). 기존 활성 세션 자동 종료 로직 포함
  - `endSession(sessionId, pagesRead?)` — `PATCH /sessions/{id}/end`. `duration_seconds` 서버 계산
- `src/features/routine/useReadingTimer.ts` — 포그라운드 타이머 훅 (`setInterval` 1초, `started_at` 기반)
- `src/features/routine/useActiveSession.ts` — 활성 세션 조회/관리 훅
- `src/features/routine/copy.ts` — 다정한 메시지 카피 상수 (시작 유도, 종료 격려, streak 달성)
- 독서 타이머 화면 (`app/(tabs)/library/[bookId]/timer.tsx` 또는 유사 경로)
- `Button`(SPEC-UI-001) "독서 시작" / "독서 종료" 통합

**완료 기준**:
- 사용자가 책을 선택하고 독서 세션을 시작/종료할 수 있다
- 기존 활성 세션이 있으면 자동 종료 후 새 세션 시작
- 포그라운드에서 실시간 타이머가 표시된다
- 백그라운드 복귀 시 `started_at` 기반으로 타이머가 재동기화된다
- `duration_seconds`가 서버 측 `ended_at - started_at`으로 정확히 계산된다
- 다정한 메시지가 시작/종료 시점에 표시된다

**의존성 완료 조건**: SPEC-LIBRARY-001 (책 컨텍스트), SPEC-API-001 (Supabase 클라이언트), SPEC-AUTH-001 (인증), SPEC-UI-001 (Button/Card)

### Secondary Goal (2순위): 독서 알림 설정

**범위**: REQ-ROUT-ALARM (REQ-ROUT-005 ~ REQ-ROUT-007)

**산출물**:
- `src/features/routine/alarmApi.ts` — 알림 설정 조회/수정 함수
  - `getAlarmSettings()` — `users.reading_alarm_time`, `reading_alarm_enabled` 조회
  - `updateAlarmTime(time)` — `reading_alarm_time` 업데이트
  - `toggleAlarmEnabled(enabled)` — `reading_alarm_enabled` 토글
- `src/features/routine/useAlarmSettings.ts` — 알림 설정 상태 관리 훅
- 알림 설정 UI (마이페이지 내 설정 섹션 또는 별도 화면)
- 시간 선택 컴포넌트 (React Native `DateTimePicker` 또는 커스텀)

**완료 기준**:
- 사용자가 독서 알림 시간을 설정/변경할 수 있다
- 독서 알림 활성화/비활성화 토글이 동작한다
- 설정 값이 `users` 테이블에 정확히 저장된다 (RLS 검증)
- 설정 화면 로드 시 현재 값이 표시된다
- SPEC-NOTIF-001이 이 설정 값을 소비할 수 있는 인터페이스가 준비된다

**의존성 완료 조건**: Primary Goal 완료, SPEC-AUTH-001 (사용자 식별)

### Final Goal (3순위): 독서 습관 추적 및 통계

**범위**: REQ-ROUT-STATS (REQ-ROUT-008 ~ REQ-ROUT-010)

**산출물**:
- `src/features/routine/statsApi.ts` — `GET /sessions/stats` 집계 쿼리
  - `getReadingStats()` — total_duration_seconds, total_sessions, current_streak, today_duration_seconds
  - streak 계산 로직 (자정 기준, 미결정 6.1 임시 방침)
- `src/features/routine/useReadingStats.ts` — 통계 조회 훅
- `src/features/routine/goalStorage.ts` — 클라이언트 측 목표 관리 (AsyncStorage)
- 루틴 통계 위젯 (홈 화면 또는 마이페이지 내)
- `ProgressBar`(SPEC-UI-001) 목표 대비 진행률 표시

**완료 기준**:
- 누적 독서 시간, 총 세션 수, 현재 streak가 정확히 집계된다
- 인덱스 `(user_id, book_id)`가 통계 쿼리에 활용된다
- streak가 자정 기준으로 정확히 계산된다 (미결정 6.1 임시 방침)
- 일일 목표 대비 진행률이 `ProgressBar`로 표시된다
- streak 달성 시 다정한 메시지가 표시된다

**의존성 완료 조건**: Primary Goal 완료 (세션 데이터 축적 필요)

---

## 2. 기술 접근 (Technical Approach)

### 2.1 세션 데이터 계층

- **PostgREST 직접 호출**: `POST /sessions`, `PATCH /sessions/{id}/end`는 클라이언트에서 PostgREST 쿼리로 구성한다. 별도 Edge Function은 두지 않는다 (제외 범위 8).
- **세션 시작 쿼리**:
  - 기존 활성 세션 자동 종료: `UPDATE reading_sessions SET ended_at=now(), duration_seconds=EXTRACT(EPOCH FROM (now() - started_at)) WHERE user_id=auth.uid() AND ended_at IS NULL`
  - 새 세션 INSERT: `INSERT INTO reading_sessions (user_id, book_id, started_at) VALUES (auth.uid(), {bookId}, now())`
  - 두 쿼리는 원자적 트랜잭션으로 실행 (RLS 정책으로 본인 세션만 조작)
- **세션 종료 쿼리**:
  - `UPDATE reading_sessions SET ended_at=now(), duration_seconds=EXTRACT(EPOCH FROM (now() - started_at)), pages_read={pagesRead} WHERE id={sessionId} AND user_id=auth.uid()`
  - `duration_seconds`는 서버 측 계산 (가정 2.1.1 — 클라이언트 타이머에 의존하지 않음)
- **권한**: RLS(REQ-DB-021)가 단독 검증. 클라이언트는 권한 로직 미구현.

### 2.2 포그라운드 타이머 계층

- **실시간 표시**: `useReadingTimer` 훅이 `setInterval(1000)`으로 1초마다 경과 시간을 재계산한다. 계산은 `Date.now() - started_at.getTime()` 기반 (클라이언트 카운터가 아님).
- **백그라운드 복귀 동기화**: 앱 상태 변화(`AppState` 이벤트)를 감지하여, `active` 복귀 시 `started_at` 기반으로 타이머를 재동기화한다 (REQ-ROUT-003). 백그라운드 중 `setInterval` 지연을 보정한다.
- **포맷팅**: 경과 시간을 `HH:MM:SS` 또는 `MM분 SS초`로 포맷팅하여 화면에 표시한다.

### 2.3 알림 설정 계층

- **설정 조회**: `users` 테이블에서 본인 행(`auth.uid() = id`)의 `reading_alarm_time`, `reading_alarm_enabled`를 SELECT. RLS(REQ-DB-014)가 본인 행만 노출.
- **설정 수정**: `UPDATE users SET reading_alarm_time={time} WHERE id=auth.uid()` (RLS own-row UPDATE 정책).
- **시간 형식 검증**: 클라이언트 측에서 `HH:MM` 입력을 `HH:MM:SS` time 타입으로 변환. 유효성 검증 후 서버 전송.
- **SPEC-NOTIF-001 인터페이스**: 본 SPEC은 설정 값의 정확한 저장을 보장한다. SPEC-NOTIF-001은 `users` 테이블을 조회하여 알림 발송 스케줄을 결정한다. 두 SPEC 간의 계약은 `reading_alarm_time` (time) + `reading_alarm_enabled` (boolean) 두 컬럼이다.

### 2.4 통계 집계 계층

- **집계 쿼리**: `GET /sessions/stats`는 PostgREST RPC(사용자 정의 함수) 또는 클라이언트 측 집계로 구현한다.
  - 옵션 A: PostgREST `rpc('get_reading_stats')` — 서버 측 PL/pgSQL 함수로 집계 (성능 유리)
  - 옵션 B: 클라이언트에서 `reading_sessions` SELECT 후 JS 집계 (단순하지만 대량 데이터 시 성능 저하)
  - MVP 권장: 옵션 A (서버 측 집계 함수) — 인덱스 `(user_id, book_id)` 활용
- **streak 계산**: 종료된 세션의 `ended_at::date`를 역순 정렬하여 연속 일수를 계산한다.
  ```sql
  WITH dates AS (
    SELECT DISTINCT (ended_at AT TIME ZONE 'Asia/Seoul')::date AS d
    FROM reading_sessions
    WHERE user_id = auth.uid() AND ended_at IS NOT NULL
  )
  SELECT count(*) AS streak
  FROM dates
  WHERE d >= (
    SELECT COALESCE(MAX(d), CURRENT_DATE)
    FROM dates
    WHERE d <= CURRENT_DATE
  ) - (COUNT_GAP)  -- 연속 일수 역추적 로직
  ```
  정확한 SQL은 구현 시 작성하며, 자정(local timezone) 기준을 따른다 (미결정 6.1 임시 방침).
- **목표 관리**: `goalStorage.ts`가 AsyncStorage로 일일/주간 목표를 저장/조회한다. 서버 스키마 변경 없음 (가정 2.2.5).

### 2.5 상태 관리

- **세션 상태**: React Query(TanStack Query) 또는 로컬 상태로 활성 세션 캐싱.
- **타이머 상태**: `useReadingTimer` 훅 내부 `useRef`로 interval ID 관리, `useEffect` cleanup으로 메모리 누수 방지.
- **통계 캐싱**: 세션 종료 후 통계 쿼리 invalidate로 최신화.

---

## 3. 아키텍처 설계 방향

### 3.1 모듈 구조

```
src/features/routine/
  sessionApi.ts           # PostgREST 세션 시작/종료 쿼리
  alarmApi.ts             # 알림 설정 조회/수정 쿼리
  statsApi.ts             # 통계 집계 쿼리 (GET /sessions/stats)
  useReadingTimer.ts      # 포그라운드 타이머 훅 (setInterval + AppState 동기화)
  useActiveSession.ts     # 활성 세션 조회/관리 훅
  useAlarmSettings.ts     # 알림 설정 상태 관리 훅
  useReadingStats.ts      # 통계 조회 훅
  goalStorage.ts          # 클라이언트 측 목표 관리 (AsyncStorage)
  streakCalculator.ts     # streak 계산 로직 (자정 기준)
  copy.ts                 # 다정한 메시지 카피 상수
  types.ts                # ReadingSession, ReadingStats, AlarmSettings 타입
  index.ts                # 공개 API
```

### 3.2 데이터 흐름

```
[독서 세션 시작]
  → 사용자가 서재에서 책 선택 (SPEC-LIBRARY-001)
  → startSession(bookId) 호출
  → 기존 활성 세션 자동 종료 (있다면)
  → reading_sessions INSERT (started_at=now(), ended_at=NULL)
  → useReadingTimer 시작 (setInterval 1초)
  → "오늘의 첫 페이지가 당신을 기다리고 있어요" 표시

[독서 세션 종료]
  → 사용자가 "독서 종료" 버튼 탭
  → endSession(sessionId, pagesRead?) 호출
  → reading_sessions UPDATE (ended_at=now(), duration_seconds=서버 계산)
  → useReadingTimer 정지 (cleanup)
  → "오늘도 한 페이지, 잘 읽으셨어요" 표시
  → useReadingStats invalidate (통계 갱신)
  → (선택) user_books.current_page 업데이트 (SPEC-LIBRARY-001)

[백그라운드 → 포그라운드 복귀]
  → AppState 'active' 이벤트
  → useReadingTimer started_at 기반 재동기화
  → 타이머 표시 갱신 (서버 시간 기준)

[알림 설정 변경]
  → 사용자가 시간/토글 변경
  → updateAlarmTime / toggleAlarmEnabled 호출
  → users 테이블 업데이트 (RLS own-row)
  → SPEC-NOTIF-001이 다음 알림 스케줄 시 이 값 소비
```

### 3.3 RLS 및 인덱스 연동

- **세션 권한**: RLS(REQ-DB-021)가 `reading_sessions`를 본인(`auth.uid()=user_id`)만 접근 허용. 클라이언트 권한 로직 불필요.
- **알림 설정 권한**: RLS(REQ-DB-014)가 `users` 테이블을 본인(`auth.uid()=id`)만 조회/수정 허용.
- **통계 성능**: 인덱스 `(user_id, book_id)`로 통계 집계 쿼리 최적화. 사용자별 세션 필터링이 인덱스로 빠르게 처리된다.

### 3.4 SPEC-NOTIF-001 협업 경계

```
[본 SPEC (ROUTINE)]                [SPEC-NOTIF-001]
  알림 설정 UI                        Expo Push 통합
  reading_alarm_time 저장 ───────→  설정된 시간에 알림 스케줄
  reading_alarm_enabled 토글 ────→  토글 상태 기반 발송 제어
  세션 종료 격려 메시지                로컬 알림 카피 (발송용)
  streak 달성 메시지                   알림 센터 UI
```

두 SPEC은 `users.reading_alarm_time` (time) + `users.reading_alarm_enabled` (boolean) 두 컬럼을 계약 인터페이스로 사용한다. 본 SPEC은 쓰기 측, SPEC-NOTIF-001은 읽기(소비) 측을 담당한다.

---

## 4. 리스크 및 대응 계획

### 리스크 1: 백그라운드 타이머 부정확성

**위험**: 앱이 백그라운드 중일 때 `setInterval`이 OS에 의해 지연/정지되어, 사용자가 포그라운드로 돌아왔을 때 타이머 표시가 부정확할 수 있다.

**대응**: `duration_seconds`는 서버 측 `ended_at - started_at`으로 계산한다 (REQ-ROUT-002). 클라이언트 타이머는 표시용일 뿐이며, 백그라운드 복귀 시 `started_at` 기반 재동기화로 표시를 보정한다 (REQ-ROUT-003). 최종 기록 값은 항상 서버 계산을 따른다.

### 리스크 2: streak 계산 경계 케이스

**위험**: 자정 경계(23:50 세션 종료 → 00:10 다음 세션 종료)에서 streak 계산이 직관과 다를 수 있다. 사용자가 "매일 읽었다"고 인식하지만, 날짜 경계로 인해 streak가 끊길 수 있다.

**대응**: MVP에서는 자정(local timezone) 기준을 명확히 문서화한다 (미결정 6.1). 24시간 윈도우 방식은 v1.1.0에서 검토. 사용자 피드백 수집 후 기준 조정.

### 리스크 3: 기존 활성 세션 자동 종료 시 데이터 손실

**위험**: 사용자가 세션을 종료하지 않은 채 새 세션을 시작하면, 기존 활성 세션이 자동 종료된다. 이때 기존 세션의 `duration_seconds`가 매우 길어질 수 있다 (예: 어제 시작하고 종료 안 함 → 24시간).

**대응**: 자동 종료 시 `duration_seconds`를 실제 경과 시간으로 기록한다. 사용자에게 "이전 세션이 자동으로 종료되었어요" 안내 메시지를 표시한다. 비정상적으로 긴 세션(예: 8시간 초과)에 대한 사용자 확인 다이얼로그는 확장 단계에서 검토.

### 리스크 4: 통계 집계 성능

**위험**: 세션 데이터가 누적될 경우, `GET /sessions/stats` 집계 쿼리 성능이 저하될 수 있다.

**대응**: 인덱스 `(user_id, book_id)`로 사용자별 필터링을 최적화한다. 통계 쿼리는 본인 세션만 집계하므로 데이터 범위가 제한적이다. MVP 니치 시장 규모(product.md)에서는 성능 문제 가능성이 낮다. 확장 단계에서 materialized view 검토.

---

## 5. 제외 범위 (구현하지 않을 항목)

본 계획은 spec.md §4 제외 범위를 준수한다. 추가로 다음을 구현하지 않는다:

1. **Edge Function**: 세션 시작/종료/통계용 Edge Function은 두지 않는다. PostgREST 직접 호출 + (선택) RPC 함수.
2. **집계 테이블**: streak/누적 시간용 별도 테이블은 두지 않는다. `reading_sessions`에서 실시간 집계.
3. **서버 측 목표 저장**: 일일/주간 목표는 클라이언트(AsyncStorage)에만 저장한다. `users` 테이블에 목표 컬럼 추가 안 함 (확장 단계 검토).
4. **오프라인 세션 기록**: MVP에서는 오프라인 상태에서 세션 시작/종료를 지원하지 않는다. 네트워크 연결 필수 (세션 시작/종료는 서버 기록).

---

## 6. 완료 정의 (Definition of Done)

- [ ] REQ-ROUT-001 ~ REQ-ROUT-010 모든 요구사항 구현
- [ ] acceptance.md 모든 시나리오 통과
- [ ] TRUST 5 품질 게이트 통과 (테스트 커버리지 85%+)
- [ ] RLS 정책이 본인 세션만 접근 허용함을 검증
- [ ] `duration_seconds`가 서버 측 계산으로 정확함을 검증
- [ ] 백그라운드 복귀 시 타이머가 `started_at` 기반으로 재동기화됨을 검증
- [ ] 기존 활성 세션 자동 종료 로직이 정상 동작함을 검증
- [ ] streak가 자정 기준으로 정확히 계산됨을 검증
- [ ] 알림 설정이 `users` 테이블에 정확히 저장됨을 검증
- [ ] `Button`, `Card`, `ProgressBar`(SPEC-UI-001) 통합 동작 확인
- [ ] 다정한 메시지 카피가 product.md 시나리오 1 톤앤매너를 준수함
- [ ] 인덱스 `(user_id, book_id)` 활용 검증

---

## 7. 추적성

| 계획 요소 | 연결된 REQ | 소스 |
|-----------|-----------|------|
| Primary Goal | REQ-ROUT-001, REQ-ROUT-002, REQ-ROUT-003, REQ-ROUT-004 | spec.md §3 REQ-ROUT-TIMER |
| Secondary Goal | REQ-ROUT-005, REQ-ROUT-006, REQ-ROUT-007 | spec.md §3 REQ-ROUT-ALARM |
| Final Goal | REQ-ROUT-008, REQ-ROUT-009, REQ-ROUT-010 | spec.md §3 REQ-ROUT-STATS |
| 미결정 6.1 (streak 기준) | REQ-ROUT-009 | spec.md §5.1 — 자정 기준 임시 방침 |
| 미결정 6.2 (목표 기본값) | REQ-ROUT-010 | spec.md §5.2 — 일일 15분 임시값 |
| 미결정 6.3 (백그라운드 폴백) | REQ-ROUT-003 | spec.md §5.3 — 자동 종료 안 함 임시 방침 |
