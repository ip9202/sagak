---
# 8-field frontmatter (spec.md와 동기화)
id: SPEC-LIBRARY-001
title: "Personal Library Management - Implementation Plan"
version: "1.0.0"
status: draft
created: 2026-06-14
updated: 2026-06-14
author: "강력쇠주먹"
priority: high
issue_number: 0
labels: [library, user-books, progress-tracking, reading-status, visibility, crud, plan]
---

# SPEC-LIBRARY-001: 구현 계획

## HISTORY

| 날짜 | 버전 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 2026-06-14 | 1.0.0 | 최초 작성 — 마일스톤, 기술 접근법, 아키텍처 방향, 리스크 정의 | 강력쇠주먹 |

---

## 1. 마일스톤 (Milestones)

> 본 계획은 시간 예측을 사용하지 않으며, 우선순위 기반 마일스톤으로 진행 순서를
> 정의한다 (TRUST 원칙 — 예측 가능성). 각 마일스톤은 선행 마일스톤 완료 후 시작한다.

### Primary Goal (우선순위 High) — 서재 CRUD 파운데이션

**목표**: 사용자가 서재에 책을 추가하고, 목록을 조회하고, 삭제할 수 있는 핵심 기능

- **M1: libraryApi 타입 안전 쿼리 함수 구현**
  - `src/features/library/libraryApi.ts` 작성
  - `addBook`, `getLibrary`, `deleteBook`, `updateProgress`, `updateStatus`,
    `updateVisibility` 함수 정의
  - 각 함수는 `supabase.from('user_books')` 사용, gen-types `Database` 타입 적용
  - UNIQUE 충돌(409) 및 RLS 거부 에러 처리 (SPEC-API-001 REQ-API-012 분류)
  - 산출물: `src/features/library/libraryApi.ts`

- **M2: useLibrary 훅 (데이터 페칭 + 상태 관리)**
  - `src/features/library/useLibrary.ts` 작성
  - `useLibrary` 훅: 서재 목록 조회 + status 필터 + 정렬 (REQ-LIB-003)
  - `useLibraryItem` 훅: 개별 서재 항목 상세 조회 (책 메타데이터 조인)
  - `useUpdateProgress`, `useUpdateStatus`, `useUpdateVisibility` mutation 훅
  - 낙관적 업데이트 적용 (REQ-LIB-013, 데이터 페칭 라이브러리 확정 시)
  - 산출물: `src/features/library/useLibrary.ts`

- **M3: 서재 화면 (Library Screen)**
  - `app/(tabs)/library.tsx` 작성
  - 서재 목록 표시 (`BookCard` 컴포넌트 재사용)
  - status 필터 탭 (전체 / 읽는 중 / 완독 / 보관함)
  - 빈 상태 UI (서재가 비었을 때 책 추가 유도)
  - 산출물: `app/(tabs)/library.tsx`

### Secondary Goal (우선순위 Medium) — 진도 추적 및 상태 관리

**목표**: 사용자가 진도를 업데이트하고, 독서 상태를 전환하며, 공개 범위를 제어

- **M4: 책 상세 화면 (Book Detail Screen)**
  - `app/(tabs)/[bookId].tsx` 작성
  - 현재 페이지 입력 + 진도률 표시 (`ProgressBar` 컴포넌트)
  - 독서 상태 전환 드롭다운 (reading/completed/shelved)
  - 공개/비공개 토글
  - 서재에서 삭제 버튼 + 확인 다이얼로그
  - 페이지 값 검증 (REQ-LIB-011: 음수 거부, total_pages 초과 거부)
  - 산출물: `app/(tabs)/[bookId].tsx`

- **M5: 완독 처리 플로우**
  - "완독 처리" 버튼 → `status='completed'` UPDATE
  - 완독 완료 토스트/축하 메시지 표시
  - DB 트리거 자동 생성 확인 (completion_reports 행 존재 여부 조회 — 선택적)
  - 역전환(completed → reading) 경고 UI (미결정 사항 5.1 정책 반영)
  - 산출물: 책 상세 화면 내 완독 플로우 통합

### Final Goal (우선순위 Low) — 에지 케이스 및 UX 다듬기

- **M6: 에지 케이스 처리**
  - 중복 추가 방지 (REQ-LIB-002: 409 Conflict → 사용자 메시지)
  - 삭제 시 자식 데이터 RESTRICT 위반 처리 (REQ-LIB-004, 미결정 사항 5.3)
  - 페이지 검증 에러 메시지 (REQ-LIB-011)
  - 네트워크 실패 시 낙관적 업데이트 롤백 (REQ-LIB-013)

### Optional Goal — 확장 기능 (MVP 범위 밖, 후순위)

- **M7 (선택): 대량 삭제 UX** (미결정 사항 5.4 해결 시)
  - 다중 선택 체크박스 + "N개 삭제" 버튼
  - 확인 다이얼로그

---

## 2. 기술 접근법 (Technical Approach)

### 2.1 데이터 페칭 전략

본 SPEC은 SPEC-API-001 미결정 사항 6.1(데이터 페칭 라이브러리 선택)에 의존한다.
라이브러리 확정 전까지 인터페이스를 라이브러리 무관하게 정의한다.

**가정**: React Query v5(`@tanstack/react-query`) 선택 시의 접근법을 기본으로
작성한다. 다른 라이브러리 선택 시 훅 구현만 조정된다.

- **조회**: `useQuery` 훅으로 서재 목록 캐싱 + 백그라운드 갱신
- **변경**: `useMutation` 훅으로 진도/상태/공개범위 UPDATE + 캐시 무효화
- **낙관적 업데이트**: `onMutate` 콜백으로 즉시 UI 갱신, `onError`에서 롤백

### 2.2 쿼리 키 설계

```
queryKey 패턴:
- ['library'] — 전체 서재 목록
- ['library', { status }] — status 필터링된 목록
- ['library', 'item', bookId] — 개별 서재 항목
- ['library', 'item', bookId, 'progress'] — 진도 데이터
```

mutation 성공 시 관련 쿼리 키를 무효화(`queryClient.invalidateQueries`)하여
캐시를 갱신한다.

### 2.3 PostgREST 쿼리 패턴

**서재 목록 조회 (books 조인)**:
```typescript
supabase
  .from('user_books')
  .select(`
    *,
    books (
      id, title, author, cover_url, total_pages
    )
  `)
  .eq('user_id', userId)  // RLS가 자동 필터링하나, 명시적 필터로 성능 최적화
  .order('last_progress_at', { ascending: false })
```

> RLS가 `auth.uid() = user_id`를 보장하므로, `.eq('user_id', userId)`는 성능
> 최적화용 중복 필터다. 클라이언트가 임의의 userId를 전달해도 RLS가 차단한다.

**진도 업데이트**:
```typescript
supabase
  .from('user_books')
  .update({ current_page: newPage })  // last_progress_at은 DB 트리거가 자동 갱신
  .eq('user_id', userId)
  .eq('book_id', bookId)
```

### 2.4 에러 처리 매핑

SPEC-API-001 REQ-API-012 에러 카테고리를 서재 도메인 메시지로 매핑:

| 에러 카테고리 | 서재 도메인 메시지 |
|--------------|-------------------|
| `VALIDATION` (UNIQUE 충돌) | "이미 서재에 있는 책입니다" |
| `VALIDATION` (CHECK 위반) | "올바르지 않은 상태 값입니다" |
| `RLS_DENIED` | "접근 권한이 없습니다" |
| `NETWORK` | "네트워크 연결을 확인해 주세요" |
| `NOT_FOUND` (삭제 시) | "이미 삭제된 항목입니다" |

---

## 3. 아키텍처 설계 방향 (Architecture Design)

### 3.1 파일 구조

```
src/features/library/
  ├── libraryApi.ts          # PostgREST 쿼리 함수 (순수 함수, 훅 무관)
  ├── useLibrary.ts          # React Query 훅 (데이터 페칭 + 상태 관리)
  └── types.ts               # 서재 도메인 타입 (LibraryItem, LibraryFilter 등)

app/(tabs)/
  ├── library.tsx            # 서재 목록 화면
  └── [bookId].tsx           # 책 상세 화면 (진도/상태/공개범위 관리)
```

### 3.2 타입 정의

```typescript
// src/features/library/types.ts

import type { Database } from '@/types/db';

type UserBook = Database['public']['Tables']['user_books']['Row'];
type Book = Database['public']['Tables']['books']['Row'];

export type ReadingStatus = 'reading' | 'completed' | 'shelved';

export interface LibraryItem extends UserBook {
  books: Pick<Book, 'id' | 'title' | 'author' | 'cover_url' | 'total_pages'>;
}

export interface LibraryFilter {
  status?: ReadingStatus | 'all';
  sortBy?: 'last_progress_at' | 'created_at' | 'title';
}

export interface ProgressUpdate {
  bookId: string;
  currentPage: number;
}

export interface StatusUpdate {
  bookId: string;
  status: ReadingStatus;
}

export interface VisibilityUpdate {
  bookId: string;
  isPublic: boolean;
}
```

### 3.3 컴포넌트 재사용 (SPEC-UI-001)

| SPEC-UI-001 컴포넌트 | 서재 화면 사용 |
|---------------------|----------------|
| `BookCard` | 서재 목록 항목 표시 (표지, 제목, 저자, 진도률) |
| `ProgressBar` | 책 상세 화면 진도 시각화 |
| `Button` | "서재에 추가", "완독 처리", "삭제" 버튼 |
| `Card` | 빈 상태 안내, 필터 탭 컨테이너 |

---

## 4. 리스크 및 대응 계획 (Risks and Mitigations)

### 4.1 리스크: DB 트리거 동작 의존성

**리스크**: 본 SPEC은 `last_progress_at` 자동 갱신, `completed_at` 자동 설정,
`completion_reports` 자동 생성을 DB 트리거에 의존한다. 트리거가 예상과 다르게
동작하면 진도 추적 및 완독 처리가 실패한다.

**대응**:
- 구현 전 SPEC-DB-001 트리거(`on_user_books_update`, `generate_completion_report_trigger`)
  동작을 통합 테스트로 검증
- 클라이언트 UPDATE 후 조회를 통해 트리거 결과(`last_progress_at`, `completed_at`)
  가 올바르게 설정되었는지 확인하는 케릭터리제이션 테스트 작성
- 트리거 실패 시 사용자 에러 메시지 + 재시도 옵션 제공

### 4.2 리스크: 데이터 페칭 라이브러리 미확정

**리스크**: SPEC-API-001 미결정 사항 6.1(React Query vs SWR vs 순수 훅)이
확정되지 않으면, `useLibrary` 훅 구현이 불확실해진다.

**대응**:
- `libraryApi.ts`는 라이브러리 무관한 순수 함수로 작성 (Supabase 클라이언트만 사용)
- `useLibrary.ts`는 React Query 가정으로 작성하되, 다른 라이브러리로 전환 시
  훅 시그니처를 유지하도록 설계
- SPEC-API-001 미결정 사항 6.1 확정 시 본 SPEC 버전 업 없이 즉시 적용

### 4.3 리스크: UNIQUE 제약 에러 처리 부재

**리스크**: 같은 책 중복 추가 시 DB 409 Conflict를 클라이언트가 적절히 처리하지
못하면, 사용자에게 원시 에러가 노출된다.

**대응**:
- SPEC-API-001 REQ-API-012 `VALIDATION` 에러 카테고리로 분류
- REQ-API-014 사용자 친화적 메시지 함수로 "이미 서재에 있는 책입니다" 변환
- 통합 테스트: 중복 추가 시나리오 검증

### 4.4 리스크: FK RESTRICT로 인한 삭제 실패

**리스크**: 감정 기록이나 완독 리포트가 있는 서재 항목 삭제 시 FK RESTRICT 위반으로
에러가 발생한다 (SPEC-DB-001 정책).

**대응**:
- 삭제 전 확인 다이얜로그 표시
- RESTRICT 위반 에러 감지 시 "이 책에 감정 기록이 있어 삭제할 수 없습니다" 안내
- 대안 제안: "보관함으로 이동(status='shelved')" 옵션 (미결정 사항 5.3)

### 4.5 리스크: 낙관적 업데이트 롤백 실패

**리스크**: 진도 업데이트 낙관적 적용 후 서버 실패 시, UI가 잘못된 값을
유지할 수 있다.

**대응**:
- React Query `onError` 콜백에서 즉시 이전 값으로 롤백
- 롤백 후 에러 메시지 표시 + 재시도 옵션
- 롤백 동작을 단위 테스트로 검증

---

## 5. 품질 게이트 (Quality Gates)

### 5.1 TRUST 5 검증 항목

- **Tested**: 서재 CRUD, 진도 추적, 상태 전환, 공개 범위 토글 단위/통합 테스트
  커버리지 85% 이상
- **Readable**: `libraryApi.ts`, `useLibrary.ts` 함수명 명확, 한국어 주석(코드
  코멘트 설정 준수), 영어 식별자
- **Unified**: ESLint + Prettier + TypeScript strict 통과, 기존 SPEC-API-001
  패턴 일관성
- **Secured**: RLS 의존 검증(자기 서재만 조작), UNIQUE 제약 에러 처리,
  페이지 값 검증(음수/초과 방지)
- **Trackable**: Conventional commits, SPEC-LIBRARY-001 이슈 참조

### 5.2 인수 기준 매핑

본 계획의 마일스톤은 `acceptance.md`의 Given-When-Then 시나리오와 매핑된다:

| 마일스톤 | 인수 시나리오 |
|---------|---------------|
| M1 (libraryApi) | AC-LIB-001 ~ AC-LIB-005 (CRUD 기본 동작) |
| M2 (useLibrary) | AC-LIB-006 ~ AC-LIB-010 (데이터 페칭 + 상태 관리) |
| M3 (서재 화면) | AC-LIB-011 ~ AC-LIB-015 (목록 표시 + 필터) |
| M4 (책 상세 화면) | AC-LIB-016 ~ AC-LIB-020 (진도/상태/공개범위 UI) |
| M5 (완독 처리) | AC-LIB-021 ~ AC-LIB-025 (완독 플로우) |
| M6 (에지 케이스) | AC-LIB-026 ~ AC-LIB-030 (에러 처리) |

---

## 6. 다음 단계 (Next Steps)

1. **어노테이션 주기**: 사용자가 본 계획을 검토하고 미결정 사항(5.1~5.4)에 대한
   결정을 내린다.
2. **데이터 페칭 라이브러리 확정**: SPEC-API-001 미결정 사항 6.1 확정 (React Query
   권장 — 낙관적 업데이트, 캐싱 내장).
3. **구현 시작**: `/moai run SPEC-LIBRARY-001` — 마일스톤 M1부터 순차 진행.
4. **선행 SPEC 확인**: SPEC-BOOK-001(책 등록)이 완료되었는지 확인. 미완료 시
   `book_id` FK 유효성 확보 불가 → 블로커.
