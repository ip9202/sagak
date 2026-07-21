---
id: SPEC-CLUB-001
title: "Track A — 합류형 요청 — Compact View"
version: "1.0.0"
status: draft
created: 2026-06-14
updated: 2026-06-14
author: "강력쇠주먹"
priority: high
issue_number: 0
---

# SPEC-CLUB-001 요약 (Compact)

> 본 문서는 spec.md와 acceptance.md의 요약본이다. 전체 내용은 원본 파일 참조.

---

## 핵심 범위

Track A는 같은 책을 읽는 공개·활성 독자에게 "같이 읽어요" 합류 요청을 보내는 **비동기 연결**
기능이다. 실시간 매칭/팝업 채팅이 아닌, 요청 기반의 느슨한 연결 모델이다. 상태 기계
(pending → accepted/declined)는 DB 트리거가 보장하며, 클라이언트는 트리거를 소비한다.

---

## 요구사항 (Requirements) — 12개 REQ, 4개 모듈

### REQ-CLUBA-READER: Track A 독자 목록 조회 (3 REQ)

| REQ ID | 요구사항 요약 | 인수 시나리오 |
|--------|--------------|--------------|
| REQ-CLUBA-001 | `user_books_public` 보안 뷰로 book_id별 공개 독자 조회 (제한 컬럼만) | R1: 독자 목록 조회 |
| REQ-CLUBA-002 | 활성 독자 정렬 (started_reading_at 기준, 유령 유저 필터) | R3: 정렬 검증 |
| REQ-CLUBA-003 | 독자별 club_id 매핑 (그룹 없으면 null, lazy 생성 대상) | R4: 그룹 식별 |

> 추가: R2(비공개 독자 제외 — is_public 필터)

### REQ-CLUBA-REQUEST: 합류 요청 생성 (3 REQ)

| REQ ID | 요구사항 요약 | 인수 시나리오 |
|--------|--------------|--------------|
| REQ-CLUBA-004 | `join_requests` INSERT (status='pending', requester_id=auth.uid(), message) | R5: 요청 생성 |
| REQ-CLUBA-005 | UNIQUE(club_id, requester_id) 위반 시 409 Conflict + 한국어 메시지 | R6: 중복 방지 |
| REQ-CLUBA-006 | 대상 그룹 없음 시 Edge Function이 1인 그룹 lazy 생성 후 요청 INSERT | R8: lazy 생성 |

> 추가: R7(RLS 권한 강제 — requester_id 위조 거부)

### REQ-CLUBA-RESPOND: host 승인/거절 응답 (3 REQ)

| REQ ID | 요구사항 요약 | 인수 시나리오 |
|--------|--------------|--------------|
| REQ-CLUBA-007 | host만 status UPDATE 가능 (RLS join_requests_update_host 강제) | R11: 비host 거부 |
| REQ-CLUBA-008 | terminal 상태(accepted/declined) 재설정 시 트리거 RAISE EXCEPTION 처리 | R12: terminal 거부 |
| REQ-CLUBA-009 | 응답 시 responded_at=now() 기록 | R9: accepted, R10: declined |

> 추가: R13(terminal 상태 양성 편집 — message 수정 허용)

### REQ-CLUBA-MEMBER: 수락 시 club_members 자동 추가 (3 REQ)

| REQ ID | 요구사항 요약 | 인수 시나리오 |
|--------|--------------|--------------|
| REQ-CLUBA-010 | accepted 전환 시 join_request_accept 트리거가 club_members(role='member') 자동 INSERT | R14: 자동 추가 |
| REQ-CLUBA-011 | accepted 후 클라이언트가 club_members 재조회로 멤버십 확인 | R15: 멤버십 확인 |
| REQ-CLUBA-012 | declined 시 club_members 행 추가 없음 (트리거 미발화) | R16: 미추가 |

> 추가: R17(SECURITY DEFINER 트리거 RLS 우회 검증)

---

## SPEC-DB-001 연동 (상태 기계·트리거·RLS)

### 상태 기계 (join_requests)

```
pending ──host accepted──→ accepted (terminal, club_members INSERT)
   │
   └──host declined───→ declined (terminal, 멤버 미추가)
```

- **terminal 재설정 거부**: `guard_join_request_status_trigger` (BEFORE UPDATE)가
  `NEW.status IS DISTINCT FROM OLD.status AND OLD.status <> 'pending'` 시 RAISE EXCEPTION
- **accepted 자동 추가**: `join_request_accept_trigger` (AFTER UPDATE, SECURITY DEFINER)가
  `NEW.status='accepted'` 시 club_members INSERT

### RLS 정책 (REQ-DB-020)

| 작업 | 정책 | 조건 |
|------|------|------|
| SELECT | `join_requests_select_requester_or_host` | `auth.uid() IN (requester_id, club.host_id)` |
| INSERT | `join_requests_insert_own` | `auth.uid() = requester_id` (WITH CHECK) |
| UPDATE | `join_requests_update_host` | `auth.uid() = club.host_id` |

### 보안 뷰 (REQ-DB-013e)

- `user_books_public`: `SELECT book_id, current_page, started_reading_at, user_id FROM user_books
  WHERE is_public=true` — 독자 목록 소스 (제한 컬럼만)

---

## 인수 기준 요약 — 17개 시나리오 + 4개 엣지 케이스

| 모듈 | 시나리오 수 | 범위 |
|------|-----------|------|
| REQ-CLUBA-READER | R1-R4 (4개) | 뷰 소비, 비공개 제외, 정렬, 그룹 매핑 |
| REQ-CLUBA-REQUEST | R5-R8 (4개) | INSERT, UNIQUE 위반, RLS, lazy 생성 |
| REQ-CLUBA-RESPOND | R9-R13 (5개) | accepted, declined, host 권한, terminal 거부, 양성 편집 |
| REQ-CLUBA-MEMBER | R14-R17 (4개) | 자동 INSERT, 멤버십 확인, 미추가, SECURITY DEFINER |
| 엣지 케이스 | E1-E4 (4개) | 자기 요청, closed 그룹, 네트워크 재시도, 메시지 길이 |

---

## 제외 범위

- Track B 모임 생성 (SPEC-CLUB-002)
- 실시간 피드 (SPEC-FEED-001)
- 자동 수락 (SPEC-DB-001 미결정 6.1 — MVP 수동 승인만)
- 실시간 문득 모임 type='instant' (확장 단계)
- 실시간 팝업 채팅 (비목표)
- 요청 알림 발송 메커니즘 (SPEC-NOTIF-001)

---

## 미결정 사항 요약

| ID | 항목 | 상태 |
|----|------|------|
| 5.1 | 요청 알림 발송 시점 (DB 트리거 vs Edge Function vs 클라이언트) | SPEC-NOTIF-001 연동 대기 |
| 5.2 | 거절 시 재요청 쿨다운 | 미해결 — MVP는 재요청 불가 |
| 5.3 | 독자 목록 정렬 기준 (started_reading_at vs current_page) | 미해결 — MVP는 started_reading_at DESC |
| 5.4 | lazy 그룹 생성 주체 (Edge Function vs 클라이언트 2단계) | 해결 대기 — Edge Function 위임 가정 |

---

## 의존성

- **SPEC-DB-001** (선행, 완료 v1.2.0): 스키마, 트리거, RLS, 보안 뷰
- **SPEC-API-001** (선행): 클라이언트 싱글톤, gen-types 타입, 에러 정규화
- **SPEC-LIBRARY-001** (선행): user_books.is_public 노출 제어
- **SPEC-AUTH-001** (선행): 사용자 식별, 세션 JWT
- **SPEC-BOOK-001** (선행): 책 컨텍스트 (book_id)

---

## 핵심 품질 게이트

- 상태 기계 무결성: DB 트리거가 보장 (클라이언트 재검증 없음)
- RLS 신뢰: 클라이언트 측 권한 검사 없음, RLS 거부 시 VALIDATION/RLS_DENIED 에러 처리
- 트리거 예외 처리: terminal 재설정, UNIQUE 위반 사용자 친화적 메시지 변환
- 한국어 사용자 메시지: "이미 이 그룹에 요청을 보냈습니다", "이미 처리된 요청입니다"
- 85%+ 단위 테스트 커버리지, 통합 테스트로 상태 기계 전환 전수 검증
