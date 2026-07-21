---
id: SPEC-BOOK-001
title: "Book Search & Registration — Compact Reference"
version: "1.0.0"
status: draft
created: 2026-06-14
updated: 2026-06-14
author: "강력쇠주먹"
priority: high
issue_number: 0
---

# SPEC-BOOK-001 Compact Reference (자동 생성 요약)

> 본 문서는 spec.md + acceptance.md에서 REQ 식별자, 인수 기준 시나리오, 제외 범위만
> 추출한 실행 가능한 요약이다. 상세는 spec.md / plan.md / acceptance.md를 참조한다.

---

## 요구사항 (Requirements) — REQ-BOOK-001 ~ REQ-BOOK-016

### REQ-BOOK-SEARCH: Kakao 도서 검색 (Edge Function 프록시)

| REQ | 요약 | EARS 유형 |
|-----|------|-----------|
| REQ-BOOK-001 | `POST /functions/kakao-book-search` 엔드포인트 — query/target 수신, Kakao API 프록시 | Event-Driven (WHEN) |
| REQ-BOOK-002 | `KAKAO_REST_API_KEY` 서버(Edge Function) 보관, 클라이언트 노출 금지 | Unwanted (IF then) |
| REQ-BOOK-003 | Kakao 응답 정규화 스키마(title/authors/publisher/published_at/cover_url/isbn/kakao_id) | Event-Driven (WHEN then) |
| REQ-BOOK-004 | Kakao API 에러 시 구조화 에러 응답(`{ error, code }`) 반환 | Unwanted (IF then) |
| REQ-BOOK-005 | 빈 쿼리 검색 차단, "검색어를 입력해 주세요" 안내 | State-Driven (WHILE then) |

### REQ-BOOK-SCAN: 바코드 스캔 (ISBN)

| REQ | 요약 | EARS 유형 |
|-----|------|-----------|
| REQ-BOOK-006 | 카메라 권한 요청(`expo-camera`), 거부 시 수동 ISBN 입력 대체 | Event-Driven (WHEN) + Unwanted (IF) |
| REQ-BOOK-007 | ISBN(EAN-13) 바코드 포맷 검증, 비-ISBN(QR 등) 무시 | Event-Driven (WHEN) |
| REQ-BOOK-008 | ISBN 인식 시 자동 검색 전환(target='isbn'), 카메라 중지 | Event-Driven (WHEN) |
| REQ-BOOK-009 | 동일 ISBN 연속 스캔 디바운스(2초), 중복 API 호출 방지 | State-Driven (WHILE) |

### REQ-BOOK-CACHE: books 테이블 캐싱·업서트

| REQ | 요약 | EARS 유형 |
|-----|------|-----------|
| REQ-BOOK-010 | 캐시 히트 우선 조회(kakao_id/isbn), Kakao API 호출 생략 | Event-Driven (WHEN) + Conditional (IF) |
| REQ-BOOK-011 | 캐시 미스 시 Kakao API 호출 후 books 업서트(service_role, ON CONFLICT) | Conditional (IF then) |
| REQ-BOOK-012 | Kakao 응답 → books 컬럼 매핑(isbn/title/author/publisher/published_at/cover_url/total_pages/kakao_id) | Event-Driven (WHEN) |
| REQ-BOOK-013 | 클라이언트 books SELECT(캐시 조회), PostgREST 직접 조회 | Event-Driven (WHEN) |
| REQ-BOOK-014 | 책 선택 시 book_id(books.id) 반환, 후속 서재 플로우(SPEC-LIBRARY-001) 전달 | Event-Driven (WHEN) |

### REQ-BOOK-DETAIL: 책 상세 조회

| REQ | 요약 | EARS 유형 |
|-----|------|-----------|
| REQ-BOOK-015 | `bookId`로 books SELECT 상세 조회(`.eq('id', bookId).single()`) | Event-Driven (WHEN) |
| REQ-BOOK-016 | ISBN 검색 빈 결과 시 "도서를 찾을 수 없습니다" + 수동 입력 안내 | Conditional (IF then) |

---

## 인수 기준 시나리오 (Acceptance Scenarios) — S1 ~ S22

### Module 1: REQ-BOOK-SEARCH

| 시나리오 | 검증 내용 | 핵심 검증 |
|---------|----------|-----------|
| S1 | Edge Function 엔드포인트 존재 | POST /functions/kakao-book-search 200 응답 |
| S2 | API 키 서버 보관 | 클라이언트 번들에 키 부재 |
| S3 | 검색 결과 응답 스키마 정규화 | 필수 필드 포함, 누락 시 제외 |
| S4 | Kakao API 에러 처리 | `{ error, code }` 구조 반환 |
| S5 | 수동 검색 빈 쿼리 차단 | Edge Function 호출 안 됨 |

### Module 2: REQ-BOOK-SCAN

| 시나리오 | 검증 내용 | 핵심 검증 |
|---------|----------|-----------|
| S6 | 카메라 권한 요청 | 권한 API 호출 |
| S7 | 권한 거부 시 대체 경로 | 수동 ISBN 입력 필드 제공 |
| S8 | ISBN 바코드 인식 | ISBN-13 포맷 검증 |
| S9 | 비-ISBN 바코드 무시 | QR/Code128 무시 |
| S10 | ISBN 인식 시 자동 전환 | target='isbn' 검색 호출 |
| S11 | 중복 스캔 디바운스 | 2초 내 동일 ISBN 1회만 처리 |
| S12 | ISBN-10 레거시 호환(엣지) | ISBN-13 변환 또는 직접 검색 |

### Module 3: REQ-BOOK-CACHE

| 시나리오 | 검증 내용 | 핵심 검증 |
|---------|----------|-----------|
| S13 | 캐시 히트 시 Kakao API 생략 | dapi.kakao.com 요청 부재 |
| S14 | 캐시 미스 시 Kakao API 호출 후 업서트 | service_role books upsert |
| S15 | Kakao 응답 → books 컬럼 매핑 | authors 배열 → 쉼표 결합 |
| S16 | 클라이언트 books SELECT | PostgREST 직접, RLS 통과 |
| S17 | 책 등록(book_id) 반환 | UUID 반환, user_books 미호출 |
| S18 | 동일 도서 중복 등록 방지(엣지) | UNIQUE isbn, 기존 행 재사용 |

### Module 4: REQ-BOOK-DETAIL

| 시나리오 | 검증 내용 | 핵심 검증 |
|---------|----------|-----------|
| S19 | 책 상세 조회 성공 | 단일 Book 행 반환 |
| S20 | 존재하지 않는 bookId(엣지) | NOT_FOUND 에러 |
| S21 | ISBN 검색 빈 결과 폴백 | 빈 목록 + 수동 입력 안내 |
| S22 | 미인증 사용자 조회 차단(엣지) | RLS 거부, 로그인 리다이렉트 |

---

## 제외 범위 (Exclusions)

1. **서재 추가 플로우** → SPEC-LIBRARY-001 (user_books INSERT)
2. **표지 이미지 Storage 업로드** → 별도 SPEC / tech.md Storage 영역
3. **추천 알고리즘** → SPEC-CLUB-001, SPEC-FEED-001
4. **다른 도서 API** (Naver, Google Books) → MVP 범위 밖
5. **도서 정보 수정** → MVP 읽기 전용(books는 Kakao 캐시)
6. **검색 결과 무한 스크롤/페이지네이션** → Open Question 6.1 미해결
7. **오프라인 검색 캐시** → Open Question 6.3 미해결, MVP 범위 밖
8. **Kakao Developers 앱 등록/키 발급** → SPEC-DEPLOY-001 인프라 영역

---

## 연동 포인트 (Integration)

| 연동 SPEC | 포인트 | 방향 |
|-----------|--------|------|
| SPEC-DB-001 | REQ-DB-002 books 스키마, REQ-DB-013b books RLS | 소비 (읽기) |
| SPEC-API-001 | REQ-API-004 invokeEdgeFunction, REQ-API-008 Book 타입, REQ-API-011~015 에러 처리 | 소비 (읽기) |
| SPEC-UI-001 | BookCard 컴포넌트, 디자인 토큰 | 소비 (읽기) |
| SPEC-LIBRARY-001 | book_id 반환 → user_books INSERT | 제공 (후속) |
| SPEC-NAV-001 | 검색/상세 화면 라우팅 통합 | 양방향 (완료 후 연동) |
| SPEC-DEPLOY-001 | Kakao REST API 키 시크릿 관리, Edge Function 배포 | 소비 (인프라) |

---

## 미결정 사항 요약 (Open Questions)

| ID | 항목 | 상태 | 현재 결정 |
|----|------|------|-----------|
| 6.1 | 검색 결과 페이지네이션 | 미해결 | MVP 첫 페이지만 |
| 6.2 | Kakao API 할당량 초과 폴백 | 미해결 | (B) 캐시 전용 모드 권장 |
| 6.3 | 오프라인 검색 캐시 TTL | 미해결 | 영구 캐시(TTL 없음) |
| 6.4 | ISBN 이외 바코드 처리 | 미해결 | (A) 조용히 무시(기본) |
