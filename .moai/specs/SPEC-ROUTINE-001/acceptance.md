---
id: SPEC-ROUTINE-001
title: "독서 루틴 및 타이머 — 인수 기준"
version: "1.0.0"
status: draft
created: 2026-06-14
updated: 2026-06-14
author: "강력쇠주먹"
priority: medium
issue_number: 0
labels: [routine, timer, alarm, streak, reading-session, supabase, phase-4, acceptance]
---

# SPEC-ROUTINE-001: 인수 기준 (acceptance.md)

## HISTORY

| 날짜 | 버전 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 2026-06-14 | 1.0.0 | 최초 작성 — 10개 REQ에 대한 Given-When-Then 시나리오, 품질 게이트, 검증 방법 | 강력쇠주먹 |

---

## 1. 인수 시나리오 (Given-When-Then)

### REQ-ROUT-001: 독서 세션 시작

#### 시나리오 R1: 정상 세션 시작

**Given** 인증된 사용자가 서재에서 책 `book-1`을 선택했다
**And** 사용자에게 활성 세션(`ended_at IS NULL`)이 없다
**When** 사용자가 "독서 시작" 버튼을 탭한다
**Then** 시스템은 `reading_sessions`에 새 행을 INSERT한다
**And** 행은 `user_id={사용자 ID}`, `book_id=book-1`, `started_at=now()`, `ended_at=NULL` 값을 가진다
**And** 포그라운드 타이머가 00:00:00부터 시작된다

#### 시나리오 R2: 기존 활성 세션 자동 종료 후 새 세션 시작

**Given** 인증된 사용자에게 활성 세션(`session-A`, `book_id=book-1`, `ended_at=NULL`)이 존재한다
**When** 사용자가 책 `book-2`를 선택하고 "독서 시작" 버튼을 탭한다
**Then** 시스템은 `session-A`를 자동 종료한다 (`ended_at=now()`, `duration_seconds=경과 시간`)
**And** 새 세션(`book_id=book-2`, `started_at=now()`, `ended_at=NULL`)을 INSERT한다
**And** 포그라운드 타이머가 새 세션 기준으로 시작된다

#### 시나리오 R3: 타인 세션 접근 차단 (RLS)

**Given** 사용자 A와 사용자 B가 서로 다른 계정이다
**And** 사용자 A에게 활성 세션이 존재한다
**When** 사용자 B가 세션 조회를 시도한다
**Then** 시스템은 RLS(REQ-DB-021)에 의해 사용자 A의 세션을 노출하지 않는다
**And** 사용자 B는 본인 세션만 조회할 수 있다

---

### REQ-ROUT-002: 독서 세션 종료 및 duration 기록

#### 시나리오 R4: 정상 세션 종료

**Given** 인증된 사용자에게 활성 세션(`session-A`, `started_at=2026-06-14T10:00:00Z`)이 존재한다
**When** 사용자가 "독서 종료" 버튼을 탭한다 (현재 시각: 2026-06-14T10:30:00Z)
**Then** 시스템은 `session-A`를 UPDATE한다: `ended_at=2026-06-14T10:30:00Z`, `duration_seconds=1800` (30분)
**And** `duration_seconds`는 서버 측 `ended_at - started_at`으로 계산된다
**And** 포그라운드 타이머가 정지된다

#### 시나리오 R5: pages_read 선택적 기록

**Given** 사용자에게 활성 세션이 존재한다
**When** 사용자가 "독서 종료" 시 `pages_read=15`를 입력한다
**Then** 시스템은 `session` 행에 `pages_read=15`를 기록한다

**Given** 사용자에게 활성 세션이 존재한다
**When** 사용자가 "독서 종료" 시 `pages_read`를 입력하지 않는다
**Then** 시스템은 `pages_read`를 NULL로 유지한다 (선택적 필드)

#### 시나리오 R6: 종료 후 타이머 정리

**Given** 사용자가 세션을 종료했다 (시나리오 R4)
**When** 독서 타이머 화면을 확인한다
**Then** `setInterval`이 cleanup되어 타이머가 정지한다
**And** 메모리 누수가 발생하지 않는다

---

### REQ-ROUT-003: 독서 타이머 포그라운드 표시

#### 시나리오 R7: 실시간 타이머 표시

**Given** 사용자에게 활성 세션(`started_at=now()-120초`)이 존재한다
**When** 독서 타이머 화면을 확인한다
**Then** 타이머가 `00:02:00`으로 표시된다
**And** 1초마다 1초씩 증가한다 (`setInterval` 동작)

#### 시나리오 R8: 백그라운드 복귀 시 타이머 재동기화

**Given** 사용자에게 활성 세션(`started_at=now()-300초`)이 존재한다
**And** 타이머가 `00:05:00`에 표시되어 있다
**When** 앱이 백그라운드로 전환되었다가 60초 후 포그라운드로 복귀한다
**Then** 타이머가 `started_at` 기반으로 `00:06:00`으로 재동기화된다
**And** 백그라운드 중 `setInterval` 지연이 보정된다

---

### REQ-ROUT-004: 다정한 메시지 카피 표시

#### 시나리오 R9: 세션 종료 격려 메시지

**Given** 사용자가 세션을 종료했다 (`duration_seconds=1800`)
**When** 세션 종료 화면이 표시된다
**Then** 다정한 격려 메시지가 표시된다 (예: "오늘도 한 페이지, 잘 읽으셨어요")
**And** 메시지는 product.md 시나리오 1 톤앤매너를 준수한다 (강제적/의무적 표현 금지)

#### 시나리오 R10: 시작 유도 메시지

**Given** 사용자에게 활성 세션이 없다
**When** 독서 타이머 화면에 진입한다
**Then** "오늘의 첫 페이지가 당신을 기다리고 있어요" 메시지가 표시된다
**And** "독서 시작" 버튼이 노출된다

---

### REQ-ROUT-005: 독서 알림 시간 설정

#### 시나리오 R11: 알림 시간 설정

**Given** 인증된 사용자가 알림 설정 화면에 있다
**When** 사용자가 알림 시간을 `21:30`으로 입력하고 저장한다
**Then** 시스템은 `users.reading_alarm_time`을 `21:30:00`으로 업데이트한다
**And** 업데이트는 본인 행(`auth.uid()=id`)에만 적용된다 (RLS)

#### 시나리오 R12: 잘못된 시간 형식 거부

**Given** 인증된 사용자가 알림 설정 화면에 있다
**When** 사용자가 잘못된 형식(`25:99` 등)을 입력하고 저장을 시도한다
**Then** 시스템은 클라이언트 측 검증으로 업데이트를 거부한다
**And** "올바른 시간 형식이 아닙니다" 안내 메시지를 표시한다

---

### REQ-ROUT-006: 독서 알림 활성화/비활성화 토글

#### 시나리오 R13: 알림 비활성화

**Given** 인증된 사용자의 `reading_alarm_enabled=true`이다
**When** 사용자가 알림 토글을 off로 변경한다
**Then** 시스템은 `users.reading_alarm_enabled`를 `false`로 업데이트한다
**And** 이 사용자에게는 SPEC-NOTIF-001 알림이 발송되지 않는다 (계약 인터페이스)

#### 시나리오 R14: 알림 재활성화

**Given** 인증된 사용자의 `reading_alarm_enabled=false`이다
**When** 사용자가 알림 토글을 on으로 변경한다
**Then** 시스템은 `users.reading_alarm_enabled`를 `true`로 업데이트한다
**And** `reading_alarm_time`이 설정된 경우, SPEC-NOTIF-001이 알림을 재개할 수 있다

---

### REQ-ROUT-007: 알림 설정 조회

#### 시나리오 R15: 설정 화면 로드 시 현재 값 표시

**Given** 인증된 사용자의 `reading_alarm_time=21:00:00`, `reading_alarm_enabled=true`이다
**When** 사용자가 알림 설정 화면을 로드한다
**Then** 시스템은 현재 설정 값을 조회하여 표시한다
**And** 시간 필드에 `21:00`이, 토글에 `on`이 표시된다

#### 시나리오 R16: 설정 미설정 시 기본 표시

**Given** 인증된 사용자의 `reading_alarm_time=NULL`이다 (설정하지 않음)
**When** 사용자가 알림 설정 화면을 로드한다
**Then** 시스템은 시간 필드를 빈 값(또는 placeholder)으로 표시한다
**And** 토글은 기본값 `true`(SPEC-DB-001 REQ-DB-001)로 표시된다

---

### REQ-ROUT-008: 독서 통계 조회

#### 시나리오 R17: 누적 통계 조회

**Given** 인증된 사용자에게 종료된 세션이 10개 존재한다
**And** 총 `duration_seconds` 합계가 18000초(5시간)이다
**When** 사용자가 독서 통계 조회를 요청한다
**Then** 시스템은 `total_duration_seconds=18000`, `total_sessions=10`을 반환한다
**And** RLS(REQ-DB-021)에 의해 본인 세션만 집계된다

#### 시나리오 R18: 오늘 통계 조회

**Given** 오늘 날짜에 사용자가 2개 세션을 종료했다 (각 900초, 1200초)
**When** 사용자가 독서 통계 조회를 요청한다
**Then** 시스템은 `today_duration_seconds=2100`을 반환한다
**And** 다른 날짜의 세션은 `today_duration_seconds`에 포함되지 않는다

---

### REQ-ROUT-009: 연속 독서 일수(streak) 계산

#### 시나리오 R19: 연속 3일 streak

**Given** 사용자가 오늘, 어제, 그저께 세션을 종료했다 (`ended_at` 날짜가 연속)
**When** 시스템이 `current_streak`를 계산한다
**Then** 시스템은 `current_streak=3`을 반환한다 (자정 기준, 미결정 6.1 임시 방침)

#### 시나리오 R20: streak 리셋

**Given** 사용자가 3일 전 마지막으로 세션을 종료했다 (어제, 오늘 세션 없음)
**When** 시스템이 `current_streak`를 계산한다
**Then** 시스템은 `current_streak=0`을 반환한다 (연속 일수 끊김)

#### 시나리오 R21: streak 달성 메시지

**Given** 사용자의 streak가 2에서 3으로 증가했다 (오늘 첫 세션 종료)
**When** 세션 종료 처리가 완료된다
**Then** 다정한 streak 달성 메시지가 표시될 수 있다 (예: "며칠째 책과 함께하는군요. 당신의 발자취가 예뻐요")
**And** 메시지는 product.md 시나리오 1 톤앤매너를 준수한다

---

### REQ-ROUT-010: 목표 대비 진행률 표시

#### 시나리오 R22: 목표 진행률 표시

**Given** 사용자의 일일 목표가 900초(15분)이다 (미결정 6.2 임시값)
**And** 오늘 세션 합계가 450초(7.5분)이다
**When** 루틴 통계 위젯이 렌더링된다
**Then** `ProgressBar`가 50%로 표시된다 (450/900)
**And** 진행률이 시각적으로 표시된다

#### 시나리오 R23: 목표 달성 축하 메시지

**Given** 사용자의 일일 목표가 900초(15분)이다
**And** 오늘 세션 합계가 900초 이상이다
**When** 목표 달성 조건이 충족된다
**Then** 다정한 축하 메시지가 표시된다 (예: "오늘의 목표, 가볍게 닿았네요. 수고했어요")
**And** `ProgressBar`가 100%로 표시된다

#### 시나리오 R24: 목표 미설정 시 기본값

**Given** 사용자가 일일 목표를 명시적으로 설정하지 않았다
**When** 루틴 통계 위젯이 렌더링된다
**Then** 시스템은 기본값 900초(15분)를 사용하여 진행률을 표시한다 (미결정 6.2 임시값)
**And** 사용자가 목표를 변경하면 AsyncStorage에 저장된다

---

## 2. 품질 게이트 (Quality Gates)

### TRUST 5 검증

| 기둥 | 기준 | 검증 방법 |
|------|------|-----------|
| Tested | 85%+ 코드 커버리지 | Jest + @testing-library/react-native, 모든 시나리오 R1-R24 단위/통합 테스트 |
| Readable | 명확한 명명, 영어 주석 | ESLint, 코드 리뷰, 한국어 문서화 주석은 code_comments 설정(ko) 준수 |
| Unified | 일관된 스타일 | Prettier, ESLint 규칙, tokens.ts 기반 스타일링 (색/간격 하드코딩 금지) |
| Secured | RLS 의존, service_role 미사용 | RLS 정책 검증 테스트, 타인 세션 접근 차단 시나리오 R3 |
| Trackable | Conventional commits, SPEC 참조 | `feature/SPEC-ROUTINE-001-reading-timer` 브랜치, 커밋 메시지에 REQ-ROUT-XXX 참조 |

### LSP 품질 게이트 (run 단계)

- 0 에러, 0 타입 에러, 0 린트 에러 (TypeScript strict)
- 타이머 훅의 `useEffect` cleanup 검증 (메모리 누수 방지) — 시나리오 R6
- `AppState` 이벤트 리스너 cleanup 검증
- streak 계산 로직 타입 안정성 검증 (Date 조작)

---

## 3. 검증 방법 및 도구

### 3.1 단위 테스트

- **sessionApi**: PostgREST 쿼리 빌더 검증 — R1, R2, R4, R5 시나리오
- **useReadingTimer**: 타이머 시작/정지/재동기화 로직 — R7, R8 시나리오
- **streakCalculator**: 자정 기준 streak 계산 — R19, R20 시나리오
- **alarmApi**: 설정 조회/수정 쿼리 — R11, R13, R14 시나리오
- **goalStorage**: AsyncStorage 목표 저장/조회 — R22, R24 시나리오

### 3.2 통합 테스트

- **RLS 검증**: Supabase 로컬 개발 환경에서 타인 세션 접근 차단 확인 — R3
- **세션 자동 종료**: 활성 세션 존재 시 새 세션 시작 로직 — R2
- **duration_seconds 서버 계산**: `ended_at - started_at` 정확성 — R4
- **백그라운드 복귀**: `AppState` 이벤트 시뮬레이션 → 타이머 재동기화 — R8

### 3.3 수동 검증

- **다정한 메시지 카피**: product.md 시나리오 1 톤앤매너 준수 여행 시각 확인 — R9, R10, R21, R23
- **다크모드**: 타이머/통계 화면의 light/dark 모드 전환 시 가시성 확인
- **접근성**: WCAG AA 터치타겟(44dp), accessibilityLabel 준수 (토글, 버튼)
- **SPEC-NOTIF-001 계약**: 알림 설정 값이 SPEC-NOTIF-001에서 정상 소비됨을 확인 (협업 통합 테스트)

---

## 4. Definition of Done (완료 정의)

- [ ] 시나리오 R1-R24 모두 통과
- [ ] 단위 테스트 커버리지 85%+
- [ ] RLS 정책이 타인 세션 접근을 차단함을 통합 테스트로 검증
- [ ] `duration_seconds`가 서버 측 계산으로 정확함을 검증
- [ ] 백그라운드 복귀 시 타이머가 `started_at` 기반으로 재동기화됨을 검증
- [ ] 기존 활성 세션 자동 종료 로직이 정상 동작함을 검증
- [ ] streak가 자정 기준으로 정확히 계산됨을 검증
- [ ] 알림 설정이 `users` 테이블에 정확히 저장됨을 검증
- [ ] `Button`, `Card`, `ProgressBar`(SPEC-UI-001) 통합 동작 확인
- [ ] 다정한 메시지가 product.md 시나리오 1 톤앤매너를 준수함
- [ ] TRUST 5 모든 기둥 통과
- [ ] LSP 게이트 0 에러
- [ ] conventional commits + SPEC 참조

---

## 5. 추적성

| 시나리오 | REQ | 검증 유형 |
|----------|-----|-----------|
| R1 | REQ-ROUT-001 | 통합 (정상 세션 시작) |
| R2 | REQ-ROUT-001 | 통합 (활성 세션 자동 종료) |
| R3 | REQ-ROUT-001 | 통합 (RLS 차단) |
| R4 | REQ-ROUT-002 | 통합 (서버 측 duration 계산) |
| R5 | REQ-ROUT-002 | 단위 (pages_read 선택적) |
| R6 | REQ-ROUT-002 | 단위 (타이머 cleanup) |
| R7 | REQ-ROUT-003 | 단위 (실시간 타이머) |
| R8 | REQ-ROUT-003 | 통합 (백그라운드 복귀 재동기화) |
| R9 | REQ-ROUT-004 | 수동 (종료 격려 메시지) |
| R10 | REQ-ROUT-004 | 수동 (시작 유도 메시지) |
| R11 | REQ-ROUT-005 | 통합 (알림 시간 설정) |
| R12 | REQ-ROUT-005 | 단위 (형식 검증) |
| R13 | REQ-ROUT-006 | 통합 (알림 비활성화) |
| R14 | REQ-ROUT-006 | 통합 (알림 재활성화) |
| R15 | REQ-ROUT-007 | 단위 (설정 조회) |
| R16 | REQ-ROUT-007 | 단위 (미설정 기본 표시) |
| R17 | REQ-ROUT-008 | 통합 (누적 통계) |
| R18 | REQ-ROUT-008 | 통합 (오늘 통계) |
| R19 | REQ-ROUT-009 | 단위 (streak 계산) |
| R20 | REQ-ROUT-009 | 단위 (streak 리셋) |
| R21 | REQ-ROUT-009 | 수동 (streak 달성 메시지) |
| R22 | REQ-ROUT-010 | 단위 (목표 진행률) |
| R23 | REQ-ROUT-010 | 수동 (목표 달성 메시지) |
| R24 | REQ-ROUT-010 | 단위 (목표 기본값) |
