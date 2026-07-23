---
# NOTE: `created` is the canonical field name per MoAI plan workflow Phase 2
# (8-field frontmatter: id, version, status, created, updated, author, priority,
# issue_number). Do NOT rename to `created_at` — orchestrator ruling on MP-3.
id: SPEC-COMPLETION-002
title: "완독 다이어리 아카이브(리스트) + 상세 재설계"
version: "1.0.0"
status: completed
created: 2026-06-27
updated: 2026-07-23
author: "강력쇠주먹"
priority: medium
issue_number: 0
labels: [completion, diary, archive, list, redesign, frontend, pencil]
---

# SPEC-COMPLETION-002: 완독 다이어리 아카이브(리스트) + 상세 재설계

## HISTORY

| 날짜 | 버전 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 2026-06-27 | 1.0.0 | 최초 작성 — 완독 다이어리 리스트(아카이브) 화면 신규 도입, 기존 상세 화면 F09 `.pen` 재설계 정합, 마이 진입점 연결(REQ-COMP-002 이행). 5개 요구사항 모듈 (ROUTE/LIST/DETAIL/ENTRY/STATE). 설계 레퍼런스: `.moai/design/sagak.pen` F08/F09 4프레임 | 강력쇠주먹 |

---

## 1. 환경 (Environment)

- **플랫폼**: iOS/Android 모바일 앱 (React Native + Expo SDK 55 + React 19.2 + TypeScript strict)
- **백엔드**: Supabase (PostgreSQL 15+ / PostgREST 자동 REST API)
- **데이터 소스**:
  - `user_books` (status='completed', completed_at) — SPEC-LIBRARY-001 소유
  - `books` (title, author, cover_url) — SPEC-BOOK-001 소유
  - `completion_reports.report_data` JSONB (total_records, highlights) — SPEC-DB-001 트리거 산출, SPEC-COMPLETION-001 읽기 전용 소비
- **인증**: Supabase Auth (세션 기반, RLS 자동 적용 — `auth.uid() = user_id`)
- **라우팅**: Expo Router ~5 (SPEC-NAV-001)
- **설계 레퍼런스**: `.moai/design/sagak.pen` 프레임 `F08-CompletionDiaryList`, `F08-CompletionDiaryList-Empty`, `F09-CompletionDiaryDetail`, `F09-CompletionDiaryDetail-Empty` (design commit `1300d6b`)
- **의존 SPEC**:
  - **SPEC-COMPLETION-001** (핵심 — report_data 데이터 계약, `fetchReport`, `useCompletionReport`, `ReportData` 타입 재사용)
  - SPEC-LIBRARY-001 (완독 처리 플로우, `user_books.status`, `getLibrary` 패턴)
  - SPEC-UI-002 (FROZEN 화면 패턴 디자인 시스템 — 3계층 레이아웃, 타이틀 균일성, 카드 밀도, 빈/로딩/에러 상태)
  - SPEC-NAV-001 (라우팅)
  - SPEC-DB-001 (completion_reports 스키마, RLS)

### COMPLETION-001 vs COMPLETION-002 경계 (Boundary)

본 SPEC은 SPEC-COMPLETION-001의 **데이터 계약을 재사용**하며, 시각적·탐색적 확장을 담당한다. 중복 구현을 방지하기 위해 경계를 명시한다.

| 영역 | SPEC-COMPLETION-001 (PR #14) | SPEC-COMPLETION-002 (본 SPEC) |
|------|------------------------------|-------------------------------|
| report_data 파싱 | ✅ `ReportData` 타입, `isReportData()` 타입 가드 | 재사용 (재정의 안 함) |
| 단일 리포트 조회 API | ✅ `fetchReport(userBookId)` | 재사용 (상세 화면) |
| 단일 리포트 조회 훅 | ✅ `useCompletionReport(userBookId)` | 재사용 (상세 화면) |
| 상세 화면 데이터 로직 | ✅ 6상태 분기 (loading/success/empty/error/data-error/auth) | 재사용 |
| 상세 화면 시각화 | ✅ 1차 구현 (CelebrationHeader, EmotionCurveChart, HighlightList) | **F09 `.pen` 정합 재설계** (래퍼 카드, 라벨, 레이아웃 조정) |
| 리스트(아카이브) 화면 | ❌ 미구현 | **신규 도입** |
| 진입점 (REQ-COMP-002) | 계약만 정의, 구현 연기 | **이행** (마이 + 서재) |
| 리스트 쿼리 | ❌ | **신규** (`fetchCompletionDiaryList`) |

> **핵심 원칙**: 본 SPEC은 `ReportData`/`fetchReport`/`useCompletionReport`를 **있는 그대로 재사용**하며, report_data 스키마 해석이나 파싱 로직을 재정의하지 않는다. 상세 화면의 "재설계"는 F09 시각적 구조 정합이지, 데이터 로직 재구현이 아니다.

---

## 2. 가정 (Assumptions)

### 2.1 아키텍처 가정

1. **report_data 읽기 전용 (001 위임)**: `completion_reports.report_data`는 DB 트리거가 완독 시점에 채운 읽기 전용 스냅샷이다(SPEC-DB-001 REQ-DB-010). 본 SPEC의 리스트 쿼리와 상세 화면 모두 이 JSONB를 수정하지 않으며, 001이 정의한 `ReportData` 인터페이스로 파싱한다.
2. **1 user_book = 1 리포트**: `completion_reports`에 `UNIQUE(user_book_id)` 제약이 있으므로(SPEC-DB-001), 리스트의 각 완독 항목은 최대 1개의 다이어리 리포트와 1:1로 대응한다. 리스트 쿼리는 LEFT JOIN으로 리포트가 없는 completed 항목도 허용한다(드문 케이스 — 트리거 지연).
3. **RLS 자동 적용**: `user_books`, `completion_reports` 모두 RLS 정책(`auth.uid() = user_id`)이 적용된다. 리스트 쿼리는 본인 completed 항목만 자동 필터링된다. 클라이언트는 추가 user_id 필터 없이 조회한다(001 결정 4와 일관).
4. **001 상세 화면 데이터 로직 유지**: 기존 `CompletionDiaryScreen.tsx`의 6상태 분기(loading/success/empty/error/data-error/auth)는 그대로 유지하되, 시각적 구조를 F09에 정합시킨다. 상태 분기 로직 자체는 001의 자산이므로 본 SPEC이 재정의하지 않는다.
5. **001 진입점 계약 이행**: 001의 REQ-COMP-002("완독 다이어리 진입점 제공")는 계약만 정의하고 구현을 연기했다(`app/(tabs)/my.tsx:539` no-op + `@MX:TODO`). 본 SPEC이 이 계약을 이행하여 마이 메뉴와 서재 completed 항목에 진입점을 연결한다.

### 2.2 비즈니스 가정

1. **완독 다이어리 아카이브는 읽기 전용 탐색**: 리스트 화면은 사용자가 완독한 책들의 다이어리를 탐색하는 아카이브 뷰다. 사용자는 리스트에서 특정 책의 상세 다이어리로 진입할 수 있다.
2. **비경쟁 원칙 (constitution)**: 리스트의 "지금까지 N권 완독" 요약 통계는 **개인 여정 기록**이지 타인과의 경쟁 지표가 아니다. 좋아요 수, 팔로워 수, 랭킹은 표시하지 않는다(Design Constitution FROZEN — Non-competition principle).
3. **DiaryCard 하이라이트 미리보기**: 리스트의 각 카드는 `report_data.highlights[0]`(가장 최근 감정 기록)를 한두 줄로 미리 보여준다. highlights가 빈 배열(total_records=0)이면 미리보기 줄을 생략한다.
4. **상세 화면 빈 상태 (F09-Empty)**: 완독은 했지만 감정 기록이 0건인 책의 상세 화면은 CelebrationHeader(완독 자체는 축하) + "기록된 감정이 없어요" 메시지를 표시한다(001 REQ-COMP-005의 시각적 표현을 F09 구조로 정합).

---

## 3. 요구사항 (Requirements)

> 본 SPEC은 5개 요구사항 모듈로 구성된다: REQ-COMP2-ROUTE, REQ-COMP2-LIST, REQ-COMP2-DETAIL, REQ-COMP2-ENTRY, REQ-COMP2-STATE.
> REQ ID는 SPEC-COMPLETION-001의 REQ-COMP-XXX와 구분하기 위해 **REQ-COMP2-XXX** 체계를 사용한다.

### REQ-COMP2-ROUTE: 라우팅 및 리스트 화면 존재

**목적**: 완독 다이어리 아카이브(리스트) 화면에 대한 독립 라우트를 제공한다.

#### REQ-COMP2-001: 완독 다이어리 리스트 라우트 존재

**WHEN** 앱이 시작되고 익스포 라우터가 라우트 맵을 구성하면,
**THEN** 시스템은 완독 다이어리 리스트 화면을 위한 라우트(`app/(tabs)/completion/index.tsx` 또는 동등한 my 서브 라우트)를 노출해야 한다.

**WHERE** 리스트 라우트가 존재하면,
**THEN** 시스템은 기존 상세 라우트 `app/(tabs)/completion/[bookId].tsx`(SPEC-COMPLETION-001)와 공존해야 하며, 리스트 → 상세 네비게이션이 `bookId` 파라미터로 연결되어야 한다.

> **설계 근거**: 현재 `completion/` 디렉토리는 `[bookId].tsx`만 존재한다. `index.tsx`를 추가하면 `/completion`은 리스트, `/completion/{bookId}`는 상세로 자연스럽게 분리된다(SPEC-NAV-001 라우팅 패턴).

---

### REQ-COMP2-LIST: 리스트(아카이브) 화면

**목적**: 사용자가 완독한 책들의 다이어리를 탐색할 수 있는 아카이브 리스트를 제공한다. 설계 레퍼런스: `.pen` 프레임 `F08-CompletionDiaryList`, `F08-CompletionDiaryList-Empty`.

#### REQ-COMP2-002: 완독 다이어리 리스트 쿼리

**WHEN** 리스트 화면이 마운트되면,
**THEN** 시스템은 본인의 `user_books` 중 `status='completed'`인 항목들을 조회하고, 각 항목에 대해 `books`(title, author, cover_url), `completion_reports.report_data`(total_records, highlights)를 조인하여 리스트 메타데이터를 구성해야 한다.

**WHILE** 리스트 쿼리가 실행 중인 동안,
**THEN** 시스템은 각 항목을 다음 데이터 계약(REQ-COMP2-002 데이터 셰이프, Section 4 참조)으로 파싱해야 한다:
- `userBookId`, `bookId`, `title`, `author`, `coverUrl`(nullable)
- `completedAt`(ISO 문자열, nullable)
- `totalRecords`(report_data.total_records)
- `recentHighlight`(report_data.highlights[0]?.content ?? null)

> **설계 근거**: 기존 `getLibrary(status='completed')`(SPEC-LIBRARY-001)는 `completion_reports`를 조인하지 않으므로, 리스트 전용 쿼리가 필요하다. `completion_reports`의 `UNIQUE(user_book_id)` 제약으로 1:1 LEFT JOIN이 가능하다. RLS가 본인 항목만 자동 필터링하므로 user_id는 클라이언트에서 전송하지 않는다(001 결정 4 일관). 구체적 SELECT/Shape은 Section 4 데이터 계약에 정의하며, 마이그레이션은 포함하지 않는다(기존 테이블/RLS 재사용).

#### REQ-COMP2-003: DiaryCard 렌더링

**WHILE** 리스트 쿼리가 성공적으로 1개 이상의 항목을 반환하는 동안,
**THEN** 시스템은 각 항목을 DiaryCard로 렌더링해야 하며, 카드는 다음 요소를 포함해야 한다 (F08 `DiaryCard-N` 정합):
- **Cover** 이미지 (`coverUrl`, 60×84, cornerRadius 6, `coverUrl`이 null이면 `brand-200` 플레이스홀더)
- **BookTitle** (text-primary, fontSize 15, weight 600, fill container)
- **Meta 행**: "완독 {completedAt 포맷}" + "기록 {totalRecords}개" (둘 다 Inter 11, weight 500, text-tertiary)
- **Highlight 미리보기**: `recentHighlight`가 존재하면 한두 줄(text-secondary, fontSize 13, lineHeight 1.5, `numberOfLines=2`), 존재하지 않으면 생략
- **Chevron** 아이콘 (chevron-right, 20×20, text-tertiary)

**WHERE** DiaryCard가 렌더링되면,
**THEN** 시스템은 SPEC-UI-002 FROZEN 카드 패턴(`bg-surface`, `cornerRadius 16`, `padding 16`)을 적용해야 한다.

> **하이라이트 미리보기 규칙 (미결정 사항 6.3 해결)**: `report_data.highlights`는 DB 트리거가 `ORDER BY created_at DESC LIMIT 5`로 정렬하므로(SPEC-DB-001), `highlights[0]`가 **가장 최근 감정 기록**이다. 카드 미리보기는 `highlights[0].content`를 사용하며, 최근성(recency) 기준이다. `total_records=0`이면 highlights 배열이 비어 있으므로 미리보기 줄을 생략한다.

#### REQ-COMP2-004: 완독 권수 요약 통계 (비경쟁)

**WHILE** 리스트가 1개 이상의 항목을 표시하는 동안,
**THEN** 시스템은 리스트 상단에 "지금까지 {N}권 완독" 요약 통계를 표시해야 한다 (F08 `SummaryStat`, text-secondary, fontSize 13, weight 500, 중앙 정렬).

**WHERE** 요약 통계가 표시되면,
**THEN** 시스템은 타인과의 비교 지표(좋아요, 팔로워, 랭킹)를 포함하지 않아야 한다 (Design Constitution Non-competition principle).

> **설계 근거**: "N권 완독"은 개인 독서 여정의 기록이지 경쟁 지표가 아니다. constitution FROZEN 비경쟁 원칙을 준수하면서도 사용자에게 성취감을 제공하는 최소 표현이다.

#### REQ-COMP2-005: 리스트 빈 상태

**IF** 리스트 쿼리가 완료되었으나 완독한 책이 0권이면 (completed 항목 없음),
**THEN** 시스템은 `EmptyState` 재사용 컴포넌트를 표시해야 하며, 다음 오버라이드를 적용한다 (F08-Empty 정합):
- 아이콘: `sparkles`
- 타이틀: "완독한 책이 아직 없어요"
- 서브: "첫 책을 끝까지 읽어보세요"

**WHEN** 사용자가 빈 상태의 CTA 버튼을 탭하면,
**THEN** 시스템은 서재 탭(읽는중 필터)으로 이동해야 한다.

> **빈 상태 CTA 결정 (미결정 사항 6.1 해결)**: `EmptyState` 재사용 컴포넌트는 기본 "시작하기" CTA를 포함한다. 본 SPEC은 CTA를 **서재 탭(읽는중)으로 재지정**하고, 라벨을 "읽으러 가기"로 변경한다. 근거: "완독한 책이 아직 없어요" 상태에서 사용자의 자연스러운 다음 행동은 "읽으러 가기"이며, 서재의 읽는중 목록이 가장 적합한 랜딩 지점이다. 기본 "시작하기"는 액션의 목적이 모호하다.

#### REQ-COMP2-006: 리스트 → 상세 네비게이션

**WHEN** 사용자가 DiaryCard를 탭하면,
**THEN** 시스템은 해당 항목의 `bookId`를 파라미터로 사용하여 완독 다이어리 상세 라우트(`/completion/{bookId}`)로 이동해야 한다.

> **설계 근거**: 상세 라우트 `app/(tabs)/completion/[bookId].tsx`(SPEC-COMPLETION-001)는 이미 `bookId`를 받아 `useLibraryItem`으로 `userBookId`를 변환한다. 리스트 카드도 동일하게 `bookId`를 전달하여 기존 변환 로직을 재사용한다.

#### REQ-COMP2-007: 리스트 당겨서 새로고침

**WHEN** 사용자가 리스트 화면에서 아래로 당겨서 새로고침 제스처를 수행하면,
**THEN** 시스템은 완독 다이어리 리스트 쿼리를 다시 실행하여 최신 완독 상태를 반영해야 한다.

> **설계 근거**: 사용자가 앱 실행 중 새 책을 완독 처리한 후 리스트로 돌아왔을 때 최신 상태를 보장한다. SPEC-UI-002 화면 패턴의 새로고침 일관성을 준수한다.

---

### REQ-COMP2-DETAIL: 상세 화면 F09 재설계 정합

**목적**: SPEC-COMPLETION-001이 구현한 상세 화면의 시각적 구조를 `.pen` 프레임 `F09-CompletionDiaryDetail`에 정합시킨다. 데이터 로직(001의 `useCompletionReport`, `fetchReport`, 6상태 분기)은 재사용한다.

#### REQ-COMP2-008: 상세 화면 F09 구조 정합

**WHILE** 상세 화면이 success 또는 empty 상태로 렌더링되는 동안,
**THEN** 시스템은 다음 4개 섹션을 F09 `Content` 구조(vertical, gap 24)로 배치해야 한다:

1. **CelebrationHeader 카드** (`brand-50` fill, cornerRadius 16, padding [20,16], 중앙 정렬):
   - Cover (72×100, cornerRadius 6, `brand-200` 플레이스홀더 또는 실제 표지)
   - 완독 Badge (pill, `brand-500` fill, cornerRadius 999, padding [4,12], "완독" text-inverse 13 weight 700)
   - Message ("이 책과의 여정을 완성하셨어요", text-primary, fontSize 18, weight 700, 중앙, lineHeight 1.4)
   - CompletedDate ("{completedAt 포맷} 완독", text-brand, Inter 13 weight 600)
2. **RecordsHeader** ("이 책에 남긴 감정 기록 {totalRecords}개", text-secondary, fontSize 13, weight 600)
3. **EmotionCurveChart 카드** (`bg-surface` fill, cornerRadius 16, padding 16) — REQ-COMP2-009 참조
4. **HighlightList 카드** (`bg-surface` fill, cornerRadius 16) — 001의 HighlightList를 카드 래퍼로 감싸 F09 정합

> **설계 근거 (001 vs 002 시각적 차이)**: 001의 `CompletionDiaryScreen`은 각 컴포넌트를 플랫하게 배치했다. F09는 CelebrationHeader를 `brand-50` 카드로 감싸고, EmotionCurveChart/HighlightList를 `bg-surface` 카드로 감싸 시각적 위계를 명확히 한다. 데이터 로직(001)은 그대로 두고 **래퍼/라벨/간격만 조정**한다.

#### REQ-COMP2-009: EmotionCurveChart 카드 컨트랙트

**WHEN** `report_data.emotion_curve`에 1개 이상의 포인트가 존재하면,
**THEN** 시스템은 EmotionCurveChart를 F09 카드 내에 렌더링해야 하며, 다음 컨트랙트를 준수해야 한다:
- **데이터 바인딩**: x축 = `page_number`, y축 = `emotion_count` (001 REQ-COMP-006 재사용)
- **단일 브랜드 컬러**: `brand-500` (#C17B2F, SPEC-UI-001 토큰) 단일 색상
- **카드 라벨**: "감정 곡선" (text-tertiary, 11, weight 600)
- **Peak 표시**: `emotion_count`가 최대인 포인트를 peak 표시(점/하이라이트)로 강조해야 한다

**WHERE** EmotionCurveChart 카드가 렌더링되면,
**THEN** 시스템은 카드 라벨 아래 캡션("페이지별 감정 기록 흐름", text-tertiary, fontSize 10)과 차트 영역(height 120, `bg-muted`, cornerRadius 8)을 포함해야 한다.

> **EmotionCurveChart 컨트랙트 결정 (미결정 사항 6.2 해결)**: `.pen` F09는 바(bar) 영역을 **플레이스홀더**로 표시한다(F09 `ChartZone`의 5개 rectangle + peak ellipse는 시각적 목업). 실제 구현은 001의 **순수 SVG 폴리라인/영역 차트**(page × emotion_count, 단일 brand-500)를 그대로 사용하되, F09 카드 래퍼(라벨 + 캡션 + 차트 영역)로 감싼다. Peak 표시는 최대 emotion_count 포인트에 점을 겹쳐 표시한다. `.pen`의 `cornerRadius 999`(pill badge)와 `strokeSides: ["top"]`(HighlightList 행 구분선)는 Pencil 스키마 기능으로, 구현 시 Pencil CLI(grep)로 실제 렌더링 동작을 검증해야 한다 — 본 SPEC은 시각적 의도만 명시하고, 구현 노트로 기록한다(블로커 아님).

#### REQ-COMP2-010: 상세 화면 빈 상태 (F09-Empty 정합)

**IF** `total_records = 0`이면 (감정 기록 0건),
**THEN** 시스템은 CelebrationHeader 카드(완독 자체는 축하)를 유지하되, EmotionCurveChart 카드와 HighlightList 카드를 생략하고 "기록된 감정이 없어요" 메시지를 표시해야 한다 (F09-Empty 정합, 001 REQ-COMP-005 시각적 정합).

> **설계 근거**: 완독 자체는 성취이므로 CelebrationHeader는 유지한다. 감정 기록이 없으면 차트/리스트 카드를 렌더링하지 않고 빈 상태 메시지로 대체한다. 001의 `empty` 상태 분기를 F09 카드 구조에 맞게 재배치한다.

#### REQ-COMP2-011: 상세 화면 뒤로 가기

**WHEN** 사용자가 상세 화면 헤더의 Back 버튼(chevron-left)을 탭하면,
**THEN** 시스템은 완독 다이어리 리스트 화면으로 돌아가야 한다 (또는 진입점이 리스트가 아닌 경우 이전 화면으로 `router.back()`).

> **설계 근거**: F08/F09 헤더 모두 Back chevron을 포함한다. 리스트 → 상세 → 리스트 탐색 흐름을 지원한다. SPEC-NAV-001 네비게이션 스택 패턴을 준수한다.

---

### REQ-COMP2-ENTRY: 진입점 연결 (REQ-COMP-002 이행)

**목적**: SPEC-COMPLETION-001의 REQ-COMP-002("완독 다이어리 진입점 제공") 계약을 이행하여, 사용자가 완독 다이어리에 도달할 수 있는 진입점을 연결한다.

#### REQ-COMP2-012: 마이 메뉴 진입점 연결

**WHEN** 사용자가 마이 탭의 "완독 다이어리" 메뉴 행(`app/(tabs)/my.tsx:539`, 현재 no-op + `@MX:TODO`)을 탭하면,
**THEN** 시스템은 완독 다이어리 리스트 라우트(`/completion`)로 이동해야 한다.

**WHERE** 마이 메뉴 진입점이 연결되면,
**THEN** 시스템은 기존 `@MX:TODO` 주석을 제거하고 네비게이션 핸들러를 구현해야 한다.

> **설계 근거**: `my.tsx:539`는 이미 "완독 다이어리" 라벨과 Heart 아이콘을 가진 Pressable 행으로 존재한다. 본 SPEC은 이 행의 `onPress`를 리스트 라우트로 연결하는 것만으로 001의 연기된 계약을 이행한다.

#### REQ-COMP2-013: 서재 completed 항목 진입점 (선택)

**WHERE** 서재 화면(SPEC-LIBRARY-001)에서 `status='completed'`인 항목이 표시되는 동안,
**THEN** 시스템은 해당 항목에 완독 다이어리 진입 액션(아이콘 버튼 또는 행 탭)을 노출하여, 탭 시 완독 다이어리 상세 라우트(`/completion/{bookId}`)로 이동하도록 해야 한다.

> **범위 메모**: 본 REQ는 서재 화면과의 협력(SPEC-LIBRARY-001)이 필요하다. 진입 액션의 정확한 UI(아이콘 종류, 행 내 배치)는 SPEC-LIBRARY-001의 서재 화면 설계와 협력하여 확정한다. 본 SPEC은 "서재 completed 항목에서 상세 다이어리로 진입 가능해야 한다"는 계약을 정의한다. 리스트 진입(REQ-COMP2-006)과 함께 2개의 상세 진입 경로를 제공한다.

---

### REQ-COMP2-STATE: 상태 관리 (SPEC-UI-002 FROZEN 준수)

**목적**: 리스트/상세 양 화면의 로딩/에러 상태를 SPEC-UI-002 FROZEN 화면 패턴에 맞춰 처리한다.

#### REQ-COMP2-014: 로딩 상태

**WHILE** 리스트 쿼리 또는 상세 리포트 조회가 진행 중인 동안,
**THEN** 시스템은 로딩 표시(스켈레톤 또는 ActivityIndicator)를 표시해야 하며, 헤더와 상태바 영역은 유지해야 한다 (SPEC-UI-002 REQ-SCREEN-STATE FROZEN).

> **설계 근거**: 001 상세 화면은 이미 로딩 상태를 구현했다. 리스트 화면도 동일한 패턴을 적용한다. SPEC-UI-002 FROZEN 상태 패턴(빈/로딩/에러)을 양 화면에서 일관되게 준수한다.

#### REQ-COMP2-015: 에러 상태

**IF** 리스트 쿼리 또는 상세 리포트 조회가 실패하면 (네트워크 에러, 재시도 초과, 인증 만료),
**THEN** 시스템은 에러 메시지와 재시도 버튼을 표시해야 한다.

**WHERE** 에러가 인증 만료(401)인 경우,
**THEN** 시스템은 001의 `auth` 상태 분기와 일관되게 로그인 라우트로 유도해야 한다.

> **설계 근거**: 001 상세 화면의 6상태 분기(error/data-error/auth)를 리스트 화면에도 대칭적으로 적용한다. 리스트 쿼리 에러는 NETWORK/AUTH 카테고리로 분류하며, VALIDATION(리스트 셰이프 불일치)은 데이터 오류 상태로 처리한다.

#### REQ-COMP2-016: 비경쟁 원칙 준수

**WHILE** 완독 다이어리 리스트/상세 화면이 표시되는 동안,
**THEN** 시스템은 타인과의 비교 지표(좋아요 수, 팔로워 수, 랭킹, 리더보드)를 표시하지 않아야 한다 (Design Constitution FROZEN Non-competition principle).

> **설계 근거**: 완독 다이어리는 개인 독서 여정의 아카이브이지 소셜 경쟁 도구가 아니다. "N권 완독" 요약(REQ-COMP2-004)은 개인 기록이며 허용되지만, 타인 지표는 constitution에 의해 금지된다.

---

## 4. 데이터 계약 (Data Contracts)

### 4.1 리스트 쿼리 데이터 셰이프 (REQ-COMP2-002)

완독 다이어리 리스트의 단일 항목 타입(`CompletionDiaryListItem`):

```typescript
interface CompletionDiaryListItem {
  userBookId: string;       // user_books.id (상세 라우트 bookId 변환용 keys)
  bookId: string;           // books.id (상세 라우트 파라미터)
  title: string;            // books.title
  author: string | null;    // books.author (nullable)
  coverUrl: string | null;  // books.cover_url (nullable — 플레이스홀더 사용)
  completedAt: string | null; // user_books.completed_at (ISO, nullable — 트리거 지연 대비)
  totalRecords: number;     // report_data.total_records (리포트 없으면 0)
  recentHighlight: string | null; // report_data.highlights[0]?.content ?? null
}
```

**PostgREST SELECT 계약** (구현 시 `fetchCompletionDiaryList`가 사용):

```
GET /rest/v1/user_books?status=eq.completed
  &select=id,book_id,completed_at,books(id,title,author,cover_url),
          completion_reports(report_data)
  &order=completed_at.desc
```

- `user_books.status=eq.completed` — 완독 항목 필터
- `books(...)` — 1:1 조인 (FK)
- `completion_reports(report_data)` — 1:1 LEFT 조인 (UNIQUE(user_book_id) 제약)
- `order=completed_at.desc` — 최근 완독 순
- RLS가 `auth.uid() = user_id`로 본인 항목만 자동 필터링

> **주의**: 본 SPEC은 마이그레이션을 포함하지 않는다. 위 SELECT는 기존 테이블/RLS/FK를 그대로 사용한다. `completion_reports` 조인이 PostgREST 리소스 임베딩으로 동작하는지는 구현 시 검증해야 한다(FK 관계가 설정되어 있어야 함 — `user_books.id ← completion_reports.user_book_id`).

### 4.2 ReportData 재사용 (SPEC-COMPLETION-001 위임)

상세 화면의 `report_data` 파싱은 001의 `ReportData` 인터페이스를 재사용한다 (재정의 안 함):

```typescript
// src/features/completion/types.ts (SPEC-COMPLETION-001)
interface ReportData {
  emotion_curve: Array<{ page_number: number; emotion_count: number }>;
  highlights: Array<{ page_number: number; content: string }>;
  total_records: number;
}
```

본 SPEC은 이 타입을 import하여 사용하며, 스키마 해석이나 타입 가드(`isReportData`)를 재구현하지 않는다.

---

## 5. 인덱스 (Indexes)

본 SPEC은 데이터베이스 스키마를 수정하지 않으므로 추가 인덱스가 없다. 리스트 쿼리에 사용되는 인덱스(`user_books(user_id, status)`, `completion_reports(user_book_id)` UNIQUE)는 SPEC-DB-001/SPEC-LIBRARY-001에서 이미 생성되어 있다.

---

## 6. 미결정 사항 (Open Questions)

### 6.1 F08-Empty CTA 대상 — 해결됨

**상태**: 해결됨 (서재 탭 읽는중으로 재지정)

**결정**: `EmptyState` 재사용 컴포넌트의 기본 "시작하기" CTA를 **서재 탭(읽는중 필터)으로 재지정**하고, 라벨을 "읽으러 가기"로 변경한다.

**근거**: "완독한 책이 아직 없어요" 상태에서 사용자의 자연스러운 다음 행동은 "현재 읽는중인 책을 계속 읽기" 또는 "새 책 시작"이다. 서재의 읽는중 목록이 두 행동 모두를 지원하는 가장 적합한 랜딩 지점이다. 기본 "시작하기"는 액션의 목적이 모호하고, CTA 숨김은 행동 유도성을 잃는다.

**옵션 (기록용)**:
- A. 서재 탭(읽는중)으로 재지정, 라벨 "읽으러 가기" — 채택
- B. CTA 숨김 — 기각 (행동 유도성 상실)
- C. 기본 "시작하기" 유지 — 기각 (목적 모호)

### 6.2 EmotionCurveChart 컨트랙트 — 해결됨

**상태**: 해결됨 (순수 SVG 폴리라인/영역 + Peak 점, F09 카드 래퍼)

**결정**: 001의 순수 SVG 감정 곡선(page × emotion_count, 단일 `brand-500`)을 F09 카드 래퍼(`bg-surface`, cornerRadius 16, 라벨 "감정 곡선" + 캡션)로 감싼다. Peak(emotion_count 최대 포인트)를 점으로 강조 표시한다. `.pen` F09의 바(bar) 영역은 시각적 목업이며, 실제 구현은 001의 폴리라인을 따른다.

**Pencil 스키마 구현 노트**: `.pen`의 `cornerRadius 999`(pill badge)와 `strokeSides: ["top"]`(HighlightList 행 구분선)은 Pencil 스키마 기능이다. 구현 시 Pencil CLI(grep)로 실제 렌더링 동작을 검증해야 한다. React Native에서 `strokeSides: ["top"]`은 `borderTopWidth`/`borderTopColor`로 매핑된다. 본 SPEC은 시각적 의도만 명시하며, 스키마 검증은 구현 단계에서 수행한다(블로커 아님).

### 6.3 DiaryCard 하이라이트 미리보기 선정 — 해결됨

**상태**: 해결됨 (가장 최근 highlights[0] 사용)

**결정**: DiaryCard의 하이라이트 미리보기는 `report_data.highlights[0].content`(가장 최근 감정 기록)를 사용한다. `numberOfLines=2`로 두 줄까지만 표시하고 말줄임표로 잘란다. `highlights`가 빈 배열(total_records=0)이면 미리보기 줄을 생략한다.

**근거**: `report_data.highlights`는 DB 트리거가 `ORDER BY created_at DESC LIMIT 5`로 정렬한다(SPEC-DB-001). 따라서 `highlights[0]`이 가장 최근 기록이며, "최근 남긴 하이라이트"라는 F08 카드 카피와 일치한다. 최고 감정(highest-emotion) 기준은 데이터에 감정 종류 필드가 없어(001 시정) 적용 불가능하다.

---

## 7. 제외 범위 (Exclusions)

본 SPEC은 다음을 포함하지 않는다:

1. **report_data 생성·집계 로직** — DB 트리거 PL/pgSQL이 단독 처리 (SPEC-DB-001 REQ-DB-010). 본 SPEC은 001과 동일하게 읽기 전용 소비자.
2. **ReportData 타입/파싱 로직 재정의** — 001의 `ReportData`, `isReportData()`, `fetchReport`, `useCompletionReport`를 재사용한다 (재정의 안 함).
3. **데이터베이스 마이그레이션** — 리스트 쿼리는 기존 `user_books`/`books`/`completion_reports` 테이블과 RLS/FK를 그대로 사용한다. 신규 테이블, 뷰, RPC는 포함하지 않는다.
4. **완독 처리 플로우 (status 전환 UI)** — `user_books.status: reading → completed` 전환은 SPEC-LIBRARY-001 영역이다.
5. **리치 콘텐츠 (이미지 카드, 자동 영상)** — 001과 동일하게 텍스트 + 차트 + 하이라이트 카드로 구성된 경량 다이어리로 한정.
6. **공유 기능** — 완독 다이어리(리스트/상세)를 외부(SNS, 메신저)로 공유하는 기능은 본 SPEC 범위 밖.
7. **인쇄/PDF 내보내기** — 본 SPEC 범위 밖.
8. **다이어리 자동 갱신** — 완독 후 추가 감정 기록이 발생해도 report_data는 자동 갱신되지 않는다 (스냅샷, 001 제외 범위 동일).
9. **서재 화면 자체 재설계** — REQ-COMP2-013은 서재 completed 항목에 진입 액션을 추가하는 계약만 정의하며, 서재 화면의 전반적 재설계는 SPEC-LIBRARY-001 영역이다.
10. **소셜/경쟁 기능** — 좋아요, 팔로워, 랭킹, 리더보드는 constitution Non-competition principle에 의해 금지되며 본 SPEC에서 도입하지 않는다.

---

## 8. 추적성 (Traceability)

| TAG | 요구사항 | 소스 |
|-----|---------|------|
| SPEC-COMPLETION-002 | REQ-COMP2-001 ~ REQ-COMP2-016 | `.moai/design/sagak.pen` (F08-CompletionDiaryList, F08-CompletionDiaryList-Empty, F09-CompletionDiaryDetail, F09-CompletionDiaryDetail-Empty, design commit 1300d6b), `.moai/specs/SPEC-COMPLETION-001/spec.md` (REQ-COMP-002 진입점 계약, ReportData 재사용), `app/(tabs)/my.tsx:539` (no-op 진입점), `.moai/specs/SPEC-LIBRARY-001/` (status='completed', getLibrary 패턴), `.claude/rules/moai/design/constitution.md` (Non-competition principle FROZEN) |

### 의존성 추적

| 의존 SPEC | 의존 내용 | 본 SPEC의 역할 |
|-----------|----------|---------------|
| SPEC-COMPLETION-001 | ReportData 타입, fetchReport, useCompletionReport, CompletionDiaryScreen 데이터 로직 | 재사용 (재정의 안 함) |
| SPEC-LIBRARY-001 | user_books.status='completed', getLibrary 패턴, 서재 진입점 협력 | completed 항목 소비, 서재 진입 액션 협력 |
| SPEC-UI-002 | FROZEN 화면 패턴 (3계층 레이아웃, 카드 밀도, 빈/로딩/에러 상태) | 양 화면 패턴 준수 |
| SPEC-NAV-001 | Expo Router 라우팅, 네비게이션 스택 | 리스트/상세 라우트 공존, bookId 파라미터 |
| SPEC-DB-001 | completion_reports 스키마, RLS, UNIQUE(user_book_id) | 읽기 전용 조인 소비자 |
| SPEC-BOOK-001 | books 테이블 (title, author, cover_url) | 책 메타데이터 소비 |

---

## 9. Implementation Notes

> 본 섹션은 구현(`\moai run`) 시점에 채워지는 참고 영역이다. 본 SPEC 작성 단계(1.0.0)에서는 설계 근거와 `.pen` 레퍼런스 매핑만 기록한다.

### 9.1 `.pen` 프레임 → REQ 매핑

| `.pen` 프레임 | 매핑 REQ |
|---------------|----------|
| `F08-CompletionDiaryList` | REQ-COMP2-001, 002, 003, 004, 006, 007 |
| `F08-CompletionDiaryList-Empty` | REQ-COMP2-005 |
| `F09-CompletionDiaryDetail` | REQ-COMP2-008, 009, 011 |
| `F09-CompletionDiaryDetail-Empty` | REQ-COMP2-010 |

### 9.2 Pencil 스키마 검증 필요 항목 (구현 시)

- `cornerRadius 999` (F09 Badge pill) → React Native `borderRadius: 999` 또는 `borderRadius: height/2`
- `strokeSides: ["top"]` (F09 HighlightList 행 구분선) → `borderTopWidth: 1`, `borderTopColor`
- `textGrowth: "fixed-width"` (F08/F09 텍스트) → `flexShrink: 1` 또는 고정 width

이 항목들은 Pencil CLI(grep/Edit)로 `.pen` 노드 JSON을 검증하며 구현한다. 본 SPEC은 시각적 의도만 명시한다.

### 9.3 001 코드 재사용 매핑

| 001 자산 | 002 재사용 방식 |
|----------|-----------------|
| `src/features/completion/types.ts` (ReportData, isReportData) | import하여 재사용 |
| `src/features/completion/completionApi.ts` (fetchReport) | 상세 화면에서 재사용 |
| `src/features/completion/useCompletionReport.ts` | 상세 화면에서 재사용 |
| `src/features/completion/CompletionDiaryScreen.tsx` | F09 정합을 위해 수정 (래퍼/라벨/간격 조정, 데이터 로직 유지) |
| `src/features/completion/EmotionCurveChart.tsx` | F09 카드 래퍼 추가를 위해 수정 (데이터 바인딩 유지) |
| `src/features/completion/HighlightList.tsx` | F09 카드 래퍼 추가를 위해 수정 (데이터 렌더링 유지) |
| `src/features/completion/CelebrationHeader.tsx` | F09 카드 정합을 위해 수정 (Cover/Badge/Date 추가) |
