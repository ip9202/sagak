---
id: SPEC-EMOTION-001
title: "감정 아카이브 및 스티커 반응"
version: "1.0.0"
status: completed
created: 2026-06-14
updated: 2026-06-17
author: "강력쇠주먹"
priority: high
issue_number: 0
labels: [emotion, archive, sticker, rls, supabase, phase-2]
---

# SPEC-EMOTION-001: 감정 아카이브 및 스티커 반응

## HISTORY

| 날짜 | 버전 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 2026-06-14 | 1.0.0 | 최초 작성 — 페이지별 감정 기록 CRUD, 단어 질문지 유도, 스티커 반응 3종(409 정책), 스포일러 블러, 타임라인, 공개 범위 제어. SPEC-DB-001 REQ-DB-004/005/016/017, SPEC-UI-001 REQ-FE-024/025 연동 | 강력쇠주먹 |

---

## 1. 환경 (Environment)

- **백엔드**: Supabase (관리형 PostgreSQL + PostgREST + Realtime)
- **데이터 엔터티**:
  - `emotion_records` (SPEC-DB-001 REQ-DB-004) — 페이지별 감정 기록. 컬럼: `id`, `user_id`, `book_id`, `page_number(NOT NULL)`, `content(NOT NULL)`, `visibility(ENUM public/club, default public)`, `club_id(nullable, NOT NULL when visibility=club)`, `created_at`, `updated_at`
  - `sticker_reactions` (SPEC-DB-001 REQ-DB-005) — 공감 스티커 반응. 컬럼: `id`, `record_id`, `user_id`, `sticker_type(ENUM empathy/touching/comforted, NOT NULL)`, `created_at`
- **ENUM 타입**:
  - `visibility`: `'public'`, `'club'` (PostgREST CHECK 제약)
  - `sticker_type`: `'empathy'`(완전히 공감해요), `'touching'`(마음이 찡해지네요), `'comforted'`(덕분에 위로받았어요) — SPEC-DB-001 ERD 편차 메모: text에서 전용 ENUM으로 상향 정의
- **제약**:
  - `emotion_records`: CHECK `visibility='club' → club_id NOT NULL`
  - `sticker_reactions`: UNIQUE `(record_id, user_id)` — 기록당 사용자당 1개만 허용
- **RLS 정책** (이미 SPEC-DB-001로 구현됨):
  - `emotion_records` (REQ-DB-016): 읽기 = 본인 OR `visibility='public'` OR (`visibility='club'` AND 모임 멤버). 쓰기 = `auth.uid() = user_id`만
  - `sticker_reactions` (REQ-DB-017): 읽기 = 전체 공개(`USING (true)`). 쓰기 = `auth.uid() = user_id`만
- **API 서피스** (structure.md "Records CRUD+sticker"):
  - `GET /records/{book_id}` — 특정 책의 감정 기록 목록 (스포일러 필터, 작성자 조인, 스티커 집계)
  - `POST /records` — 새 감정 기록 추가
  - `PUT /records/{record_id}` — 기록 수정 (본인만)
  - `DELETE /records/{record_id}` — 기록 삭제 (본인만)
  - `POST /records/{record_id}/reactions` — 스티커 반응 등록
  - `DELETE /records/{record_id}/reactions` — 스티커 반응 취소 (본인만)
- **의존성**:
  - **SPEC-LIBRARY-001** (선행): 책 컨텍스트(`book_id`, `current_page`) 및 진도 상태. 본 SPEC은 서재에 등록된 책에 한해 감정 기록을 허용
  - **SPEC-UI-001** (선행): `EmotionRecordCard`(REQ-FE-024 — 아바타+닉네임+페이지+본문+스티커+스포일러 블러 12px), `StickerReaction`(REQ-FE-025 — 3종 스티커) 컴포넌트 소비
- **플랫폼**: React Native + Expo SDK 55 (TypeScript strict). 클라이언트는 PostgREST 직접 호출, `service_role` 키 사용 금지
- **참조 SSOT**:
  - `.booktalk/pages_03_기능명세서.md` §2 (페이지 기반 감정 기록 및 공감 리액션), §3 (스포일러 방지 진도별 감정 피드)
  - `.booktalk/pages_08_API명세서.md` §5 (감정 기록 API), §6 (스티커 리액션 API)
  - `.moai/project/product.md` 핵심 기능 "감정 아카이브", 사용 시나리오 2 "감정 공유", 가치 제안 "안전한 글쓰기 울타리"
  - `.moai/project/db/schema.md` (emotion_records, sticker_reactions)

---

## 2. 가정 (Assumptions)

### 2.1 아키텍처 가정

1. **visibility 제약 위임**: `visibility='club'`일 때 `club_id NOT NULL` 검증은 DB CHECK 제약(SPEC-DB-001 REQ-DB-004)이 보장한다. 클라이언트는 CHECK 위반 시 PostgREST 에러(400/23514)를 사용자 친화적 메시지로 변환한다.
2. **스티커 UNIQUE 정책**: `(record_id, user_id)` UNIQUE 위반 시 DB가 409 Conflict를 반환한다. 클라이언트는 **업서트(on conflict update)를 적용하지 않는다** (SPEC-DB-001 미결정 6.2 해결). 대신 기존 반응이 있으면 클라이언트에서 사전 조회 후 "이미 반응한 기록입니다" 안내하고, 취소(DELETE) 후 재등록으로 유도한다.
3. **자기 반응 허용**: MVP에서 자기 자신의 기록에 스티커를 붙이는 것을 허용한다 (ERD 제약과 일치, SPEC-DB-001 비즈니스 가정 2.2.4). 이는 자기 감정 기록에 대한 메모 용도로 열어둔다.
4. **RLS에 의존**: 모든 읽기/쓰기 권한 검증은 DB RLS(REQ-DB-016/017)가 단독 수행한다. 클라이언트나 Edge Function은 권한 로직을 중복 구현하지 않는다.
5. **작성자 식별**: `user_id`는 클라이언트가 전송하지 않고, PostgREST가 `auth.uid()`에서 자동 주입하는 것을 전제한다. 단, `auth.uid()` 자동 주입은 컬럼 생략 시에만 동작하므로, 클라이언트 요청 본문에서 `user_id` 필드를 생략해야 한다.

### 2.2 비즈니스 가정

1. **단어/한 줄 범위**: 감정 기록 `content`는 단어 또는 한 줄(긴 독후감이 아닌 초미니 기록)을 전제한다. 클라이언트에서 길이 상한(예: 120자)을 적용하되, DB 컬럼은 `text`로 넉넉히 유지한다 (DB는 길이를 강제하지 않음).
2. **안전한 글쓰기 울타리**: 단어 질문지는 사용자 진도(현재 페이지 근처)에 맞춘 1~2개의 짧은 질문을 제안한다. 이는 강제가 아닌 **유도 프롬프트**이며, 사용자가 자유 입력을 선택할 수 있다 (pages_03 §2.2).
3. **스포일러 블러 기준**: 피드 조회 시 `page_number > current_page`(사용자 진도)인 기록은 블러 처리한다. 기준 `current_page`는 `user_books.current_page`(SPEC-LIBRARY-001)를 사용한다.
4. **공개 범위 기본값**: `visibility` 기본값은 `'public'`이다. `club`으로 설정 시 `club_id`가 필수이며, 해당 모임의 멤버만 읽을 수 있다 (RLS 정책).
5. **스티커 집계**: 기록별 스티커 집계는 `sticker_reactions` 테이블 GROUP BY 쿼리로 실시간 산출한다. 별도 집계 테이블을 두지 않는다 (MVP 단순화).
6. **타임라인 정렬**: 타임라인은 페이지순(`page_number ASC`) 또는 시간순(`created_at DESC`) 토글을 제공한다. 기본값은 시간순이다.

---

## 3. 요구사항 (Requirements)

> 본 SPEC은 4개 요구사항 모듈로 구성된다: REQ-EMO-RECORD, REQ-EMO-GUIDE, REQ-EMO-STICKER, REQ-EMO-SPOILER.

### REQ-EMO-RECORD: 감정 기록 CRUD (페이지별 단어/한 줄)

**목적**: 사용자가 읽는 순간의 감정을 페이지별로 기록·조회·수정·삭제할 수 있게 한다. 제품의 핵심 가치인 "감정 아카이브"의 데이터 생성 계층.

#### REQ-EMO-001: 감정 기록 생성

**WHEN** 인증된 사용자가 서재에 등록된 책(`user_books` 행 존재)에 대해 감정 기록 작성을 요청하면,
**THEN** 시스템은 `emotion_records`에 새 행을 INSERT해야 한다. 행은 `user_id`(auth.uid 자동 주입), `book_id`, `page_number(NOT NULL)`, `content(NOT NULL, 공백 불가)`, `visibility(default 'public')`, `club_id(visibility='club' 시 필수)`를 포함한다.

**IF** 요청의 `visibility='club'`이고 `club_id`가 누락되거나 사용자가 해당 모임의 멤버가 아니면,
**THEN** 시스템은 DB CHECK 제약 또는 RLS 정책에 의해 INSERT를 거부해야 한다. 클라이언트는 400/403 에러를 사용자 친화적 메시지로 변환한다.

**WHILE** 감정 기록 입력 화면이 활성일 때,
**THEN** 시스템은 빈 `content` 제출을 차단하고, 사용자에게 내용 입력을 안내해야 한다.

#### REQ-EMO-002: 감정 기록 조회 (스포일러 필터 + 작성자 조인 + 스티커 집계)

**WHEN** 인증된 사용자가 특정 책의 감정 기록 목록을 조회하면,
**THEN** 시스템은 RLS 정책(REQ-DB-016)에 의해 허용된 행만 반환해야 한다: 본인 기록 OR `visibility='public'` OR (`visibility='club'` AND 모임 멤버).

**WHILE** 감정 기록 목록 응답을 구성할 때,
**THEN** 시스템은 각 행에 작성자 공개 프로필(`nickname`, `avatar_url` — `user_profiles` 뷰 조인)과 스티커 집계(`sticker_reactions` GROUP BY, 각 `sticker_type`별 count)를 포함해야 한다.

**IF** 조회 대상 기록의 `page_number`가 사용자의 현재 진도(`user_books.current_page`)보다 크면,
**THEN** 시스템은 해당 행을 응답에서 제외하거나 블러 처리 메타데이터(`is_spoiler=true`)를 부여해야 한다 (REQ-EMO-SPOILER 참조). 기본 동작은 서버가 `page_number lte current_page` 필터를 적용하고, 초과 행은 별도 조회 시에만 블러 메타데이터와 함께 반환한다.

#### REQ-EMO-003: 감정 기록 수정

**WHEN** 인증된 사용자가 본인 소유의 감정 기록 수정을 요청하면,
**THEN** 시스템은 `content`, `visibility`, `club_id` 필드에 한해 UPDATE를 허용해야 한다. `user_id`, `book_id`, `page_number`는 수정 불가(생성 시 고정).

**IF** 인증된 사용자가 타인의 감정 기록 수정을 요청하면,
**THEN** 시스템은 RLS 정책(`auth.uid() = user_id`)에 의해 UPDATE를 거부해야 한다.

#### REQ-EMO-004: 감정 기록 삭제

**WHEN** 인증된 사용자가 본인 소유의 감정 기록 삭제를 요청하면,
**THEN** 시스템은 해당 행을 삭제해야 한다. 연관된 `sticker_reactions`는 FK `ON DELETE CASCADE`(schema.md)에 의해 자동 삭제된다.

**IF** 인증된 사용자가 타인의 감정 기록 삭제를 요청하면,
**THEN** 시스템은 RLS 정책에 의해 DELETE를 거부해야 한다.

---

### REQ-EMO-GUIDE: 안전한 글쓰기 울타리 (단어 질문지 유도)

**목적**: 긴 독후감 부담 없이 단어/한 줄로 감정을 기록하도록 유도한다 (product.md 가치 제안 "안전한 글쓰기 울타리", pages_03 §2.2).

#### REQ-EMO-005: 단어 질문지 제안

**WHEN** 인증된 사용자가 감정 기록 입력 화면을 열면,
**THEN** 시스템은 사용자 진도(현재 `current_page` 근처)에 맞춘 1~2개의 짧은 질문 프롬프트를 노출해야 한다. 예: "이 페이지에서 멈춘 문장은?", "지금 떠오르는 단어 하나?"

**WHERE** 질문지 기능이 활성화된 경우,
**THEN** 시스템은 질문을 **유도 프롬프트**(선택적)로 제공하되, 사용자가 자유 입력을 선택할 수 있도록 해야 한다. 질문 선택 시에도 `content`는 사용자가 직접 작성한다.

> 질문 구체 문구와 진도 구간 매핑은 미결정 사항 6.1로 연기한다. MVP에서는 정적 질문 풀(3~5개)에서 라운드 로빈 또는 랜덤 제안한다.

---

### REQ-EMO-STICKER: 스티커 반응 (3종, 기록당 1개, 409 처리)

**목적**: 좋아요 경쟁 대신 감정 공감 스티커로 따뜻한 상호작용을 제공한다 (product.md 비목표 "좋아요/팔로워 경쟁 회피", pages_03 §2.3).

#### REQ-EMO-006: 스티커 반응 등록

**WHEN** 인증된 사용자가 타인 또는 본인의 감정 기록에 스티커 반응 등록을 요청하면,
**THEN** 시스템은 `sticker_reactions`에 `(record_id, user_id=auth.uid(), sticker_type)` 행을 INSERT해야 한다. `sticker_type`은 `'empathy'`, `'touching'`, `'comforted'` 중 하나여야 한다.

**IF** 동일 `(record_id, user_id)` 조합이 이미 존재하면,
**THEN** 시스템은 UNIQUE 제약 위반으로 409 Conflict를 반환해야 한다. 클라이언트는 업서트를 적용하지 않고, 사용자에게 "이미 반응한 기록입니다" 안내 후 기존 반응 취소(DELETE)를 유도한다.

**IF** 요청의 `sticker_type`이 ENUM 값이 아니면,
**THEN** 시스템은 400 Bad Request를 반환해야 한다.

#### REQ-EMO-007: 스티커 반응 취소

**WHEN** 인증된 사용자가 본인이 등록한 스티커 반응 취소를 요청하면,
**THEN** 시스템은 해당 행을 삭제해야 한다.

**IF** 인증된 사용자가 타인의 스티커 반응 취소를 요청하면,
**THEN** 시스템은 RLS 정책(`auth.uid() = user_id`)에 의해 DELETE를 거부해야 한다.

---

### REQ-EMO-SPOILER: 스포일러 방지 블러 + 타임라인 뷰

**목적**: 사용자 진도 이후 감정 기록이 스포일러가 되지 않도록 블러 처리하고, 페이지순/시간순 타임라인을 제공한다 (pages_03 §3, SPEC-UI-001 REQ-FE-024).

#### REQ-EMO-008: 스포일러 블러 처리

**WHILE** 감정 기록 목록 또는 상세 화면에서 기록의 `page_number`가 사용자의 현재 진도(`user_books.current_page`)를 초과하면,
**THEN** 시스템은 `EmotionRecordCard`(SPEC-UI-001 REQ-FE-024)의 스포일러 블러(12px blur)를 활성화해야 한다. 블러 영역에는 "진도 이후 내용입니다" 안내 문구를 노출한다.

**WHERE** 사용자가 블러된 기록을 탭하여 스포일러 확인 동작을 하면,
**THEN** 시스템은 일시적으로(해당 세션/화면 내) 블러를 해제할 수 있다. 해제 영구 vs 일시 여부는 미결정 사항 6.3으로 연기한다. MVP 기본값은 일시 해제(화면 이탈 시 복원)이다.

#### REQ-EMO-009: 타임라인 뷰 (페이지순/시간순)

**WHEN** 인증된 사용자가 특정 책의 타임라인 뷰를 요청하면,
**THEN** 시스템은 해당 책에 대한 허용된 감정 기록을 페이지순(`page_number ASC, created_at ASC`) 또는 시간순(`created_at DESC`)으로 정렬하여 반환해야 한다. 기본 정렬은 시간순이다.

**WHILE** 타임라인 뷰가 활성일 때,
**THEN** 시스템은 정렬 토글 UI를 제공하고, 페이지순 선택 시 동일 페이지 내에서는 시간순으로 2차 정렬해야 한다.

#### REQ-EMO-010: 공개 범위 제어

**WHEN** 인증된 사용자가 감정 기록 생성/수정 시 `visibility`를 선택하면,
**THEN** 시스템은 `'public'`(전체 인증 사용자 공개) 또는 `'club'`(지정 모임 멤버만) 중 하나를 요구해야 한다.

**IF** `visibility='club'`이면,
**THEN** 시스템은 `club_id`가 필수임을 검증해야 하고, 사용자가 해당 모임의 멤버임을 확인해야 한다 (RLS `fn_user_in_club` 헬퍼). 검증 실패 시 400/403을 반환한다.

---

## 4. 제외 범위 (Exclusions)

본 SPEC은 다음을 포함하지 않는다:

1. **모임 피드 내 감정 표시**: 모임 진도별 슬라이딩 피드, Realtime 구독, 모임원 감정 기록 표시는 SPEC-FEED-001 영역이다. 본 SPEC은 감정 기록 CRUD와 타임라인 뷰(책 기준)만 다룬다.
2. **완독 다이어리 집계**: 완독 시 `completion_reports.report_data`(감정 곡선, 하이라이트, 총 기록 수) 시각화는 SPEC-COMPLETION-001 영역이다. DB 트리거가 자동 생성하지만 UI는 별도 SPEC.
3. **스티커 커스텀 SVG 에셋**: 3종 스티커(empathy/touching/comforted)의 시각적 디자인 에셋은 SPEC-UI-001이 자리만 확보했다. 본 SPEC은 ENUM 값과 집계 로직만 정의한다.
4. **좋아요/팔로우 기능**: product.md 비목표. 감정 스티커만으로 상호작용한다.
5. **실시간 채팅**: `type=instant` 모임의 팝업 채팅은 비목표(MVP 밖).
6. **감정 기록 검색/필터(태그, 키워드)**: MVP에서는 책 단위 타임라인만 제공한다. 전역 검색은 확장 단계.
7. **감정 기록 멘션/공유(외부 SNS)**: MVP 밖.
8. **Edge Function 로직**: 감정 기록/스티커는 PostgREST 직접 호출로 처리한다. 전용 Edge Function은 두지 않는다.

---

## 5. 미결정 사항 (Open Questions)

### 5.1 단어 질문지 구체 문구 및 진도 구간 매핑 — 미해결

**상태**: 기획 문서(pages_03 §2.2.1)는 "진도 기반 질문 추천"을 명시하나, 구체 질문 문구와 진도 구간(예: 0-33%, 34-66%, 67-100%) 매핑은 정의되지 않았다.

**임시 방침**: MVP에서는 정적 질문 풀(3~5개, 예: "이 페이지에서 멈춘 문장은?", "지금 떠오르는 단어 하나?", "이 장면에서 느낀 감정은?")에서 라운드 로빈 또는 랜덤 제안한다. 진도 구간 매핑은 사용자 피드백 후 확장한다.

**해결 시점**: SPEC-EMOTION-001 v1.1.0 또는 별도 기획 문서(`.booktalk/` 업데이트)에서 다룬다.

### 5.2 감정 기록 수정 허용 범위 — 부분 해결

**상태**: `content`, `visibility`, `club_id` 수정을 허용하고(REQ-EMO-003), `user_id`, `book_id`, `page_number`는 고정으로 정의했다. 단, 수정 시간 제한(예: 작성 후 24시간 이내) 또는 수정 이력 표시 여부는 미정이다.

**임시 방침**: MVP에서는 시간 제한 없이 본인이면 언제든 수정 가능, 수정 이력은 `updated_at` 타임스탬프만 표시(이전 버전 보존 안 함).

**해결 시점**: 사용자 피드백 후 필요 시 v1.1.0에서 제한 도입.

### 5.3 스포일러 블러 해제 영구 vs 일시 — 부분 해결

**상태**: 블러 해제 동작의 지속성(세션 내 일시 vs 영구)이 명확하지 않다.

**임시 방침**: MVP 기본값은 일시 해제(해당 화면/세션 내에서만, 화면 이탈 시 복원). 사용자 설정으로 "스포일러 자동 노출" 옵션을 추가할지는 확장 단계에서 검토한다.

**해결 시점**: v1.1.0에서 사용자 설정 옵션 도입 여부 결정.

---

## 6. 추적성 (Traceability)

| TAG | 요구사항 | 소스 |
|-----|---------|------|
| SPEC-EMOTION-001 | REQ-EMO-001 ~ REQ-EMO-010 | `.booktalk/pages_03_기능명세서.md` §2-§3, `.booktalk/pages_08_API명세서.md` §5-§6, `.moai/project/product.md` 핵심 기능·사용 시나리오 2·가치 제안, `.moai/project/structure.md` Records CRUD+sticker API, SPEC-DB-001 REQ-DB-004/005/016/017, SPEC-UI-001 REQ-FE-024/025, `.moai/project/db/schema.md` |

### 의존성 역추적

| 의존 SPEC | 본 SPEC이 소비하는 산출물 |
|-----------|--------------------------|
| SPEC-DB-001 | `emotion_records`(REQ-DB-004), `sticker_reactions`(REQ-DB-005), RLS(REQ-DB-016/017), ENUM `sticker_type`, UNIQUE `(record_id, user_id)`, CHECK `visibility='club' → club_id NOT NULL` |
| SPEC-UI-001 | `EmotionRecordCard`(REQ-FE-024: 스포일러 블러 12px, 아바타+닉네임+페이지+본문+스티커), `StickerReaction`(REQ-FE-025: 3종 스티커) |
| SPEC-LIBRARY-001 | 책 컨텍스트(`book_id`, `user_books.current_page` — 스포일러 기준), 서재 등록 검증 |

---

## Implementation Notes

**Status:** ✅ Completed (2026-06-17)
**PR:** #12 (commit a1ce6cf)
**Phase:** Run (TDD) → Sync

### Files Created

**Source files (8 files, 1333 LOC):**
1. `src/features/emotion/types.ts` — DB Row derived types (EmotionRecordWithAuthor, StickerAggregate, Visibility, CreateInput, UpdateInput, SortOption)
2. `src/features/emotion/emotionApi.ts` — PostgREST 직접 호출 (create/list/update/delete), client-side pre-validation, users 조인 + sticker GROUP BY, spoiler split
3. `src/features/emotion/stickerApi.ts` — precheck/create/delete/aggregate, 409 UNIQUE→VALIDATION mapping via normalizeError, no upsert pattern
4. `src/features/emotion/useEmotionRecords.ts` — React Query 훅 (queryKey ['emotion',{bookId,userId}], CRUD mutations, cache invalidation)
5. `src/features/emotion/useStickerReaction.ts` — optimistic update + 409 rollback, useReplaceSticker (DELETE→POST)
6. `src/features/emotion/questionPrompts.ts` — 정적 풀 (5개 prompts), round-robin by currentPage seed
7. `src/features/emotion/EmotionInputScreen.tsx` — 입력 화면 (page/content/question/visibility toggle, pageNumber validation)
8. `src/features/emotion/TimelineScreen.tsx` — 타임라인 화면 (EmotionRecordCard list, sort toggle time/page, spoiler blur via isSpoiler prop)

**Test files (10 files, 627 tests pass):**
- `types.test.ts` — Type validation
- `emotionApi.create.test.ts` — Create scenarios (EC-1 client-side pre-validate)
- `emotionApi.list.test.ts` — List scenarios (EC-7, EC-8 client split safe/spoiler)
- `emotionApi.updateDelete.test.ts` — Update/Delete scenarios
- `stickerApi.test.ts` — Sticker scenarios (EC-11 409 UNIQUE→VALIDATION mapping)
- `useEmotionRecords.test.tsx` — React Query hook (cache invalidation)
- `useStickerReaction.test.tsx` — Sticker hook (optimistic update, rollback)
- `questionPrompts.test.ts` — Round-robin logic (deterministic by currentPage)
- `EmotionInputScreen.test.tsx` — Input screen UI (EC-12 maxLength 120)
- `TimelineScreen.test.tsx` — Timeline UI (EC-5, EC-7, EC-8, sort toggle, spoiler blur)

### REQ Coverage

| REQ | Description | Status |
|-----|-------------|--------|
| REQ-EMO-001 | 감정 기록 생성 | ✅ Implemented (emotionApi.create, client-side pre-validation EC-1) |
| REQ-EMO-002 | 감정 기록 조회 (스포일러 필터 + 작성자 조인 + 스티커 집계) | ✅ Implemented (emotionApi.list, users join + sticker GROUP BY, client-side spoiler split) |
| REQ-EMO-003 | 감정 기록 수정 | ✅ Implemented (emotionApi.update) |
| REQ-EMO-004 | 감정 기록 삭제 | ✅ Implemented (emotionApi.delete) |
| REQ-EMO-005 | 단어 질문지 제안 | ✅ Implemented (questionPrompts, static pool 5개, round-robin by currentPage) |
| REQ-EMO-006 | 스티커 반응 등록 | ✅ Implemented (stickerApi.create, 409 UNIQUE→VALIDATION mapping EC-11) |
| REQ-EMO-007 | 스티커 반응 취소 | ✅ Implemented (stickerApi.delete, useReplaceSticker DELETE→POST) |
| REQ-EMO-008 | 스포일러 블러 처리 | ✅ Implemented (TimelineScreen, EmotionRecordCard isSpoiler prop) |
| REQ-EMO-009 | 타임라인 뷰 (페이지순/시간순) | ✅ Implemented (TimelineScreen, sort toggle) |
| REQ-EMO-010 | 공개 범위 제어 | ✅ Implemented (EmotionInputScreen visibility toggle) |

**Total: 10/10 REQ covered (100%)**

### Test Results

- **627/627 tests pass** (75 suites total)
- **92.47% statements coverage** (target 85%+ exceeded)
- 87.73% branches coverage
- 96.15% functions coverage
- 92.34% lines coverage

### Key Architecture Decisions

1. **PostgREST 직접 호출**: Edge Function 없이 PostgREST 직접 호출 (단순 CRUD, no complex logic)
2. **스티커 409 no-upsert**: UNIQUE 위반 시 업서트(on conflict update) 대신 DELETE→POST 재등록 유도 패턴 (SPEC-DB-001 미결정 6.2 해결)
3. **Sticker GROUP BY realtime**: 클라이언트에서 시뮬레이션 (MVP 단순화, 서버 집계 테이블 미사용)
4. **Spoiler blur client-side**: list API에서 current_page 기준 split 후 UI에 isSpoiler prop 전달 (서버 필터 미사용)
5. **Question prompts 정적 풀**: MVP에서 5개 정적 질문 라운드 로빈 (진도 구간 매핑은 미결정 5.1로 v1.1.0 연기)

### Known MINOR Follow-ups

1. **bookTitle 필요성 (DEFERRED)**: listEmotionRecords에서 books 테이블 조인으로 book_title 추가 검토 (현재는 book_id만, UI에서 필요 시 v1.1.0 추가)
2. **normalizeError 패턴 확인 (VERIFIED)**: 409 UNIQUE→VALIDATION mapping 정상 동작 확인 완료 (no change needed)

### Dependencies Consumed

- **SPEC-DB-001**: emotion_records, sticker_reactions tables, RLS policies (REQ-DB-016/017), ENUM sticker_type, UNIQUE constraint
- **SPEC-API-001**: PostgREST client, normalizeError (409→VALIDATION mapping)
- **SPEC-UI-001**: EmotionRecordCard (REQ-FE-024), StickerReaction (REQ-FE-025) components
- **SPEC-LIBRARY-001**: Book context (book_id, user_books.current_page for spoiler baseline)

### Integration Points

- **EmotionInputScreen**: EmotionRecordCard + StickerReaction 컴포넌트 소비 (SPEC-UI-001)
- **TimelineScreen**: EmotionRecordCard list, sort toggle, spoiler blur
- **emotionApi**: PostgREST direct (no Edge Function), client-side pre-validation (EC-1)
- **stickerApi**: 409 UNIQUE→VALIDATION mapping via normalizeError (EC-11)
- **useEmotionRecords**: React Query cache invalidation (queryKey ['emotion',{bookId,userId}])
- **useStickerReaction**: Optimistic update + 409 rollback, useReplaceSticker pattern
