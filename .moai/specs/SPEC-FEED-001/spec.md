---
id: SPEC-FEED-001
title: "스포일러 방지 진도별 피드"
version: "1.1.0"
status: implemented
created: 2026-06-14
updated: 2026-06-20
author: "강력쇠주먹"
priority: medium
issue_number: 0
labels: [feed, realtime, spoiler, club, supabase, phase-3]
---

# SPEC-FEED-001: 스포일러 방지 진도별 피드

## HISTORY

| 날짜 | 버전 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 2026-06-14 | 1.0.0 | 최초 작성 — 모임 진도별 슬라이딩 피드, 클라이언트 스포일러 블러, Supabase Realtime postgres_changes 구독, visibility=club 감정 기록 표시. SPEC-DB-001 REQ-DB-004/013d/016, SPEC-EMOTION-001 스포일러 패턴, SPEC-UI-001 REQ-FE-024 연동 | 강력쇠주먹 |
| 2026-06-20 | 1.1.0 | REQ-FEED-004 블러 안내 문구를 FROZEN `EmotionRecordCard` 기준("이 기록은 내 진도를 넘었어요")으로 정정. SPEC-UI-001 FROZEN 코드가 단일 진실 원천(SPEC-UI-001 acceptance.md 및 `src/components/EmotionRecordCard.tsx`와 일치)이므로 본 SPEC 문구를 코드에 맞춤. PR #25(SPEC-FEED-001 구현, squash 63ddf12) 머지에 따른 sync 단계 정정. status draft→implemented. 구현 결과 섹션(§7) 추가 | 강력쇠주먹 |

---

## 1. 환경 (Environment)

- **백엔드**: Supabase (관리형 PostgreSQL + PostgREST + Realtime)
- **실시간**: Supabase Realtime — `postgres_changes` 구독 (인증된 채널, RLS 적용)
- **데이터 엔터티**:
  - `emotion_records` (SPEC-DB-001 REQ-DB-004) — 피드 대상. 컬럼: `id`, `user_id`, `book_id`, `page_number(NOT NULL)`, `content`, `visibility(ENUM public/club)`, `club_id(nullable, NOT NULL when visibility=club)`, `created_at`, `updated_at`
  - `sticker_reactions` (SPEC-DB-001 REQ-DB-005) — 스티커 집계. 컬럼: `id`, `record_id`, `user_id`, `sticker_type(ENUM)`, `created_at`
  - `clubs` (SPEC-DB-001 REQ-DB-006) — 모임 컨텍스트. 컬럼: `id`, `host_id`, `book_id`, `type`, `title`, `description`, `duration_days`, `daily_pages`, `trigger_page`, `status`
  - `club_members` (SPEC-DB-001 REQ-DB-007) — 멤버십 검증. `(club_id, user_id)` UNIQUE
  - `user_books` (SPEC-DB-001 REQ-DB-003) — 현재 진도 기준. `current_page` 컬럼
- **성능 인덱스** (SPEC-DB-001 §4 / schema.md):
  - `emotion_records (book_id, page_number)` — 진도별 피드 페이지네이션 최적화
  - `sticker_reactions (record_id)` — 기록별 리액션 집계
- **RLS 정책** (이미 SPEC-DB-001로 구현됨):
  - `emotion_records` (REQ-DB-016): 읽기 = 본인 OR `visibility='public'` OR (`visibility='club'` AND `fn_user_in_club(club_id)` 멤버). Realtime postgres_changes 구독에도 동일 RLS 적용
  - `sticker_reactions` (REQ-DB-017): 읽기 = 전체 공개(`USING (true)`)
  - `club_members` (REQ-DB-019): 읽기 = `fn_user_in_club(club_id)` (재귀 방지 헬퍼)
  - `clubs` (REQ-DB-018): 읽기 = 공개 탐색 허용(`USING (true)`)
- **SECURITY DEFINER 헬퍼** (SPEC-DB-001 REQ-DB-013d):
  - `fn_user_in_club(p_club_id uuid) RETURNS boolean` — `auth.uid()`가 모임 멤버인지 검증, RLS 재귀 방지
- **보안 뷰** (SPEC-DB-001 REQ-DB-013e):
  - `user_profiles` — 작성자 공개 프로필(`nickname`, `avatar_url`) 노출
- **API 서피스** (structure.md "Clubs CRUD"):
  - `GET /clubs/{id}/feed` — 진도별 슬라이딩 피드 (현재 진도 기반 스포일러 블러 처리, Supabase Realtime 구독과 병행)
  - Realtime 채널: `postgres_changes` on `emotion_records`(INSERT) + `sticker_reactions`(INSERT)
- **의존성**:
  - **SPEC-CLUB-001** (선행): Track A 모임 컨텍스트, `club_id` 식별
  - **SPEC-CLUB-002** (선행): Track B 모임 생성/관리, `clubs.book_id` + 진도 설정
  - **SPEC-EMOTION-001** (선행): 감정 데이터 구조, 스티커 반응, 스포일러 블러 패턴 (REQ-EMO-SPOILER와 동일 원칙)
  - **SPEC-UI-001** (선행): `EmotionRecordCard`(REQ-FE-024 — 스포일러 블러 12px), `StickerReaction`(REQ-FE-025) 컴포넌트 소비
  - **SPEC-API-001** (선행): Supabase 클라이언트 싱글톤, 인증 헤더 자동 주입
- **플랫폼**: React Native + Expo SDK 55 (TypeScript strict). 클라이언트는 PostgREST + Realtime 직접 호출, `service_role` 키 사용 금지
- **참조 SSOT**:
  - `.moai/project/product.md` 핵심 기능 "스포일러 방지 진도별 피드", 사용 시나리오 2 "감정 공유", 비목표 "실시간 매칭 및 팝업 채팅", 비목표 "좋아요/팔로워 경쟁"
  - `.moai/project/structure.md` API 서피스 "Clubs CRUD — `GET /clubs/{id}/feed` (진도별 슬라이딩 피드, 현재 진도 기반 스포일러 블러 처리, Supabase Realtime 구독과 병행)"
  - `.moai/project/tech.md` 백엔드 "실시간 동기화 기능을 통해 사용자 간의 감정 공유와 모임 활동을 실시간으로 처리"
  - `.moai/project/db/schema.md` (emotion_records 인덱스, fn_user_in_club, RLS 정책)

---

## 2. 가정 (Assumptions)

### 2.1 아키텍처 가정

1. **스포일러 블러는 클라이언트 측 로직**: 서버(`GET /clubs/{id}/feed`)는 진도 초과 기록도 포함하여 모든 허용된 행을 반환한다. 클라이언트가 현재 사용자 진도(`user_books.current_page`)와 각 기록의 `page_number`를 비교하여 블러 여부를 결정한다. 이는 진도 업데이트 시 서버 재요청 없이 즉시 블러 해제가 가능하도록 한다.
2. **RLS에 의존**: 모든 읽기 권한 검증은 DB RLS(REQ-DB-016/017/019)가 단독 수행한다. 클라이언트나 Edge Function은 권한 로직을 중복 구현하지 않는다. `visibility='club'` 기록은 `fn_user_in_club(club_id)` 헬퍼로 멤버십이 검증된 사용자에게만 노출된다.
3. **Realtime RLS 적용**: Supabase Realtime의 `postgres_changes` 구독은 인증된 채널에서 동작하며, 동일한 RLS 정책이 적용된다. 비멤버는 모임 채널을 구독해도 `visibility='club'` 기록 변경 이벤트를 수신하지 않는다.
4. **피드 데이터 단위**: 피드는 모임의 책(`clubs.book_id`)에 대한 `emotion_records` 중 `visibility='club'` AND `club_id={모임 ID}`인 기록을 우선 표시한다. `visibility='public'` 기록 중 같은 책의 것도 보조 표시할 수 있으나, MVP에서는 모임 피드는 `visibility='club'` 기록만 다룬다 (공개 전체 피드는 비목표).
5. **진도 기준 출처**: 스포일러 블러 기준이 되는 `current_page`는 현재 사용자의 `user_books.current_page`(해당 책)를 사용한다. 모임의 집단 진도(`clubs.trigger_page` 등)가 아닌 개인 진도를 기준으로 한다 (개인별 스포일러 방지).

### 2.2 비즈니스 가정

1. **모임 피드 범위**: MVP에서 피드는 모임(`club_id`) 단위로 제공된다. 공개(public) 전체 피드는 비목표(product.md "대중 스케일 서비스 추구" 회피)이므로 구현하지 않는다.
2. **느슨한 실시간**: Realtime은 새 기록/스티커 도착을 알리는 용도이며, 팝업 채팅이나 실시간 매칭이 아니다 (product.md 비목표). Realtime 이벤트는 피드 목록에 새 행을 추가하거나 스티커 집계를 갱신하는 데 사용된다.
3. **좋아요/팔로우 없음**: product.md 비목표 "좋아요/팔로워 경쟁 메커니즘" 회피. 상호작용은 오직 공감 스티커 3종(SPEC-EMOTION-001)으로 한정한다.
4. **스티커 집계 실시간 반영**: 새 스티커 반응 INSERT 시 Realtime 이벤트를 수신하고, 해당 기록의 스티커 집계를 클라이언트에서 재계산한다. 별도 집계 테이블은 두지 않는다 (SPEC-EMOTION-001 가정 2.2.5와 일관).
5. **페이지네이션**: 초기 로드는 최신순(`created_at DESC`)으로 제한된 페이지 크기(미결정 사항 6.3)를 반환한다. 무한 스크롤로 추가 페이지를 로드한다.

---

## 3. 요구사항 (Requirements)

> 본 SPEC은 3개 요구사항 모듈로 구성된다: REQ-FEED-QUERY, REQ-FEED-SPOILER, REQ-FEED-REALTIME.

### REQ-FEED-QUERY: 모임 피드 조회 (visibility=club, 멤버십 검증, 페이지네이션)

**목적**: 모임원이 작성한 `visibility='club'` 감정 기록을 진도별로 조회할 수 있게 한다. structure.md API 서피스 "`GET /clubs/{id}/feed`"의 데이터 계층.

#### REQ-FEED-001: 모임 피드 초기 로드

**WHEN** 인증된 사용자가 특정 모임(`club_id`)의 피드 조회를 요청하면,
**THEN** 시스템은 RLS 정책(REQ-DB-016)에 의해 허용된 `emotion_records` 행만 반환해야 한다. 대상 행은 `club_id={요청 모임 ID}` AND `visibility='club'`인 기록이며, 요청자가 해당 모임의 멤버(`fn_user_in_club` 검증 통과)여야 한다.

**IF** 요청자가 해당 모임의 멤버가 아니면,
**THEN** 시스템은 RLS 정책에 의해 빈 결과를 반환해야 한다 (`visibility='club'` 기록이 노출되지 않음). 클라이언트는 빈 결과를 "피드를 볼 수 없는 모임"으로 처리한다.

**WHILE** 피드 응답을 구성할 때,
**THEN** 시스템은 각 행에 작성자 공개 프로필(`nickname`, `avatar_url` — `user_profiles` 뷰 조인)과 스티커 집계(`sticker_reactions` GROUP BY, 각 `sticker_type`별 count)를 포함해야 한다.

#### REQ-FEED-002: 모임 피드 페이지네이션

**WHEN** 인증된 사용자가 피드를 스크롤하여 추가 기록 로드를 요청하면,
**THEN** 시스템은 커서 기반 페이지네이션(`created_at` 기준, 이전 페이지 마지막 행 이전)으로 다음 페이지를 반환해야 한다. 인덱스 `(book_id, page_number)`와 `created_at DESC` 정렬을 활용한다.

> 초기 로드 페이지 크기는 미결정 사항 6.3으로 연기한다. MVP 임시값은 20행이다.

#### REQ-FEED-003: 모임 책 컨텍스트 검증

**WHILE** 피드 조회가 활성일 때,
**THEN** 시스템은 피드 대상 기록의 `book_id`가 모임의 책(`clubs.book_id`)과 일치함을 보장해야 한다. 클라이언트는 모임 상세 정보(`GET /clubs/{id}`)에서 `book_id`를 획득하고, 피드 쿼리에 `book_id` 필터를 적용한다.

---

### REQ-FEED-SPOILER: 진도별 스포일러 블러 (클라이언트 측, 해제 상호작용)

**목적**: 현재 사용자 진도 이후 페이지의 감정 기록이 스포일러가 되지 않도록 블러 처리한다. SPEC-EMOTION-001 REQ-EMO-SPOILER와 동일 원칙을 모임 피드에 적용하되, 클라이언트 측에서 결정한다.

#### REQ-FEED-004: 진도별 스포일러 블러 처리

**WHILE** 모임 피드 화면에서 감정 기록의 `page_number`가 현재 사용자의 진도(`user_books.current_page` — 해당 책)를 초과하면,
**THEN** 시스템은 `EmotionRecordCard`(SPEC-UI-001 REQ-FE-024)의 스포일러 블러(12px blur)를 활성화해야 한다. 블러 영역에는 "이 기록은 내 진도를 넘었어요" 안내 문구를 노출한다.

> **문구 정정 (2026-06-20, v1.1.0)**: 본 REQ의 블러 라벨 문구를 "진도 이후 내용입니다"에서 FROZEN `EmotionRecordCard`(`src/components/EmotionRecordCard.tsx`, SPEC-UI-001 REQ-FE-024)가 실제 렌더링하는 "이 기록은 내 진도를 넘었어요"로 정정했다. SPEC-UI-001 FROZEN zone(디자인 헌법 v3.4.0)이 우선하므로, 구현 코드(단일 진실 원천)에 본 SPEC 문서를 맞추었다. 상세는 HISTORY(2026-06-20) 참조.

> 서버는 진도 초과 기록도 반환한다 (가정 2.1.1). 클라이언트가 `current_page`와 `page_number`를 비교하여 블러를 적용한다. `current_page`는 `user_books`에서 별도 조회하거나 피드 응답 메타데이터에 포함한다.

**WHEN** 사용자의 진도(`user_books.current_page`)가 업데이트되면,
**THEN** 시스템은 서버 재요청 없이 클라이언트에서 즉시 블러 상태를 재평가해야 한다 (진도 이내 페이지의 블러가 해제됨).

#### REQ-FEED-005: 스포일러 해제 상호작용

**WHERE** 사용자가 블러된 감정 기록을 탭하여 스포일러 확인 동작을 하면,
**THEN** 시스템은 일시적으로(해당 세션/화면 내) 블러를 해제할 수 있다. 해제 영구 vs 일시 여부는 미결정 사항 6.1로 연기한다. MVP 기본값은 일시 해제(화면 이탈 시 복원)이다.

---

### REQ-FEED-REALTIME: Supabase Realtime 구독 (postgres_changes, 재연결)

**목적**: 모임원이 새 감정 기록을 작성하거나 스티커 반응을 등록할 때, 다른 멤버의 피드에 실시간으로 반영한다. tech.md "실시간 동기화"의 모임 피드 적용 계층.

#### REQ-FEED-006: 새 감정 기록 Realtime 구독

**WHEN** 모임원이 새 감정 기록(`emotion_records` INSERT, `visibility='club'`, `club_id={모임 ID}`)을 작성하면,
**THEN** 시스템은 해당 모임의 Realtime 채널을 구독 중인 다른 멤버의 클라이언트에 `postgres_changes` 이벤트를 전달해야 한다. 클라이언트는 이벤트 수신 시 피드 목록 상단에 새 행을 추가하고, 작성자 프로필과 스티커 집계(초기 0)를 표시해야 한다.

> Realtime 채널은 인증된 사용자만 구독할 수 있으며, RLS 정책이 이벤트 필터링에 적용된다. 비멤버는 `visibility='club'` 기록 INSERT 이벤트를 수신하지 않는다 (가정 2.1.3).

#### REQ-FEED-007: 새 스티커 반응 Realtime 구독

**WHEN** 모임원이 피드에 표시된 감정 기록에 스티커 반응(`sticker_reactions` INSERT)을 등록하면,
**THEN** 시스템은 해당 모임 채널 구독자에게 `postgres_changes` 이벤트를 전달해야 한다. 클라이언트는 이벤트 수신 시 해당 기록의 스티커 집계를 increment하고, `StickerReaction`(SPEC-UI-001 REQ-FE-025) 컴포넌트의 count를 갱신해야 한다.

#### REQ-FEED-008: Realtime 재연결 및 에러 처리

**IF** 네트워크 단절 또는 Realtime 서버 일시적 장애로 채널 연결이 끊어지면,
**THEN** 시스템은 자동 재연결을 시도해야 한다. 재연결 백오프 전략(지수 백오프 또는 고정 간격)은 미결정 사항 6.2로 연기한다.

**WHILE** 재연결 시도 중일 때,
**THEN** 시스템은 사용자에게 "실시간 연결 끊김 — 재연결 중" 상태를 표시해야 하며, 재연결 성공 시 누락된 기록을 보완하기 위해 전체 피드를 재조회(`GET /clubs/{id}/feed`)해야 한다.

---

## 4. 제외 범위 (Exclusions)

본 SPEC은 다음을 포함하지 않는다:

1. **실시간 팝업 채팅**: product.md 비목표 "실시간 매칭 및 팝업 채팅". `type=instant` 모임의 채팅, 시그널 푸시는 MVP 밖이다.
2. **좋아요/팔로우 기능**: product.md 비목표 "좋아요/팔로워 경쟁 메커니즘". 감정 스티커만으로 상호작용한다 (SPEC-EMOTION-001).
3. **공개(public) 전체 피드**: product.md 비목표 "대중 스케일 서비스 추구" 회피. MVP는 모임(`club_id`) 단위 피드만 제공한다. 전체 공개 피드는 확장 단계.
4. **피드 검색/필터**: 태그, 키워드, 작성자 필터링은 MVP에서 제공하지 않는다. 진도별 슬라이딩 + 시간순 정렬만 지원한다.
5. **알림**: 새 감정 기록/스티커에 대한 푸시 알림, 알림 센터는 SPEC-NOTIF-001 영역이다. 본 SPEC은 Realtime 구독(화면 활성 시)만 다룬다.
6. **감정 기록 CRUD**: 기록 생성/수정/삭제는 SPEC-EMOTION-001 영역이다. 본 SPEC은 모임 피드 **조회 및 실시간 반영**만 다룬다.
7. **스티커 반응 등록/취소**: 스티커 CRUD는 SPEC-EMOTION-001 REQ-EMO-STICKER 영역이다. 본 SPEC은 스티커 변경의 Realtime 반영만 다룬다.
8. **모임 관리**: 모임 생성, 가입 요청, 진도 동기화는 SPEC-CLUB-001/002 영역이다. 본 SPEC은 모임 컨텍스트를 소비한다.
9. **Edge Function 로직**: 모임 피드는 PostgREST 직접 호출 + Realtime 직접 구독으로 처리한다. 전용 Edge Function은 두지 않는다.

---

## 5. 미결정 사항 (Open Questions)

### 5.1 스포일러 블러 해제 영구 vs 세션 — 부분 해결

**상태**: 블러 해제 동작의 지속성(세션 내 일시 vs 영구)이 명확하지 않다. SPEC-EMOTION-001 미결정 5.3과 동일 이슈.

**임시 방침**: MVP 기본값은 일시 해제(해당 화면/세션 내에서만, 화면 이탈 시 복원). 사용자 설정으로 "스포일러 자동 노출" 옵션을 추가할지는 확장 단계에서 검토한다.

**해결 시점**: v1.1.0에서 사용자 설정 옵션 도입 여부 결정. SPEC-EMOTION-001 결정과 일관성 유지.

### 5.2 Realtime 재연결 백오프 전략 — 미해결

**상태**: 네트워크 단절 시 자동 재연결의 백오프 전략(지수 백오프, 고정 간격, 최대 재시도 횟수)이 정의되지 않았다.

**임시 방침**: MVP에서는 Supabase Realtime 클라이언트의 기본 재연결 동작에 의존한다. 클라이언트(`useClubFeedRealtime` 훅)는 `SUBSCRIBED`/`CHANNEL_ERROR`/`TIMED_OUT` 상태를 추적하고, 에러 시 사용자에게 상태를 표시한다. 재연결 성공 시 전체 피드 재조회로 누락 보완.

**해결 시점**: v1.1.0에서 지수 백오프(예: 1s, 2s, 4s, 8s, 최대 30s) 도입 검토.

### 5.3 초기 로드 페이지네이션 크기 — 미해결

**상태**: 피드 초기 로드 시 한 번에 반환할 기록 수(페이지 크기)가 정의되지 않았다.

**임시 방침**: MVP 임시값은 20행. 무한 스크롤로 추가 로드. 사용자 피드백 및 성능 측정 후 조정.

**해결 시점**: v1.1.0에서 성능 데이터 기반 최적화.

---

## 6. 추적성 (Traceability)

| TAG | 요구사항 | 소스 |
|-----|---------|------|
| SPEC-FEED-001 | REQ-FEED-001 ~ REQ-FEED-008 | `.moai/project/product.md` 핵심 기능 "스포일러 방지 진도별 피드"·사용 시나리오 2·비목표, `.moai/project/structure.md` API "Clubs CRUD — `GET /clubs/{id}/feed`", `.moai/project/tech.md` 백엔드 Realtime, SPEC-DB-001 REQ-DB-004/005/006/013d/013e/016/017/018/019, SPEC-EMOTION-001 REQ-EMO-SPOILER 패턴, SPEC-UI-001 REQ-FE-024/025, `.moai/project/db/schema.md` 인덱스·fn_user_in_club |

### 의존성 역추적

| 의존 SPEC | 본 SPEC이 소비하는 산출물 |
|-----------|--------------------------|
| SPEC-DB-001 | `emotion_records`(REQ-DB-004 — visibility=club, club_id), `sticker_reactions`(REQ-DB-005), `clubs`(REQ-DB-006 — book_id), `club_members`(REQ-DB-007), `user_books`(REQ-DB-003 — current_page), RLS(REQ-DB-016/017/018/019), `fn_user_in_club`(REQ-DB-013d), `user_profiles` 뷰(REQ-DB-013e), 인덱스 `(book_id, page_number)`(§4) |
| SPEC-EMOTION-001 | 스포일러 블러 패턴(REQ-EMO-SPOILER — 클라이언트 측 page_number vs current_page 비교), 스티커 집계 로직(REQ-EMO-006), visibility 제어(REQ-EMO-010) |
| SPEC-UI-001 | `EmotionRecordCard`(REQ-FE-024 — 스포일러 블러 12px, 아바타+닉네임+페이지+본문+스티커), `StickerReaction`(REQ-FE-025 — 3종 스티커 count 표시) |
| SPEC-CLUB-001 | Track A 모임 컨텍스트(`club_id` 식별, 멤버십) |
| SPEC-CLUB-002 | Track B 모임 생성/관리(`clubs.book_id`, 진도 설정) |
| SPEC-API-001 | Supabase 클라이언트 싱글톤, Realtime 채널 설정, 인증 헤더 자동 주입 |

---

## 7. 구현 결과 (Implementation Outcome)

> 본 섹션은 PR #25(squash commit `63ddf12`, 2026-06-20 develop 머지) 기준 구현 결과를 기록한다. TDD(RED-GREEN-REFACTOR) 표준 서브에이전트 모드로 진행되었다.

### 7.1 구현 완료 범위 (Phase A/B/C/D)

| Phase | 범위 | 산출물 | 상태 |
|-------|------|--------|------|
| Phase A | 피드 데이터 계층 — 타입, 스포일러 필터, 쿼리, 조회 훅 | `src/features/feed/{types,spoilerFilter,queries,useClubFeed}.ts` + 3개 테스트 스위트(32/32 통과, coverage 97%) | ✅ |
| Phase B | 피드 화면 — FlatList + EmotionRecordCard + 세션 revealed state + 빈/로딩/에러, 라우트 + 모임 상세 CTA, barrel | `src/features/feed/components/ClubFeedScreen.tsx`, `app/(tabs)/clubs/[clubId]/feed.tsx`, `app/(tabs)/clubs/[clubId].tsx`(CTA edit), `src/features/feed/index.ts` (누적 38 tests) | ✅ |
| Phase C | Realtime 구독 — postgres_changes 2리스너(emotion_records INSERT + sticker_reactions INSERT), invalidate, cleanup, 연결 상태 배지 | `src/features/feed/useClubFeedRealtime.ts`, `ClubFeedScreen.tsx`(상태 배지 통합) (누적 53 tests, 전체 913 tests, tsc EXIT 0) | ✅ |
| Phase D | F14 .pen 모임 피드 화면 프레임 | `.moai/design/sagak.pen` 프레임(3계층 레이아웃 + 3카드 + 블러, layout 검증 통과) | ✅ (코드 산출물, 사용자 저장 대기 — §7.3) |

### 7.2 백엔드 산출물 (DB migration)

- **`supabase/migrations/20240620000001_enable_realtime_feed.sql`** (머지됨): `supabase_realtime` publication에 `emotion_records`, `sticker_reactions` 추가 + 양 테이블 `REPLICA IDENTITY FULL` 설정. 기존 SELECT RLS 정책(migration 0014)이 브로드캐스트 게이트를 자동 수행하므로(F13), 본 마이그레이션은 정책을 변경하지 않는다. RLS 강제(FORCE ROW LEVEL SECURITY)는 migration 0014에서 이미 적용됨.

### 7.3 오픈 항목 / 후속 작업

| 항목 | 상세 | 후속 |
|------|------|------|
| F2/F13 RLS 로컬 통합 테스트 | 비멤버 세션으로 `visibility='club'` 조회 시 빈 결과(F2) 및 Realtime 미수신(F13) 검증이 로컬 Supabase 환경에서 아직 수행되지 않음. 단위 테스트는 통과했으나 외부 시스템(Supabase RLS) 동작은 실제 검증 필요(lessons #4) | 로컬 Supabase 통합 테스트 추가 예정 |
| F12 정렬 단언 | 새 기록 Realtime 반영이 "상단 추가" 순서로 단위 테스트에서 엄격 단언되지 않음(구현은 동작) | 정렬 순서 단언 강화 |
| Worker timer warning | Realtime 훅 cleanup 관련 React Native 타이머 워닝이 특정 환경에서 발생 가능(기능 영향 없음) | 환경 재현 후 워닝 소거 |
| F14 .pen 사용자 저장 | F14 .pen 프레임은 코드로 산출되었으나, 최종 사용자 인증 저장(sign-off) 대기 | 사용자 .pen 확인 후 저장 |
| 후속 이슈 | 스포일러/정렬/타이머 관련 세부 항목은 GitHub 이슈로 추적 | issue #26, issue #27 |

### 7.4 검증 요약

- 단위/통합 테스트: 53개 FEED 테스트 통과, 전체 913개 테스트 통과
- 타입 체크: `tsc --noEmit` EXIT 0
- 품질 게이트: TRUST 5 표준 단계 통과(evaluator-active 최종 통과)
- 메서둘로지: TDD(RED-GREEN-REFACTOR), Brownfield Enhancement 적용
