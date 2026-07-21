---
# 8-field frontmatter (spec.md와 동기화)
id: SPEC-LIBRARY-001
title: "Personal Library Management - Acceptance Criteria"
version: "1.0.0"
status: draft
created: 2026-06-14
updated: 2026-06-14
author: "강력쇠주먹"
priority: high
issue_number: 0
labels: [library, user-books, progress-tracking, reading-status, visibility, crud, acceptance, gherkin]
---

# SPEC-LIBRARY-001: 인수 기준

## HISTORY

| 날짜 | 버전 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 2026-06-14 | 1.0.0 | 최초 작성 — Given/When/Then 시나리오, 엣지 케이스, 품질 게이트 정의 | 강력쇠주먹 |

---

## 1. 인수 시나리오 (Acceptance Scenarios)

> 모든 시나리오는 Given-When-Then(Gherkin) 형식으로 작성된다. 각 시나리오는
> `spec.md`의 REQ-LIB-* 요구사항에 추적 가능해야 한다.

### 1.1 서재 추가 (REQ-LIB-CRUD: REQ-LIB-001, REQ-LIB-002)

#### AC-LIB-001: 정상적인 서재 책 추가

```
Feature: 서재 책 추가

  Scenario: 사용자가 새 책을 서재에 추가한다
    Given 사용자가 인증된 상태이다
    And 책 "돈키호테"(book_id: "book-001")가 books 테이블에 등록되어 있다
    And 사용자의 서재에 "book-001"이 존재하지 않는다

    When 사용자가 "서재에 추가" 버튼을 탭한다

    Then user_books 테이블에 새 행이 INSERT된다
    And user_id는 현재 인증 사용자 ID이다
    And book_id는 "book-001"이다
    And status는 "reading"이다
    And current_page는 0이다
    And is_public은 true이다
    And started_reading_at은 현재 시각(now)으로 설정된다
    And 서재 목록에 해당 책이 즉시 표시된다
```

#### AC-LIB-002: 중복 추가 방지 (UNIQUE 제약)

```
Feature: 서재 책 추가

  Scenario: 이미 서재에 있는 책을 다시 추가하려 한다
    Given 사용자가 인증된 상태이다
    And 책 "돈키호테"(book_id: "book-001")가 사용자의 서재에 이미 존재한다

    When 사용자가 "서재에 추가" 버튼을 탭한다

    Then DB UNIQUE(user_id, book_id) 제약에 의해 INSERT가 거부된다 (409 Conflict)
    And 클라이언트는 "이미 서재에 있는 책입니다" 메시지를 표시한다
    And 중복 행은 생성되지 않는다
    And 서재 목록에 변화가 없다
```

#### AC-LIB-003: 미인증 사용자의 서재 추가 차단 (RLS)

```
Feature: 서재 책 추가

  Scenario: 미인증 사용자가 서재에 책을 추가하려 한다
    Given 사용자가 인증되지 않은 상태이다 (auth.uid() = null)

    When 서재 추가 API를 호출한다

    Then RLS 정책에 의해 INSERT가 거부된다
    And 클라이언트는 인증 에러를 수신한다
    And user_books 테이블에 행이 생성되지 않는다
```

### 1.2 서재 목록 조회 (REQ-LIB-CRUD: REQ-LIB-003, REQ-LIB-005)

#### AC-LIB-004: 서재 목록 정상 조회

```
Feature: 서재 목록 조회

  Scenario: 사용자가 자신의 서재 목록을 조회한다
    Given 사용자가 인증된 상태이다
    And 사용자의 서재에 3권의 책이 등록되어 있다 (reading 2권, completed 1권)

    When 사용자가 서재 화면을 연다

    Then user_books 테이블에서 auth.uid() = user_id 조건으로 행이 조회된다
    And books 테이블이 조인되어 책 메타데이터(제목, 저자, 표지, 총 페이지)가 포함된다
    And 3권의 책이 목록에 표시된다
    And 타인의 서재 행은 RLS에 의해 숨겨진다
```

#### AC-LIB-005: 서재 목록 status 필터링

```
Feature: 서재 목록 조회

  Scenario: 사용자가 status 필터로 "읽는 중" 책만 조회한다
    Given 사용자가 인증된 상태이다
    And 사용자의 서재에 reading 2권, completed 1권, shelved 1권이 있다

    When 사용자가 "읽는 중" 필터 탭을 선택한다

    Then status='reading'인 2권의 책만 표시된다
    And completed, shelved 상태의 책은 숨겨진다
```

#### AC-LIB-006: 빈 서재 상태

```
Feature: 서재 목록 조회

  Scenario: 서재에 책이 없을 때 빈 상태 UI를 표시한다
    Given 사용자가 인증된 상태이다
    And 사용자의 서재에 등록된 책이 없다

    When 사용자가 서재 화면을 연다

    Then 빈 상태 UI가 표시된다
    And "서재에 책을 추가해 보세요" 안내 메시지가 표시된다
    And 책 검색/추가로 이동하는 버튼이 표시된다
```

### 1.3 서재 항목 삭제 (REQ-LIB-CRUD: REQ-LIB-004)

#### AC-LIB-007: 자식 데이터 없는 서재 항목 삭제

```
Feature: 서재 항목 삭제

  Scenario: 감정 기록이 없는 서재 항목을 삭제한다
    Given 사용자가 인증된 상태이다
    And 서재 항목 "book-001"에 감정 기록(emotion_records)이 없다
    And 서재 항목 "book-001"에 완독 리포트(completion_reports)가 없다

    When 사용자가 "삭제" 버튼을 탭하고 확인 다이얼로그에서 "삭제"를 선택한다

    Then user_books에서 해당 행이 DELETE된다
    And 서재 목록에서 해당 책이 제거된다
```

#### AC-LIB-008: 자식 데이터 있는 서재 항목 삭제 제한 (FK RESTRICT)

```
Feature: 서재 항목 삭제

  Scenario: 감정 기록이 있는 서재 항목 삭제를 시도한다
    Given 사용자가 인증된 상태이다
    And 서재 항목 "book-001"에 감정 기록 3개가 존재한다

    When 사용자가 "삭제" 버튼을 탭하고 확인 다이얼로그에서 "삭제"를 선택한다

    Then FK ON DELETE RESTRICT 정책에 의해 DELETE가 거부된다
    And 클라이언트는 "이 책에 감정 기록이 있어 삭제할 수 없습니다" 메시지를 표시한다
    And 서재 항목은 유지된다
    And "보관함으로 이동" 대안 옵션이 제안된다 (미결정 사항 5.3 정책 반영)
```

### 1.4 진도 추적 (REQ-LIB-PROGRESS: REQ-LIB-010 ~ REQ-LIB-013)

#### AC-LIB-009: 정상적인 진도 업데이트

```
Feature: 진도 추적

  Scenario: 사용자가 현재 페이지를 업데이트한다
    Given 사용자가 인증된 상태이다
    And 서재 항목 "book-001"의 current_page가 50이다
    And 책 "book-001"의 total_pages가 300이다

    When 사용자가 페이지 입력 필드에 "120"을 입력하고 저장한다

    Then user_books에서 current_page가 120으로 UPDATE된다
    And DB 트리거가 last_progress_at을 now()로 자동 갱신한다
    And 클라이언트는 last_progress_at을 UPDATE 본문에 포함하지 않는다
    And 진도률이 40%로 재계산되어 표시된다 (120/300 * 100)
```

#### AC-LIB-010: 페이지 값 검증 — 음수 거부

```
Feature: 진도 추적

  Scenario: 음수 페이지 값을 입력한다
    Given 사용자가 책 상세 화면에 있다

    When 사용자가 페이지 입력 필드에 "-5"를 입력하고 저장한다

    Then 클라이언트 측 검증이 음수를 거부한다
    And "페이지 번호는 0 이상이어야 합니다" 에러 메시지가 표시된다
    And DB UPDATE는 전송되지 않는다
```

#### AC-LIB-011: 페이지 값 검증 — total_pages 초과 거부

```
Feature: 진도 추적

  Scenario: 총 페이지 수를 초과하는 값을 입력한다
    Given 사용자가 책 상세 화면에 있다
    And 책 "book-001"의 total_pages가 300이다

    When 사용자가 페이지 입력 필드에 "350"을 입력하고 저장한다

    Then 클라이언트 측 검증이 초과를 거부한다
    And "마지막 페이지를 초과했습니다" 에러 메시지가 표시된다
    And DB UPDATE는 전송되지 않는다
```

#### AC-LIB-012: total_pages null 도서의 진도 업데이트

```
Feature: 진도 추적

  Scenario: 수동 입력 도서(total_pages=null)의 진도를 업데이트한다
    Given 사용자가 책 상세 화면에 있다
    And 책 "book-002"의 total_pages가 null이다 (수동 입력)

    When 사용자가 페이지 입력 필드에 "100"을 입력하고 저장한다

    Then current_page가 100으로 UPDATE된다
    And 상한 검사는 생략된다 (total_pages가 null이므로)
    And 진도률은 표시되지 않는다 (total_pages가 null이므로)
```

#### AC-LIB-013: 진도 낙관적 업데이트 + 성공

```
Feature: 진도 추적

  Scenario: 진도 업데이트 시 낙관적 업데이트가 적용된다
    Given 사용자가 책 상세 화면에 있다
    And 현재 current_page가 50이다

    When 사용자가 "100"을 입력하고 저장한다

    Then UI가 즉시 current_page=100으로 갱신된다 (서버 응답 대기 없음)
    And 서버 UPDATE가 성공하면 UI가 확정된다
    And ProgressBar가 즉시 갱신된다
```

#### AC-LIB-014: 진도 낙관적 업데이트 + 실패 롤백

```
Feature: 진도 추적

  Scenario: 서버 실패 시 낙관적 업데이트가 롤백된다
    Given 사용자가 책 상세 화면에 있다
    And 현재 current_page가 50이다
    And 네트워크가 불안정하다

    When 사용자가 "100"을 입력하고 저장한다

    Then UI가 즉시 current_page=100으로 갱신된다
    But 서버 UPDATE가 실패한다 (네트워크 에러)
    And UI가 이전 값(50)으로 롤백된다
    And "진도 저장에 실패했습니다. 다시 시도해 주세요" 에러 메시지가 표시된다
    And 재시도 옵션이 제공된다
```

### 1.5 독서 상태 관리 (REQ-LIB-STATUS: REQ-LIB-020 ~ REQ-LIB-023)

#### AC-LIB-015: 완독 처리 (reading → completed)

```
Feature: 독서 상태 관리

  Scenario: 사용자가 책을 완독 처리한다
    Given 사용자가 인증된 상태이다
    And 서재 항목 "book-001"의 status가 "reading"이다

    When 사용자가 "완독 처리" 버튼을 탭한다

    Then user_books에서 status가 "completed"로 UPDATE된다
    And 클라이언트는 completed_at을 UPDATE 본문에 포함하지 않는다
    And DB 트리거가 completed_at을 now()로 자동 설정한다 (SPEC-DB-001 REQ-DB-003)
    And DB 트리거가 completion_reports 행을 자동 생성한다 (SPEC-DB-001 REQ-DB-010)
    And 완독 축하 메시지가 표시된다
```

#### AC-LIB-016: 완독 리포트 멱등성 (재완독)

```
Feature: 독서 상태 관리

  Scenario: 이미 완독한 책의 상태를 역전환 후 재완독한다
    Given 서재 항목 "book-001"의 status가 "completed"이다
    And completion_reports에 이미 행이 존재한다

    When 사용자가 status를 "reading"으로 역전환한다 (미결정 사항 5.1 — 허용 가정)
    And 이후 다시 "completed"로 전환한다

    Then DB UNIQUE(user_book_id) + ON CONFLICT DO NOTHING에 의해
    completion_reports에 새 행이 생성되지 않는다
    And 기존 completion_reports 행이 유지된다
```

#### AC-LIB-017: 서재 정리 (reading → shelved)

```
Feature: 독서 상태 관리

  Scenario: 사용자가 읽기를 중단하고 책을 보관한다
    Given 사용자가 인증된 상태이다
    And 서재 항목 "book-001"의 status가 "reading"이다

    When 사용자가 "보관함으로 이동" 버튼을 탭한다

    Then user_books에서 status가 "shelved"로 UPDATE된다
    And 기본 서재 목록(진행 중)에서 해당 책이 사라진다
    And "보관함" 필터에서 해당 책이 표시된다
    And current_page, last_progress_at 등 기존 진도 데이터는 유지된다
```

#### AC-LIB-018: 잘못된 status 값 거부 (CHECK 제약)

```
Feature: 독서 상태 관리

  Scenario: 허용되지 않은 status 값을 전송한다
    Given 클라이언트가 status UPDATE를 시도한다

    When status 값으로 "paused"를 전송한다

    Then DB CHECK 제약에 의해 UPDATE가 거부된다
    And 클라이언트는 "올바르지 않은 상태 값입니다" 에러 메시지를 표시한다
    And status는 이전 값을 유지한다
```

### 1.6 공개/비공개 설정 (REQ-LIB-VISIBILITY: REQ-LIB-030 ~ REQ-LIB-032)

#### AC-LIB-019: 공개 범위 토글 (true → false)

```
Feature: 공개/비공개 설정

  Scenario: 사용자가 서재 항목을 비공개로 설정한다
    Given 사용자가 인증된 상태이다
    And 서재 항목 "book-001"의 is_public이 true이다

    When 사용자가 책 상세 화면에서 "공개" 토글을 끈다

    Then user_books에서 is_public이 false로 UPDATE된다
    And 해당 항목이 user_books_public 보안 뷰에서 제거된다
    And Track A 독자 목록에 해당 항목이 더 이상 나타나지 않는다
    And 본인 서재에서는 계속 조회 가능하다
```

#### AC-LIB-020: 공개 범위 토글 (false → true)

```
Feature: 공개/비공개 설정

  Scenario: 사용자가 서재 항목을 다시 공개로 설정한다
    Given 사용자가 인증된 상태이다
    And 서재 항목 "book-001"의 is_public이 false이다

    When 사용자가 책 상세 화면에서 "공개" 토글을 켠다

    Then user_books에서 is_public이 true로 UPDATE된다
    And 해당 항목이 user_books_public 보안 뷰에 다시 포함된다
    And Track A 독자 목록에 해당 항목이 다시 나타난다
```

#### AC-LIB-021: 신규 추가 항목의 공개 기본값 안내

```
Feature: 공개/비공개 설정

  Scenario: 책을 서재에 추가할 때 공개 기본값을 안내한다
    Given 사용자가 책 상세 또는 검색 결과 화면에 있다

    When "서재에 추가" 버튼 근처의 UI를 본다

    Then "서재에 추가하면 기본적으로 공개됩니다" 안내 문구가 표시된다
    And 추가 후 책 상세 화면에서 공개 범위를 변경할 수 있음이 안내된다
```

---

## 2. 엣지 케이스 (Edge Cases)

### EC-01: 세션 만료 중 서재 조작

```
Feature: 세션 만료 처리

  Scenario: 진도 업데이트 중 세션이 만료된다
    Given 사용자가 책 상세 화면에서 진도를 입력했다
    And 세션이 백그라운드에서 만료되었다 (JWT 갱신 실패)

    When 사용자가 저장 버튼을 탭한다

    Then RLS 정책이 auth.uid() = null로 인해 UPDATE를 거부한다
    And 클라이언트는 AUTH 에러 카테고리를 수신한다
    And "세션이 만료되었습니다. 다시 로그인해 주세요" 메시지가 표시된다
    And 진도 데이터는 UI에 보존된다 (재로그인 후 재시도 가능)
```

### EC-02: 동시 진도 업데이트 (경쟁 조건)

```
Feature: 동시성 처리

  Scenario: 두 기기에서 같은 책의 진도를 동시에 업데이트한다
    Given 사용자가 기기 A와 기기 B에서 같은 계정으로 로그인되어 있다
    And 서재 항목 "book-001"의 current_page가 50이다

    When 기기 A에서 current_page=100으로 업데이트하고
    And 거의 동시에 기기 B에서 current_page=80으로 업데이트한다

    Then 최종 current_page는 나중에 도착한 UPDATE 값으로 확정된다
    And 사용자가 수동으로 새로고침하면 최종값이 동기화된다
    And last_progress_at은 두 UPDATE 모두에 의해 갱신된다
```

### EC-03: books.total_pages 변경 후 진도율 재계산

```
Feature: 진도율 계산

  Scenario: 총 페이지 수가 나중에 업데이트된 경우
    Given 서재 항목 "book-001"의 current_page가 100이다
    And 책 "book-001"의 total_pages가 처음에 null이었다가 200으로 업데이트되었다

    When 사용자가 서재 목록을 새로고침한다

    Then 진도률이 50%로 재계산되어 표시된다 (100/200 * 100)
    And ProgressBar가 50%로 갱신된다
```

### EC-04: 대량 서재 (성능)

```
Feature: 성능

  Scenario: 서재에 100권 이상의 책이 있는 경우
    Given 사용자의 서재에 150권의 책이 등록되어 있다

    When 사용자가 서재 화면을 연다

    Then 목록이 2초 이내에 표시된다 (초기 로딩)
    And 스크롤이 부드럽게 동작한다 (60fps 유지)
    And status 필터 전환이 1초 이내에 완료된다
```

> 성능 기준은 휴리스틱이며, 구현 시 실제 측정값으로 조정 가능.

### EC-05: 오프라인 상태에서 서재 조작

```
Feature: 오프라인 처리

  Scenario: 네트워크가 끊긴 상태에서 진도를 업데이트한다
    Given 사용자가 책 상세 화면에 있다
    And 네트워크 연결이 끊겨 있다

    When 사용자가 진도를 입력하고 저장한다

    Then 네트워크 에러가 발생한다
    And "네트워크 연결을 확인해 주세요" 메시지가 표시된다
    And 낙관적 업데이트가 롤백된다
    And 진도 데이터는 입력 필드에 보존된다 (재시도 가능)
```

> 오프라인 큐잉/동기화는 SPEC-API-001 미결정 사항 6.2이며, MVP 범위 밖.

### EC-06: 삭제 후 서재 목록 동기화

```
Feature: 서재 항목 삭제

  Scenario: 서재 항목 삭제 후 목록이 즉시 갱신된다
    Given 사용자가 서재 화면에 있다
    And 서재에 3권의 책이 있다

    When 사용자가 한 권을 삭제한다 (자식 데이터 없음)

    Then 서재 목록이 2권으로 즉시 갱신된다
    And 새로고침 없이도 UI가 반영된다
    And 삭제된 항목이 애니메이션과 함께 사라진다
```

---

## 3. 품질 게이트 (Quality Gates)

### 3.1 기능 검증 (Functionality)

- [ ] 모든 AC-LIB-001 ~ AC-LIB-021 시나리오가 통과한다
- [ ] 서재 CRUD가 RLS 정책과 일관되게 동작한다
- [ ] DB 트리거 자동 갱신(last_progress_at, completed_at)이 검증되었다
- [ ] UNIQUE 제약 에러가 사용자 친화적 메시지로 변환된다

### 3.2 보안 검증 (Security)

- [ ] 미인증 사용자는 서재 조작이 불가하다 (RLS)
- [ ] 타인의 서재 행은 조회/수정/삭제 불가하다 (RLS)
- [ ] 페이지 값 검증이 클라이언트 + DB 양쪽에서 동작한다
- [ ] status 값이 CHECK 제약에 의해 검증된다

### 3.3 성능 검증 (Performance)

- [ ] 서재 목록 조회가 2초 이내에 완료된다 (100권 기준)
- [ ] 진도 업데이트가 낙관적 적용으로 즉시 UI 반영된다
- [ ] status 필터 전환이 1초 이내에 완료된다

### 3.4 사용성 검증 (Usability)

- [ ] 빈 서재 상태가 명확하게 안내된다
- [ ] 모든 에러 메시지가 한국어 사용자 친화적이다
- [ ] 삭제 확인 다이얼로그가 실수를 방지한다
- [ ] 공개 기본값이 사전에 안내된다

---

## 4. Definition of Done (완료 기준)

본 SPEC은 다음 조건이 모두 충족되면 완료로 간주된다:

1. **요구사항 구현**: spec.md의 모든 REQ-LIB-001 ~ REQ-LIB-032가 구현되었다
2. **인수 시나리오 통과**: AC-LIB-001 ~ AC-LIB-021 시나리오가 자동화 테스트로
   검증되었다
3. **엣지 케이스 처리**: EC-01 ~ EC-06이 수동/자동 테스트로 확인되었다
4. **품질 게이트 통과**: TRUST 5 검증(Tested 85%+, Readable, Unified, Secured,
   Trackable)이 완료되었다
5. **선행 SPEC 의존성 확인**: SPEC-DB-001(트리거 동작), SPEC-API-001(클라이언트),
   SPEC-AUTH-001(인증), SPEC-BOOK-001(책 등록)이 모두 구현되어 있다
6. **미결정 사항 해결 또는 문서화**: 미결정 사항 5.1~5.4가 사용자 승인을 받았거나,
   후속 버전에서 해결될 계획이 문서화되어 있다

---

## 5. 추적성 (Traceability)

| 인수 시나리오 | 요구사항 | 마일스톤 |
|--------------|---------|---------|
| AC-LIB-001 | REQ-LIB-001 | M1, M3 |
| AC-LIB-002 | REQ-LIB-002 | M1, M6 |
| AC-LIB-003 | REQ-LIB-005 | M1 |
| AC-LIB-004 | REQ-LIB-003, REQ-LIB-005 | M2, M3 |
| AC-LIB-005 | REQ-LIB-003 | M2, M3 |
| AC-LIB-006 | REQ-LIB-003 | M3 |
| AC-LIB-007 | REQ-LIB-004 | M4, M6 |
| AC-LIB-008 | REQ-LIB-004 | M4, M6 |
| AC-LIB-009 | REQ-LIB-010, REQ-LIB-012 | M2, M4 |
| AC-LIB-010 | REQ-LIB-011 | M4 |
| AC-LIB-011 | REQ-LIB-011 | M4 |
| AC-LIB-012 | REQ-LIB-011, REQ-LIB-012 | M4 |
| AC-LIB-013 | REQ-LIB-013 | M2, M4 |
| AC-LIB-014 | REQ-LIB-013 | M2, M6 |
| AC-LIB-015 | REQ-LIB-020, REQ-LIB-021 | M4, M5 |
| AC-LIB-016 | REQ-LIB-022 | M5 |
| AC-LIB-017 | REQ-LIB-023 | M4 |
| AC-LIB-018 | REQ-LIB-020 | M4, M6 |
| AC-LIB-019 | REQ-LIB-030, REQ-LIB-031 | M4 |
| AC-LIB-020 | REQ-LIB-030, REQ-LIB-031 | M4 |
| AC-LIB-021 | REQ-LIB-032 | M3, M4 |

| 엣지 케이스 | 관련 요구사항 | 관련 미결정 사항 |
|------------|--------------|-----------------|
| EC-01 | REQ-LIB-010, REQ-LIB-005 | SPEC-AUTH-001 미결정 사항 5.2 |
| EC-02 | REQ-LIB-010 | — |
| EC-03 | REQ-LIB-012 | — |
| EC-04 | REQ-LIB-003 | — |
| EC-05 | REQ-LIB-010, REQ-LIB-013 | SPEC-API-001 미결정 사항 6.2 |
| EC-06 | REQ-LIB-004 | 미결정 사항 5.3 |
