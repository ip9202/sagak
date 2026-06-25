---
id: SPEC-LIBRARY-001
title: "Personal Library Management - Compact Spec"
version: "1.0.0"
status: completed
created: 2026-06-14
updated: 2026-06-25
author: "강력쇠주먹"
priority: high
issue_number: 0
---

# SPEC-LIBRARY-001: 개인 서재 관리 (Compact)

> 본 문서는 `spec.md`와 `acceptance.md`의 핵심 요구사항과 인수기준만 추출한
> 컴팩트 버전이다. 전체 내용은 각 원본 문서를 참조한다.

---

## 요구사항 (Requirements)

### REQ-LIB-CRUD: 서재 추가·조회·삭제

| REQ ID | 요구사항 | EARS 유형 |
|--------|---------|-----------|
| REQ-LIB-001 | 서재 책 추가 (POST /library) — status='reading', current_page=0, is_public=true 기본값 | Event-Driven |
| REQ-LIB-002 | 중복 추가 방지 — UNIQUE(user_id, book_id) 위반 시 409 → "이미 서재에 있는 책입니다" | Unwanted |
| REQ-LIB-003 | 서재 목록 조회 (GET /library) — books 조인, status 필터, 정렬 지원 | Ubiquitous |
| REQ-LIB-004 | 서재 항목 삭제 (DELETE /library/{book_id}) — FK RESTRICT 위반 시 안내 | Event-Driven |
| REQ-LIB-005 | 서재 조회 권한 — RLS auth.uid()=user_id로 자기 행만 | State-Driven |

### REQ-LIB-PROGRESS: 진도 추적

| REQ ID | 요구사항 | EARS 유형 |
|--------|---------|-----------|
| REQ-LIB-010 | 진도 업데이트 (PUT /library/{book_id}) — current_page만 UPDATE, last_progress_at은 DB 트리거 자동 갱신 | Event-Driven |
| REQ-LIB-011 | 페이지 값 검증 — 음수 거부, total_pages 초과 거부 (null일 경우 상한 생략) | State-Driven |
| REQ-LIB-012 | 진도률 계산 (파생값) — current_page / total_pages * 100 | Ubiquitous |
| REQ-LIB-013 | 진도 낙관적 업데이트 — 서버 응답 전 UI 갱신, 실패 시 롤백 | Optional |

### REQ-LIB-STATUS: 독서 상태 관리

| REQ ID | 요구사항 | EARS 유형 |
|--------|---------|-----------|
| REQ-LIB-020 | 상태 전환 (PUT status) — reading/completed/shelved, CHECK 제약 준수 | Event-Driven |
| REQ-LIB-021 | 완독 처리 (reading→completed) — status UPDATE만, completed_at/completion_reports는 DB 트리거 자동 | Event-Driven |
| REQ-LIB-022 | 역전환 (completed→reading) — 허용하되 completion_reports 유지 경고 (미결정 5.1) | State-Driven |
| REQ-LIB-023 | 서재 정리 (reading→shelved) — 보관함 이동 | Event-Driven |

### REQ-LIB-VISIBILITY: 공개/비공개 설정

| REQ ID | 요구사항 | EARS 유형 |
|--------|---------|-----------|
| REQ-LIB-030 | 공개 범위 토글 (PUT is_public) — true↔false 전환 | Event-Driven |
| REQ-LIB-031 | 공개 설정의 Track A 영향 — is_public=true면 user_books_public 뷰 노출, false면 숨김 | State-Driven |
| REQ-LIB-032 | 공개 설정 기본값 안내 — 추가 시 is_public=true임을 명시 | Ubiquitous |

---

## 인수 기준 요약 (Acceptance Criteria Summary)

| AC ID | 시나리오 | 관련 REQ |
|-------|---------|---------|
| AC-LIB-001 | 정상적인 서재 책 추가 | REQ-LIB-001 |
| AC-LIB-002 | 중복 추가 방지 (UNIQUE) | REQ-LIB-002 |
| AC-LIB-003 | 미인증 사용자 차단 (RLS) | REQ-LIB-005 |
| AC-LIB-004 | 서재 목록 정상 조회 | REQ-LIB-003, 005 |
| AC-LIB-005 | status 필터링 | REQ-LIB-003 |
| AC-LIB-006 | 빈 서재 상태 UI | REQ-LIB-003 |
| AC-LIB-007 | 자식 데이터 없는 항목 삭제 | REQ-LIB-004 |
| AC-LIB-008 | 자식 데이터 있는 항목 삭제 제한 (FK RESTRICT) | REQ-LIB-004 |
| AC-LIB-009 | 정상 진도 업데이트 + last_progress_at 자동 갱신 | REQ-LIB-010, 012 |
| AC-LIB-010 | 페이지 음수 거부 | REQ-LIB-011 |
| AC-LIB-011 | total_pages 초과 거부 | REQ-LIB-011 |
| AC-LIB-012 | total_pages=null 도서 진도 | REQ-LIB-011, 012 |
| AC-LIB-013 | 진도 낙관적 업데이트 성공 | REQ-LIB-013 |
| AC-LIB-014 | 진도 낙관적 업데이트 실패 롤백 | REQ-LIB-013 |
| AC-LIB-015 | 완독 처리 + completion_reports 자동 생성 | REQ-LIB-020, 021 |
| AC-LIB-016 | 완독 리포트 멱등성 (재완독) | REQ-LIB-022 |
| AC-LIB-017 | 서재 정리 (shelved) | REQ-LIB-023 |
| AC-LIB-018 | 잘못된 status 값 거부 (CHECK) | REQ-LIB-020 |
| AC-LIB-019 | 공개→비공개 토글 | REQ-LIB-030, 031 |
| AC-LIB-020 | 비공개→공개 토글 | REQ-LIB-030, 031 |
| AC-LIB-021 | 신규 추가 공개 기본값 안내 | REQ-LIB-032 |

---

## 제외 범위 (Exclusions)

본 SPEC은 다음을 포함하지 않는다:

1. **완독 다이어리 UI** — `completion_reports.report_data` 시각화는 SPEC-COMPLETION-001
2. **감정 기록 CRUD** — 페이지별 감정 기록, 스티커 반응은 SPEC-EMOTION-001
3. **Track A 독자 목록 표시** — 타인 공개 서재 조회, 합류 요청 UI는 SPEC-CLUB-001
4. **책 검색 및 등록** — Kakao API 연동, 바코드 스캔, books 업서트는 SPEC-BOOK-001
5. **독서 세션/타이머** — reading_sessions(시간 측정)은 SPEC-ROUTINE-001
6. **Edge Function 구현** — generate-completion-report는 예비용, 본 SPEC은 호출 안 함
7. **백엔드 스키마 변경** — user_books, 트리거, RLS는 SPEC-DB-001에 완성됨
8. **데이터 페칭 라이브러리 선택** — SPEC-API-001 미결정 사항 6.1

---

## SPEC-DB-001 연동 포인트

| SPEC-DB-001 REQ | 본 SPEC 연동 |
|-----------------|-------------|
| REQ-DB-003 (user_books 스키마) | 모든 REQ-LIB-* 의 컬럼 매핑 기반 |
| REQ-DB-003 (UNIQUE(user_id, book_id)) | REQ-LIB-002 중복 추가 방지 |
| REQ-DB-003 (last_progress_at 자동 갱신) | REQ-LIB-010 진도 UPDATE 시 트리거 의존 |
| REQ-DB-003 (completed_at 자동 설정) | REQ-LIB-021 완독 처리 시 트리거 의존 |
| REQ-DB-010 (completion_reports 자동 생성) | REQ-LIB-021 완독 처리 시 트리거 의존 |
| REQ-DB-013e (user_books_public 보안 뷰) | REQ-LIB-031 공개 설정의 Track A 영향 |
| REQ-DB-015 (user_books RLS) | REQ-LIB-005 서재 조회 권한 |

---

## 미결정 사항 요약

| ID | 질문 | 기본 정책 | 상태 |
|----|------|----------|------|
| 5.1 | 완독 취소(completed→reading) 허용? | 허용하되 경고 (A) | 미해결 |
| 5.2 | 서재 정렬 기본값? | last_progress_at 내림차순 (A) | 미해결 |
| 5.3 | 자식 데이터 있는 항목 삭제 정책? | 삭제 금지 + 안내 (A) | 미해결 |
| 5.4 | 대량 삭제 UX 필요? | 개별 삭제만 (A) | 미해결 |
