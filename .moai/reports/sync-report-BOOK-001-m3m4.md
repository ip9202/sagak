# SPEC-BOOK-001 M3+M4 문서 동기화 보고서

생성일: 2026-06-16
동기화 대상: PR #9 (commit a293e8d) 머지 완료 후 M3+M4 범위
작업자: manager-docs (sync phase)
모드: auto (코드 수정 금지, 문서만 갱신)

---

## 요약

SPEC-BOOK-001 M3(바코드 스캔)+M4(검색·상세 화면) 구현 완료 후 문서 동기화를 완료했습니다.
M1~M4 전부 develop 머지 완료로 SPEC-BOOK-001 status를 completed 로 상향했습니다.

---

## 수정 파일 목록

### 1. `.moai/specs/SPEC-BOOK-001/progress.md`
- **Scope**: M1+M2 → M1~M4 전체 범위로 확장
- **Phase 0**: expo-camera 미추가 → ~55.0.19 추가 명시
- **Phase 2 Implementation (M3+M4) 섹션 신규 추가**:
  - M3 (T-011~T-014): isbn.ts, debounce.ts, BarcodeScanner.tsx, expo-camera mock
  - M4 (T-015~T-019): format.ts, SearchResultCard, BookSearchScreen, BookDetailScreen, 라우팅 통합
- **Phase 2 Quality Gates (M3+M4)**: jest 462/52 suites, tsc 0, eslint 0, 커버리지 94%+
- **Divergence (M3+M4)**: BookCard vs SearchResult 분리, 디바운스 순수 함수 추출, format 유틸 분리, expo-camera 신규, Pencil 디자인 기반, 권한 게이트 fix cycle
- **PR #9 머지**: a293e8d, 39 files changed, 3460 insertions
- **SPEC 완료 상태**: completed (M1~M4 전부 머지), ISBN→bookId 합의된 후속 명시

### 2. `.moai/specs/SPEC-BOOK-001/spec.md`
- **frontmatter**: status draft → completed, version 1.1.0 → 1.2.0
- **HISTORY**: 1.2.0 행 추가 (M3+M4 구현 완료, PR #9, a293e8d, 462 테스트, 94%+ 커버리지, completed)
- **M3+M4 구현 이력 섹션 신규 추가**:
  - 구현 산출물 (M3 새 파일 4개, M4 새 파일 4개, 수정 파일 7개)
  - 공개 API (BarcodeScanner, isValidIsbn*, SearchResultCard, BookSearchScreen, BookDetailScreen)
  - 기술 결정 6가지 (BookCard 분리, 디바운스 추출, format 공유, expo-camera, Pencil 기반, 권한 게이트 3상태)
  - 품질 게이트 통과 현황
  - **Known Issue**: ISBN→bookId 매핑 (SPEC-LIBRARY-001 합의된 후속, 결함 아님)

### 3. `.moai/project/tech.md`
- **의존성 라이브러리**: "expo-camera M3 구현 시 추가 예정" → 실제 추가 (~55.0.19, CameraView/useCameraPermissions/barcodeScannerSettings API, SDK 55 호환, 권한 게이트 3상태)

### 4. `.moai/project/structure.md`
- **app/(tabs)/**: search.tsx, scan.tsx 신규 (href:null), [bookId].tsx BookDetailScreen 통합, library.tsx 검색 진입 CTA, _layout.tsx search/scan 등록
- **src/components/**: 6가지 → 7가지 (SearchResultCard 추가, BookCard와 분리 명시)
- **src/features/book/**: isbn.ts, debounce.ts, format.ts, BarcodeScanner.tsx, BookSearchScreen.tsx, BookDetailScreen.tsx 추가, index.ts barrel 확장
- **API 서피스 Books**: M1+M2 → M1~M4 완료. BarcodeScanner, isValidIsbn*, SearchResultCard, BookSearchScreen, BookDetailScreen 공개 API 명시
- **UI 컴포넌트 라이브러리**: 6가지 → 7가지 (SearchResultCard)

---

## 구현 범위 검증

### 완료 (M1~M4 전부)
- REQ-BOOK-001~005 (Kakao Book Search Edge Function, 검색 입력 검증) — M1+M2
- REQ-BOOK-006~009 (바코드 스캔, 카메라 권한, ISBN 인식, 디바운스) — M3
- REQ-BOOK-010~014 (books 테이블 캐싱/업서트, 클라이언트 조회, 검색 결과 카드) — M1+M2+M4
- REQ-BOOK-015~016 (책 상세 조회, ISBN 미발견 에러) — M2+M4

### 남은 작업 (본 SPEC 범위 외)
- 실제 Kakao REST API 키 배포: SPEC-DEPLOY-001 인프라 영역
- 무한 스크롤/페이지네이션: Open Question 6.1 미해결

---

## 품질 게이트 결과 (M3+M4)

| 항목 | 결과 | 세부 |
|------|------|------|
| TypeScript | PASS | 0 errors |
| ESLint | PASS | 0 errors |
| Jest | PASS | 462/462 passed (52 suites) |
| Coverage | PASS | 94%+ |
| evaluator-active | PASS | TRUST 5 준수 |

---

## SPEC status: completed 근거

1. **M1 (Edge Function)**: PR #8 (852f0ac) 머지 — kakao-book-search Edge Function, 373 테스트
2. **M2 (Client API)**: PR #8 (852f0ac) 머지 — searchApi, bookDetailApi, book 타입 정의
3. **M3 (BarcodeScanner)**: PR #9 (a293e8d) 머지 — isbn.ts, debounce.ts, BarcodeScanner.tsx, expo-camera ~55.0.19
4. **M4 (화면 UI)**: PR #9 (a293e8d) 머지 — SearchResultCard, BookSearchScreen, BookDetailScreen, 라우팅 통합
5. **게이트**: tsc 0, jest 462, eslint 0, 커버리지 94%+ 전부 PASS

M1~M4 전부 develop 머지 완료, 16개 REQ 전부 구현 검증 → status: completed

---

## Known Issue (합의된 후속)

### ISBN→bookId 매핑
- **현상**: search.tsx에서 검색 결과 선택 시 `router.push('/book/${result.isbn}')` 로 ISBN 기반 라우팅. [bookId].tsx는 ISBN을 param으로 수신하지만, BookDetailScreen은 books.id(UUID)로 getBookDetail을 호출.
- **상태**: 합의된 후속 (결함 아님). M4 범위에서는 라우팅 연결까지만 구현.
- **해결 시점**: SPEC-LIBRARY-001에서 user_books 플로우와 함께 해결 예정.

---

## 기술 결정 요약 (M3+M4)

1. **BookCard vs SearchResult 분리**: 서재용(진행률 필수) vs 검색 결과용(진행률 없음) → SearchResultCard 별도 작성 (Pencil x8zuOu)
2. **디바운스 순수 함수 추출**: 컴포넌트 테스트에서 setScanning(false)로 디바운스 분기 도달 불가 → shouldSuppressDuplicate 순수 함수 (REQ-BOOK-009 실질 검증)
3. **format 유틸 공유**: SearchResultCard + BookDetailScreen 동일 출판일 포맷 공유 (DRY)
4. **expo-camera ~55.0.19**: SDK 55 호환. CameraView + useCameraPermissions
5. **Pencil 디자인 기반**: sagak.pen SearchResultCard(x8zuOu), F06-Search(E44G9), F07-Scan(acwG9). token-only 스타일링
6. **권한 게이트 3상태**: loading/granted/denied 분기 (evaluator fix cycle 반영)

---

## 검증 완료

- 모든 수정 파일에서 M3/M4 완료 범위 명확히 표기
- ISBN→bookId 매핑은 합의된 후속 명시 (결함 아님)
- expo-camera ~55.0.19 실제 추가 명시 (tech.md)
- SPEC status completed 근거 명시 (M1~M4 전부 머지)
- Pencil(.pen) 기반 구현 명시, Stitch 아님

---

**동기화 완료**: 2026-06-16
**다음 단계**: 오케스트레이터 검토 후 manager-git 으로 develop 직접 커밋 (Git Flow)
