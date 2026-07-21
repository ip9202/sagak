---
id: SPEC-CLUB-002
title: "Track B 개설형 모임 관리 — Compact Reference"
version: "1.0.0"
status: draft
created: 2026-06-14
updated: 2026-06-14
author: "강력쇠주먹"
priority: high
issue_number: 0
---

# SPEC-CLUB-002 Compact Reference (자동 생성 요약)

> 본 문서는 spec.md + acceptance.md에서 REQ 식별자, 인수 기준 시나리오, 제외 범위만
> 추출한 실행 가능한 요약이다. 상세는 spec.md / plan.md / acceptance.md를 참조한다.

---

## 요구사항 (Requirements) — REQ-CLUBB-001 ~ REQ-CLUBB-017

### REQ-CLUBB-CREATE: 함께 읽기 모임 생성

| REQ | 요약 | EARS 유형 |
|-----|------|-----------|
| REQ-CLUBB-001 | `clubs` INSERT 엔드포인트 (PostgREST), host_id=auth.uid() WITH CHECK | Event-Driven (WHEN) |
| REQ-CLUBB-002 | type='group' 강제, instant 거부 (클라이언트/Edge 단) | Unwanted (IF) |
| REQ-CLUBB-003 | 0명 출발 허용, min_members 게이트 아님 | State-Driven (WHILE) |
| REQ-CLUBB-004 | 모임 설정 입력 (description, duration_days, daily_pages, trigger_page) | Event-Driven (WHEN) |
| REQ-CLUBB-005 | 모임 생성 결과 반환 (.select().single()) | Event-Driven (WHEN) |

### REQ-CLUBB-HOST: host 자동 가입 트리거 연동

| REQ | 요약 | EARS 유형 |
|-----|------|-----------|
| REQ-CLUBB-006 | 클라이언트 club_members INSERT 금지 (트리거 단독 처리) | Ubiquitous (항상) |
| REQ-CLUBB-007 | host 멤버십 존재 확인 (clubs INSERT 후 검증) | Event-Driven (WHEN) + Conditional (IF) |
| REQ-CLUBB-008 | host 멤버십 조회 권한 (RLS fn_user_in_club) | State-Driven (WHILE) |

### REQ-CLUBB-PROGRESS: 진도 동기화

| REQ | 요약 | EARS 유형 |
|-----|------|-----------|
| REQ-CLUBB-009 | 진도 업데이트 엔드포인트 (clubs UPDATE, host만) | Event-Driven (WHEN) |
| REQ-CLUBB-010 | 비host 진도 업데이트 차단 (RLS) | Unwanted (IF) |
| REQ-CLUBB-011 | 진도 업데이트 입력 검증 (음수/비정수 차단) | State-Driven (WHILE) |
| REQ-CLUBB-012 | closed 모임 진도 업데이트 차단 | Unwanted (IF) |

### REQ-CLUBB-MANAGE: 참가자·상태 관리 (host 권한)

| REQ | 요약 | EARS 유형 |
|-----|------|-----------|
| REQ-CLUBB-013 | 모임 멤버 목록 조회 (club_members SELECT) | Event-Driven (WHEN) |
| REQ-CLUBB-014 | 모임 상태 변경 (active → closed, host만) | Event-Driven (WHEN) |
| REQ-CLUBB-015 | closed → active 재활성화 허용 (양방향) | Conditional (IF) |
| REQ-CLUBB-016 | 멤버 자발적 탈퇴 (club_members DELETE, 본인만) | Event-Driven (WHEN) + Conditional (IF) |
| REQ-CLUBB-017 | 모임 상세 조회 (clubs SELECT 단일 행, 공개) | Event-Driven (WHEN) |

---

## 인수 기준 시나리오 (Acceptance Scenarios) — S1 ~ S23

### Module 1: REQ-CLUBB-CREATE

| 시나리오 | 검증 내용 | 핵심 검증 |
|---------|----------|-----------|
| S1 | 모임 생성 성공 | clubs INSERT, host_id=auth.uid(), status='active' |
| S2 | type='group' 강제 | type='instant' 클라이언트 거부 |
| S3 | type 누락 시 INSERT 실패(엣지) | NOT NULL 제약 위반 |
| S4 | 0명 출발 허용 | min_members=0 또는 NULL, 게이트 없음 |
| S5 | 모임 설정 입력 수집 | description, duration_days, daily_pages, trigger_page |
| S6 | 모임 생성 결과 반환 | id, host_id, book_id, type, title, status 포함 |
| S7 | book_id 누락 시 실패(엣지) | NOT NULL 제약 위반 |

### Module 2: REQ-CLUBB-HOST

| 시나리오 | 검증 내용 | 핵심 검증 |
|---------|----------|-----------|
| S8 | 클라이언트 club_members INSERT 금지 | RLS 거부, 트리거 단독 처리 |
| S9 | host 멤버십 자동 생성 | handle_new_club_host 트리거 동작 |
| S10 | host 멤버십 존재 확인 | verifyHostMembership true 반환 |
| S11 | 트리거 실패 감지(엣지) | host 멤버십 부재, 오류 메시지 |
| S12 | host 멤버십 조회 권한 | RLS fn_user_in_club=true |

### Module 3: REQ-CLUBB-PROGRESS

| 시나리오 | 검증 내용 | 핵심 검증 |
|---------|----------|-----------|
| S13 | 진도 업데이트 성공(host) | clubs UPDATE 허용, daily_pages/trigger_page |
| S14 | 비host 진도 업데이트 차단 | RLS 거부 (0 rows) |
| S15 | 진도 업데이트 입력 검증 | 음수/비정수 클라이언트 차단 |
| S16 | closed 모임 진도 차단 | 클라이언트 사전 차단 |

### Module 4: REQ-CLUBB-MANAGE

| 시나리오 | 검증 내용 | 핵심 검증 |
|---------|----------|-----------|
| S17 | 모임 멤버 목록 조회 | club_members SELECT, host+member 포함 |
| S18 | 모임 종료 (active→closed) | host UPDATE 허용 |
| S19 | 모임 재활성화 (closed→active) | 양방향 전환 허용 |
| S20 | 멤버 자발적 탈퇴 | club_members DELETE, 본인만 |
| S21 | host 고아 모임 경고(엣지) | 유일 멤버 탈퇴 시 종료 유도 |
| S22 | 모임 상세 조회 | clubs SELECT 단일 행, 공개 |
| S23 | 비host 모임 종료 차단(엣지) | RLS 거부 (0 rows) |

---

## 제외 범위 (Exclusions)

1. **실시간 채팅 (type='instant')** → MVP 비목표, 시그널 푸시·팝업 채팅 미구현
2. **모임 피드** → SPEC-FEED-001 (진도별 슬라이딩 피드, 스포일러 블러)
3. **Track A 합류 요청 로직** → SPEC-CLUB-001 (join_requests 상태 기계, 승인/거절)
4. **자동 수락 (auto_accept)** → SPEC-DB-001 미결정 6.1, MVP 수동 승인만
5. **모임 검색·추천** → 추후 SPEC (같은 책/같은 시기 추천)
6. **host 위임 (호스트 변경)** → 미결정 6.2, MVP 범위 밖
7. **감정 기록 연동** → SPEC-FEED-001 (모임 피드 내 감정 표시)

---

## 연동 포인트 (Integration)

| 연동 SPEC | 포인트 | 방향 |
|-----------|--------|------|
| SPEC-DB-001 | REQ-DB-006 clubs 스키마, REQ-DB-007 club_members, REQ-DB-008b host 트리거, REQ-DB-018/019 RLS | 소비 (읽기, 트리거 의존) |
| SPEC-BOOK-001 | book_id 확보 (검색·등록된 books.id) | 소비 (선행) |
| SPEC-API-001 | supabase 싱글톤, Club/ClubMember 타입, 에러 처리 | 소비 (읽기) |
| SPEC-CLUB-001 | Track A 요청 수신 (Track B 모임도 요청 수신 가능) | 양방향 (병행) |
| SPEC-FEED-001 | daily_pages/trigger_page 진도 기반 피드 | 제공 (후속) |
| SPEC-NAV-001 | 모임 생성/관리/상세 화면 라우팅 | 양방향 (완료 후 연동) |

---

## 미결정 사항 요약 (Open Questions)

| ID | 항목 | 상태 | 현재 결정 |
|----|------|------|-----------|
| 6.1 | closed 모임 데이터 보존 정책 | 미해결 | (A) 영구 보존 (기본) |
| 6.2 | host 위임 (호스트 변경) | 미해결 | MVP 미지원, 탈퇴 시 종료 유도 |
| 6.3 | 진도 동기화 주기 | 미해결 | host 수동, 자동 알림 미지원 |
