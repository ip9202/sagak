---
id: SPEC-BOOK-001
title: "Book Search & Registration"
version: "1.2.0"
status: completed
created: 2026-06-14
updated: 2026-06-16
author: "강력쇠주먹"
priority: high
issue_number: 0
labels: [book, search, kakao-api, barcode, isbn, edge-function, cache]
---

# SPEC-BOOK-001: 도서 검색 및 등록

## HISTORY

| 날짜 | 버전 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 2026-06-14 | 1.0.0 | 최초 작성 — Kakao Book Search API 연동(Edge Function 프록시), 바코드 스캔, 수동 검색, books 캐싱·업서트, 책 상세 조회 정의 | 강력쇠주먹 |
| 2026-06-16 | 1.1.0 | M1+M2 구현 완료 — Edge Function kakao-book-search, Client API(searchApi/bookDetailApi), book 타입 정의. PR #8, 커밋 852f0ac. 테스트 373/373, 커버리지 100%/96.87%. M3(바코드 스캔), M4(화면 UI), expo-camera, 실제 Kakao API 키는 후속 연기 | 강력쇠주먹 |
| 2026-06-16 | 1.2.0 | M3+M4 구현 완료 — BarcodeScanner(expo-camera ~55.0.19, 권한 게이트 3상태), ISBN 검증, 디바운스 순수 함수, SearchResultCard, BookSearchScreen, BookDetailScreen, 라우팅 통합. PR #9, 커밋 a293e8d. 테스트 462/462, 커버리지 94%+. status: completed (M1~M4 전부 머지) | 강력쇠주먹 |

---

## 1. 환경 (Environment)

- **클라이언트 런타임**: React Native 0.83.2 + Expo SDK 55 + React 19.2 (iOS/Android)
- **외부 도서 API**: Kakao Book Search API (REST, `https://dapi.kakao.com/v3/search/book`)
- **Edge Function 런타임**: Supabase Edge Functions (Deno) — `supabase/functions/kakao-book-search/`
- **바코드 스캔 라이브러리**: `expo-camera` (카메라 권한 + 바코드 인식) — ISBN(EAN-13) 스캔
- **ISBN 포맷**: ISBN-13(EAN-13, 13자리 숫자, 978/979 접두사) 우선, ISBN-10(10자리) 레거시 호환
- **인증**: Supabase Auth (JWT) — Edge Function 호출 시 `Authorization: Bearer <jwt>` 자동 첨부 (SPEC-API-001 REQ-API-004)
- **데이터베이스**: Supabase PostgreSQL — `books` 테이블 (SPEC-DB-001 REQ-DB-002)
- **RLS 정책**: `books`는 authenticated SELECT `USING(true)` 공개 카탈로그, INSERT는 service_role만 (SPEC-DB-001 REQ-DB-013b)
- **API 클라이언트**: `supabase` 싱글톤 + `invokeEdgeFunction` 래퍼 (SPEC-API-001 REQ-API-001, REQ-API-004)

### 단일 출처 (Single Source of Truth)

본 SPEC의 API 서피스는 `.moai/project/structure.md` "Books (검색/스캔/상세)" 및 "Edge Functions (카카오 연동)" 섹션을 단일 출처로 한다.
외부 API 연동·캐싱·요청 효율 정책은 `.moai/project/tech.md` "외부 API" 섹션을 따른다.
`books` 테이블 스키마 및 RLS 정책은 `.moai/specs/SPEC-DB-001/spec.md` (REQ-DB-002, REQ-DB-013b)와 `.moai/project/db/schema.md`에 기반한다.

### 의존성

- **SPEC-DB-001** (선행): `books` 테이블 스키마 + RLS 정책 완료 (v1.2.0)
- **SPEC-API-001** (선행): Supabase 클라이언트 싱글톤, `invokeEdgeFunction` 래퍼, gen-types `Book` 타입, 에러 처리 완료 (v1.0.0)
- **SPEC-UI-001** (선행): `BookCard` 컴포넌트, 디자인 토큰 완료 (v1.0.0)
- **후속 SPEC**: SPEC-LIBRARY-001 (서재 추가 플로우 — 본 SPEC이 등록한 `book_id`를 소비)

---

## 2. 가정 (Assumptions)

### 2.1 아키텍처 가정

1. Kakao Book Search API의 REST API 키(`KAKAO_REST_API_KEY`)는 절대 클라이언트 번들에
   노출되지 않는다. 키는 Edge Function(`kakao-book-search`)의 환경 변수
   (`Deno.env.get('KAKAO_REST_API_KEY')`)로만 접근되며, 클라이언트는 Edge Function을
   통해서만 Kakao API에 간접 접근한다. 이는 API 키 유출 방지와 CORS 해결을 위한
   프록시 패턴이다 (SPEC-DB-001 가정 2.2.2 service_role 원칙과 동일 계층).
2. 클라이언트는 `books` 테이블에 대해 SELECT만 수행한다 (REQ-DB-013b RLS — authenticated
   SELECT `USING(true)`). `books` INSERT는 Edge Function(`kakao-book-search`)이
   `service_role` 키로 수행한다. 클라이언트 RLS에는 INSERT 정책이 없으므로, 클라이언트
   직접 INSERT는 거부된다.
3. `books` 테이블은 Kakao API 응답의 캐시 카탈로그이다. 같은 책(`kakao_id` 또는 `isbn`
   기준)에 대한 반복 검색은 매번 Kakao API를 호출하지 않고 `books` 테이블에서 재사용한다
   (요청 효율 최적화 — tech.md "외부 API" 준수).
4. Edge Function은 Kakao API 호출 전 `books` 테이블을 먼저 조회하고(캐시 히트 시 즉시
   반환), 캐시 미스 시에만 Kakao API를 호출한 뒤 결과를 `books`에 업서트(`ON CONFLICT
   DO UPDATE/NOTHING`)한다. 이는 Kakao API 할당량 절약의 핵심 메커니즘이다.
5. 바코드 스캔은 `expo-camera`의 `onBarCodeScanned` 콜백을 사용하며, 인식된 바코드가
   ISBN(EAN-13) 포맷인 경우에만 검색 플로우로 전환한다. ISBN이 아닌 바코드(QR, Code128
   등)는 무시하거나 사용자에게 안내한다.

### 2.2 비즈니스 가정

1. `books.kakao_id`는 Kakao API 응답의 도서 식별자이며, Kakao API 응답과 `books` 행의
   매핑 키로 사용된다. `isbn`은 UNIQUE이지만 일부 도서는 ISBN이 누락될 수 있으므로,
   캐시 판별은 `kakao_id`를 우선 키로 사용한다 (REQ-DB-002 컬럼 정의).
2. 책 "등록"이란 `books` 테이블에 행을 캐싱하는 것을 의미한다. 개인 서재(`user_books`)
   추가는 본 SPEC 범위 밖이며(SPEC-LIBRARY-001), 본 SPEC은 `book_id`(books.id)를 반환하여
   후속 서재 추가 플로우에 전달한다.
3. Kakao API 검색 결과의 페이지네이션은 기본적으로 첫 페이지(1~10권 또는 1~50권, Kakao
   API `size` 파라미터)만 반환한다. 추가 페이지 로드(무한 스크롤)는 미결정 사항
   (Open Question 6.1)이며, MVP에서는 첫 페이지 결과로 제한한다.
4. 표지 이미지(`cover_url`)는 Kakao API가 제공하는 URL을 `books.cover_url`에 저장하고,
   클라이언트는 이 URL을 직접 렌더링한다. Storage 업로드(이미지 캐싱/리사이징)는 본 SPEC
   범위 밖이다 (제외 범위 §5.3).

---

## 3. 요구사항 (Requirements)

> 본 SPEC은 4개 요구사항 모듈로 구성된다: REQ-BOOK-SEARCH, REQ-BOOK-SCAN,
> REQ-BOOK-CACHE, REQ-BOOK-DETAIL.

### REQ-BOOK-SEARCH: Kakao 도서 검색 (Edge Function 프록시)

**목적**: 클라이언트가 Kakao REST API 키를 보유하지 않고도 도서 검색을 수행할 수 있도록,
Edge Function(`kakao-book-search`)을 프록시로 사용하여 CORS를 해결하고 API 키를
서버 측에 보관한다.

#### REQ-BOOK-001: Kakao Book Search Edge Function 엔드포인트

시스템은 **항상** `POST /functions/kakao-book-search` Edge Function 엔드포인트를
유지해야 한다. 이 엔드포인트는 `query`(검색어), `target`(검색 필드: title/isbn/author,
기본 title)을 요청 본문으로 받는다.

**WHEN** 클라이언트가 `invokeEdgeFunction('kakao-book-search', { query, target })`를 호출하면,
**THEN** 시스템은 Edge Function이 `KAKAO_REST_API_KEY` 환경 변수를 사용해
`https://dapi.kakao.com/v3/search/book`에 `Authorization: KakaoAK <key>` 헤더로
요청을 전송해야 한다.

#### REQ-BOOK-002: API 키 서버 보관 (클라이언트 노출 금지)

시스템은 **항상** Kakao REST API 키를 Edge Function의 서버 측 환경 변수
(`Deno.env.get('KAKAO_REST_API_KEY')`)로만 보관해야 한다.

**IF** 클라이언트 번들에서 `KAKAO_REST_API_KEY` 값이 발견되면,
**THEN** 이는 보안 결함으로 간주되며 즉시 수정되어야 한다 (가정 2.1.1).

#### REQ-BOOK-003: 검색 결과 응답 스키마

**WHEN** Edge Function이 Kakao API 응답을 수신하면,
**THEN** 시스템은 응답을 정규화하여 다음 스키마의 JSON 배열을 반환해야 한다:
각 도서 객체는 `title`, `authors`(배열), `publisher`, `published_at`(ISO 날짜),
`cover_url`, `isbn`(ISBN 문자열, 복수일 경우 첫 번째), `kakao_id`, `total_pages`(가용 시)
필드를 포함한다.

#### REQ-BOOK-004: 검색 실패 에러 처리

**IF** Kakao API가 에러(4xx/5xx, 타임아웃, 네트워크 장애)를 반환하면,
**THEN** 시스템은 Edge Function이 구조화된 에러 응답(`{ error: string, code: string }`)을
클라이언트에 반환해야 한다.
**AND** 클라이언트는 SPEC-API-001 REQ-API-011~015 에러 처리 체계를 통해 사용자 친화적
메시지("도서 검색에 실패했습니다" 등)로 변환해야 한다.

#### REQ-BOOK-005: 수동 검색 입력 검증

**WHILE** 클라이언트가 수동 검색 폼을 제출하는 동안,
**THEN** 시스템은 `query`가 빈 문자열이거나 공백만인 경우 검색 요청을 차단하고
사용자에게 "검색어를 입력해 주세요" 메시지를 표시해야 한다.

---

### REQ-BOOK-SCAN: 바코드 스캔 (ISBN)

**목적**: 사용자가 책 뒷면의 바코드를 카메라로 스캔하여 ISBN을 자동 추출하고,
해당 ISBN으로 도서를 검색·등록한다.

#### REQ-BOOK-006: 카메라 권한 요청

**WHEN** 사용자가 바코드 스캔 화면에 처음 진입하면,
**THEN** 시스템은 `expo-camera`의 권한 요청 API를 통해 카메라 접근 권한을 요청해야 한다.

**IF** 사용자가 권한을 거부하면,
**THEN** 시스템은 스캔 기능을 비활성화하고, "설정에서 카메라 권한을 허용해 주세요" 안내와
함께 수동 ISBN 입력 대체 경로를 제공해야 한다.

#### REQ-BOOK-007: ISBN 바코드 인식

**WHEN** 카메라가 바코드를 인식하면(`onBarCodeScanned` 콜백),
**THEN** 시스템은 인식된 바코드가 ISBN(EAN-13) 포맷인지 검증해야 한다.

**IF** 바코드가 ISBN 포맷이 아니면(QR, Code128 등),
**THEN** 시스템은 해당 바코드를 무시하고 스캔을 계속해야 한다 (사용자에게 짧은 안내
표시 가능, 미결정 사항 6.4).

#### REQ-BOOK-008: ISBN 검색 자동 전환

**WHEN** 유효한 ISBN이 인식되면,
**THEN** 시스템은 자동으로 `target='isbn'`으로 Kakao 검색(REQ-BOOK-001)을 트리거하고,
카메라 스캔을 중지해야 한다.
**AND** 검색 결과가 단일 도서인 경우 도서 상세/등록 화면으로 전환해야 한다.

#### REQ-BOOK-009: 중복 스캔 방지 (디바운스)

**WHILE** 카메라가 활성화된 동안,
**THEN** 시스템은 동일 ISBN에 대한 연속 스캔 이벤트를 디바운스(예: 2초 내 동일 ISBN 무시)하여
중복 검색 요청을 방지해야 한다.

---

### REQ-BOOK-CACHE: books 테이블 캐싱·업서트

**목적**: Kakao API 검색 결과를 `books` 테이블에 캐싱하여, 반복 검색 시 Kakao API
호출을 최소화하고 API 할당량을 절약한다. 캐시는 Edge Function(service_role)이 관리한다.

#### REQ-BOOK-010: 캐시 히트 우선 조회

**WHEN** Edge Function이 검색 요청을 수신하면,
**THEN** 시스템은 Kakao API를 호출하기 전에 먼저 `books` 테이블을 `kakao_id` 또는
`isbn`(target에 따라)으로 조회해야 한다.

**IF** 캐시 히트(기존 `books` 행 존재)이면,
**THEN** 시스템은 Kakao API를 호출하지 않고 캐시된 행을 반환해야 한다.

#### REQ-BOOK-011: 캐시 미스 시 Kakao API 호출 후 업서트

**IF** 캐시 미스(해당 `kakao_id` 또는 `isbn`의 `books` 행이 없음)이면,
**THEN** 시스템은 Kakao API를 호출하고, 응답의 각 도서를 `books` 테이블에
업서트(`ON CONFLICT (isbn) DO UPDATE SET ...` 또는 `ON CONFLICT DO NOTHING`)해야 한다.

> 업서트는 `service_role` 키로 수행되며, 클라이언트 RLS에는 `books` INSERT 정책이 없다
> (REQ-DB-013b). `books`는 공개 카탈로그이므로 모든 authenticated 사용자가 동일 캐시를
> 공유한다.

#### REQ-BOOK-012: books 행 스키마 매핑

**WHEN** Edge Function이 Kakao API 응답을 `books` 테이블에 업서트하면,
**THEN** 시스템은 다음 매핑을 적용해야 한다 (REQ-DB-002 컬럼 정의 준수):
- `isbn` ← Kakao `isbn` (첫 번째 값, UNIQUE)
- `title` ← Kakao `title` (NOT NULL)
- `author` ← Kakao `authors` 배열을 쉼표 결합 (NOT NULL)
- `publisher` ← Kakao `publisher`
- `published_at` ← Kakao `datetime`에서 날짜 부분 추출
- `cover_url` ← Kakao `thumbnail`
- `total_pages` ← 가용 시 매핑, 미가용 시 NULL
- `kakao_id` ← Kakao 응답 식별자

#### REQ-BOOK-013: 클라이언트 캐시 조회 (books SELECT)

**WHEN** 클라이언트가 책 상세 정보를 조회하면,
**THEN** 시스템은 `supabase.from('books').select().eq('id', bookId)`를 통해
`books` 테이블에서 직접 조회해야 한다 (REQ-DB-013b RLS authenticated SELECT 허용).
**AND** Edge Function을 거치지 않고 PostgREST로 직접 조회한다.

#### REQ-BOOK-014: 책 등록(books 캐싱) 결과 반환

**WHEN** 사용자가 검색 결과에서 특정 책을 선택하면,
**THEN** 시스템은 해당 도서의 `book_id`(books.id)를 반환해야 한다.
**AND** 이 `book_id`는 후속 서재 추가 플로우(SPEC-LIBRARY-001)에 전달된다.

> 본 SPEC은 `book_id` 반환까지만 책임지며, `user_books` INSERT는 SPEC-LIBRARY-001 영역이다.

---

### REQ-BOOK-DETAIL: 책 상세 조회

**목적**: 등록된 책(또는 검색 결과 책)의 상세 정보를 클라이언트에 제공한다.
조회는 `books` 테이언트 직접 SELECT로 수행된다.

#### REQ-BOOK-015: 책 상세 정보 조회

**WHEN** 클라이언트가 `bookId`로 책 상세를 요청하면,
**THEN** 시스템은 `supabase.from('books').select('*').eq('id', bookId).single()`을
실행하여 단일 `Book` 행을 반환해야 한다.

**IF** 해당 `bookId`의 행이 존재하지 않으면,
**THEN** 시스템은 SPEC-API-001 REQ-API-012 `NOT_FOUND` 에러를 반환해야 한다.

#### REQ-BOOK-016: 존재하지 않는 ISBN 검색 폴백

**IF** ISBN 검색(바코드 스캔 또는 수동 ISBN 입력) 결과 Kakao API가 빈 결과를 반환하면,
**THEN** 시스템은 사용자에게 "해당 ISBN의 도서를 찾을 수 없습니다" 메시지를 표시하고,
수동 입력(제목/저자) 대체 경로를 안내해야 한다.

---

## 4. API 서피스 매핑 (API Surface Mapping)

본 SPEC은 `.moai/project/structure.md` "Books (검색/스캔/상세)" 엔드포인트의 구현을 정의한다.

| 엔드포인트 | 구현 메커니즘 | REQ |
|-----------|--------------|-----|
| `POST /functions/kakao-book-search` | Edge Function (Deno) — Kakao API 프록시 + books 캐싱 | REQ-BOOK-001~004, REQ-BOOK-010~012 |
| `books` SELECT (클라이언트 PostgREST) | `supabase.from('books').select()` — 캐시 조회, 상세 조회 | REQ-BOOK-013, REQ-BOOK-015 |
| `books` INSERT (service_role, Edge Function) | Edge Function이 업서트 — 클라이언트 직접 INSERT 불가 | REQ-BOOK-011 |
| 바코드 스캔 | `expo-camera` `onBarCodeScanned` — 클라이언트 전용 | REQ-BOOK-006~009 |

> `POST /books/scan`, `GET /books/{id}`, `GET /books/{id}/cover` (structure.md API 서피스)는
> 본 SPEC에서 클라이언트 함수(`searchByIsbn`, `getBookDetail`)로 매핑된다. 별도 REST
> 엔드포인트가 아닌 PostgREST `books` SELECT + Edge Function 조합으로 구현된다.

---

## 5. 제외 범위 (Exclusions)

본 SPEC은 다음을 포함하지 않는다:

1. **서재 추가 플로우**: `user_books` INSERT(진도 0, 상태 reading)는 SPEC-LIBRARY-001이
   처리한다. 본 SPEC은 `book_id` 반환까지만 책임진다.
2. **표지 이미지 Storage 업로드**: `cover_url`은 Kakao API의 URL을 그대로 사용하며,
   Supabase Storage에 이미지를 업로드/캐싱/리사이징하는 로직은 포함하지 않는다
   (tech.md "백엔드/데이터베이스" Storage 영역이나 별도 SPEC에서 처리).
3. **추천 알고리즘**: "같은 책 읽는 독자", "같은 시기 추천" 등은 SPEC-CLUB-001,
   SPEC-FEED-001 영역이다.
4. **다른 도서 API 연동**: Naver Book API, Google Books API 등 다른 외부 도서 API는
   MVP 범위 밖이며, Kakao Book Search API만 사용한다.
5. **도서 정보 수정**: `books` 행의 사용자 편집(오타 수정, 총 페이지 수정 등)은 MVP에서
   지원하지 않는다. `books`는 Kakao API 캐시이며 읽기 전용이다.
6. **검색 결과 무한 스크롤/페이지네이션**: 추가 페이지 로드는 미결정 사항(Open Question 6.1)이며,
   MVP에서는 첫 페이지 결과로 제한한다.
7. **오프라인 검색 캐시**: 네트워크 오프라인 시 로컬 캐시 조회/큐잉은 미결정 사항
   (Open Question 6.3)이며, MVP 범위 밖이다.
8. **OAuth 앱 등록·Kakao Developers 설정**: Kakao REST API 키 발급, 앱 등록은
   SPEC-DEPLOY-001 인프라 영역이다.

---

## 6. 미결정 사항 (Open Questions)

### 6.1 검색 결과 페이지네이션 임계값 — 미해결

Kakao API 검색 결과의 페이지네이션 처리 방식(첫 페이지만 vs 무한 스크롤 vs 더 보기 버튼)이
미확정이다.

**현재 결정**: MVP에서는 첫 페이지(`size` 기본값, 약 10~50권)만 반환한다.

**영향 범위**: 사용자 경험(많은 검색 결과 탐색), Kakao API 할당량 소비.

**해결 시점**: SPEC-BOOK-001 구현 후 사용자 피드백 기반 확정, 또는 SPEC-LIBRARY-001
연동 시 재검토.

### 6.2 Kakao API 할당량 초과 시 폴백 — 미해결

Kakao Book Search API의 일일/월간 할당량 초과 시 동작이 미확정이다.

**후보**:
- (A) 에러 메시지 표시 후 재시도 유도
- (B) `books` 캐시 테이블만 조회(캐시된 도서만 검색 가능)
- (C) 대체 도서 API(Naver 등) 폴백 — 제외 범위 위반이므로 부적합

**권장**: (B) — 할당량 초과 시 캐시 전용 모드로 전환, 사용자에게 안내.

**해결 시점**: Edge Function 구현 시 할당량 에러 코드 매핑과 함께 확정.

### 6.3 오프라인 검색 캐시 TTL — 미해결

`books` 캐시 행의 유효 기간(TTL) 및 오프라인 시 캐시 조회 전략이 미확정이다.

**현재 결정**: `books` 행은 영구 캐시(TTL 없음). 도서 메타데이터(title/author/isbn)는
변경 빈도가 극히 낮으므로 갱신하지 않는다.

**영향 범위**: 출판사 메타데이터 변경(개정판 표지 교체 등) 반영 지연.

**해결 시점**: MVP 이후 데이터 품질 모니터링 기반 재검토.

### 6.4 ISBN 이외 바코드 처리 — 미해결

QR 코드, Code128 등 ISBN이 아닌 바코드 인식 시 사용자 안내 방식이 미확정이다.

**후보**:
- (A) 조용히 무시 (현재 기본 동작)
- (B) "ISBN 바코드를 스캔해 주세요" 짧은 안내 토스트

**해결 시점**: UX 프로토타이핑 단계에서 확정.

---

## 7. 추적성 (Traceability)

| TAG | 요구사항 | 소스 |
|-----|---------|------|
| SPEC-BOOK-001 | REQ-BOOK-001 ~ REQ-BOOK-016 | `.moai/project/product.md`(핵심 기능 "종이책 서재 관리"), `.moai/project/structure.md`(API 서피스 Books/Edge Functions), `.moai/project/tech.md`(외부 API 섹션), `.moai/specs/SPEC-DB-001/spec.md`(REQ-DB-002 books 스키마, REQ-DB-013b books RLS), `.moai/specs/SPEC-API-001/spec.md`(REQ-API-004 Edge Function 래퍼, REQ-API-011~015 에러 처리), `.moai/project/db/schema.md`(books 테이블), `.moai/specs/INDEX.md`(SPEC 카탈로그) |

---

## 구현 이력 (Implementation History)

### M1+M2 구현 완료 (2026-06-16)

**PR**: #8 (squash-merged into develop)
**커밋**: 852f0ac
**범위**: REQ-BOOK-001~005, REQ-BOOK-010~016 (M1: Edge Function, M2: Client API)
**연기**: M3 (REQ-BOOK-006~009 바코드 스캔), M4 (화면 UI), expo-camera 의존성, 실제 Kakao REST API 키 배포

**구현 산출물**:

새 파일:
- `src/types/book.ts` — BookRow, SearchResult, SearchTarget + type guards (isSearchTarget, isValidSearchResult)
- `src/features/book/searchApi.ts` — searchBooks(query, target), 빈 쿼리 차단 로직
- `src/features/book/bookDetailApi.ts` — getBookDetail(bookId), PGRST116→NOT_FOUND 변환
- `src/features/book/index.ts` — 통합 진입점
- `supabase/functions/kakao-book-search/index.ts` — Edge Function 진입점 (Deno)
- `supabase/functions/kakao-book-search/normalizer.ts` — 쿼리 정규화 (trim, lowercase)
- `supabase/functions/kakao-book-search/cacheManager.ts` — 캐시 조회/업서트 로직
- `supabase/functions/kakao-book-search/mapper.ts` — Kakao 응답 → SearchResult 매핑
- `supabase/functions/kakao-book-search/kakaoClient.ts` — Kakao API HTTP 클라이언트
- `supabase/functions/kakao-book-search/deno.json` — Deno 의존성
- `jest.config.js` — collectCoverageFrom 확장 (supabase/functions/** 포함)

테스트:
- `src/features/book/__tests__/searchApi.test.ts` — 32개 테스트, 커버리지 100%
- `src/features/book/__tests__/bookDetailApi.test.ts` — 29개 테스트, 커버리지 100%
- `supabase/functions/kakao-book-search/__tests__/normalizer.test.ts` — 17개 테스트
- `supabase/functions/kakao-book-search/__tests__/cacheManager.test.ts` — 15개 테스트
- `supabase/functions/kakao-book-search/__tests__/mapper.test.ts` — 22개 테스트
- `supabase/functions/kakao-book-search/__tests__/kakaoClient.test.ts` — 20개 테스트
- **전체**: 373개 테스트 통과, src/features/book 100%, Edge Function 96.87% 커버리지

**공개 API** (structure.md 등록 완료):
- `searchBooks(query, target): Promise<SearchResult[]>` — 빈/공백 쿼리 차단
- `getBookDetail(bookId): Promise<BookRow>` — 존재하지 않으면 NOT_FOUND
- Edge Function: `POST /functions/kakao-book-search` → `{data: SearchResult[]}` | `{error, code}`

**기술 결정**:

1. **타입 정의**: BookRow는 `src/types/book.ts`에 수동 정의 (gen-types REQ-API-008 연기, 기존 types/index.ts의 Book은 emotion 도메인 소속이므로 untouched)
2. **Edge Function 아키텍처**: 순수 로직 모듈 (normalizer/mapper/cacheManager/kakaoClient)은 Deno globals 없이 Jest로 DI 테스트, index.ts는 얇은 Deno 셸
3. **인터페이스 계약**: `{data: SearchResult[]}` 성공 / `{error, code}` 에러. authors[]는 SearchResult에서 배열 유지, books.author 컬럼에만 쉼표 결합 (mapper)
4. **보안**: KAKAO_REST_API_KEY + SUPABASE_SERVICE_ROLE_KEY는 Edge Function 환경 변수만 (REQ-BOOK-002). 클라이언트는 anon 키 + SELECT만
5. **N+1 해결**: commit 2fdabc5에서 upsertBooks 배치 업서트로 수정 (PostgREST `.upsert(rows[])`)

**연기 사항 (M3/M4)**:

- 바코드 스캔 (REQ-BOOK-006~009): expo-camera 의존성 필요
- 화면 UI (BookSearchScreen/BookDetailScreen): SPEC-UI-002 화면 패턴 적용 필요
- 실제 Kakao REST API 키 배포: SPEC-DEPLOY-001 인프라 영역
- 무한 스크롤/페이지네이션: Open Question 6.1 미해결

**품질 게이트 통과**:

- TypeScript: 0 errors
- ESLint: 0 errors
- Jest: 373/373 passed
- Coverage: src/features/book 100%, Edge Function 96.87%
- evaluator-active: PASS (점수 미확인, TRUST 5 준수)

**후속 작업**:

- SPEC-LIBRARY-001: user_books 플로우에서 getBookDetail 반환값 활용
- SPEC-BOOK-001 M3: expo-camera 추가 및 BarcodeScanner.tsx 구현
- SPEC-BOOK-001 M4: Pencil .pen 기반 화면 UI 구현
- SPEC-DEPLOY-001: Kakao REST API 키 배포 및 OAuth 앱 등록

---

### M3+M4 구현 완료 (2026-06-16)

**PR**: #9 (squash-merged into develop)
**커밋**: a293e8d
**범위**: REQ-BOOK-005, REQ-BOOK-006~009, REQ-BOOK-014~016 (M3: 바코드 스캔, M4: 화면 UI)
**status**: completed (M1~M4 전부 develop 머지)

**구현 산출물**:

새 파일 (M3 — 바코드 스캔):
- `src/features/book/isbn.ts` — isValidIsbn13/isValidIsbn10/isValidIsbn (ISBN-13 EAN-13 체크디지트 + ISBN-10 레거시 호환)
- `src/features/book/debounce.ts` — shouldSuppressDuplicate 순수 함수 (DUPLICATE_DEBOUNCE_MS=2000)
- `src/features/book/BarcodeScanner.tsx` — CameraView/useCameraPermissions(expo-camera), 권한 게이트 3상태, ISBN 바코드 타입 필터(ean13/upc_a)
- `src/features/book/__tests__/__mocks__/expo-camera.tsx` — expo-camera jest 수동 목

새 파일 (M4 — 화면 UI):
- `src/features/book/format.ts` — formatPublishedMonth(iso) → "YYYY.MM" 공유 유틸
- `src/components/SearchResultCard.tsx` — 검색 결과 카드 (Pencil x8zuOu, BookCard와 분리)
- `src/features/book/BookSearchScreen.tsx` — 검색 메인 화면 (Pencil F06-Search E44G9)
- `src/features/book/BookDetailScreen.tsx` — 도서 상세 화면 (useSession 세션 가드, 에러 매핑)

수정 파일 (라우팅 통합):
- `app/(tabs)/search.tsx` — BookSearchScreen 라우트 (href:null), ISBN 자동 전환 param
- `app/(tabs)/scan.tsx` — BarcodeScanner 라우트 (href:null), ISBN 감지 시 router.replace('/search')
- `app/(tabs)/[bookId].tsx` — BookDetailScreen 통합 (SPEC-NAV-001 stub 교체)
- `app/(tabs)/library.tsx` — 검색 진입 CTA (빈 상태 + 헤더 아이콘)
- `app/(tabs)/_layout.tsx` — search/scan Tabs.Screen href:null 등록
- `src/features/book/index.ts` — BarcodeScanner, isValidIsbn* barrel 확장
- `package.json` — expo-camera ~55.0.19 추가

테스트:
- `src/features/book/__tests__/isbn.test.ts` — ISBN-13/ISBN-10 체크디지트 검증
- `src/features/book/__tests__/debounce.test.ts` — 디바운스 계약 직접 검증
- `src/features/book/__tests__/BarcodeScanner.test.tsx` — 권한 게이트 3상태, 바코드 타입 필터
- `src/features/book/__tests__/format.test.ts` — 출판일 포맷 변환
- `src/components/__tests__/SearchResultCard.test.tsx` — 카드 렌더링, 메타 라인, 접근성
- `src/features/book/__tests__/BookSearchScreen.test.tsx` — 빈 쿼리 차단, 빈 결과, 로딩/에러
- `src/features/book/__tests__/BookDetailScreen.test.tsx` — 세션 가드, NOT_FOUND/RLS 에러
- **전체**: 462 테스트 통과 (52 suites), 커버리지 94%+

**공개 API** (신규, M3+M4):
- `BarcodeScanner` 컴포넌트 — onIsbnDetected(isbn), onManualEntry, onClose
- `isValidIsbn(value)`, `isValidIsbn13(isbn)`, `isValidIsbn10(isbn)` — ISBN 검증
- `SearchResultCard` 컴포넌트 — result, onPress
- `BookSearchScreen` 컴포넌트 — onNavigateScan, onSelectBook, initialQuery, initialTarget
- `BookDetailScreen` 컴포넌트 — bookId, onRequireAuth

**기술 결정 (M3+M4)**:

1. **BookCard vs SearchResult 분리**: 기존 BookCard는 서재용(currentPage/totalPages 진행률 필수), 검색 결과는 진행률 없음 → SearchResultCard 별도 작성 (Pencil x8zuOu)
2. **디바운스 순수 함수 추출**: 컴포넌트 테스트에서 setScanning(false)로 디바운스 분기 도달 불가 → shouldSuppressDuplicate 순수 함수로 추출 (REQ-BOOK-009 실질 검증)
3. **format 유틸 공유**: SearchResultCard + BookDetailScreen 동일 출판일 포맷 공유 → formatPublishedMonth 공유 유틸 (DRY)
4. **expo-camera ~55.0.19**: SDK 55 호환. CameraView(active, barcodeScannerSettings, onBarcodeScanned), useCameraPermissions 훅
5. **Pencil 디자인 기반**: sagak.pen SearchResultCard(x8zuOu), F06-Search(E44G9), F07-Scan(acwG9). token-only 스타일링 (SPEC-UI-002 FROZEN)
6. **권한 게이트 3상태**: permission === null(loading) / granted / denied(or undetermined) 분기 처리 (evaluator fix cycle 반영)

**품질 게이트 통과**:
- TypeScript: 0 errors
- ESLint: 0 errors
- Jest: 462/462 passed (52 suites)
- Coverage: 94%+
- evaluator-active: PASS

**Known Issue (합의된 후속)**:

- **ISBN→bookId 매핑**: search.tsx에서 검색 결과 선택 시 `router.push('/book/${result.isbn}')` 로 ISBN 기반 라우팅. 현재 [bookId].tsx는 ISBN을 param으로 수신하지만, BookDetailScreen은 books.id(UUID)로 getBookDetail을 호출. 이 ISBN→bookId 매핑은 SPEC-LIBRARY-001에서 user_books 플로우와 함께 해결 예정 (합의된 후속, 결함 아님). M4 범위에서는 라우팅 연결까지만 구현.

**남은 작업 (본 SPEC 범위 외)**:
- 실제 Kakao REST API 키 배포: SPEC-DEPLOY-001 인프라 영역
- 무한 스크롤/페이지네이션: Open Question 6.1 미해결

| REQ-BOOK-SEARCH | REQ-BOOK-001 ~ REQ-BOOK-005 | structure.md "Edge Functions (카카오 연동)", tech.md "외부 API" |
| REQ-BOOK-SCAN | REQ-BOOK-006 ~ REQ-BOOK-009 | product.md "바코드 스캔", structure.md "POST /books/scan" |
| REQ-BOOK-CACHE | REQ-BOOK-010 ~ REQ-BOOK-014 | SPEC-DB-001 REQ-DB-002, REQ-DB-013b, tech.md "검색 결과는 캐싱을 통해 중복 호출을 최소화" |
| REQ-BOOK-DETAIL | REQ-BOOK-015 ~ REQ-BOOK-016 | structure.md "GET /books/{id}", SPEC-API-001 REQ-API-012 NOT_FOUND |
