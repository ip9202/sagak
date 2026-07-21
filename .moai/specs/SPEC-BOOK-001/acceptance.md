---
id: SPEC-BOOK-001
title: "Book Search & Registration — Acceptance Criteria"
version: "1.0.0"
status: draft
created: 2026-06-14
updated: 2026-06-14
author: "강력쇠주먹"
priority: high
issue_number: 0
---

# SPEC-BOOK-001 인수 기준

## 개요

본 문서는 SPEC-BOOK-001 요구사항(REQ-BOOK-001 ~ REQ-BOOK-016)의 인수 기준을
Given-When-Then(Gherkin) 형식으로 정의한다. 각 시나리오는 관찰 가능한 증거(테스트 출력,
파일 존재, 컴파일 결과, 네트워크 모킹)를 기반으로 검증 가능해야 한다.

---

## Module 1: REQ-BOOK-SEARCH — Kakao 도서 검색 (Edge Function 프록시)

### 시나리오 S1: Edge Function 엔드포인트 존재

**Given** `supabase/functions/kakao-book-search/index.ts` 파일이 존재한다
**When** Edge Function이 배포된 후 `POST /functions/kakao-book-search` 엔드포인트로
`{ "query": "호모 데우스" }` 요청을 전송한다
**Then** HTTP 200 응답과 정규화된 도서 JSON 배열이 반환되어야 한다

**검증 방법**: 통합 테스트 — `supabase.functions.invoke('kakao-book-search', { body: { query: '호모 데우스' } })`
호출, 응답 스키마 검증

### 시나리오 S2: API 키 서버 보관

**Given** Edge Function이 `Deno.env.get('KAKAO_REST_API_KEY')`로 API 키를 읽는다
**When** 클라이언트 번들(`src/` 디렉토리 전체)에서 `KAKAO_REST_API_KEY` 문자열을 검색한다
**Then** 클라이언트 코드에 API 키 값이 포함되어 있지 않아야 한다 (빈 문자열 또는 미참조)
**And** `EXPO_PUBLIC_KAKAO_REST_API_KEY` 환경 변수가 클라이언트에서 사용되지 않아야 한다

**검증 방법**: 정적 분석 테스트 — `grep -r "KAKAO_REST_API_KEY" src/` 결과 빈 집합,
빌드 후 번들에서 키 문자열 부재 확인

### 시나리오 S3: 검색 결과 응답 스키마 정규화

**Given** Kakao API가 `documents` 배열을 포함한 응답을 반환한다
**When** Edge Function이 응답을 정규화한다
**Then** 각 도서 객체가 다음 필드를 포함해야 한다:
`title`(문자열), `authors`(배열), `publisher`(문자열), `published_at`(ISO 날짜 문자열),
`cover_url`(문자열), `isbn`(문자열), `kakao_id`(문자열)
**And** 필수 필드(title, authors, isbn)가 누락된 도서 객체는 제외되어야 한다

**검증 방법**: 단위 테스트 — Kakao API 응답 모킹, 정규화 함수 출력 스키마 검증

### 시나리오 S4: Kakao API 에러 처리

**Given** Kakao API가 HTTP 4xx/5xx 에러를 반환한다 (또는 타임아웃/네트워크 장애)
**When** Edge Function이 에러 응답을 수신한다
**Then** 클라이언트에 `{ error: string, code: string }` 구조의 에러 응답이 반환되어야 한다
**And** 클라이언트는 SPEC-API-001 `normalizeError`를 통해 사용자 친화적 메시지로 변환해야 한다

**검증 방법**: 단위 테스트 — Kakao API 에러 모킹, Edge Function 에러 응답 스키마 검증

### 시나리오 S5: 수동 검색 빈 쿼리 차단

**Given** 사용자가 검색 입력 필드에 빈 문자열 또는 공백만 입력한다
**When** 검색 버튼을 누르거나 엔터를 입력한다
**Then** 검색 요청(Edge Function 호출)이 실행되지 않아야 한다
**And** 사용자에게 "검색어를 입력해 주세요" 메시지가 표시되어야 한다

**검증 방법**: 컴포넌트 테스트 — `invokeEdgeFunction` 스파이, 빈 쿼리 submit 시 호출되지 않음 검증

---

## Module 2: REQ-BOOK-SCAN — 바코드 스캔 (ISBN)

### 시나리오 S6: 카메라 권한 요청

**Given** 사용자가 바코드 스캔 화면에 처음 진입한다
**When** `BarcodeScanner` 컴포넌트가 마운트된다
**Then** `expo-camera`의 권한 요청 API(`Camera.requestCameraPermissionsAsync()`)가
호출되어야 한다
**And** 권한 상태가 `granted`, `denied`, `undetermined` 중 하나로 설정되어야 한다

**검증 방법**: 컴포넌트 테스트 — 권한 API 모킹, 마운트 시 호출 검증

### 시나리오 S7: 카메라 권한 거부 시 대체 경로

**Given** 사용자가 카메라 권한을 거부한 상태이다
**When** 바코드 스캔 화면이 렌더링된다
**Then** 카메라 뷰가 표시되지 않아야 한다
**And** "설정에서 카메라 권한을 허용해 주세요" 안내 메시지가 표시되어야 한다
**And** 수동 ISBN 입력 필드 대체 경로가 제공되어야 한다

**검증 방법**: 컴포넌트 테스트 — 권한 `denied` 모킹, 안내 메시지 및 수동 입력 필드 렌더링 검증

### 시나리오 S8: ISBN 바코드 인식

**Given** 카메라가 활성화되어 있고 권한이 부여되어 있다
**When** ISBN(EAN-13) 바코드가 카메라에 인식된다 (`onBarCodeScanned` 콜백, type=EAN_13)
**Then** 인식된 데이터가 ISBN-13 포맷(13자리 숫자, 978/979 접두사)으로 검증되어야 한다
**And** 유효한 ISBN인 경우 검색 플로우로 전환되어야 한다

**검증 방법**: 단위 테스트 — `isValidIsbn13('9791186565873')` true 반환,
`isValidIsbn13('123')` false 반환 검증

### 시나리오 S9: 비-ISBN 바코드 무시

**Given** 카메라가 활성화되어 있다
**When** QR 코드 또는 Code128 바코드가 인식된다 (type=QR_CODE 또는 type=CODE_128)
**Then** 해당 바코드는 무시되어야 한다
**And** 검색 플로우로 전환되지 않아야 한다
**And** 스캔이 계속 진행되어야 한다

**검증 방법**: 단위 테스트 — QR 타입 바코드 이벤트 모킹, 검색 함수 호출되지 않음 검증

### 시나리오 S10: ISBN 인식 시 자동 검색 전환

**Given** 유효한 ISBN-13 바코드가 인식되었다
**When** `onBarCodeScanned` 콜백이 처리된다
**Then** 카메라 스캔이 중지되어야 한다
**And** `target='isbn'`으로 `searchBooks(isbn, 'isbn')`이 호출되어야 한다
**And** 검색 결과가 단일 도서인 경우 상세/등록 화면으로 전환되어야 한다

**검증 방법**: 컴포넌트 테스트 — ISBN 스캔 이벤트 모킹, `searchBooks` 호출 인자 및
화면 전환 검증

### 시나리오 S11: 중복 스캔 디바운스

**Given** 카메라가 활성화되어 있다
**When** 동일 ISBN 바코드가 2초 이내에 연속으로 인식된다 (예: 3회)
**Then** 첫 번째 인식만 검색 요청으로 처리되어야 한다
**And** 나머지 인식 이벤트는 무시되어야 한다 (중복 API 호출 방지)

**검증 방법**: 단위 테스트 — `isDuplicateWithin(isbn, 2000ms)` 디바운스 로직,
동일 ISBN 2초 내 반복 시 true 반환 검증 (Jest 가짜 타이머 사용)

### 시나리오 S12: ISBN-10 레거시 호환 (엣지 케이스)

**Given** 구형 책의 바코드가 ISBN-10(10자리) 포맷이다
**When** `onBarCodeScanned`가 ISBN-10 데이터를 수신한다
**Then** ISBN-10을 ISBN-13으로 변환(`convertIsbn10To13`)한 후 검색을 수행해야 한다
**Or** ISBN-10을 그대로 `target='isbn'` 검색에 사용해야 한다 (Kakao API ISBN-10 지원 여부 확인)

**검증 방법**: 단위 테스트 — `isValidIsbn10('8932917245')` true 반환,
`convertIsbn10To13('8932917245')` 유효한 ISBN-13 반환 검증

---

## Module 3: REQ-BOOK-CACHE — books 테이블 캐싱·업서트

### 시나리오 S13: 캐시 히트 시 Kakao API 호출 생략

**Given** `books` 테이블에 ISBN "9791186565873"인 행이 이미 존재한다
**When** 클라이언트가 `invokeEdgeFunction('kakao-book-search', { query: '9791186565873', target: 'isbn' })`를 호출한다
**Then** Edge Function은 Kakao API(`dapi.kakao.com`)에 요청을 전송하지 않아야 한다
**And** `books` 테이블의 기존 행이 정규화 JSON으로 반환되어야 한다

**검증 방법**: 통합 테스트 — `fetch` 스파이로 Kakao API 호출 부재 검증,
`books` SELECT 모킹으로 캐시된 행 반환 검증

### 시나리오 S14: 캐시 미스 시 Kakao API 호출 후 업서트

**Given** `books` 테이블에 ISBN "9791186565873"인 행이 존재하지 않는다
**When** 클라이언트가 해당 ISBN으로 검색을 요청한다
**Then** Edge Function이 Kakao API를 호출해야 한다
**And** Kakao 응답의 도서를 `books` 테이블에 업서트해야 한다
(`ON CONFLICT (isbn) DO UPDATE`, service_role 키 사용)
**And** 업서트된 행을 정규화 JSON으로 반환해야 한다

**검증 방법**: 통합 테스트 — `supabase.from('books').upsert` 모킹,
Kakao API 응답 → books INSERT 매핑 검증

### 시나리오 S15: Kakao 응답 → books 컬럼 매핑

**Given** Kakao API 응답 도서 객체가 `authors: ["유발 하라리"]`, `title: "호모 데우스"`,
`publisher: "김영사"`, `thumbnail: "https://..."`, `isbn: "9791186565873"`를 포함한다
**When** Edge Function이 books 업서트를 수행한다
**Then** `books.author` 컬럼에 `"유발 하라리"`가 저장되어야 한다 (배열 → 쉼표 결합)
**And** `books.title`에 `"호모 데우스"`, `books.isbn`에 `"9791186565873"`,
`books.cover_url`에 thumbnail URL이 저장되어야 한다
**And** NOT NULL 컬럼(title, author, isbn)이 모두 채워져야 한다

**검증 방법**: 단위 테스트 — `mapKakaoToBook(kakaoResponse)` 출력 검증

### 시나리오 S16: 클라이언트 books SELECT (캐시 조회)

**Given** `books` 테이언트가 인증된 상태이다 (JWT 보유)
**When** `bookDetailApi.getBook(bookId)`를 호출한다
**Then** `supabase.from('books').select('*').eq('id', bookId).single()`이 실행되어야 한다
**And** PostgREST로 직접 조회되어야 한다 (Edge Function을 거치지 않음)
**And** RLS 정책(authenticated SELECT `USING(true)`, REQ-DB-013b)에 의해 행이 반환되어야 한다

**검증 방법**: 단위 테스트 — `supabase.from('books').select` 모킹,
RLS 통과 시 행 반환 검증

### 시나리오 S17: 책 등록(book_id) 반환

**Given** 사용자가 검색 결과에서 특정 책을 선택한다
**When** 책 선택 이벤트가 처리된다
**Then** 해당 도서의 `book_id`(books.id, UUID)가 반환되어야 한다
**And** 이 `book_id`는 후속 서재 추가 플로우(SPEC-LIBRARY-001)에 전달 가능해야 한다

**검증 방법**: 통합 테스트 — 검색 결과 → 선택 → `book_id` 반환 검증,
`user_books` INSERT 미호출 확인 (본 SPEC 범위 밖)

### 시나리오 S18: 동일 도서 중복 등록 방지 (엣지 케이스)

**Given** 동일 ISBN("9791186565873")의 `books` 행이 이미 존재한다
**When** 다른 사용자가 같은 ISBN으로 검색한다
**Then** 새로운 `books` 행이 생성되지 않아야 한다 (UNIQUE isbn 제약)
**And** 기존 행의 `id`가 반환되어야 한다 (캐시 재사용)
**And** Kakao API가 호출되지 않아야 한다 (캐시 히트, S13과 동일)

**검증 방법**: 통합 테스트 — 동일 ISBN 2회 검색 시 단일 books 행 유지 검증

---

## Module 4: REQ-BOOK-DETAIL — 책 상세 조회

### 시나리오 S19: 책 상세 정보 조회 성공

**Given** `books` 테이블에 `bookId`(UUID)에 해당하는 행이 존재한다
**When** `bookDetailApi.getBook(bookId)`를 호출한다
**Then** `supabase.from('books').select('*').eq('id', bookId).single()`이 실행된다
**And** 단일 `Book` 행(title, author, publisher, cover_url 등)이 반환되어야 한다

**검증 방법**: 단위 테스트 — PostgREST 응답 모킹, 반환 타입 및 필드 검증

### 시나리오 S20: 존재하지 않는 bookId (엣지 케이스)

**Given** `books` 테이블에 `bookId`에 해당하는 행이 존재하지 않는다
**When** `bookDetailApi.getBook(bookId)`를 호출한다
**Then** PostgREST가 `PGRST116`(0 rows) 에러를 반환한다
**And** SPEC-API-001 `normalizeError`가 `NOT_FOUND` 카테고리로 분류해야 한다
**And** 사용자에게 "책 정보를 찾을 수 없습니다" 메시지가 표시되어야 한다

**검증 방법**: 단위 테스트 — PostgREST 빈 결과 모킹, 에러 분류 검증

### 시나리오 S21: ISBN 검색 빈 결과 폴백

**Given** 사용자가 바코드 스캔 또는 수동 입력으로 ISBN "9999999999999"(존재하지 않는 ISBN)를 검색한다
**When** Kakao API가 빈 `documents` 배열을 반환한다
**Then** 검색 결과 목록이 비어 있어야 한다
**And** 사용자에게 "해당 ISBN의 도서를 찾을 수 없습니다" 메시지가 표시되어야 한다
**And** 수동 입력(제목/저자) 대체 경로가 안내되어야 한다

**검증 방법**: 통합 테스트 — Kakao API 빈 응답 모킹, 빈 결과 + 안내 메시지 검증

### 시나리오 S22: 미인증 사용자 books 조회 차단 (RLS 엣지 케이스)

**Given** 사용자가 로그인하지 않은 상태이다 (JWT 없음)
**When** `bookDetailApi.getBook(bookId)`를 호출한다
**Then** RLS 정책(REQ-DB-013b — authenticated SELECT)에 의해 행이 반환되지 않아야 한다
**Or** 인증 오류가 발생해야 한다
**And** 클라이언트는 로그인 화면으로 리다이렉트해야 한다 (SPEC-AUTH-001 연동)

**검증 방법**: 통합 테스트 — 미인증 상태 모킹, RLS 거부 검증 (SPEC-AUTH-001 완료 후 통합)

---

## 엣지 케이스 요약

| 시나리오 | 엣지 케이스 | 기대 동작 |
|---------|-----------|-----------|
| S12 | ISBN-10 레거시 바코드 | ISBN-13 변환 후 검색 또는 직접 검색 |
| S18 | 동일 도서 중복 등록 | UNIQUE isbn 제약, 기존 행 재사용 |
| S20 | 존재하지 않는 bookId | NOT_FOUND 에러, 사용자 안내 |
| S21 | ISBN 검색 빈 결과 | 빈 목록 + 수동 입력 안내 |
| S22 | 미인증 사용자 조회 | RLS 차단, 로그인 리다이렉트 |

---

## 품질 게이트 (Definition of Done)

본 SPEC의 인수 기준 충족 여부는 다음 기준으로 판정한다:

- **기능 완성도**: S1~S22 모든 시나리오 통과 (22/22)
- **테스트 커버리지**: `src/features/book/` 및 `supabase/functions/kakao-book-search/`
  커버리지 85% 이상
- **보안 검증**: S2(API 키 서버 보관), S22(RLS 차단) 통과
- **TRUST 5**: Tested, Readable, Unified, Secured, Trackable 5차원 모두 통과
- **SPEC-DB-001 정합성**: books 컬럼 매핑(S15)이 REQ-DB-002 스키마와 정확히 일치
- **SPEC-API-001 연동**: 에러 처리(S4, S20)가 REQ-API-011~015 체계 사용

---

## 검증 도구

| 시나리오 범주 | 검증 도구 |
|--------------|----------|
| Edge Function 로직 | Deno 테스트 러너(`deno test`) 또는 Supabase 로컬 함수 테스트 |
| 클라이언트 API 함수 | Jest 단위 테스트 + `supabase` 모킹 |
| 바코드 스캔 컴포넌트 | `@testing-library/react-native` 컴포넌트 테스트 |
| RLS 정책 | Supabase 로컬 개발 환경(`supabase start`) + pgTAP 테스트 (SPEC-DB-001 패턴) |
| 통합 플로우 | 통합 테스트 (Edge Function + 클라이언트 API + books SELECT) |
| API 키 노출 검사 | 정적 분석(`grep -r`) 또는 빌드 번들 검사 스크립트 |
