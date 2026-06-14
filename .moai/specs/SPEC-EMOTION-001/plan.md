---
id: SPEC-EMOTION-001
title: "감정 아카이브 및 스티커 반응 — 구현 계획"
version: "1.0.0"
status: draft
created: 2026-06-14
updated: 2026-06-14
author: "강력쇠주먹"
priority: high
issue_number: 0
labels: [emotion, archive, sticker, plan, phase-2]
---

# SPEC-EMOTION-001: 구현 계획 (plan.md)

## HISTORY

| 날짜 | 버전 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 2026-06-14 | 1.0.0 | 최초 작성 — 마일스톤, 기술 접근, 리스크, 산출물 | 강력쇠주먹 |

---

## 1. 마일스톤 (우선순위 기반)

> 시간 추정은 TRUST 원칙에 따라 사용하지 않는다. 우선순위 라벨과 의존성 순서로 표현한다.

### Primary Goal — 감정 기록 CRUD + 스티커 반응 (핵심 가치)

| 순서 | 작업 | 우선순위 | 의존성 | 관련 REQ |
|------|------|----------|--------|----------|
| 1 | 감정 기록 입력 화면(`EmotionInputScreen`) + `emotionApi.create` | Priority High | SPEC-LIBRARY-001(책 컨텍스트), SPEC-UI-001(컴포넌트) | REQ-EMO-001 |
| 2 | 감정 기록 목록 조회 + 스포일러 필터 + 작성자 조인 + 스티커 집계 쿼리 | Priority High | #1 | REQ-EMO-002 |
| 3 | 감정 기록 수정/삭제 (`emotionApi.update`, `emotionApi.delete`) | Priority High | #1 | REQ-EMO-003, REQ-EMO-004 |
| 4 | 스티커 반응 등록/취소 (`stickerApi.create`, `stickerApi.delete`) + 409 처리 | Priority High | #2 | REQ-EMO-006, REQ-EMO-007 |
| 5 | 공개 범위 제어 UI (visibility 토글, club 선택) | Priority Medium | #1 | REQ-EMO-010 |

### Secondary Goal — 안전한 글쓰기 울타리 + 타임라인

| 순서 | 작업 | 우선순위 | 의존성 | 관련 REQ |
|------|------|----------|--------|----------|
| 6 | 단어 질문지 정적 풀 + 진도 기반 제안 로직 | Priority Medium | #1 | REQ-EMO-005 |
| 7 | 타임라인 뷰(`TimelineScreen`) + 페이지순/시간순 토글 | Priority Medium | #2 | REQ-EMO-009 |
| 8 | 스포일러 블러 연동(`EmotionRecordCard` blur prop) + 일시 해제 | Priority Medium | #2, SPEC-UI-001 | REQ-EMO-008 |

### Final Goal — 품질 게이트

| 순서 | 작업 | 우선순위 | 의존성 |
|------|------|----------|--------|
| 9 | Jest + @testing-library/react-native 테스트 (목업 API) | Priority High | #1-#8 |
| 10 | TRUST 5 품질 게이트 통과 (85%+ 커버리지, ESLint, tsc strict) | Priority High | #9 |

---

## 2. 기술 접근

### 2.1 아키텍처 개요

```
┌─────────────────────────────────────────────────────┐
│  Client (React Native + Expo)                       │
│  src/features/emotion/                              │
│    emotionApi.ts   ── PostgREST 래퍼 (records CRUD) │
│    stickerApi.ts   ── PostgREST 래퍼 (reactions)     │
│    EmotionInputScreen.tsx  ── 기록 입력 화면        │
│    TimelineScreen.tsx      ── 타임라인 화면         │
│    useEmotionRecords.ts    ── React Query 훅        │
│    useStickerReaction.ts   ── 스티커 반응 훅        │
│    questionPrompts.ts      ── 단어 질문지 정적 풀   │
└─────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│  Supabase (PostgREST + RLS)                         │
│  emotion_records (REQ-DB-004, RLS REQ-DB-016)       │
│  sticker_reactions (REQ-DB-005, RLS REQ-DB-017)     │
│  user_profiles 뷰 (닉네임/아바타 조인)              │
└─────────────────────────────────────────────────────┘
```

### 2.2 기술 스택 (tech.md 준수)

- **프레임워크**: React Native + Expo SDK 55, React 19.2, TypeScript strict
- **백엔드 클라이언트**: `@supabase/supabase-js` (SPEC-API-001이 제공하는 싱글톤)
- **상태 관리**: React Query (서버 상태 — 감정 기록 목록 캐싱, 낙관적 업데이트)
- **컴포넌트**: `EmotionRecordCard`(SPEC-UI-001 REQ-FE-024), `StickerReaction`(SPEC-UI-001 REQ-FE-025)
- **스타일링**: `StyleSheet.create` + `tokens.ts`(SPEC-UI-001)
- **테스트**: Jest + @testing-library/react-native
- **검증**: PostgREST 자동 스키마 검증, RLS 정책은 이미 SPEC-DB-001로 구현됨

### 2.3 핵심 설계 결정

#### 결정 1: PostgREST 직접 호출 (Edge Function 없음)

감정 기록과 스티커 반응은 모든 비즈니스 로직(권한, UNIQUE, CHECK)이 DB 계층에 있다. 따라서 클라이언트가 PostgREST를 직접 호출하고, 별도 Edge Function은 두지 않는다.

**이유**: RLS(REQ-DB-016/017), UNIQUE 제약, CHECK 제약이 이미 DB에 구현되어 있어 중복 로직이 불필요. Edge Function은 `service_role` 키 사용이 필요해 보안 면에서 불리.

#### 결정 2: 스티커 409 처리 — 업서트 미적용

`(record_id, user_id)` UNIQUE 위반 시 409를 그대로 클라이언트에 반환하고, 업서트(on conflict update)는 적용하지 않는다 (SPEC-DB-001 미결정 6.2 해결).

**클라이언트 처리 흐름**:
1. 스티커 등록 전 사전 조회(`sticker_reactions?record_id=eq.X&user_id=eq.me`)로 기존 반응 확인
2. 기존 반응 있으면 "이미 반응했습니다" 안내 + 취소(DELETE) 옵션 제공
3. 사전 조회 우회 시 409 발생 → 에러 메시지 변환

**이유**: 사용자가 의도치 않게 기존 스티커 종류를 덮어쓰는 것을 방지. 사용자가 명시적으로 취소 후 재등록하도록 유도.

#### 결정 3: 스티커 집계 — GROUP BY 실시간 산출

기록별 스티커 집계는 `sticker_reactions` GROUP BY 쿼리로 실시간 산출한다. 별도 집계 테이블(count cache)은 두지 않는다.

**이유**: MVP 트래픽에서는 GROUP BY 성능이 충분. 인덱스 `idx_sticker_reactions_record_id`(schema.md)가 조회를 지원. 확장 단계에서 트래픽 증가 시 카운트 캐시 도입 검토.

#### 결정 4: 스포일러 블러 — 클라이언트 계산

스포일러 여부(`page_number > user_books.current_page`)는 클라이언트에서 계산한다. 서버는 `current_page`를 기준으로 사전 필터링(`page_number lte current_page`)된 목록과, 필요 시 초과 행(블러 메타데이터와 함께)을 별도 응답으로 분리한다.

**이유**: RLS는 행 수준 격리만 수행하므로, 진도 기반 콘텐츠 필터링은 앱 계층 책임. `EmotionRecordCard`(SPEC-UI-001)의 blur prop에 `is_spoiler` 값을 전달하면 12px 블러가 활성화된다.

### 2.4 데이터 흐름

#### 감정 기록 생성 흐름

```
사용자 입력 → EmotionInputScreen
  → 검증(content 비어있지 않음, visibility=club 시 club_id 존재)
  → emotionApi.create({ book_id, page_number, content, visibility, club_id })
  → PostgREST POST /emotion_records (user_id 자동 주입)
  → RLS INSERT 정책(auth.uid() = user_id) 통과
  → DB CHECK(visibility=club → club_id NOT NULL) 통과
  → 201 Created + 생성된 행 반환
  → React Query 캐시 무효화 → 목록 새로고침
```

#### 스티커 409 흐름

```
사용자 스티커 탭 → stickerApi.create({ record_id, sticker_type })
  → PostgREST POST /sticker_reactions
  → RLS INSERT 정책(auth.uid() = user_id) 통과
  → UNIQUE(record_id, user_id) 위반 시도
  → 409 Conflict 반환
  → 클라이언트 에러 변환: "이미 반응한 기록입니다"
  → 사용자에게 취소(DELETE) 재시도 안내
```

---

## 3. 구현 산출물

| 파일 | 목적 | 우선순위 |
|------|------|----------|
| `src/features/emotion/emotionApi.ts` | PostgREST 래퍼 — `list(bookId, options)`, `create(input)`, `update(id, patch)`, `delete(id)` | Priority High |
| `src/features/emotion/stickerApi.ts` | PostgREST 래퍼 — `create(recordId, type)`, `delete(recordId)`, `listByRecord(recordId)`, `aggregateByRecord(recordId)` | Priority High |
| `src/features/emotion/useEmotionRecords.ts` | React Query 훅 — 목록 조회, 생성/수정/삭제 뮤테이션, 캐시 무효화 | Priority High |
| `src/features/emotion/useStickerReaction.ts` | 스티커 반응 훅 — 등록/취소, 409 에러 처리, 낙관적 업데이트 | Priority High |
| `src/features/emotion/questionPrompts.ts` | 단어 질문지 정적 풀(3~5개) + 진도 기반 제안 함수 | Priority Medium |
| `src/features/emotion/EmotionInputScreen.tsx` | 감정 기록 입력 화면 — 페이지 선택, content 입력, 질문지 제안, visibility 토글 | Priority High |
| `src/features/emotion/TimelineScreen.tsx` | 타임라인 화면 — `EmotionRecordCard` 목록, 정렬 토글, 스포일러 블러 | Priority Medium |
| `src/features/emotion/types.ts` | `EmotionRecord`, `StickerReaction`, `StickerType`, `Visibility` 타입 정의 (SPEC-UI-001 `src/types/EmotionRecord.ts`, `StickerType.ts` 확장) | Priority High |
| `src/features/emotion/__tests__/*.test.ts` | Jest 유닛/통합 테스트 | Priority High |

> SPEC-UI-001이 이미 `src/types/EmotionRecord.ts`, `src/types/StickerType.ts` 스켈레톤을 생성했다. 본 SPEC은 이를 API 응답 형태(작성자 조인, 스티커 집계 포함)로 확장한다.

---

## 4. 리스크 및 대응

### 리스크 1: SPEC-LIBRARY-001 미구현 의존성

**리스크**: 본 SPEC은 책 컨텍스트(`book_id`, `user_books.current_page`)와 서재 등록 검증에 의존하나, SPEC-LIBRARY-001이 아직 작성/구현되지 않았다.

**대응**: 구현 순서는 INDEX.md 의존성 그래프에 따라 SPEC-LIBRARY-001 완료 후 본 SPEC을 진행한다. 본 SPEC 작성 시점에는 인터페이스(`user_books.current_page` 읽기, 서재 등록 여부 확인)만 정의하고, 구현 시점에 SPEC-LIBRARY-001 산출물과 통합한다.

**영향도**: Medium — 인터페이스는 확정되어 있으므로 병렬 설계 가능.

### 리스크 2: 스티커 409 UX 마찰

**리스크**: 업서트 미적용 정책으로 인해, 사용자가 스티커 종류를 변경하려면 취소(DELETE) 후 재등록(POST) 2단계를 거쳐야 한다. 이는 UX 마찰을 유발할 수 있다.

**대응**: 클라이언트에서 "기존 반응 교체" 액션을 제공하여, 2단계를 하나의 사용자 동작으로 묶는다(내부적으로 DELETE → POST 순차 실행). 단, 네트워크 실패 시 일관성 복구 로직이 필요하다.

**영향도**: Low — MVP에서 허용 가능한 마찰.

### 리스크 3: 스포일러 블러 기준 데이터 일관성

**리스크**: `user_books.current_page`와 감정 기록 `page_number`의 일관성. 사용자가 진도를 업데이트하지 않은 상태에서 과거 기록을 조회하면 스포일러로 오탐될 수 있다.

**대응**: 기본 조회는 `page_number lte current_page` 필터로 안전한 행만 반환. 초과 행은 사용자가 명시적으로 "스포일러 포함 보기" 액션을 했을 때만 블러 메타데이터와 함께 반환. 진도 업데이트는 SPEC-LIBRARY-001 책임.

**영향도**: Medium — 진도 업데이트 지연 시 사용자 경험 저하 가능.

### 리스크 4: 단어 질문지 진도 매핑 미정

**리스크**: 미결정 5.1에서 질문 구체 문구와 진도 구간 매핑이 미정이다. 임시 정적 풀은 개인화 부족으로 사용자 참여도가 낮을 수 있다.

**대응**: MVP에서는 정적 풀(3~5개) 라운드 로빈으로 시작. 사용자 피드백(질문 클릭률, 기록 작성 전환율) 수집 후 v1.1.0에서 진도 구간 매핑 도입.

**영향도**: Low — 핵심 기능(기록 자체)은 질문지와 무관하게 동작.

### 리스크 5: RLS 정책 신뢰성

**리스크**: 본 SPEC은 RLS(REQ-DB-016/017)에 전적으로 의존한다. RLS 정책에 버그가 있으면 권한 누출로 이어진다.

**대응**: SPEC-DB-001이 이미 272개 pgTAP 테스트로 RLS를 검증했다. 본 SPEC 구현 시 클라이언트 테스트에서 권한 거부 시나리오(타인 기록 수정/삭제 시도)를 추가로 검증한다.

**영향도**: Low — 이미 검증된 RLS 정책.

---

## 5. 전문가 상담 권장

본 SPEC은 다음 도메인 전문가 상담을 권장한다:

### 5.1 expert-backend 상담 (권장)

**사유**: 감정 기록 CRUD, 스티커 반응 API 설계, PostgREST 쿼리 최적화, RLS 정책 검증.

**검토 항목**:
- `emotionApi.list`의 복합 쿼리(스포일러 필터 + 작성자 조인 + 스티커 집계) 성능
- 스티커 GROUP BY 집계의 인덱스 활용도
- 409 에러 응답 표준화(PostgREST 에러 코드 → 클라이언트 메시지 매핑)

### 5.2 expert-frontend 상담 (권장)

**사유**: `EmotionInputScreen`, `TimelineScreen` 화면 설계, `EmotionRecordCard`/`StickerReaction` 컴포넌트 소비, 스포일러 블러 UX.

**검토 항목**:
- 단어 질문지 UI 배치(입력 폼 상단 vs 사이드)
- 스포일러 블러 해제 인터랙션(탭 vs 롱프레스)
- 타임라인 정렬 토글 UX

### 5.3 design-uiux 상닩 (선택)

**사유**: 단어 질문지 문구 톤앤매너(pages_12 UX 라이팅 가이드 준수), 스포일러 안내 문구.

---

## 6. 품질 게이트 (TRUST 5)

| 항목 | 기준 | 검증 도구 |
|------|------|-----------|
| Tested | 85%+ 커버리지, 권한 거부 시나리오 포함 | Jest + @testing-library/react-native |
| Readable | 한국어 주석(SPEC-UI-001 패턴), 명확한 함수명 | ESLint, 코드 리뷰 |
| Unified | tokens.ts 사용, StyleSheet.create 패턴 | Prettier, ESLint |
| Secured | RLS 의존 검증, service_role 미사용 | 보안 리뷰, RLS pgTAP (SPEC-DB-001) |
| Trackable | conventional commits, SPEC-ID 참조 | Git 훅, 커밋 메시지 검사 |

---

## 7. 다음 단계

1. **사용자 승인**: 본 SPEC 문서(spec.md, plan.md, acceptance.md) 검토 및 승인
2. **SPEC-LIBRARY-001 선행 완료**: 책 컨텍스트 인터페이스 확정
3. **`/moai:2-run SPEC-EMOTION-001`** 실행: TDD(RED-GREEN-REFACTOR) 사이클로 구현
4. **`/moai:3-sync SPEC-EMOTION-001`** 실행: API 문서, CHANGELOG 동기화
