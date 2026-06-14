---
id: SPEC-BOOK-001
title: "Book Search & Registration — Implementation Plan"
version: "1.0.0"
status: draft
created: 2026-06-14
updated: 2026-06-14
author: "강력쇠주먹"
priority: high
issue_number: 0
---

# SPEC-BOOK-001 구현 계획

## 개요

본 문서는 SPEC-BOOK-001 요구사항(REQ-BOOK-001 ~ REQ-BOOK-016)의 구현 접근법,
마일스톤, 기술 스택 결정, 리스크를 정의한다. 구현 코드는 `/moai:2-run` 단계에서
작성되며, 본 문서는 계획 문서이다.

---

## 1. 기술 스택 결정

### 1.1 신규 의존성 (package.json 추가 필요)

| 패키지 | 버전 | 목적 | REQ |
|--------|------|------|-----|
| `expo-camera` | ~16.0.0 | 바코드 스캔(ISBN), 카메라 권한 | REQ-BOOK-006, REQ-BOOK-007 |

> 버전은 2026-06-14 기준 Expo SDK 55 호환 안정 버전이며, `/moai:2-run` 단계에서
> 최신 안정 버전으로 확정.

### 1.2 기존 의존성 (SPEC-API-001, SPEC-UI-001에서 이미 설치 또는 예정)

- `@supabase/supabase-js` ^2.45.0 (SPEC-API-001) — PostgREST `books` SELECT,
  `supabase.functions.invoke('kakao-book-search')`
- `expo` ~55.0.0, `expo-router` ~5.0.0, `react` 19.2.0, `react-native` 0.83.2
- `typescript` ~5.7.0 (strict 모드)
- `jest` ^29.7.0, `@testing-library/react-native` ^13.3.0

### 1.3 Edge Function 런타임 (Deno, 별도 패키지 아님)

- Supabase Edge Functions (Deno 런타임)
- 표준 라이브러리: `Deno.env`, `fetch` (내장)
- Supabase 클라이언트(Deno용): `@supabase/supabase-js` (Edge Function 내에서
  `service_role` 키로 `books` 업서트)

### 1.4 외부 API

- Kakao Book Search API: `https://dapi.kakao.com/v3/search/book`
- 인증: `Authorization: KakaoAK <REST_API_KEY>` 헤더
- REST API 키: Kakao Developers 콘솔에서 발급 (SPEC-DEPLOY-001 인프라 영역)

---

## 2. 파일 구조 (구현 산출물)

```
src/
├── features/book/
│   ├── searchApi.ts              # Kakao 검색 API 호출 래퍼 (REQ-BOOK-001, 003~005)
│   ├── bookDetailApi.ts          # books SELECT 상세 조회 (REQ-BOOK-013, 015)
│   ├── BarcodeScanner.tsx        # 바코드 스캔 컴포넌트 (REQ-BOOK-006~009)
│   ├── BookSearchScreen.tsx      # 검색 메인 화면 (수동 검색 + 스캔 진입점)
│   ├── BookDetailScreen.tsx      # 책 상세 화면 (REQ-BOOK-015)
│   └── __tests__/
│       ├── searchApi.test.ts
│       ├── bookDetailApi.test.ts
│       └── BarcodeScanner.test.tsx
└── types/
    └── book.ts                   # SearchResult, BookDetail 타입 (gen-types Book 기반 도출)

supabase/
└── functions/
    └── kakao-book-search/
        ├── index.ts              # Edge Function 진입점 (REQ-BOOK-001~004, 010~012)
        ├── kakaoClient.ts        # Kakao API 호출 로직
        ├── cacheManager.ts       # books 캐시 조회·업서트 (service_role)
        └── deno.json             # Deno 설정 (import map)
```

> `src/types/db.ts`의 `Book` 타입(SPEC-API-001 REQ-API-008)을 기반으로
> `SearchResult`(Kakao 응답 정규화) 및 `BookDetail`(books SELECT Row) 타입을 도출한다.

---

## 3. 마일스톤 (우선순위 기반)

### Milestone 1: Edge Function 인프라 (Priority High)

**목표**: Kakao Book Search API 프록시 Edge Function 구축 및 API 키 서버 보관 확립.

- REQ-BOOK-001: `POST /functions/kakao-book-search` 엔드포인트 구현
- REQ-BOOK-002: `KAKAO_REST_API_KEY` 환경 변수 설정 (Edge Function 시크릿)
- REQ-BOOK-003: Kakao API 응답 정규화 스키마 매핑
- REQ-BOOK-004: Kakao API 에러 처리 (구조화 에러 응답)
- REQ-BOOK-010: 캐시 히트 우선 조회 로직
- REQ-BOOK-011: 캐시 미스 시 Kakao API 호출 후 books 업서트 (service_role)
- REQ-BOOK-012: Kakao 응답 → books 컬럼 매핑

**완료 조건**: Edge Function 로컬(`supabase functions serve`) 및 원격 배포 후,
클라이언트 없이 curl/Postman으로 검색 요청 시 정규화된 JSON 반환.

### Milestone 2: 클라이언트 검색 API 레이어 (Priority High)

**목표**: Edge Function 호출 래퍼 및 books SELECT 조회 함수 구현.

- REQ-BOOK-005: 수동 검색 입력 검증 (빈 쿼리 차단)
- REQ-BOOK-013: 클라이언트 books SELECT (캐시 조회, PostgREST 직접)
- REQ-BOOK-014: 책 등록 결과(book_id) 반환
- REQ-BOOK-015: 책 상세 정보 조회 (`books` SELECT)
- REQ-BOOK-016: ISBN 검색 빈 결과 폴백

**의존**: Milestone 1 완료 (Edge Function 배포), SPEC-API-001 완료 (클라이언트 싱글톤).

**완료 조건**: `searchApi.ts`, `bookDetailApi.ts` 단위 테스트 통과.

### Milestone 3: 바코드 스캔 UI (Priority Medium)

**목표**: `expo-camera` 기반 ISBN 바코드 스캔 컴포넌트 구현.

- REQ-BOOK-006: 카메라 권한 요청 및 거부 처리
- REQ-BOOK-007: ISBN 바코드 포맷 검증
- REQ-BOOK-008: ISBN 인식 시 자동 검색 전환
- REQ-BOOK-009: 중복 스캔 디바운스

**의존**: Milestone 2 완료 (검색 API 레이어).

**완료 조건**: `BarcodeScanner.tsx` 컴포넌트 렌더링 및 스캔 이벤트 단위 테스트 통과.
실기기 카메라 테스트는 통합 검증 단계에서 수행.

### Milestone 4: 검색·상세 화면 통합 (Priority Medium)

**목표**: 검색 메인 화면과 상세 화면 통합, BookCard 컴포넌트 연동.

- `BookSearchScreen.tsx`: 수동 검색 입력 + 검색 결과 목록(BookCard 렌더링)
- `BookDetailScreen.tsx`: 책 상세 정보 표시 (표지, 제목, 저자, 출판사)
- 검색 결과 → 상세 → 등록(book_id 반환) 플로우 연결

**의존**: Milestone 2, 3 완료, SPEC-UI-001 `BookCard` 컴포넌트.

**완료 조건**: 화면 간 네비게이션 플로우 통합 테스트 통과.
(SPEC-NAV-001 라우팅 구조와의 통합은 SPEC-NAV-001 완료 후 별도 연동.)

---

## 4. 아키텍처 설계 방향

### 4.1 Edge Function 프록시 패턴

```
[클라이언트]                              [Edge Function]                    [Kakao API]
     │                                          │                                │
     │  invokeEdgeFunction(                     │                                │
     │    'kakao-book-search',                  │                                │
     │    { query, target })                    │                                │
     │ ────────────────────────────────────────>│                                │
     │                                          │                                │
     │                              1. books 캐시 조회 (service_role)            │
     │                                  (kakao_id 또는 isbn 기준)                │
     │                                          │                                │
     │                          [캐시 히트] ─────├──> 정규화 JSON 반환            │
     │ <─────────────────────────────────────────│                                │
     │                                          │                                │
     │                          [캐시 미스] ─────┤ 2. Kakao API 호출              │
     │                                          │ ──────────────────────────────>│
     │                                          │ <──────────────────────────────│
     │                                          │                                │
     │                              3. books 업서트 (service_role,               │
     │                                  ON CONFLICT DO UPDATE)                   │
     │                                          │                                │
     │                                          ├──> 정규화 JSON 반환             │
     │ <─────────────────────────────────────────│                                │
```

**핵심 설계 원칙**:
- API 키는 Edge Function 환경 변수에만 존재 (REQ-BOOK-002)
- 캐시 히트 시 Kakao API 호출 생략 (REQ-BOOK-010) — 할당량 절약
- 업서트는 `service_role`로 수행, 클라이언트는 SELECT 전용 (REQ-DB-013b 준수)

### 4.2 클라이언트 데이터 흐름

```
[사용자 입력]
  ├─ 수동 검색 (제목/저자/ISBN) ─> searchApi.searchBooks(query, target)
  │                                    │
  │                                    v
  │                            invokeEdgeFunction('kakao-book-search')
  │                                    │
  │                                    v
  │                            SearchResult[] (정규화 JSON)
  │                                    │
  │                                    v
  │                            BookCard 목록 렌더링
  │
  └─ 바코드 스캔 ─> BarcodeScanner ─> ISBN 인식 ─> searchApi.searchBooks(isbn, 'isbn')
                                                         │
                                                         v
                                                 (동일 플로우)

[책 선택] ─> BookDetailScreen ─> bookDetailApi.getBook(bookId)
                                    │
                                    v
                            supabase.from('books').select().eq('id', bookId)
                                    │
                                    v
                            BookDetail 반환 ─> book_id 후속 플로우(SPEC-LIBRARY-001) 전달
```

### 4.3 ISBN 바코드 검증 로직

```
onBarCodeScanned(data, type):
  if type not in [EAN_13, UPC_A]:
    return  # ISBN 포맷 아님, 무시 (REQ-BOOK-007)

  isbn = sanitize(data)
  if not isValidIsbn13(isbn) and not isValidIsbn10(isbn):
    return  # 유효하지 않은 ISBN

  if isDuplicateWithin(isbn, 2000ms):  # 디바운스 (REQ-BOOK-009)
    return

  stopCamera()
  searchByIsbn(isbn)  # 자동 전환 (REQ-BOOK-008)
```

### 4.4 books 업서트 매핑 (REQ-BOOK-012)

| Kakao API 필드 | books 컬럼 | 변환 로직 |
|----------------|-----------|-----------|
| `title` | `title` | 그대로 매핑 (NOT NULL) |
| `authors[]` | `author` | `authors.join(', ')` (NOT NULL) |
| `publisher` | `publisher` | 그대로 매핑 |
| `datetime` | `published_at` | ISO → date 부분 추출 |
| `thumbnail` | `cover_url` | URL 그대로 매핑 |
| `isbn` | `isbn` | 공백 분리 시 첫 번째 값 (UNIQUE) |
| `contents`(가능) | — | MVP 미매핑 |
| — | `total_pages` | Kakao 미제공 시 NULL |
| — | `kakao_id` | Kakao 응답 식별자 (가용 시) |

> 업서트 충돌 키: `isbn` (UNIQUE 제약 기반 `ON CONFLICT (isbn) DO UPDATE`).

---

## 5. 리스크 및 대응 계획

### 리스크 1: Kakao API 할당량 초과 (Medium)

**상황**: Kakao Book Search API의 일일/월간 호출 한도 도달.

**영향**: 검색 기능 전면 장애.

**대응**:
- REQ-BOOK-010 캐시 히트 우선 조회로 API 호출 최소화 (사전 예방)
- 미결정 사항 6.2 폴백 전략 확정: 할당량 초과 에러 코드 감지 시 캐시 전용 모드 전환
- Edge Function에서 할당량 모니터링 로깅 (Sentry 연동 준비)

### 리스크 2: 클라이언트 API 키 노출 (High)

**상황**: Kakao REST API 키가 클라이언트 번들에 포함되어 유출.

**영향**: API 키 악용, 할당량 소진, 보안 사고.

**대응**:
- REQ-BOOK-002 강제: 키는 Edge Function 환경 변수만 사용
- 코드 리뷰 체크리스트: `EXPO_PUBLIC_KAKAO_*` 변수 사용 금지 (클라이언트 노출)
- 빌드 후 번들 검사: API 키 문자열 grep 자동화 (SPEC-DEPLOY-001 CI/CD 영역)

### 리스크 3: 바코드 인식률 저하 (Medium)

**상향**: ISBN 바코드가 아닌 바코드 인식, 조명/각도 문제로 인식 실패.

**영향**: 사용자 경험 저하, 수동 입력 이탈.

**대응**:
- REQ-BOOK-007 ISBN 포맷 검증으로 비-ISBN 바코드 필터링
- REQ-BOOK-006 권한 거부 시 수동 ISBN 입력 대체 경로 제공
- UX 안내: "책 뒷면의 바코드를 카메라에 비춰 주세요" 가이드 표시

### 리스크 4: books 캐시 정합성 (Low)

**상황**: 출판사 메타데이터 변경(개정판 표지 등)이 `books` 캐시에 반영되지 않음.

**영향**: 구버전 메타데이터 표시.

**대응**:
- 미결정 사항 6.3: MVP에서는 영구 캐시(TTL 없음) 정책 채택 — 도서 메타데이터 변경 빈도 극히 낮음
- 향후 데이터 품질 모니터링 도입 시 선택적 갱신 로직 추가 검토

### 리스크 5: Edge Function 콜드 스타트 지연 (Low)

**상황**: Supabase Edge Function 최초 호출 시 콜드 스타트로 인한 지연.

**영향**: 첫 검색 요청 응답 지연 (수초).

**대응**:
- 검색 화면 로딩 상태 UI 표시로 체감 지연 완화
- 캐시 히트 시(REQ-BOOK-010) 응답 속도 향상

---

## 6. 품질 게이트 (TRUST 5)

본 SPEC 구현 시 다음 TRUST 5 기준을 충족해야 한다:

- **Tested**: Edge Function 로직(캐시 조회·업서트), 클라이언트 검색 API, 바코드 검증
  로직 단위 테스트. 목표 커버리지 85% 이상. (REQ-BOOK-001~016 해당 함수)
- **Readable**: 한국어 주석, 명확한 함수명(`searchBooks`, `getBookDetail`, `upsertBookCache`).
  영어 식별자, 한국어 코드 주석 (language.yaml `code_comments: ko` 준수).
- **Unified**: ESLint + Prettier + TypeScript strict 모드 통과. SPEC-UI-001 코딩 스타일 준수.
- **Secured**: API 키 서버 보관(REQ-BOOK-002), 클라이언트 번들 키 노출 검사,
  books INSERT는 service_role만(REQ-DB-013b 준수), 카메라 권한 명시적 요청(REQ-BOOK-006).
- **Trackable**: Conventional commits, SPEC-BOOK-001 참조, 각 REQ별 커밋 매핑.
  커밋 메시지 한국어 (language.yaml `git_commit_messages: ko` 준수).

---

## 7. 전문가 컨설팅 권장 영역

본 SPEC은 다음 영역에 대해 전문가 에이전트 컨설팅을 권장한다:

### 7.1 Backend 전문가 (expert-backend)

**대상**: Edge Function(`kakao-book-search`) 아키텍처, Kakao API 연동 로직, books 업서트
성능 최적화, 에러 처리 설계.

**이유**: Edge Function은 Deno 런타임으로 클라이언트와 다른 환경이며, Kakao API 응답
정규화와 캐시 일관성 보장 로직이 백엔드 전문 지식을 요구.

### 7.2 Frontend 전문가 (expert-frontend)

**대상**: `BarcodeScanner.tsx` 카메라 권한 처리 및 스캔 UX, `BookSearchScreen.tsx` 검색
상태 관리, 로딩/에러 상태 UI 패턴.

**이유**: `expo-camera` 바코드 스캔은 모바일 네이티브 권한과 라이프사이클 관리가 필요하며,
검색 화면의 비동기 상태(로딩/에러/빈 결과) 처리는 프론트엔드 전문 설계가 필요.

### 7.3 DevOps 전문가 (expert-devops)

**대상**: Edge Function 배포, Kakao REST API 키 시크릿 관리, 환경 분리(dev/staging/prod)에서의
Edge Function 시크릿 주입.

**이유**: API 키 시크릿 관리는 인프라 설정(SPEC-DEPLOY-001)과 연동되며, Edge Function
배포 파이프라인은 DevOps 전문 지식이 필요.

---

## 8. 다음 단계

1. 본 SPEC 문서 사용자 승인(Annotation cycle)
2. `/moai:2-run SPEC-BOOK-001`으로 구현 시작
3. 구현 순서: Milestone 1(Edge Function) → Milestone 2(클라이언트 API) →
   Milestone 3(바코드 UI) → Milestone 4(화면 통합)
4. 각 Milestone 완료 후 진척도 추적(`.moai/specs/SPEC-BOOK-001/progress.md`)
5. 모든 Milestone 완료 후 `/moai:3-sync SPEC-BOOK-001`으로 문서화
