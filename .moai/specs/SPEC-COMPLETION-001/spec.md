---
# NOTE: `created` is the canonical field name per MoAI plan workflow Phase 2
# (8-field frontmatter: id, version, status, created, updated, author, priority,
# issue_number). Do NOT rename to `created_at` — orchestrator ruling on MP-3.
id: SPEC-COMPLETION-001
title: "완독 다이어리 및 아카이브 시각화"
version: "1.0.0"
status: completed
created: 2026-06-14
updated: 2026-06-17
author: "강력쇠주먹"
priority: medium
issue_number: 14
labels: [completion, diary, archive, visualization, emotion-curve, frontend]
---

# SPEC-COMPLETION-001: 완독 다이어리 및 아카이브 시각화

## HISTORY

| 날짜 | 버전 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 2026-06-14 | 1.0.0 | 최초 작성 — 완독 다이어리 시각화, report_data 읽기 전용 클라이언트, 4개 요구사항 모듈 (TRIGGER/DATA/VIEW/CELEBRATE) | 강력쇠주먹 |
| 2026-06-17 | 1.0.0 | report_data 스키마 시정 — DB 트리거 실제 산출물(page_number/emotion_count, emotion_kind 없음)과 일치. REQ-COMP-006 단일 브랜드 컬러 토큰화, 6.1/6.3 해결(순수 SVG / 정적 축하), Zod→순수 타입 가드 전환. 계약 시정이며 기능 범위 변동 없음 | 강력쇠주먹 |

---

## 1. 환경 (Environment)

- **플랫폼**: iOS/Android 모바일 앱 (React Native + Expo SDK 55 + React 19.2 + TypeScript strict)
- **백엔드**: Supabase (PostgreSQL 15+ / PostgREST 자동 REST API)
- **데이터 소스**: `completion_reports.report_data` JSONB — DB 트리거가 단독 산출 (SPEC-DB-001 REQ-DB-010)
- **인증**: Supabase Auth (세션 기반, RLS 자동 적용 — REQ-DB-021: `auth.uid() = user_id`)
- **API 엔드포인트**: `GET /rest/v1/completion_reports?user_book_id=eq.{uuid}` (PostgREST 자동 생성, RLS 필터링)
- **의존 SPEC**: SPEC-LIBRARY-001 (완독 처리 플로우 — status 전환), SPEC-EMOTION-001 (감정 데이터 — report_data 소스), SPEC-UI-001 (디자인 토큰·ThemeProvider), SPEC-API-001 (Supabase 클라이언트)

### 단일 출처 (Single Source of Truth)

본 SPEC은 `completion_reports` 테이블 스키마 및 `report_data` 구조를 SPEC-DB-001 (REQ-DB-010, REQ-DB-021)에 위임한다. 본 SPEC은 **report_data를 읽어 시각화하는 클라이언트 로직**만을 정의하며, report_data 생성·집계 로직은 포함하지 않는다.

### report_data JSONB 구조 (SPEC-DB-001 위임 — 참조 전용)

> **주의 (2026-06-17 시정)**: 아래 구조는 실제 DB 트리거 `generate_completion_report()`
> (`supabase/migrations/20240614000010_create_completion_reports.sql`)의 산출물과
> 정확히 일치한다. emotion_curve는 **페이지별 감정 수량** 집계이며, emotion_count 외에
> 감정 종류(kind) 필드는 존재하지 않는다. highlights 역시 content만 포함한다.

```jsonc
{
  "emotion_curve": [
    { "page_number": 12, "emotion_count": 3 },
    { "page_number": 45, "emotion_count": 2 }
  ],
  "highlights": [
    { "page_number": 12, "content": "이 문장에서 마음이 찡해졌다" }
  ],
  "total_records": 47
}
```

필드 계약:
- `emotion_curve[]`: 페이지별 감정 기록 수. 각 원소는 `page_number`(number)와
  `emotion_count`(number)만 가진다. **감정 종류 필드는 없다.**
- `highlights[]`: 최근 감정 기록 최대 5건(트리거 `ORDER BY created_at DESC LIMIT 5`).
  각 원소는 `page_number`(number)와 `content`(string)만 가진다. **감정 종류 필드는 없다.**
- `total_records`(number): 해당 user_book의 전체 감정 기록 수.

> 위 구조는 SPEC-DB-001 REQ-DB-010이 DB 트리거 PL/pgSQL으로 채운다. 트리거 로직(하이라이트 선정 알고리즘 등)은 SPEC-DB-001 영역이며, 본 SPEC은 이 JSONB를 **있는 그대로 파싱하여 렌더링**한다.

---

## 2. 가정 (Assumptions)

### 2.1 아키텍처 가정

1. **report_data 읽기 전용**: `completion_reports.report_data`는 DB 트리거가 상태 전환 시점(동일 트랜잭션 커밋)에 완전히 채운다. 본 SPEC의 클라이언트는 report_data를 **수정·재계산하지 않으며**, 오직 읽어서 시각화한다.
2. **1 user_book = 1 리포트**: `completion_reports`에 `UNIQUE(user_book_id)` 제약이 있으므로(SPEC-DB-001 REQ-DB-010), 완독 다이어리는 user_book당 정확히 1개만 존재한다. 완독→reading→재완독 사이클에서도 `ON CONFLICT DO NOTHING`으로 1개가 유지된다.
3. **RLS 자동 적용**: PostgREST `GET /completion_reports`는 RLS 정책(REQ-DB-021: `auth.uid() = user_id`)에 의해 본인 리포트만 반환한다. 클라이언트는 별도 필터 없이 `user_book_id`로 조회하면 된다.
4. **Edge Function은 예비**: `generate-completion-report` Edge Function은 DB 트리거에 의해 호출되지 않는다(SPEC-DB-001 제외 범위). 향후 리치 콘텐츠(이미지 카드 등) 생성용으로만 예약되어 있으며, 본 SPEC 범위 밖이다.
5. **status 전환은 SPEC-LIBRARY-001 영역**: `user_books.status: reading → completed` 전환 플로우(버튼 클릭, 확인 다이얼로그 등)는 SPEC-LIBRARY-001이 소유한다. 본 SPEC은 전환 **이후** 리포트 존재를 확인하고 다이어리를 표시한다.

### 2.2 비즈니스 가정

1. **완독 다이어리는 읽기 전용 아카이브**: 사용자가 완독하면 자동으로 생성된 다이어리를 열람할 수 있다. 다이어리 내용(emotion_curve, highlights)은 DB 트리거가 산출한 스냅샷이며, 이후 감정 기록이 추가되어도 자동 갱신되지 않는다(후순위 기능).
2. **감정 데이터 0건 케이스**: 완독했지만 감정 기록이 1건도 없는 경우, `total_records: 0`, `emotion_curve: []`, `highlights: []`로 report_data가 채워진다. 다이어리 뷰는 이 케이스를 빈 상태(empty state)로 처리한다.
3. **완독 취소(reading 복귀) 시 다이어리 유지**: 사용자가 완독을 취소하고 reading으로 되돌려도, 이미 생성된 completion_reports 행은 삭제되지 않는다(UNIQUE + ON CONFLICT DO NOTHING 정책). 다이어리 접근 정책(숨김/표시)은 미결정 사항(6.3 참조)이며, 본 SPEC 범위 밖이다.

---

## 3. 요구사항 (Requirements)

> 본 SPEC은 4개 요구사항 모듈로 구성된다: REQ-COMP-TRIGGER, REQ-COMP-DATA, REQ-COMP-VIEW, REQ-COMP-CELEBRATE.

### REQ-COMP-TRIGGER: 완독 처리 연동

**목적**: SPEC-LIBRARY-001의 완독 처리 플로우 이후, DB 트리거가 자동 생성한 completion_reports 행의 존재를 확인하고 다이어리 진입점을 제공한다.

#### REQ-COMP-001: 완독 리포트 존재 확인

**WHEN** 사용자가 완독 처리(`user_books.status: reading → completed`)를 완료하면,
**THEN** 시스템은 PostgREST `GET /completion_reports?user_book_id=eq.{uuid}`를 호출하여 리포트 존재를 확인해야 한다.

**IF** 리포트가 존재하지 않으면 (DB 트리거 실패 또는 타이밍 지연),
**THEN** 시스템은 재시도(최대 3회, 간격 점진 증가) 후에도 없을 경우 에러 상태를 표시하고, 다이어리 진입을 차단해야 한다.

> **설계 근거**: DB 트리거는 동일 트랜잭션 커밋 시점에 report_data를 완전히 채우므로(SPEC-DB-001 REQ-DB-010 N2), 정상 케이스에서는 1회 조회로 즉시 리포트를 얻을 수 있다. 재시도는 트랜잭션 지연 또는 네트워크 불안정 대비용이다.

#### REQ-COMP-002: 완독 다이어리 진입점 제공

**WHILE** `user_books.status = 'completed'`인 서재 항목이 표시되는 동안,
**THEN** 시스템은 해당 항목에 완독 다이어리 진입 버튼(또는 아이콘)을 노출해야 한다.

**WHEN** 사용자가 완독 다이어리 진입 버튼을 탭하면,
**THEN** 시스템은 `completion_reports`에서 해당 `user_book_id`의 report_data를 조회하고, 완독 다이어리 화면으로 이동해야 한다.

> 진입점의 정확한 UI(아이콘 종류, 배치 위치)는 SPEC-LIBRARY-001의 서재 화면 설계와 협력한다. 본 SPEC은 "진입 가능해야 한다"는 계약만 정의한다.

#### REQ-COMP-003: 타인 리포트 접근 차단 확인

**IF** RLS 정책(REQ-DB-021)이 정상 동작하여 본인 리포트만 반환되면,
**THEN** 시스템은 조회 결과가 항상 본인 소유임을 보장받아야 하며, 클라이언트 측 추가 검증은 불필요하다.

> **설계 근거**: PostgREST는 RLS를 자동 적용하므로, `GET /completion_reports?user_book_id=eq.{uuid}`는 타인 user_book_id로 조회해도 빈 결과를 반환한다. 클라이언트는 빈 결과를 "리포트 없음"으로 처리한다.

---

### REQ-COMP-DATA: report_data 파싱 및 검증

**목적**: DB 트리거가 산출한 report_data JSONB를 타입 안전하게 파싱하고, 렌더링 가능한 형태로 변환한다.

#### REQ-COMP-004: report_data 스키마 파싱

시스템은 **항상** `completion_reports.report_data`를 다음 TypeScript 인터페이스로 파싱해야 한다:

```typescript
interface ReportData {
  emotion_curve: EmotionCurvePoint[];
  highlights: Highlight[];
  total_records: number;
}

interface EmotionCurvePoint {
  page_number: number;
  emotion_count: number;
}

interface Highlight {
  page_number: number;
  content: string;
}
```

> 위 인터페이스는 DB 트리거의 실제 산출 필드와 1:1로 일치한다. emotion_curve /
> highlights 어디에도 감정 종류(kind) 필드는 존재하지 않는다.

**IF** report_data가 위 스키마와 일치하지 않으면 (키 누락, 타입 불일치),
**THEN** 시스템은 파싱 에러를 로깅하고, 다이어리를 "데이터 오류" 상태로 표시해야 한다 (빈 상태와 구분).

> **설계 근거**: report_data는 DB 트리거 PL/pgSQL이 산출하므로 스키마 안정성이 높지만, 런타임 파싱에서 방어적 검증을 수행한다. 순수 TypeScript 타입 가드 함수 `isReportData(value): value is ReportData`를 사용하며(의존성 추가 없음 — EMOTION 모듈의 순수 타입 정책 준수), 검증 실패 시 `category=VALIDATION`인 `AppError`를 throw한다 (기술 결정은 plan.md 참조).

#### REQ-COMP-005: 감정 기록 0건 케이스 처리

**IF** `total_records = 0`이고 `emotion_curve`와 `highlights`가 빈 배열이면,
**THEN** 시스템은 다이어리를 정상적으로 렌더링하되, "기록된 감정이 없어요" 빈 상태 메시지를 표시해야 한다 (에러 상태 아님).

**WHILE** 감정 기록이 1건 이상 존재하는 동안,
**THEN** 시스템은 emotion_curve와 highlights를 차트 및 리스트로 시각화해야 한다.

---

### REQ-COMP-VIEW: 완독 다이어리 시각화

**목적**: 파싱된 report_data를 "이 책과의 여정" 테마의 다이어리 뷰로 시각화한다.

#### REQ-COMP-006: 감정 곡선 차트 시각화

**WHEN** emotion_curve에 1개 이상의 포인트가 존재하면,
**THEN** 시스템은 페이지(x축)별 감정 기록 수(y축, emotion_count)를 선형 차트 또는 바 차트로 시각화해야 한다.

**WHERE** 감정 곡선 차트가 렌더링되면,
**THEN** 시스템은 단일 브랜드 컬러 토큰(`colors.brand[500]` = `#C17B2F`, SPEC-UI-001)을 일관되게 적용해야 한다.

> **설계 근거 (2026-06-17 시정)**: DB 트리거의 emotion_curve는 페이지별 감정 *수량* 집계이며
> 감정 종류(kind) 필드를 포함하지 않는다. 따라서 "감정 종류별 고유 색상"은 데이터 근거가 없고,
> 단일 브랜드 컬러 토큰으로 시각화한다. 범례(legend)도 불필요하다.
>
> **미결정 사항 (6.1) — 해결됨**: 차트는 **순수 SVG(react-native-svg, 이미 설치됨)**로 구현한다.
> 의존성 추가 없이 단일 색상 선형/바 차트를 렌더링한다.

#### REQ-COMP-007: 하이라이트 감정 기록 표시

**WHEN** highlights 배열에 1개 이상의 하이라이트가 존재하면,
**THEN** 시스템은 하이라이트를 카드 리스트 형태로 표시하되, 각 카드에 페이지 번호(`page_number`)와 기록 내용(`content`)을 포함해야 한다.

**WHERE** 하이라이트 카드가 표시되면,
**THEN** 시스템은 SPEC-UI-001의 `EmotionRecordCard` 컴포넌트 디자인 패턴을 재사용하거나 일관된 스타일을 적용해야 한다.

#### REQ-COMP-008: 총 감정 기록 수 표시

**WHILE** 완독 다이어리가 표시되는 동안,
**THEN** 시스템은 `total_records` 값을 "이 책에서 남긴 감정 N개" 형태로 헤더 영역에 표시해야 한다.

---

### REQ-COMP-CELEBRATE: 완독 성취 표시

**목적**: 완독 성취를 축하하고 사용자에게 감정 아카이브 기반 보상 경험을 제공한다.

#### REQ-COMP-009: 완독 축하 메시지 표시

**WHEN** 사용자가 처음으로 완독 다이어리를 열면 (또는 완독 처리 직후),
**THEN** 시스템은 "이 책과의 여정을 완성하셨어요" 축하 메시지를 다이어리 상단에 표시해야 한다.

> **미결정 사항 (6.3) — 해결됨**: 축하 애니메이션 범위는 **옵션 A(정적 텍스트 + 배지 MVP)**로 확정한다.
> 컨페티/펼쳐지기 효과 없이 다이어리 헤더에 축하 메시지와 배지만 표시한다. 애니메이션 라이브러리
> (react-native-reanimated, react-native-confetti)는 도입하지 않는다.

#### REQ-COMP-010: 완독 배지 표시

**WHILE** 완독 다이어리가 표시되는 동안,
**THEN** 시스템은 완독을 나타내는 배지 아이콘을 축하 메시지 영역에 표시해야 한다.

**WHERE** 완독 배지가 존재하면,
**THEN** 시스템은 SPEC-UI-001 디자인 토큰의 강조색(amber brown #C17B2F)을 활용한 일관된 디자인을 적용해야 한다.

---

## 4. 인덱스 (Indexes)

본 SPEC은 데이터베이스 스키마를 수정하지 않으므로 추가 인덱스가 없다. `completion_reports` 조회에 사용되는 인덱스(`UNIQUE(user_book_id)`)는 SPEC-DB-001에서 이미 생성되어 있다.

---

## 5. 제외 범위 (Exclusions)

본 SPEC은 다음을 포함하지 않는다:

1. **report_data 생성·집계 로직**: `completion_reports.report_data`의 emotion_curve/highlights/total_records 산출은 DB 트리거 PL/pgSQL이 단독 처리한다 (SPEC-DB-001 REQ-DB-010). 본 SPEC은 report_data를 **읽어서 시각화만** 담당한다.
2. **Edge Function `generate-completion-report` 구현**: 이 Edge Function은 DB 트리거에 의해 호출되지 않으며, 향후 리치 콘텐츠(이미지 카드, 자동 영상 등) 생성용으로만 예약되어 있다 (SPEC-DB-001 제외 범위, 본 SPEC 제외 범위).
3. **완독 처리 플로우 (status 전환 UI)**: `user_books.status: reading → completed` 전환 버튼, 확인 다이얼로그, completed_at 설정은 SPEC-LIBRARY-001 영역이다.
4. **완독 취소(reading 복귀) 시 다이어리 유지 정책**: 완독을 취소하고 reading으로 되돌려도 completion_reports 행은 삭제되지 않는다(UNIQUE + ON CONFLICT DO NOTHING). 다이어리를 숨길지 표시할지의 정책은 후순위 결정 대상이며, 본 SPEC 범위 밖이다.
5. **리치 콘텐츠 (이미지 카드, 자동 영상)**: 완독 다이어리의 리치 콘텐츠 생성은 확장 단계 기능이다. MVP에서는 텍스트 + 차트 + 하이라이트 카드로 구성된 경량 다이어리를 제공한다.
6. **공유 기능**: 완독 다이어리를 외부(SNS, 메신저)로 공유하는 기능은 본 SPEC 범위 밖이다.
7. **인쇄/PDF 내보내기**: 완독 다이어리를 PDF로 내보내는 기능은 본 SPEC 범위 밖이다.
8. **다이어리 자동 갱신**: 완독 후 추가 감정 기록이 발생해도 report_data는 자동 갱신되지 않는다 (스냅샷). 갱신 기능은 후순위다.

---

## 6. 미결정 사항 (Open Questions)

### 6.1 감정 곡선 차트 라이브러리 — 해결됨

**상태**: 해결됨 (옵션 A 확정)

**결정**: **옵션 A — 순수 SVG (react-native-svg)**로 구현한다. `react-native-svg@15.15.3`이 이미
설치되어 있으므로 추가 의존성 없이 단일 브랜드 컬러 선형/바 차트를 렌더링한다.
감정 종류별 색상이 불필요한 단일 계열 데이터이므로(REQ-COMP-006 시정 참조) chart-kit이나
victory-native의 부가 기능은 오버엔지니어링이다.

**옵션 (기록용)**:
- A. 순수 SVG (react-native-svg) — 채택
- B. react-native-chart-kit — 기각 (단일 색상 데이터에 과함)
- C. victory-native — 기각 (의존성 무거움, 러닝 커브)

### 6.2 하이라이트 선정 알고리즘 — SPEC-DB-001에 위임 (해결됨)

**상태**: 해결됨 (SPEC-DB-001 영역으로 위임)

**결정**: report_data.highlights의 선정 로직(어떤 감정 기록을 하이라이트로 선별할지)은 DB 트리거 PL/pgSQL에 구현된다 (SPEC-DB-001 REQ-DB-010). 본 SPEC의 클라이언트는 트리거가 선정한 highlights를 **있는 그대로 렌더링**한다. 알고리즘 상세는 SPEC-DB-001의 트리거 구현에 기술한다.

### 6.3 축하 애니메이션 범위 — 해결됨

**상태**: 해결됨 (옵션 A 확정)

**결정**: **옵션 A — 정적 텍스트 + 배지**로 MVP를 한정한다. 컨페티/펼쳐지기 효과 없이
다이어리 헤더에 축하 메시지와 배지만 표시한다. 애니메이션 라이브러리는 도입하지 않는다.
옵션 B/C는 후순위 확장 후보로만 기록한다.

**옵션 (기록용)**:
- A. 정적 텍스트 + 배지 — 채택 (MVP)
- B. 경량 애니메이션 (react-native-reanimated) — 후순위
- C. 풀 컨페티 (react-native-confetti) — 후순위

---

## 7. 추적성 (Traceability)

| TAG | 요구사항 | 소스 |
|-----|---------|------|
| SPEC-COMPLETION-001 | REQ-COMP-001 ~ REQ-COMP-010 | `.moai/project/product.md` (사용 시나리오 4: 완독 성취, 핵심 기능: 감정 아카이브 기반 보상), `.moai/project/structure.md` (Edge Functions: generate-completion-report, 데이터 모델: completion_reports), `.moai/specs/SPEC-DB-001/spec.md` (REQ-DB-010 completion_reports 자동 생성 트리거, REQ-DB-021 RLS 정책), `.moai/specs/INDEX.md` (SPEC-COMPLETION-001 카탈로그 항목) |

### 의존성 추적

| 의존 SPEC | 의존 내용 | 본 SPEC의 역할 |
|-----------|----------|---------------|
| SPEC-DB-001 | REQ-DB-010 (completion_reports 스키마 + 트리거), REQ-DB-021 (RLS) | report_data 읽기 전용 소비자 |
| SPEC-LIBRARY-001 | 완독 처리 플로우 (status 전환, 진입점 배치) | 전환 이후 다이어리 표시, 진입 버튼 협력 |
| SPEC-EMOTION-001 | emotion_records 데이터 (report_data 소스) | 간접 의존 (DB 트리거가 집계) |
| SPEC-UI-001 | 디자인 토큰, EmotionRecordCard, ThemeProvider | 시각화 일관성 적용 |
| SPEC-API-001 | Supabase 클라이언트, 타입 안전 쿼리 래퍼 | PostgREST GET 호출 |

---

## 8. Implementation Notes (sync 2026-06-17)

### 8.1 최종 ReportData 계약

본 SPEC은 DB 트리거 `generate_completion_report()`가 산출한 `completion_reports.report_data`를 읽기 전용으로 소비한다. 최종 계약은 SPEC-DB-001에 의해 2026-06-14에 생성된 migration `20240614000010_create_completion_reports.sql`의 PL/pgSQL 트리거와 정확히 일치한다:

**ReportData 구조**:
```typescript
interface ReportData {
  emotion_curve: Array<{page_number: number, emotion_count: number}>
  highlights: Array<{page_number: number, content: string}>
  total_records: number
}
```

**필드 계약 (2026-06-17 시정 사항)**:
- `emotion_curve[]`: 페이지별 감정 기록 수. 각 원소는 `page_number`(number)와 `emotion_count`(number)만 가진다. **감정 종류 필드는 없다.**
- `highlights[]`: 최근 감정 기록 최대 5건(트리거 `ORDER BY created_at DESC LIMIT 5`). 각 원소는 `page_number`(number)와 `content`(string)만 가진다. **감정 종류 필드는 없다.**
- `total_records`(number): 해당 user_book의 전체 감정 기록 수

이 구조는 SPEC-DB-001 REQ-DB-010이 DB 트리거 PL/pgSQL로 채운다. 트리거 로직(하이라이트 선정 알고리즘 등)은 SPEC-DB-001 영역이며, 본 SPEC은 이 JSONB를 **있는 그대로 파싱하여 렌더링**한다.

---

### 8.2 구현 산출물 (11 files)

**계획**: 10 files
**실제**: 11 files (+ `types.test.ts` 추가)
**Drift**: 10% (비차단 — 단위 테스트 증가는 품질 개선)

**Source files (7)**:
1. `src/features/completion/types.ts` — ReportData/EmotionCurvePoint/Highlight + isReportData() 순수 타입 가드
2. `src/features/completion/completionApi.ts` — fetchReport (PostgREST GET 래퍼 + 재시도 최대3 + 점진백오프 + normalizeError, RLS auth.uid() 신뢰)
3. `src/features/completion/useCompletionReport.ts` — useState/useEffect 기반 6상태 훅 (loading/success/empty/error/data-error/auth)
4. `src/features/completion/EmotionCurveChart.tsx` — 순수 SVG 감정 곡선 (단일 brand-500 색상, 페이지별 수량)
5. `src/features/completion/HighlightList.tsx` — FlatList 하이라이트 (text.inverse 스타일)
6. `src/features/completion/CelebrationHeader.tsx` — 정적 배지 + 축하 메시지 MVP
7. `src/features/completion/CompletionDiaryScreen.tsx` — 메인 통합 화면 (6상태 분기 렌더링)

**Test files (4)**:
1. `src/features/completion/types.test.ts` — Type validation (isReportData)
2. `src/features/completion/completionApi.test.ts` — fetchReport scenarios (retry logic, error classification, empty response)
3. `src/features/completion/useCompletionReport.test.tsx` — 6상태 훅 (loading/success/empty/error/data-error/auth 분기)
4. `src/features/completion/CompletionDiaryScreen.test.tsx` — 6상태 분기 UI

---

### 8.3 Cross-SPEC 협력 사항

**REQ-COMP-002 (진입 버튼)**: 완독 다이어리 진입 버튼 UI는 본 SPEC에서 **계약만 정의**하고, 실제 구현은 SPEC-LIBRARY-001과 협력한다. 진입 버튼 배치(BookDetailScreen 또는 LibraryScreen), 라우팅 파라미터(userBookId 전달)은 SPEC-LIBRARY-001 영역이다.

**의존 관계**:
- SPEC-DB-001: `completion_reports.report_data` 생성 트리거 (본 SPEC은 읽기만)
- SPEC-EMOTION-001: `emotion_records` 데이터 (report_data 소스, 간접 의존)
- SPEC-LIBRARY-001: 완독 처리 플로우 (status 전환) + 진입 버튼 협력 (REQ-COMP-002)
- SPEC-UI-001: 디자인 토큰 (text.inverse, brand-500)

---

### 8.4 기술 결정 (Decisions)

**결정 1: Zod → 순수 타입 가드 (2026-06-17)**
- **이유**: runtime validation 라이브러리 의존성 제거, 테스트 커버리지 유지
- **결과**: `isReportData(data: unknown): data is ReportData` 순수 타입 가드로 대체
- **영향**: `types.ts` 단순화, 테스트 통과

**결정 2: 단일 brand-500 색상 (REQ-COMP-006, 2026-06-17)**
- **이유**: 감정 종류별 색상 구현은 복잡도 증가 + MVP 단순화
- **결과**: `EmotionCurveChart`는 단일 `$brand-500` 토큰 사용
- **영향**: 차트 라이브러리 불필요, 순수 SVG 구현 가능

**결정 3: 정적 축하 헤더 (6.3, 2026-06-17)**
- **이유**: MVP 범위 한정, 애니메이션 라이브러리 도입 비용 절감
- **결과**: `CelebrationHeader`는 정적 배지 + 축하 메시지만 표시
- **영향**: react-native-reanimated, react-native-confetti 미사용

**결정 4: RLS 신뢰 (user_id 미전송)**
- **이유**: PostgREST는 RLS 정책(`auth.uid() = user_id`)에 의해 본인 리포트만 자동 필터링
- **결과**: `completionApi.fetchReport(userBookId)`는 `user_id` 미전송
- **영향**: API 호출 단순화, 보안 유지

---

### 8.5 품질 게이트 (Quality Gates)

**LSP (tsc)**: 0 errors
**Lint (eslint)**: 0 errors
**Tests (jest)**: 683/683 pass
**Coverage**:
- Statements: 91.92% (target 85%+ exceeded)
- Branches: 85.55%
- Functions: 96.79%
- Lines: 93.62%

**A11Y (WCAG 2.1)**:
- 1.1.1: EmotionCurveChart `<title>` 태그로 차트 라벨 제공
- AA: text.inverse 색상 대비 준수 (-brand-500 on -inverse)
- 2.5.5: touch target 44px 이상 충족

---

### 8.6 PR 및 머지 정보

**PR**: #14
**Commit**: 463996e6bba21663ffea897b24faebef54700f24
**Merge Date**: 2026-06-17
**Branch**: develop (PR #14 머지 후 develop)
**Feature Branch**: 이미 삭제 (git workflow 준수)

---

### 8.7 미결 사항 (Deferred)

**Deferred 1: 진입 버튼 구현 (REQ-COMP-002)**
- 현재 상태: 계약만 정의 완료
- 구현 시점: SPEC-LIBRARY-001 협력 필요
- 배치 위치 미정: BookDetailScreen 또는 LibraryScreen

**Deferred 2: report_data 자동 갱신**
- 현재 상태: 완독 시점 스냅샷만 제공
- 후순위: v1.1.0 연기
- 요구사항: 완독 이후 감정 기록 추가 시 자동 갱신

---
