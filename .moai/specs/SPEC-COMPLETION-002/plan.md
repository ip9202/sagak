---
# NOTE: `created` is the canonical field name per MoAI plan workflow Phase 2
# (8-field frontmatter: id, version, status, created, updated, author, priority,
# issue_number). Do NOT rename to `created_at` — orchestrator ruling on MP-3.
id: SPEC-COMPLETION-002
title: "완독 다이어리 아카이브(리스트) + 상세 재설계 — Implementation Plan"
spec: SPEC-COMPLETION-002
version: "1.0.0"
status: draft
created: 2026-06-27
updated: 2026-06-27
author: "강력쇠주먹"
priority: medium
issue_number: 0
labels: [completion, diary, archive, list, redesign, frontend, pencil]
---

# SPEC-COMPLETION-002 구현 계획

## 1. 개요

본 문서는 SPEC-COMPLETION-002(완독 다이어리 아카이브 리스트 + 상세 재설계)의 구현 계획을 정의한다.
본 SPEC은 세 가지 영역을 다룬다:

1. **리스트(아카이브) 화면 신규 도입** — `.pen` F08 정합
2. **상세 화면 F09 재설계 정합** — 001의 CompletionDiaryScreen을 F09 카드 구조로 재배치 (데이터 로직 유지)
3. **진입점 연결** — 001의 연기된 REQ-COMP-002 계약 이행 (마이 + 서재)

> **핵심 원칙**: SPEC-COMPLETION-001의 데이터 계약(`ReportData`, `fetchReport`, `useCompletionReport`)을
> **재사용**하며 재정의하지 않는다. 상세 화면 "재설계"는 F09 시각적 구조 정합이지 데이터 로직 재구현이 아니다.
> `.pen` F08/F09 4프레임이 시각적 계약이다 — 구현 시 Pencil CLI(grep/Edit)로 노드 JSON을 검증한다.

---

## 2. 기술 스택

### 프론트엔드

| 영역 | 기술 | 버전 | 비고 |
|------|------|------|------|
| 프레임워크 | React Native + Expo SDK 55 | Expo ~55, RN 0.83.2 | SPEC-UI-001 파운데이션 |
| UI 라이브러리 | React | 19.2 | SPEC-UI-001 파운데이션 |
| 언어 | TypeScript | strict 모드 | SPEC-UI-001 파운데이션 |
| 네비게이션 | Expo Router | ~5 | SPEC-NAV-001 라우팅 |
| 데이터 페칭 | @tanstack/react-query | SPEC-LIBRARY-001 정의 버전 | 리스트 쿼리 캐싱/새로고침 |
| 상태 관리 | React hooks + Context | — | 리스트/상세 단일 화면 상태 |
| 백엔드 클라이언트 | @supabase/supabase-js | SPEC-API-001 정의 버전 | PostgREST GET (조인 쿼리) |
| 디자인 토큰 | SPEC-UI-001 tokens.ts | — | SPEC-UI-002 FROZEN 패턴 준수 |
| 차트 | 순수 SVG (react-native-svg) | 15.15.3 (이미 설치) | 001 EmotionCurveChart 재사용 |

### 데이터 소스

| 소스 | 역할 | 소유 SPEC |
|------|------|-----------|
| `user_books` (status='completed', completed_at) | 완독 항목 필터 | SPEC-LIBRARY-001 |
| `books` (title, author, cover_url) | 책 메타데이터 조인 | SPEC-BOOK-001 |
| `completion_reports.report_data` | total_records, highlights[0] 추출 | SPEC-DB-001 (생성), SPEC-COMPLETION-001 (파싱) |

---

## 3. 구현 산출물 (Files to Create/Modify)

### 신규 생성 파일

| 파일 | 유형 | 내용 | 검증 REQ |
|------|------|------|----------|
| `app/(tabs)/completion/index.tsx` | 신규 | 완독 다이어리 리스트 라우트 (StatusBar + ScrollView + CompletionDiaryListScreen) | REQ-COMP2-001 |
| `src/features/completion/list/completionDiaryListApi.ts` | 신규 | `fetchCompletionDiaryList` — PostgREST 조인 쿼리 래퍼 (user_books completed + books + completion_reports) | REQ-COMP2-002 |
| `src/features/completion/list/types.ts` | 신규 | `CompletionDiaryListItem` 인터페이스 + 파싱 헬퍼 (report_data에서 totalRecords/recentHighlight 추출) | REQ-COMP2-002 |
| `src/features/completion/list/useCompletionDiaryList.ts` | 신규 | react-query 훅 — 리스트 쿼리 캐싱, 로딩/에러/빈 상태 분기, 새로고침 | REQ-COMP2-002, 007, 014, 015 |
| `src/features/completion/list/CompletionDiaryListScreen.tsx` | 신규 | 리스트 메인 화면 (SummaryStat + DiaryList + EmptyState, F08 정합) | REQ-COMP2-003, 004, 005 |
| `src/features/completion/list/DiaryCard.tsx` | 신규 | 단일 완독 항목 카드 (Cover + Title + Meta + Highlight 미리보기 + Chevron, F08 정합) | REQ-COMP2-003 |
| `src/features/completion/list/__tests__/completionDiaryListApi.test.ts` | 신규 | 리스트 쿼리 단위 테스트 (조인, 파싱, RLS, 빈 응답) | REQ-COMP2-002 |
| `src/features/completion/list/__tests__/useCompletionDiaryList.test.tsx` | 신규 | 훅 테스트 (로딩/성공/에러/빈 상태, 새로고침) | REQ-COMP2-002, 014, 015 |
| `src/features/completion/list/__tests__/DiaryCard.test.tsx` | 신규 | 카드 컴포넌트 테스트 (F08 정합, coverUrl null, highlight null) | REQ-COMP2-003 |
| `src/features/completion/list/__tests__/CompletionDiaryListScreen.test.tsx` | 신규 | 리스트 화면 통합 테스트 (정상/빈/에러) | REQ-COMP2-004, 005 |

### 수정 대상 파일 (F09 정합 + 진입점 연결)

| 파일 | 수정 내용 | 검증 REQ |
|------|----------|----------|
| `src/features/completion/CompletionDiaryScreen.tsx` | F09 구조 정합 — CelebrationHeader를 brand-50 카드로 감싸고, EmotionCurveChart/HighlightList를 bg-surface 카드로 감싸고, RecordsHeader 라벨 추가, gap 24 배치. **데이터 로직(useCompletionReport 6상태)은 유지** | REQ-COMP2-008, 010, 011 |
| `src/features/completion/CelebrationHeader.tsx` | F09 정합 — Cover(72×100), 완독 Badge(pill, brand-500), Message, CompletedDate 추가. bookId/book 메타데이터를 props로 수신 필요 | REQ-COMP2-008 |
| `src/features/completion/EmotionCurveChart.tsx` | F09 정합 — 카드 래퍼(bg-surface, cornerRadius 16), 라벨 "감정 곡선", 캡션, 차트 영역(height 120) 추가. **데이터 바인딩(page×count, brand-500)은 유지**, peak 점 추가 | REQ-COMP2-009 |
| `src/features/completion/HighlightList.tsx` | F09 정합 — 카드 래퍼(bg-surface, cornerRadius 16), SectionLabel "하이라이트", 행 strokeSides top 매핑(borderTopWidth). **데이터 렌더링은 유지** | REQ-COMP2-008 |
| `app/(tabs)/completion/[bookId].tsx` | F09 헤더 Back 버튼 명시적 연결 (router.back). 001 로직 유지 | REQ-COMP2-011 |
| `app/(tabs)/my.tsx:539` | "완독 다이어리" 행 `onPress` 구현 — `router.push('/completion')`, `@MX:TODO` 제거 | REQ-COMP2-012 |

### 협력 SPEC과 공유 (진입점 — 계약만 본 SPEC이 정의)

| 파일 | 수정 내용 | 협력 SPEC |
|------|----------|-----------|
| `src/features/library/*.tsx` (서재 completed 항목) | 완독 다이어리 진입 액션 추가 (아이콘 또는 행 탭). 정확한 UI는 SPEC-LIBRARY-001과 협력 확정 | SPEC-LIBRARY-001 |

> `src/theme/tokens.ts`는 수정하지 않는다 — F08/F09에 사용된 모든 토큰(`brand-50/200/500`, `bg-surface/base/muted`, `text-primary/secondary/tertiary/brand/inverse`, `border-default`)이 이미 존재한다.

---

## 4. 우선순위 마일스톤

### Primary Goal (1순위) — 리스트 쿼리 및 데이터 계약

- `completionDiaryListApi.ts` — `fetchCompletionDiaryList`, PostgREST 조인 쿼리 (REQ-COMP2-002)
- `list/types.ts` — `CompletionDiaryListItem` 인터페이스, report_data 파싱 헬퍼 (REQ-COMP2-002)
- `useCompletionDiaryList.ts` — react-query 훅, 로딩/에러/빈 분기 (REQ-COMP2-002, 014, 015)
- 단위 테스트 — 조인 쿼리, report_data 파싱, RLS, 빈 응답 처리

> 이유: 리스트의 첫 번째 책임은 "완독 항목 + 책 메타 + 다이어리 메타를 안정적으로 가져와서 타입 안전하게 파싱하는 것"이다.
> 001의 `ReportData`를 재사용하되, 리스트 전용 파싱(recentHighlight 추출 등)을 추가한다.

### Secondary Goal (2순위) — 리스트 화면 시각화

- `DiaryCard.tsx` — F08 카드 정합 (Cover, Title, Meta, Highlight 미리보기, Chevron) (REQ-COMP2-003)
- `CompletionDiaryListScreen.tsx` — SummaryStat + DiaryList + EmptyState(F08-Empty) (REQ-COMP2-003, 004, 005)
- `app/(tabs)/completion/index.tsx` — 리스트 라우트 (REQ-COMP2-001)
- 컴포넌트 테스트 — DiaryCard F08 정합, 빈 상태 CTA 재지정

> 이유: Primary Goal의 데이터 계약 위에 리스트 UI를 구축한다. F08 `.pen` 프레임이 시각적 계약이다.

### Final Goal (3순위) — 상세 F09 재설계 정합 + 진입점 연결

- `CompletionDiaryScreen.tsx` F09 정합 (래퍼 카드, 라벨, gap 24) (REQ-COMP2-008, 010)
- `EmotionCurveChart.tsx` 카드 컨트랙트 (라벨, 캡션, peak 점) (REQ-COMP2-009)
- `CelebrationHeader.tsx` Cover/Badge/Date 추가 (REQ-COMP2-008)
- `HighlightList.tsx` 카드 래퍼 (REQ-COMP2-008)
- `my.tsx:539` 진입점 연결 (REQ-COMP2-012)
- 서재 completed 진입점 (REQ-COMP2-013, SPEC-LIBRARY-001 협력)
- 통합 테스트 — 마이 진입 → 리스트 → 상세 → 뒤로 가기 전체 플로우

> 이유: 상세 재설계는 001 자산을 F09에 맞춰 재배치하는 것이므로 데이터 로직 위에 구축된다.
> 진입점 연결은 001의 연기된 계약을 이행하여 전체 탐색 흐름을 완성한다.

### Optional Goal (선택) — 서재 진입점 고도화

- REQ-COMP2-013의 정확한 UI(아이콘 종류, 배치)는 SPEC-LIBRARY-001과 협력 후 확정.
- 본 SPEC Run 단계에서는 계약 구현까지 포함하되, UI 세부는 협력 결과에 따름.

---

## 5. 아키텍처 설계 방향

### 5.1 리스트 데이터 흐름

```
user_books(status='completed') + books + completion_reports
  ↓ (PostgREST GET, RLS 자동 필터, 조인 쿼리)
fetchCompletionDiaryList()
  ↓ (report_data에서 totalRecords, highlights[0] 추출 — 001 ReportData 재사용)
CompletionDiaryListItem[]
  ↓ (react-query 캐싱/새로고침)
useCompletionDiaryList() → { data, isLoading, isError, refetch }
  ↓ (조건부 렌더링)
CompletionDiaryListScreen
  ├── SummaryStat ("지금까지 N권 완독")
  ├── DiaryList (FlatList 가상화)
  │   └── DiaryCard × N (Cover + Title + Meta + Highlight + Chevron)
  └── EmptyState (F08-Empty — 완독 0권 시, CTA "읽으러 가기" → 서재)
```

### 5.2 상세 데이터 흐름 (001 재사용 + F09 정합)

```
bookId (라우트 param)
  ↓ (useLibraryItem — bookId → userBookId 변환, 001)
useCompletionReport(userBookId)
  ↓ (fetchReport — 001, 6상태 분기)
CompletionDiaryScreen (F09 정합)
  ├── Header (Back chevron + "완독 다이어리")
  ├── CelebrationHeader 카드 (brand-50, Cover + 완독 Badge + Message + CompletedDate)
  ├── RecordsHeader ("이 책에 남긴 감정 기록 N개")
  ├── EmotionCurveChart 카드 (bg-surface, 라벨 + 캡션 + 차트 + peak 점)
  └── HighlightList 카드 (bg-surface, SectionLabel + 행들)
```

### 5.3 상태 관리 전략

리스트 화면은 react-query(`useCompletionDiaryList`)로 캐싱/새로고침을 관리한다.
상세 화면은 001의 `useCompletionReport`(useState/useEffect 6상태)를 재사용한다.
전역 상태 라이브러리(Zustand 등)는 도입하지 않는다.

### 5.4 에러 처리 전략 (리스트)

| 상태 | 조건 | 사용자 경험 |
|------|------|------------|
| 로딩 | 리스트 쿼리 실행 중 | 스켈레톤 또는 ActivityIndicator (Header/StatusBar 유지) |
| 성공 (1개+) | completed 항목 1개 이상 | SummaryStat + DiaryList 렌더 |
| 빈 상태 | completed 항목 0개 | EmptyState(F08-Empty) + CTA "읽으러 가기" → 서재 |
| 에러 (네트워크) | 리스트 쿼리 네트워크 실패 | 에러 메시지 + 재시도 버튼 |
| 에러 (인증) | 401 | 로그인 라우트 유도 (001 auth 패턴 대칭) |
| 에러 (데이터 오류) | CompletionDiaryListItem 셰이프 불일치 | "데이터 오류" 상태 (VALIDATION) |

> 상세 화면의 6상태 분기는 001을 그대로 유지한다.

---

## 6. 리스크 및 대응

### 리스크 1: PostgREST 조인 쿼리 동작 검증

- **위험**: `completion_reports` 조인이 PostgREST 리소스 임베딩으로 동작하려면 FK 관계(`user_books.id ← completion_reports.user_book_id`)가 설정되어 있어야 한다. FK가 없으면 조인이 실패한다.
- **대응**: 구현 시작 시 PostgREST 쿼리를 먼저 검증한다. FK가 없으면 두 단계 쿼리(getLibrary completed → batch fetchReport)로 폴백한다. 마이그레이션은 본 SPEC 범위 밖이므로 FK 추가가 필요하면 SPEC-DB-001 협력이 필요하다 — 리스크로 기록하고 사용자에게 에스컬레이션.

### 리스크 2: 001 코드 수정에 의한 회귀

- **위험**: CompletionDiaryScreen/EmotionCurveChart/HighlightList/CelebrationHeader를 F09 정합으로 수정할 때 001의 데이터 로직(6상태 분기, ReportData 파싱)에 회귀가 발생할 수 있다.
- **대응**: DDD 모드(ANALYZE-PRESERVE-IMPROVE)를 적용한다. 001의 기존 테스트(683개)를 특성화 테스트로 보존하고, F09 정합 후에도 통과하는지 검증한다. **데이터 로직은 수정하지 않고 래퍼/라벨/간격만 조정**한다.

### 리스크 3: `.pen` Pencil 스키마 기능 검증

- **위험**: `.pen`의 `cornerRadius 999`(pill), `strokeSides: ["top"]`(행 구분선), `textGrowth: "fixed-width"`가 React Native에서 올바르게 렌더링되는지 확인이 필요하다.
- **대응**: 구현 시 Pencil CLI(grep)로 각 노드의 JSON을 검증하고, React Native 스타일 매핑(borderRadius, borderTopWidth, flexShrink)을 확인한다. 시각적 의도는 본 SPEC이 명시했고, 스키마 검증은 구현 단계에서 수행한다 (미결정 사항 6.2에 기록).

### 리스크 4: 서재 진입점 협력 의존성

- **위험**: REQ-COMP2-013(서재 completed 진입 액션)의 정확한 UI는 SPEC-LIBRARY-001 서재 화면 설계와 협력이 필요하다. 서재 설계가 확정되지 않으면 진입 액션 위치를 정할 수 없다.
- **대응**: 본 SPEC은 "서재 completed 항목에서 상세 다이어리로 진입 가능해야 한다"는 계약만 정의하고, UI 세부는 SPEC-LIBRARY-001과 협력 확정. 마이 진입점(REQ-COMP2-012)은 독립적으로 구현 가능하므로, 서재 협력이 지연되어도 마이 → 리스트 → 상세 흐름은 완성된다.

---

## 7. TDD/DDD 페이즈 계획

> 프로젝트 quality.yaml `development_mode`에 따라 DDD(ANALYZE-PRESERVE-IMPROVE) 또는 TDD(RED-GREEN-REFACTOR)를 적용한다.
> 001 코드를 수정하므로 **DDD 모드 권장** (기존 동작 보존 특성화 테스트 우선).

### 7.1 리스트 영역 (신규 — TDD 적합)

| 페이즈 | 작업 |
|--------|------|
| RED | `fetchCompletionDiaryList` 실패 테스트 작성 (조인 쿼리, 파싱, RLS, 빈 응답) |
| GREEN | 최소 구현으로 테스트 통과 (PostgREST 래퍼, CompletionDiaryListItem 파싱) |
| REFACTOR | react-query 훅 추출, 에러 분기 정리 |

### 7.2 상세 F09 정합 영역 (기존 수정 — DDD 적합)

| 페이즈 | 작업 |
|--------|------|
| ANALYZE | 001의 CompletionDiaryScreen/EmotionCurveChart/HighlightList/CelebrationHeader 구조 파악, 683개 기존 테스트 현황 확인 |
| PRESERVE | 001의 6상태 분기, ReportData 파싱 특성화 테스트가 F09 정합 후에도 통과하는지 확인 (회귀 방어) |
| IMPROVE | F09 카드 래퍼, 라벨, gap 24 배치 추가. **데이터 로직 수정 금지** |

### 7.3 진입점 영역 (혼합)

| 페이즈 | 작업 |
|--------|------|
| RED | 마이 진입점 네비게이션 실패 테스트 작성 |
| GREEN | `my.tsx:539` `onPress` 구현, `@MX:TODO` 제거 |
| REFACTOR | 서재 진입점(REQ-COMP2-013) 계약 구현 (SPEC-LIBRARY-001 협력 후 세부 UI) |

### 7.4 `.pen` 레퍼런스 주입 (SPEC-UI-002 run-workflow 규칙)

구현 시작 시 `.pen` F08/F09 4프레임을 Pencil CLI(grep)로 열람하여 시각적 계약을 확인한다.
SPEC-UI-002 FROZEN run-workflow 규칙: 각 도메인 SPEC run 시 `.pen` 레퍼런스를 주입한다.

```
grep -n '"name": "F08-CompletionDiaryList"' .moai/design/sagak.pen
grep -n '"name": "F08-CompletionDiaryList-Empty"' .moai/design/sagak.pen
grep -n '"name": "F09-CompletionDiaryDetail"' .moai/design/sagak.pen
grep -n '"name": "F09-CompletionDiaryDetail-Empty"' .moai/design/sagak.pen
```

---

## 8. 의존성 맵

### 8.1 선행 의존 (재사용, 재정의 없음)

| 의존 | 본 SPEC의 역할 |
|------|----------------|
| SPEC-COMPLETION-001 `ReportData`/`isReportData` (types.ts) | import 재사용 |
| SPEC-COMPLETION-001 `fetchReport` (completionApi.ts) | 상세 화면 재사용 |
| SPEC-COMPLETION-001 `useCompletionReport` (useCompletionReport.ts) | 상세 화면 재사용 |
| SPEC-COMPLETION-001 `EmotionCurveChart` 데이터 바인딩 | F09 카드 래퍼 내 재사용 |
| SPEC-LIBRARY-001 `getLibrary` 패턴 | 리스트 쿼리 패턴 참고 (단, 조인 셰이프는 상이) |
| SPEC-LIBRARY-001 `useLibraryItem` (bookId → userBookId 변환) | 상세 라우트 재사용 |
| SPEC-DB-001 `completion_reports` 스키마/RLS/UNIQUE | 읽기 전용 조인 소비 |
| SPEC-UI-002 FROZEN 화면 패턴 | 양 화면 3계층/카드/상태 패턴 준수 |
| SPEC-NAV-001 라우팅 | 리스트/상세 라우트 공존, bookId 파라미터 |

### 8.2 후행 의존 (본 SPEC이 영향)

| 후행 SPEC | 영향 |
|-----------|------|
| SPEC-LIBRARY-001 (서재) | REQ-COMP2-013 진입 액션 협력 — 서재 completed 항목에 다이어리 진입 추가 |
| SPEC-DOCS (문서화) | /completion 라우트, fetchCompletionDiaryList API 문서 동기화 |

---

## 9. 전문가 자문 권장 (Expert Consultation)

본 SPEC은 프론트엔드 구현 + 기존 코드 수정이 핵심이므로, 다음 전문가 자문을 권장한다:

### 프론트엔드 전문가 (expert-frontend)

- **자문 영역**: FlatList 가상화(대량 완독 항목), F09 카드 래퍼 추가 시 001 컴포넌트 회귀 방지, PostgREST 조인 쿼리 타입 안전성, 접근성(a11y)
- **자문 시점**: Secondary Goal(리스트 UI) 및 Final Goal(F09 정합) 시작 전

### 백엔드 전문가 (expert-backend)

- **자문 영역**: PostgREST 리소스 임베딩 조인(user_books + books + completion_reports) 동작 검증, FK 관계 확인, RLS 정책 상호작용
- **자문 시점**: Primary Goal(리스트 쿼리) 시작 전 — 리스크 1(FK 검증) 해소

### 디자인 전문가 (expert-frontend/design 협력)

- **자문 영역**: `.pen` Pencil 스키마 기능(cornerRadius 999, strokeSides top, textGrowth)의 React Native 매핑 검증, F08/F09 시각적 정합 디테일
- **자문 시점**: Secondary Goal 및 Final Goal 시작 전

> 전문가 자문은 사용자 승인 후 진행한다. 본 SPEC 작성 단계에서는 권장 사항으로 기록한다.

---

## 10. 커버리지 목표

- TRUST 5 기준: 85%+ (SPEC-COMPLETION-001이 91.92% 달성한 선례 참고)
- 모든 REQ-COMP2-XXX에 대해 최소 1개 테스트 시나리오 매핑 (acceptance.md 참조)
- 001 기존 테스트(683개) 회귀 없음 보장 (DDD PRESERVE 페이즈)
