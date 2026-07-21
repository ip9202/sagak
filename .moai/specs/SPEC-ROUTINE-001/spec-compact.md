---
id: SPEC-ROUTINE-001
title: "독서 루틴 및 타이머 — Compact"
version: "1.0.0"
status: draft
created: 2026-06-14
updated: 2026-06-14
author: "강력쇠주먹"
priority: medium
issue_number: 0
labels: [routine, timer, alarm, streak, reading-session, supabase, phase-4, compact]
---

# SPEC-ROUTINE-001: Compact 요약

> 본 문서는 spec.md의 핵심만 추약한 실행용 요약이다. 상세는 spec.md를 참조한다.

## 핵심 범위

독서 루틴 헬퍼 기능. (1) 다정한 독서 알림 설정(`users.reading_alarm_time/enabled`), (2) 독서 타이머(`reading_sessions` 시작/종료, `duration_seconds` 서버 측 계산), (3) 독서 습관 추적(streak, 누적 시간, `GET /sessions/stats`), (4) 일일/주간 목표(클라이언트 측 AsyncStorage). 모든 카피는 product.md 시나리오 1 "오늘의 첫 페이지가 당신을 기다리고 있어요" 톤앤매너 준수.

## 데이터 흐름

```
[독서 세션 시작]
  사용자 책 선택 (SPEC-LIBRARY-001)
    → 기존 활성 세션 자동 종료 (있다면)
    → reading_sessions INSERT (started_at=now(), ended_at=NULL) ──RLS(REQ-DB-021)
    → useReadingTimer 시작 (setInterval 1초, started_at 기반)
    → "오늘의 첫 페이지가 당신을 기다리고 있어요"

[독서 세션 종료]
  사용자 "독서 종료" 탭
    → reading_sessions UPDATE (ended_at=now(), duration_seconds=서버 계산)
    → "오늘도 한 페이지, 잘 읽으셨어요"
    → useReadingStats invalidate (통계 갱신)

[백그라운드 → 포그라운드]
  AppState 'active' → useReadingTimer started_at 기반 재동기화

[알림 설정]                          [SPEC-NOTIF-001]
  reading_alarm_time 저장 ────────→  설정된 시간에 알림 스케줄
  reading_alarm_enabled 토글 ─────→  토글 상태 기반 발송 제어
```

## 요구사항 (10개)

### REQ-ROUT-TIMER (독서 타이머)

| REQ | 요약 |
|-----|------|
| REQ-ROUT-001 | 책 선택 후 "독서 시작" → `reading_sessions` INSERT (started_at=now(), ended_at=NULL). 기존 활성 세션 자동 종료 후 새 세션 시작 |
| REQ-ROUT-002 | "독서 종료" → UPDATE (ended_at, duration_seconds=서버 측 `ended_at - started_at` 계산, pages_read 선택적) |
| REQ-ROUT-003 | 포그라운드 실시간 타이머 (`setInterval` 1초, `started_at` 기반). 백그라운드 복귀 시 재동기화 |
| REQ-ROUT-004 | 다정한 메시지: 시작 유도("오늘의 첫 페이지가..."), 종료 격려("오늘도 한 페이지...") — product.md 시나리오 1 톤 |

### REQ-ROUT-ALARM (다정한 알림 설정)

| REQ | 요약 |
|-----|------|
| REQ-ROUT-005 | `users.reading_alarm_time` 설정/수정 (time 타입, HH:MM:SS). 클라이언트 측 형식 검증 |
| REQ-ROUT-006 | `users.reading_alarm_enabled` 토글 on/off (boolean, 기본값 true). SPEC-NOTIF-001 발송 제어 신호 |
| REQ-ROUT-007 | 알림 설정 조회 — 본인 행 RLS(REQ-DB-014)로 reading_alarm_time/enabled 표시 |

### REQ-ROUT-STATS (독서 습관 추적)

| REQ | 요약 |
|-----|------|
| REQ-ROUT-008 | `GET /sessions/stats` — total_duration_seconds, total_sessions, current_streak, today_duration_seconds. 인덱스 (user_id, book_id) 활용 |
| REQ-ROUT-009 | streak 계산 (자정 기준, 미결정 6.1 임시). 종료된 세션 ended_at 역순 연속 일수. 달성 시 다정한 메시지 |
| REQ-ROUT-010 | 일일/주간 목표 대비 진행률 `ProgressBar` 표시. 목표는 클라이언트 측 AsyncStorage (기본 15분, 미결정 6.2) |

## 핵심 가정

1. **타이머 정확도는 포그라운드만 보장** — `duration_seconds`는 서버 측 `ended_at - started_at`으로 계산 (클라이언트 setInterval에 의존하지 않음)
2. **세션 시작/종료는 명시적** — 자동 시작/자동 종료 없음. 사용자 버튼 탭 기반
3. **RLS 단독 권한 검증** — 클라이언트 권한 로직 미구현. REQ-DB-021이 본인 세션만 허용
4. **통계는 실시간 집계** — 별도 집계 테이블 없음. `reading_sessions`에서 인덱스 활용 집계
5. **알림 설정은 데이터 저장만** — 발송은 SPEC-NOTIF-001 담당. 본 SPEC은 reading_alarm_time/enabled 인터페이스만
6. **목표는 클라이언트 측** — 서버 스키마 변경 없음. AsyncStorage 관리 (확장 시 검토)
7. **세션당 한 권, 활성 세션 하나만** — 동시 다책 세션 미지원. 새 세션 시 기존 자동 종료

## 제외 범위

- 알림 발송 로직 (SPEC-NOTIF-001 — Expo Push, 로컬 알림, send-notification Edge Function)
- 강제 독서 리마인더 (product.md 비목표 — 비친근적)
- 백그라운드 타이머 정확도 보장 (OS 제약 — 문서화만, duration_seconds 서버 계산으로 보완)
- 외부 캘린더 연동 (Google/Apple Calendar)
- 소셜 독서 루틴 공유 (비목표 — 좋아요/팔로워 경쟁 회피)
- 독서 속도 분석, 예상 완독일 (확장 단계)
- 서재 진도 업데이트 (SPEC-LIBRARY-001 영역 — current_page)
- Edge Function (PostgREST 직접 호출)

## 미결정 사항

| ID | 이슈 | 임시 방침 | 해결 시점 |
|----|------|-----------|-----------|
| 6.1 | streak 계산 기준 (자정 vs 24시간 윈도우) | 자정(local timezone) 기준 역순 검사 | v1.1.0 (사용자 피드백) |
| 6.2 | 일일 목표 기본값 | 15분(900초), AsyncStorage 저장 | v1.1.0 (온보딩 목표 설정) |
| 6.3 | 백그라운드 타이머 폴백 | 자동 종료 안 함, 복귀 시 started_at 재동기화 | v1.1.0 (로컬 알림 검토) |

## 의존성

| 선행 SPEC | 소비 산출물 |
|-----------|-------------|
| SPEC-DB-001 | reading_sessions(REQ-DB-009), users(REQ-DB-001 — alarm 컬럼), RLS(REQ-DB-021/014), 인덱스 (user_id, book_id) |
| SPEC-LIBRARY-001 | 책 컨텍스트(book_id), 서재 조회, current_page 업데이트 연동 |
| SPEC-API-001 | Supabase 클라이언트, 인증 헤더, 타입 안전 쿼리 래퍼 |
| SPEC-AUTH-001 | 인증된 사용자 식별(auth.uid()) |
| SPEC-UI-001 | 디자인 토큰, Button, Card, ProgressBar |

## 협업 경계 (SPEC-NOTIF-001)

| 본 SPEC 담당 | SPEC-NOTIF-001 담당 |
|-------------|---------------------|
| reading_alarm_time/enabled 저장·조회 | 설정 시간 알림 스케줄링, 발송 제어 |
| 알림 설정 UI | Expo Push 통합, 알림 센터 UI |
| 세션/streak 다정한 메시지 | 독서 알림 카피 (발송용) |

계약 인터페이스: `users.reading_alarm_time` (time) + `users.reading_alarm_enabled` (boolean)

## 구현 산출물 (참고)

```
src/features/routine/
  sessionApi.ts           # POST /sessions, PATCH /sessions/{id}/end
  alarmApi.ts             # users alarm 설정 조회/수정
  statsApi.ts             # GET /sessions/stats 집계
  useReadingTimer.ts      # 포그라운드 타이머 (setInterval + AppState)
  useActiveSession.ts     # 활성 세션 관리
  useAlarmSettings.ts     # 알림 설정 상태
  useReadingStats.ts      # 통계 조회
  goalStorage.ts          # AsyncStorage 목표 관리
  streakCalculator.ts     # 자정 기준 streak 계산
  copy.ts                 # 다정한 메시지 카피
  types.ts                # ReadingSession, ReadingStats, AlarmSettings
```

독서 타이머 화면, 루틴 통계 위젯, 알림 설정 UI.
