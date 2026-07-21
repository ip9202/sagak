---
# NOTE: `created` is the canonical field name per MoAI plan workflow Phase 2
id: SPEC-COMPLETION-002
title: "완독 다이어리 아카이브(리스트) + 상세 재설계 — Deep Research"
spec: SPEC-COMPLETION-002
version: "1.0.0"
status: draft
created: 2026-06-27
updated: 2026-06-27
author: "강력쇠주먹"
priority: medium
issue_number: 0
labels: [completion, diary, archive, list, redesign, frontend, pencil, research]
---

# SPEC-COMPLETION-002 심층 연구 (Deep Research)

> 본 문서는 SPEC-COMPLETION-002 작성을 위한 심층 코드베이스/설계 분석 결과를 기록한다.
> spec.md의 근거를 제공하며, 구현(`\moai run`) 시점에 참조된다.

---

## 1. 설계 레퍼런스 분석 (`.pen` F08/F09)

### 1.1 F08-CompletionDiaryList (라인 3562)

**구조**: 3계층 레이아웃 (SPEC-UI-002 FROZEN)
- StatusBar (ref `k9pvZQ`)
- Header: padding [8,12,0,20], space_between, alignItems center
  - Left-Back: chevron-left(24×24, text-primary) + Title "완독 다이어리"(Noto Sans KR, 22, 700)
  - Right: 빈 24×24 프레임
- Content: vertical, gap 20, padding [8,20,20,20]
  - **SummaryStat**: gap 6, alignItems center
    - "지금까지 12권 완독" (text-secondary, Noto Sans KR, 13, 500)
  - **DiaryList**: vertical, gap 12
    - **DiaryCard-0**: bg-surface, cornerRadius 16, padding 16, gap 12, alignItems center
      - Cover: rectangle, cornerRadius 6, brand-200, 60×84
      - Info (vertical, gap 6):
        - BookTitle: text-primary, 15, 600, fixed-width fill ("책 제목 한 줄 예시")
        - Meta (gap 8, alignItems center):
          - CompletedDate: "완독 2026.06.20" (text-tertiary, Inter, 11, 500)
          - Records: "기록 12개" (text-tertiary, Inter, 11, 500)
        - Highlight: text-secondary, 13, lineHeight 1.5, fixed-width fill ("최근 남긴 하이라이트 내용이 한두 줄로 미리 보여요.")
      - Chevron: chevron-right, 20×20, text-tertiary
    - **DiaryCard-1**: 동일 구조, 다른 콘텐츠 ("또 다른 책 제목 예시", "완독 2026.05.30", "기록 8개", "가장 인상 깊었던 문장이 미리 보기로 표시됩니다.")

**추출된 REQ**: 라우트(REQ-COMP2-001), 쿼리(002), DiaryCard(003), 요약(004), 네비게이션(006), 새로고침(007)

### 1.2 F08-CompletionDiaryList-Empty (라인 3874)

**구조**: F08과 동일 Header, Content는 중앙 정렬
- Content: justifyContent center, alignItems center
  - **EmptyState** (ref `pxhqO`, descendants override):
    - fVx3B(Icon): "sparkles" (기본 "book-open"에서 오버라이드)
    - mQkwC(Title): "완독한 책이 아직 없어요"
    - PV7VN(Sub): "첫 책을 끝까지 읽어보세요"
    - **CTA 미오버라이드**: EmptyState ref의 기본 CTA(Aqc0a → "시작하기")가 descendants에서 오버라이드되지 않음 → 미결정 사항 6.1 트리거

**EmptyState ref 분석** (라인 1777): reusable=true, 326×240, padding [40,20]
- Icon(48×48), Title(16, 600), Sub(13, lineHeight 1.5), CTA(ref fMvNU, "시작하기")

**추출된 REQ**: 빈 상태(REQ-COMP2-005) + CTA 재지정 결정(6.1)

### 1.3 F09-CompletionDiaryDetail (라인 3983)

**구조**: 3계층, Content vertical gap 24
- Header: F08과 동일 (back + "완독 다이어리" title)
- Content:
  1. **CelebrationHeader 카드**: brand-50, cornerRadius 16, padding [20,16], vertical gap 10, alignItems center
     - Cover: rectangle 72×100, cornerRadius 6, brand-200
     - Badge: frame, brand-500, **cornerRadius 999 (pill)**, padding [4,12], "완독"(text-inverse, 13, 700)
     - Message: "이 책과의 여정을 완성하셨어요"(text-primary, 18, 700, center, lineHeight 1.4)
     - CompletedDate: "2026.06.20 완독"(text-brand, Inter, 13, 600)
  2. **RecordsHeader**: "이 책에 남긴 감정 기록 12개"(text-secondary, 13, 600)
  3. **EmotionCurveChart 카드**: bg-surface, cornerRadius 16, padding 16, vertical gap 8
     - ChartLabel: "감정 곡선"(text-tertiary, 11, 600)
     - ChartCaption: "SVG 감정 곡선 영역 (page × emotion_count)"(text-tertiary, 10)
     - ChartZone: bg-muted, cornerRadius 8, padding [12,8], alignItems end, height 120
       - Bar-0~4: rectangle width 18, varying heights (36/58/84/64/42), brand-300/400/500/400/300
       - Peak: ellipse brand-500 10×10
  4. **HighlightList 카드**: bg-surface, cornerRadius 16, vertical
     - SectionLabel: padding [16,16,8,16], "하이라이트"(text-secondary, 13, 600)
     - Row-0~2: gap 10, padding [12,16], **stroke border-default, strokeWidth 1, strokeSides ["top"]**
       - PageBadge: brand-50, cornerRadius 6, padding [2,6], "p.42"(text-brand, Inter, 11, 600)
       - Body: text-primary, 14, lineHeight 1.6, fixed-width fill

**001 대비 시각적 차이점** (재설계 대상):
- 001 CelebrationHeader: 정적 배지+메시지 (카드 아님) → F09: brand-50 카드 + Cover/Badge/Date 포함
- 001 EmotionCurveChart: 플랫 SVG → F09: bg-surface 카드 + 라벨/캡션/차트영역
- 001 HighlightList: 플랫 리스트 → F09: bg-surface 카드 + SectionLabel + 행 strokeSides top
- 001 RecordsHeader 형식: "이 책에서 남긴 감정 N개" → F09: "이 책에 남긴 감정 기록 N개"

**추출된 REQ**: F09 정합(REQ-COMP2-008, 009), 빈 상태(010), 뒤로 가기(011)

### 1.4 F09-CompletionDiaryDetail-Empty (라인 4476)

**구조**: F09과 동일 Header + CelebrationHeader, 이후 차트/리스트 카드 없이 빈 상태 메시지 예상 (라인 4595 이후 CelebrationHeader 동일 구조 확인)

**추출된 REQ**: 상세 빈 상태(REQ-COMP2-010) — CelebrationHeader 유지, 차트/리스트 생략

---

## 2. 기존 코드베이스 분석

### 2.1 SPEC-COMPLETION-001 자산 (재사용 대상)

**`src/features/completion/types.ts`** (94라인):
- `EmotionCurvePoint`({page_number, emotion_count}), `Highlight`({page_number, content}), `ReportData`({emotion_curve, highlights, total_records})
- 순수 타입 가드 `isReportData()`: emotion_curve/highlights 배열 검증, total_records number 검증
- 빈 상태(total_records=0 + 빈 배열)도 유효 스키마로 통과 (빈 상태 ≠ 데이터 오류)
- **재사용 방식**: 본 SPEC은 import하여 재사용. 재정의 없음.

**`src/features/completion/completionApi.ts`** (139라인):
- `fetchReport(userBookId)`: PostgREST GET, 재시도 최대 3회(점진 백오프), RLS 신뢰(user_id 미전송)
- VALIDATION/AUTH 즉시 throw, NETWORK/빈 응답 재시도
- **재사용 방식**: 상세 화면에서 그대로 호출.

**`src/features/completion/useCompletionReport.ts`**:
- 6상태 분기: loading/success/empty/error/data-error/auth
- **재사용 방식**: 상세 화면 데이터 로직 유지.

**`src/features/completion/CompletionDiaryScreen.tsx`** (159라인):
- 현재: CelebrationHeader + totalHeader("이 책에서 남긴 감정 N개") + EmotionCurveChart + HighlightList 플랫 배치
- **수정 필요**: F09 카드 래퍼 추가, RecordsHeader 라벨 변경, gap 24 배치. 데이터 로직 유지.

**`src/features/completion/EmotionCurveChart.tsx`**:
- 순수 SVG, 단일 brand-500, page × emotion_count
- **수정 필요**: F09 카드 래퍼(라벨/캡션/차트영역) 추가, peak 점 추가. 데이터 바인딩 유지.

**`src/features/completion/HighlightList.tsx`**:
- FlatList 하이라이트
- **수정 필요**: F09 카드 래퍼(SectionLabel + 행 strokeSides top 매핑). 데이터 렌더링 유지.

**`src/features/completion/CelebrationHeader.tsx`**:
- 정적 배지 + 축하 메시지
- **수정 필요**: F09 카드(brand-50) + Cover + 완독 Badge(pill) + CompletedDate 추가. bookId/book 메타데이터 props 수신 필요.

### 2.2 라우팅 현황

**`app/(tabs)/completion/[bookId].tsx`** (93라인):
- bookId → useLibraryItem → userBookId 변환
- useSession 인증 가드
- StatusBar + ScrollView + CompletionDiaryScreen
- **본 SPEC**: `index.tsx`(리스트) 추가로 공존. `[bookId].tsx`는 F09 헤더 Back 연결만 수정.

**`app/(tabs)/my.tsx:539`**:
- "완독 다이어리" Pressable 행 존재 (Heart 아이콘 + 라벨 + ChevronRight)
- `onPress` no-op + `@MX:TODO: [AUTO] 완독 다이어리 리스트 라우트 미구현`
- **본 SPEC**: `onPress`에 `router.push('/completion')` 구현, `@MX:TODO` 제거.

### 2.3 서재 데이터 계약 (리스트 쿼리 참고)

**`src/features/library/libraryApi.ts`**:
- `getLibrary(filter)`: user_books SELECT `*, books(id,title,author,cover_url,total_pages)`, status 필터, last_progress_at DESC 정렬
- LIBRARY_SELECT = `'*, books(id,title,author,cover_url,total_pages)'`
- **참고점**: 본 SPEC의 리스트 쿼리는 completion_reports 조인이 추가로 필요하므로 getLibrary를 직접 재사용 불가. 단, SELECT 패턴/정렬/RLS 신뢰 정책은 참고한다.

**`src/features/library/types.ts`**:
- `ReadingStatus` = 'reading' | 'completed' | 'shelved'
- `LibraryItem` = UserBookRow + 중첩 books
- `UserBookRow` = Database['public']['Tables']['user_books']['Row']
- **참고점**: completed_at 필드는 user_books Row에 포함 (gen-types 기반).

**`src/features/library/useLibraryItem.ts`**: bookId/userId → user_books.id(userBookId) 변환. 상세 라우트가 재사용.

### 2.4 EmptyState 컴포넌트 현황

- `.pen` ref `pxhqO` (라인 1777): reusable EmptyState (Icon + Title + Sub + CTA)
- **앱 구현 검색**: `grep -rn "EmptyState" src/` → `src/features/club/trackB/components/ClubsScreen.tsx`에서 사용
- **재사용 가능성**: EmptyState가 이미 앱에 구현되어 있으면 F08-Empty에서 재사용. 구현되어 있지 않으면 F08-Empty 전용 빈 상태를 리스트 화면에 직접 구현. 구현 시점에 `src/components/` 또는 `src/features/club/` 패턴을 확인하여 일관성 유지.

---

## 3. 미결정 사항 해결 근거

### 3.1 미결정 6.1 — F08-Empty CTA 대상

**분석**:
- `.pen` F08-Empty에서 EmptyState ref의 CTA가 descendants 오버라이드에 포함되지 않음 → 기본 "시작하기"가 표시됨 (Pencil 동작)
- 하지만 "시작하기"는 완독 다이어리 빈 상태에서 목적이 모호함
- 옵션 분석:
  - A. 서재 탭(읽는중) 재지정, 라벨 "읽으러 가기" — 자연스러운 다음 행동, 행동 유도성 유지
  - B. CTA 숨김 — 행동 유도성 상실, 사용자가 다음 단계를 모름
  - C. 기본 "시작하기" 유지 — 목적 모호, 클릭 후 어디로 가는지 불명확

**결정**: A 채택. "완독한 책이 아직 없어요" → "첫 책을 끝까지 읽어보세요" 메시지와 "읽으러 가기" CTA의 시너지가 자연스럽다. 서재 탭의 읽는중 목록이 현재 읽는 책을 계속 읽거나 새 책을 시작하는 랜딩 지점으로 최적.

### 3.2 미결정 6.2 — EmotionCurveChart 컨트랙트

**분석**:
- `.pen` F09 ChartZone: 5개 rectangle(bar) + peak ellipse → 시각적 목업
- 001 EmotionCurveChart: 순수 SVG 폴리라인, page × emotion_count, 단일 brand-500
- 001의 REQ-COMP-006 시정(2026-06-17): 감정 종류 필드 없음, 단일 브랜드 컬러
- **데이터 관점**: 바 차트와 폴리라인 모두 page × emotion_count 시각화 가능. 001이 폴리라인을 이미 구현했으므로 재사용이 비용 최소.

**결정**: 001 폴리라인 재사용 + F09 카드 래퍼(라벨 "감정 곡선" + 캡션 + 차트 영역 height 120) + peak 점(emotion_count 최대 포인트). `.pen` 바는 시각적 목업이므로 구현에 반영하지 않음.

**Pencil 스키마 노트**:
- `cornerRadius 999` (Badge pill): RN `borderRadius: 999` 또는 height/2 — 구현 시 검증
- `strokeSides: ["top"]` (HighlightList 행): RN `borderTopWidth: 1, borderTopColor` — 구현 시 검증
- `textGrowth: "fixed-width"`: RN `flexShrink: 1` 또는 고정 width — 구현 시 검증

이 스키마 기능들은 본 SPEC이 시각적 의도를 명시했으며, 구현 시 Pencil CLI grep으로 노드 JSON 검증 후 RN 스타일 매핑. 블로커 아님.

### 3.3 미결정 6.3 — DiaryCard 하이라이트 선정

**분석**:
- `.pen` F08 DiaryCard Highlight: "최근 남긴 하이라이트 내용이 한두 줄로 미리 보여요" / "가장 인상 깊었던 문장이 미리 보기로 표시됩니다" → 카피가 혼재 (최근성 vs 인상도)
- `report_data.highlights` 스키마: DB 트리거 `ORDER BY created_at DESC LIMIT 5` (SPEC-DB-001) → highlights[0] = 가장 최근
- 감정 종류 필드 없음(001 시정) → "highest-emotion" 기준은 데이터 부족으로 적용 불가
- **가장 최근(highlights[0])** 기준이 데이터 근거와 F08 카피 "최근 남긴 하이라이트"에 부합

**결정**: highlights[0].content 사용, numberOfLines=2 말줄임. highlights 빈 배열(total_records=0)이면 미리보기 줄 생략. 근거: DB 정렬 보장 + F08 카피 정합 + 데이터 필드 제약.

---

## 4. 리스트 쿼리 데이터 계약 도출

### 4.1 필요 데이터

리스트 DiaryCard 렌더링에 필요:
- Cover: books.cover_url (nullable → brand-200 플레이스홀더)
- BookTitle: books.title
- CompletedDate: user_books.completed_at
- Records: completion_reports.report_data.total_records
- Highlight 미리보기: completion_reports.report_data.highlights[0].content
- bookId: books.id (상세 라우트 파라미터용)

### 4.2 PostgREST 조인 쿼리 설계

```
GET /rest/v1/user_books
  ?status=eq.completed
  &select=id,book_id,completed_at,
          books(id,title,author,cover_url),
          completion_reports(report_data)
  &order=completed_at.desc
```

**전제 조건**:
- `user_books.book_id → books.id` FK 존재 (SPEC-BOOK-001, 확인됨)
- `completion_reports.user_book_id → user_books.id` FK 존재 여부 **검증 필요** (리스크 1)
- RLS: user_books(auth.uid()=user_id), completion_reports(auth.uid()=user_id) — 둘 다 본인 행만

### 4.3 CompletionDiaryListItem 파싱

```typescript
interface CompletionDiaryListItem {
  userBookId: string;        // user_books.id
  bookId: string;            // books.id
  title: string;             // books.title
  author: string | null;     // books.author
  coverUrl: string | null;   // books.cover_url
  completedAt: string | null; // user_books.completed_at (ISO)
  totalRecords: number;      // report_data.total_records (리포트 없으면 0)
  recentHighlight: string | null; // report_data.highlights[0]?.content ?? null
}
```

파싱 로직:
- PostgREST 응답의 중첩 `books`/`completion_reports`를 평탄화
- `report_data`가 null(리포트 없음)이면 totalRecords=0, recentHighlight=null 폴백
- `report_data.highlights`가 빈 배열이면 recentHighlight=null
- 001의 `isReportData()`를 활용하여 report_data 스키마 검증 (불일치 시 VALIDATION 에러 또는 totalRecords=0 폴백 — 구현 시 결정)

### 4.4 대안 (FK 없을 시)

`completion_reports.user_book_id → user_books.id` FK가 없으면 PostgREST 조인이 동작하지 않음. 대안:
1. 2단계 쿼리: getLibrary(status='completed') → 각 userBookId로 fetchReport 배치 (N+1 문제)
2. RPC 함수 생성 (마이그레이션 필요 — 본 SPEC 범위 밖)
3. FK 추가 마이그레이션 (SPEC-DB-001 협력 — 본 SPEC 범위 밖)

**권장**: 구현 시작 시 FK 존재 여부 확인. 있으면 조인 쿼리(REQ-COMP2-002). 없으면 사용자에게 에스컬레이션하여 FK 추가 또는 대안 선택.

---

## 5. COMPLETION-001 vs COMPLETION-002 경계 검증

| 항목 | 001 (PR #14) | 002 (본 SPEC) | 중복 여부 |
|------|--------------|---------------|-----------|
| ReportData 타입 | 정의 | import 재사용 | 없음 |
| isReportData() | 구현 | 재사용 | 없음 |
| fetchReport | 구현 | 재사용 | 없음 |
| useCompletionReport | 구현 | 재사용 | 없음 |
| 상세 6상태 분기 | 구현 | 유지 | 없음 |
| 상세 시각화 | 1차 구현 | F09 정합(래퍼/라벨) | 시각적 확장, 로직 중복 없음 |
| 리스트 화면 | 미구현 | 신규 도입 | 없음 |
| 진입점(REQ-COMP-002) | 계약만 정의 | 이행 | 없음 (001 계약 이행) |
| 리스트 쿼리 | 미구현 | 신규 | 없음 |

**결론**: 경계 명확. 001 데이터 계약을 재사용하며 시각적/탐색적 확장만 담당. 중복 구현 없음.

---

## 6. SPEC-UI-002 FROZEN 패턴 준수 검증

SPEC-UI-002 FROZEN 화면 패턴 (Design Constitution v3.4):
- 3계층 레이아웃 (StatusBar → Header → Content) — F08/F09 모두 준수
- 타이틀 균일성 (fontSize 22, weight 700) — F08/F09 Header "완독 다이어리" 준수
- 카드 밀도 (cornerRadius 16, padding 16-20) — DiaryCard(cornerRadius 16, padding 16), F09 카드들 준수
- 빈/로딩/에러 상태 패턴 — REQ-COMP2-005(빈), 014(로딩), 015(에러) 준수
- 캡슐형 4탭 — 본 SPEC은 탭 영역 수정 안 함 (준수 불필요, 영향 없음)
- 토큰 전용 스타일링 (`src/theme/tokens.ts` 변수만) — F08/F09 모두 `$` 토큰 사용, 하드코딩 없음

**검증 결과**: 본 SPEC은 SPEC-UI-002 FROZEN 패턴을 준수한다. 구현 시 토큰 전용 스타일링을 엄수한다.

---

## 7. 비경쟁 원칙 검증

Design Constitution FROZEN Non-competition principle:
- 좋아요 수, 팔로워, 랭킹 표시 금지 (과시 엔진 회피)

**본 SPEC 검증**:
- "지금까지 N권 완독" 요약(REQ-COMP2-004) — 개인 여정 기록, 타인 비교 아님 → 허용
- DiaryCard — 타인 지표 없음 (본인 completed 항목만) → 준수
- 상세 화면 — 타인 지표 없음 → 준수
- REQ-COMP2-016으로 명시적 금지 선언

**결론**: 본 SPEC은 비경쟁 원칙을 준수한다.
