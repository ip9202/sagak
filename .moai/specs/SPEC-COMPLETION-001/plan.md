---
# NOTE: `created` is the canonical field name per MoAI plan workflow Phase 2
# (8-field frontmatter: id, version, status, created, updated, author, priority,
# issue_number). Do NOT rename to `created_at` — orchestrator ruling on MP-3.
id: SPEC-COMPLETION-001
title: "완독 다이어리 및 아카이브 시각화 — Implementation Plan"
spec: SPEC-COMPLETION-001
version: "1.0.0"
status: draft
created: 2026-06-14
updated: 2026-06-17
author: "강력쇠주먹"
priority: medium
issue_number: 0
labels: [completion, diary, archive, visualization, emotion-curve, frontend]
---

# SPEC-COMPLETION-001 구현 계획

## 1. 개요

본 문서는 SPEC-COMPLETION-001(완독 다이어리 및 아카이브 시각화)의 구현 계획을 정의한다.
본 SPEC은 `completion_reports.report_data`를 DB 트리거가 산출한 읽기 전용 스냅샷으로 취급하며,
클라이언트는 이를 조회하여 시각화하는 역할만 수행한다.

> **핵심 원칙**: report_data 생성 로직(PL/pgSQL 집계)은 SPEC-DB-001 영역이다. 본 SPEC은
> PostgREST `GET /completion_reports`를 호출하여 report_data를 읽고, 타입 안전하게 파싱하여
> 다이어리 뷰로 렌더링하는 클라이언트 구현만을 계획한다.

---

## 2. 기술 스택

### 프론트엔드 (본 SPEC 핵심 영역)

| 영역 | 기술 | 버전 | 비고 |
|------|------|------|------|
| 프레임워크 | React Native + Expo SDK 55 | Expo ~55, RN 0.83.2 | SPEC-UI-001 파운데이션 기반 |
| UI 라이브러리 | React | 19.2 | SPEC-UI-001 파운데이션 |
| 언어 | TypeScript | strict 모드 | SPEC-UI-001 파운데이션 |
| 네비게이션 | Expo Router | ~5 | SPEC-NAV-001 라우팅 연동 |
| 상태 관리 | React Context API + hooks | — | 단일 화면 상태이므로 경량 패턴 |
| 백엔드 클라이언트 | @supabase/supabase-js | SPEC-API-001 정의 버전 | PostgREST GET 호출 |
| 디자인 토큰 | SPEC-UI-001 tokens.ts / darkTokens.ts | — | 감정 색상 토큰 확장 가능 |

### 차트 시각화 (6.1 — 해결됨: 옵션 A 순수 SVG)

| 옵션 | 라이브러리 | 장점 | 단점 | 결정 |
|------|-----------|------|------|------|
| A (채택) | 순수 SVG (react-native-svg@15.15.3, 이미 설치) | 의존성 추가 없음, 단일 색상에 충분, 커스터마이징 자유 | 구현 비용 중간 | ✅ |
| B | react-native-chart-kit | 빠른 구현, 기본 차트 제공 | 커스터마이징 제한, 신규 의존성 | 기각 |
| C | victory-native | 고급 기능, 풍부한 차트 | 의존성 무거움, 러닝 커브 | 기각 |

> **결정 (2026-06-17)**: 감정 곡선 데이터가 단일 계열(page_number → emotion_count)이므로
> 순수 SVG로 충분하다. 감정 종류별 색상/범례가 불필요하여 chart-kit/victory-native의 부가 기능은
> 오버엔지니어링이다.

### 런타임 타입 검증 (report_data 파싱 — 결정: 순수 타입 가드)

| 옵션 | 라이브러리 | 장점 | 결정 |
|------|-----------|------|------|
| A (채택) | 순수 타입 가드 함수 `isReportData()` | 의존성 없음, EMOTION 모듈 순수 타입 정책 일관 | ✅ |
| B | Zod | 스키마 정의 + 타입 추론 동시 제공 | 기각 (zod 미설치, 신규 의존성) |

> **결정 (2026-06-17)**: `zod`가 설치되어 있지 않고 EMOTION 도메인(`src/features/emotion/types.ts`)이
> 순수 TypeScript 타입만 사용하므로 일관성을 위해 순수 타입 가드를 채택한다. ReportData 스키마가
> 단순(3개 키, 중첩 2-depth)하여 수동 구현 비용이 낮다. 검증 실패 시 `category=VALIDATION`인
> `AppError`를 throw하여 "데이터 오류" 상태(시나리오 6)로 분기한다.

---

## 3. 구현 산출물 (Files to Create)

### 신규 생성 파일

| 파일 | 유형 | 내용 | 검증 REQ |
|------|------|------|----------|
| `src/features/completion/completionApi.ts` | 신규 | PostgREST GET /completion_reports 래퍼, 재시도 로직, 타입 안전 쿼리 | REQ-COMP-001, REQ-COMP-003 |
| `src/features/completion/types.ts` | 신규 | ReportData, EmotionCurvePoint({page_number, emotion_count}), Highlight({page_number, content}) 인터페이스 + 순수 타입 가드 `isReportData()` (Zod 미사용) | REQ-COMP-004 |
| `src/features/completion/useCompletionReport.ts` | 신규 | React hook — 리포트 조회, 로딩/에러/빈 상태 관리 | REQ-COMP-001, REQ-COMP-005 |
| `src/features/completion/CompletionDiaryScreen.tsx` | 신규 | 완독 다이어리 메인 화면 (축하 메시지, 배지, 감정 곡선, 하이라이트, 총 기록 수) | REQ-COMP-006 ~ REQ-COMP-010 |
| `src/features/completion/EmotionCurveChart.tsx` | 신규 | 감정 곡선 차트 컴포넌트 (순수 SVG, 단일 brand-500 컬러) | REQ-COMP-006 |
| `src/features/completion/HighlightList.tsx` | 신규 | 하이라이트 카드 리스트 컴포넌트 | REQ-COMP-007 |
| `src/features/completion/CelebrationHeader.tsx` | 신규 | 축하 메시지 + 배지 영역 | REQ-COMP-009, REQ-COMP-010 |
| `src/features/completion/__tests__/completionApi.test.ts` | 신규 | API 래퍼 단위 테스트 (재시도, 에러, RLS 검증) | REQ-COMP-001, REQ-COMP-003 |
| `src/features/completion/__tests__/useCompletionReport.test.ts` | 신규 | hook 테스트 (로딩, 성공, 에러, 빈 상태) | REQ-COMP-001, REQ-COMP-005 |
| `src/features/completion/__tests__/CompletionDiaryScreen.test.tsx` | 신규 | 화면 통합 테스트 (정상 렌더, 빈 상태, 에러 상태) | REQ-COMP-005 ~ REQ-COMP-010 |

### 수정 대상 파일 (협력 SPEC과 공유)

| 파일 | 수정 내용 | 협력 SPEC |
|------|----------|-----------|
| `app/(tabs)/library/completion.tsx` (또는 유사 라우트 — 현재 library.tsx는 플랫) | 완독 다이어리 라우트 추가 | SPEC-NAV-001, SPEC-LIBRARY-001 |
| `src/features/library/*.tsx` (서재 상세 화면) | 완독 상태 시 다이어리 진입 버튼 추가 (본 SPEC은 진입 *계약*만 정의) | SPEC-LIBRARY-001 |

> `src/theme/tokens.ts`는 수정하지 않는다 — 단일 브랜드 컬러 토큰(`colors.brand[500]`)이 이미 존재한다.

> 진입 버튼의 정확한 위치와 라우트 구조는 SPEC-LIBRARY-001 및 SPEC-NAV-001과 협력하여 확정한다.

---

## 4. 우선순위 마일스톤

### Primary Goal (1순위) — report_data 조회 및 파싱

- `completionApi.ts` — PostgREST GET 래퍼, 재시도 로직 (REQ-COMP-001, REQ-COMP-003)
- `types.ts` — ReportData/EmotionCurvePoint/Highlight 인터페이스 + 순수 타입 가드 `isReportData()` (REQ-COMP-004)
- `useCompletionReport.ts` — 조회 hook, 로딩/성공/빈/에러/데이터오류 5상태 분기 (REQ-COMP-005)
- 단위 테스트 — API 재시도, RLS 검증(빈 결과 신뢰), 빈 상태, 데이터 오류(type guard throw) 처리

> 이유: report_data는 DB 트리거가 채운 읽기 전용 스냅샷이므로, 클라이언트의 첫 번째 책임은
> "안정적으로 가져와서 타입 안전하게 파싱하는 것"이다. 시각화 이전에 데이터 계약을 확보한다.

### Secondary Goal (2순위) — 다이어리 시각화

- `EmotionCurveChart.tsx` — 감정 곡선 차트 (순수 SVG, 단일 brand-500 컬러, REQ-COMP-006)
- `HighlightList.tsx` — 하이라이트 카드 리스트 (REQ-COMP-007)
- 총 기록 수 표시 (REQ-COMP-008)
- `CompletionDiaryScreen.tsx` 통합 — 각 컴포넌트 조합

> 이유: 핵심 가치("이 책과의 여정") 전달을 위한 시각화 계층이다. Primary Goal의 데이터 계약 위에
> 구축되므로 2순위로 배치한다.

### Final Goal (3순위) — 성취 표시 및 진입점 연동

- `CelebrationHeader.tsx` — 축하 메시지 + 배지 (REQ-COMP-009, REQ-COMP-010)
- SPEC-LIBRARY-001 서재 화면과 진입 버튼 연동 (REQ-COMP-002)
- 통합 테스트 — 완독 처리 → 다이어리 진입 → 전체 렌더 플로우

> 이유: 성취 경험은 감정 아카이브 기반 보상(product.md 핵심 기능)의 완성점이지만, 시각화
> 자체보다 우선순위가 낮다. 진입점은 SPEC-LIBRARY-001 협력이 필요하므로 Final Goal에 배치.

### Optional Goal (선택) — 경량 애니메이션 (후순위, 6.3 해결됨에 따라 MVP 제외)

- 6.3 옵션 A(정적 텍스트 + 배지)로 MVP 확정. 옵션 B/C는 후순위 확장 후보로만 기록.
- 본 SPEC Run 단계에서는 Optional Goal을 다루지 않는다 (단순성 원칙).

---

## 5. 아키텍처 설계 방향

### 5.1 데이터 흐름

```
DB 트리거 (SPEC-DB-001)
  ↓ (status: reading → completed 시 자동 생성)
completion_reports.report_data (JSONB)
  ↓ (PostgREST GET, RLS 자동 필터)
completionApi.fetchReport(userBookId)
  ↓ (순수 타입 가드 isReportData() 파싱 — 실패 시 AppError(VALIDATION))
useCompletionReport() → { data, isLoading, isEmpty, error }  (error 카테고리로 데이터오류/네트워크/인증 분기)
  ↓ (조건부 렌더링)
CompletionDiaryScreen
  ├── CelebrationHeader (축하 메시지 + 배지)
  ├── EmotionCurveChart (감정 곡선)
  ├── HighlightList (하이라이트 카드)
  └── 총 기록 수 (헤더 영역)
```

### 5.2 상태 관리 전략

단일 화면 상태이므로 전역 상태 라이브러리(Zustand 등)를 도입하지 않는다. `useCompletionReport` hook이 로컬 상태(data, isLoading, isError, isEmpty)를 관리한다.

### 5.3 에러 처리 전략

| 상태 | 조건 | 사용자 경험 |
|------|------|------------|
| 로딩 | API 호출 중 | 스켈레톤 또는 로딩 스피너 |
| 성공 (데이터 있음) | total_records >= 1 | 전체 다이어리 렌더 |
| 빈 상태 | total_records = 0, 배열 비어 있음 | "기록된 감정이 없어요" 메시지 |
| 에러 (리포트 없음) | 재시도 후에도 빈 응답 | "완독 리포트를 불러올 수 없어요" + 재시도 버튼 |
| 에러 (스키마 불일치) | isReportData() 검증 실패 → AppError(VALIDATION) | "데이터 오류가 발생했어요" + 에러 로깅 |

---

## 6. 리스크 및 대응

### 리스크 1: DB 트리거 타이밍 지연

- **위험**: 완독 처리 커밋 직후 GET을 호출했을 때 트리거가 아직 실행 전이면 빈 결과 반환
- **대응**: 재시도 로직 (최대 3회, 점진적 간격)으로 커버. 단, SPEC-DB-001은 동일 트랜잭션 커밋 시점에 report_data를 완전히 채운다고 명시하므로, 정상 케이스에서는 1회 조회로 충분하다.

### 리스크 2: 차트 라이브러리 호환성 — 해결됨 (6.1)

- **위험(해소)**: 6.1 해결로 순수 SVG(react-native-svg@15.15.3, 이미 설치 및 EMOTION/다른 화면에서 사용 중)를 채택했으므로 호환성 리스크가 사라진다.
- **대응**: 순수 SVG 단일 색상 선형/바 차트로 구현. 신규 의존성 없음.

### 리스크 3: report_data 스키마 진화

- **위험**: SPEC-DB-001 트리거 로직이 변경되어 report_data 구조가 달라질 수 있음
- **대응**: 순수 타입 가드 `isReportData()`로 런타임 검증 수행. 스키마 불일치 시 `AppError(category=VALIDATION)` throw → "데이터 오류" 상태로 안전하게 폴백 (REQ-COMP-004, 시나리오 6).

### 리스크 4: 진입점 협력 의존성

- **위험**: SPEC-LIBRARY-001 서재 화면 설계가 확정되지 않으면 진입 버튼(REQ-COMP-002) 위치를 정할 수 없음
- **대응**: 본 SPEC은 "진입 가능해야 한다"는 계약만 정의하고, 구체적 UI는 SPEC-LIBRARY-001과 협력하여 확정. 진입점 없이도 다이어리 자체는 독립적으로 구현·테스트 가능.

---

## 7. 테스트 전략

### 단위 테스트 (Primary Goal)

- `completionApi.test.ts`: 재시도 로직, RLS 필터링 검증, 네트워크 에러 처리
- `useCompletionReport.test.ts`: 로딩/성공/에러(네트워크·인증)/빈 상태/데이터 오류 분기
- `types.ts` 타입 가드 테스트: 정상 데이터, 키 누락, 타입 불일치 케이스 (isReportData → AppError(VALIDATION))

### 컴포넌트 테스트 (Secondary Goal)

- `EmotionCurveChart.test.tsx`: 빈 배열, 1개 포인트, 다중 포인트 렌더링
- `HighlightList.test.tsx`: 빈 배열, 1개, 다중 하이라이트 렌더링
- `CelebrationHeader.test.tsx`: 메시지 및 배지 표시 검증

### 통합 테스트 (Final Goal)

- `CompletionDiaryScreen.test.tsx`: 전체 플로우 — 정상 데이터, 빈 상태, 에러 상태
- 진입 버튼 → 다이어리 화면 이동 (SPEC-LIBRARY-001 협력 후 추가)

### 커버리지 목표

- TRUST 5 기준: 85%+ (SPEC-UI-001이 93.68% 달성한 선례 참고)
- 모든 REQ-COMP-XXX에 대해 최소 1개 테스트 시나리오 매핑 (acceptance.md 참조)

---

## 8. 전문가 자문 권장 (Expert Consultation)

본 SPEC은 프론트엔드 구현이 핵심이므로, 다음 전문가 자문을 권장한다:

### 프론트엔드 전문가 (expert-frontend)

- **자문 영역**: 순수 SVG 차트 컴포넌트 아키텍처(단일 brand-500 컬러), React Native 성능 최적화(대량 하이라이트 렌더링, FlatList 가상화), 접근성(a11y)
- **자문 시점**: Secondary Goal 시작 전

### 디자인 전문가 (design-uiux)

- **자문 영역**: 빈 상태/에러 상태/데이터 오류 상태 UX, 축하 헤더 정적 배지 디자인(6.3 옵션 A)
- **자문 시점**: Primary Goal 완료 후, Secondary Goal 시작 전

> 전문가 자문은 사용자 승인 후 진행한다. 본 SPEC 작성 단계에서는 권장 사항으로 기록한다.
