---
id: SPEC-FEED-001
title: "스포일러 방지 진도별 피드 — 구현 계획"
version: "1.0.0"
status: draft
created: 2026-06-14
updated: 2026-06-14
author: "강력쇠주먹"
priority: medium
issue_number: 0
labels: [feed, realtime, spoiler, club, supabase, phase-3, plan]
---

# SPEC-FEED-001: 구현 계획 (plan.md)

## HISTORY

| 날짜 | 버전 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 2026-06-14 | 1.0.0 | 최초 작성 — 3개 마일스톤, 기술 접근, 아키텍처 방향, 리스크 대응 | 강력쇠주먹 |

---

## 1. 마일스톤 (우선순위 기반)

> 본 계획은 시간 예측을 사용하지 않으며, 우선순위 기반 마일스톤으로 진행 순서를 정의한다.

### Primary Goal (1순위): 모임 피드 조회 + 스포일러 블러

**범위**: REQ-FEED-QUERY + REQ-FEED-SPOILER

**산출물**:
- `src/features/feed/queries.ts` — `GET /clubs/{id}/feed` 쿼리 함수 (PostgREST 직접 호출)
- `src/features/feed/useClubFeed.ts` — 피드 조회 훅 (초기 로드 + 페이지네이션)
- `src/features/feed/spoilerFilter.ts` — 클라이언트 측 스포일러 블러 결정 로직 (`page_number` vs `current_page`)
- 모임 피드 화면 (`app/(tabs)/clubs/[id]/feed.tsx` 또는 유사 경로)
- `EmotionRecordCard`(SPEC-UI-001) 스포일러 블러 12px 통합

**완료 기준**:
- 모임 멤버가 피드 조회 시 `visibility='club'` 기록이 표시된다
- 비멤버는 빈 결과를 받는다 (RLS 검증)
- 진도 초과 페이지의 기록이 블러 처리된다
- 진도 업데이트 시 블러가 즉시 재평가된다
- 페이지네이션(무한 스크롤)이 동작한다

**의존성 완료 조건**: SPEC-CLUB-002 (모임 생성/관리), SPEC-EMOTION-001 (감정 기록 CRUD), SPEC-API-001 (Supabase 클라이언트), SPEC-UI-001 (EmotionRecordCard)

### Secondary Goal (2순위): Supabase Realtime 구독

**범위**: REQ-FEED-REALTIME

**산출물**:
- `src/features/feed/useClubFeedRealtime.ts` — Realtime 구독 훅 (postgres_changes on emotion_records + sticker_reactions)
- Realtime 채널 설정 (`channel: 'club-feed-{club_id}'`, `postgres_changes` 필터)
- 새 기록/스티커 이벤트 수신 시 피드 목록 갱신 로직
- 재연결 상태 추적 및 사용자 알림

**완료 기준**:
- 모임원이 새 감정 기록 작성 시 다른 멤버 피드에 실시간 반영된다
- 새 스티커 반응 시 해당 기록의 스티커 집계가 갱신된다
- 네트워크 단절 시 재연결이 시도되고, 성공 시 누락分이 보완된다
- 비멤버는 Realtime 이벤트를 수신하지 않는다 (RLS 적용)

**의존성 완료 조건**: Primary Goal 완료

### Optional Goal (3순위): 스포일러 해제 고도화 및 최적화

**범위**: 미결정 사항 해결 및 사용자 경험 개선

**산출물**:
- 스포일러 해제 영구 옵션 (사용자 설정) — 미결정 5.1 해결 시
- Realtime 재연결 지수 백오프 — 미결정 5.2 해결 시
- 페이지네이션 크기 최적화 — 미결정 5.3 해결 시
- 피드 성능 프로파일링 및 인덱스 활용 검증

**완료 기준**:
- 미결정 사항 3건이 사용자 피드백 기반으로 결정된다
- 피드 로드 응답 시간이 인덱스 `(book_id, page_number)` 활용으로 최적화된다

---

## 2. 기술 접근 (Technical Approach)

### 2.1 데이터 조회 계층

- **PostgREST 직접 호출**: `GET /clubs/{id}/feed`는 클라이언트에서 PostgREST 쿼리로 구성한다. 별도 Edge Function은 두지 않는다 (제외 범위 9).
- **쿼리 구조**:
  - `emotion_records` SELECT where `club_id=eq.{club_id}` AND `visibility=eq.club` AND `book_id=eq.{clubs.book_id}`
  - 작성자 프로필 조인: `user_profiles` 뷰 (`nickname`, `avatar_url`)
  - 스티커 집계: `sticker_reactions` GROUP BY — 클라이언트에서 별도 쿼리 후 매핑, 또는 PostgREST embedded select 활용
- **인덱스 활용**: `(book_id, page_number)` 인덱스로 페이지네이션 최적화. `created_at DESC` 정렬로 최신순 표시.
- **권한**: RLS(REQ-DB-016)가 단독 검증. 클라이언트는 권한 로직 미구현.

### 2.2 스포일러 블러 계층 (클라이언트 측)

- **결정 로직**: `spoilerFilter.ts`가 각 기록의 `page_number`와 현재 사용자 `current_page`를 비교하여 `is_spoiler: boolean`을 산출한다.
- **진도 출처**: `user_books.current_page`(해당 책). 피드 응답 메타데이터에 포함하거나 별도 조회.
- **즉시 재평가**: 진도 업데이트 시 클라이언트 상태만 갱신하여 서버 재요청 없이 블러 해제.
- **UI 연동**: `EmotionRecordCard`(SPEC-UI-001 REQ-FE-024)의 `isSpoiler` prop으로 12px blur 활성화.

### 2.3 Realtime 구독 계층

- **채널 설정**: Supabase Realtime `channel('club-feed-{club_id}')` 구독.
- **이벤트 필터**:
  - `postgres_changes` on `emotion_records`: `event: 'INSERT'`, `filter: 'club_id=eq.{club_id}'`
  - `postgres_changes` on `sticker_reactions`: `event: 'INSERT'` (해당 모임 기록의 record_id 필터는 클라이언트에서 적용)
- **RLS 적용**: Realtime 채널은 인증된 사용자만 구독. 비멤버는 `visibility='club'` 이벤트 미수신.
- **상태 추적**: `SUBSCRIBED`, `CHANNEL_ERROR`, `TIMED_OUT` 콜백으로 연결 상태 관리.
- **재조회**: 재연결 성공 시 전체 피드 재조회로 누락 보완 (INCREMENTAL 동기화가 아닌 전체 새로고침 — MVP 단순화).

### 2.4 상태 관리

- **피드 상태**: React Query(TanStack Query) 또는 로컬 상태로 피드 목록 캐싱.
- **Realtime 통합**: Realtime 이벤트 수신 시 캐시된 피드 목록에 새 행 추가(invalidate 또는 optimistic update).
- **진도 상태**: `user_books.current_page`는 별도 쿼리/캐시로 관리. 진도 업데이트 시 스포일러 필터 재평가 트리거.

---

## 3. 아키텍처 설계 방향

### 3.1 모듈 구조

```
src/features/feed/
  queries.ts              # PostgREST 쿼리 함수 (GET /clubs/{id}/feed)
  useClubFeed.ts          # 피드 조회 훅 (초기 로드 + 페이지네이션)
  useClubFeedRealtime.ts  # Realtime 구독 훅
  spoilerFilter.ts        # 클라이언트 측 스포일러 블러 결정
  types.ts                # 피드 응답 타입 (FeedItem, StickerAgg)
  index.ts                # 공개 API
```

### 3.2 데이터 흐름

```
[사용자 진도 업데이트]
  → user_books.current_page 갱신 (SPEC-LIBRARY-001)
  → spoilerFilter 재평가
  → EmotionRecordCard 블러 상태 갱신 (서버 재요청 없음)

[모임원 새 감정 기록 작성] (SPEC-EMOTION-001)
  → emotion_records INSERT
  → Realtime postgres_changes 이벤트
  → useClubFeedRealtime 수신
  → 피드 목록에 새 행 추가
  → spoilerFilter 적용 (page_number vs current_page)
  → EmotionRecordCard 렌더링
```

### 3.3 RLS 및 인덱스 연동

- **조회 권한**: RLS(REQ-DB-016)가 `visibility='club'` 기록을 멤버에게만 노출. 클라이언트 권한 로직 불필요.
- **Realtime 권한**: 동일 RLS가 Realtime 이벤트에 적용. 비멤버 구독 시 이벤트 미수신.
- **조회 성능**: 인덱스 `(book_id, page_number)`로 모임 책 기준 페이지네이션 최적화.
- **멤버십 검증**: `fn_user_in_club(club_id)` 헬퍼(REQ-DB-013d)가 RLS 내부에서 재귀 없이 검증.

---

## 4. 리스크 및 대응 계획

### 리스크 1: Realtime 이벤트 누락

**위험**: 네트워크 단절 기간 중 발생한 INSERT 이벤트를 클라이언트가 수신하지 못할 수 있다.

**대응**: 재연결 성공 시 전체 피드 재조회(`GET /clubs/{id}/feed`)로 누락 보완. MVP에서는 증분 동기화 대신 전체 새로고침으로 단순화.

### 리스크 2: 스티커 집계 Realtime 동기화 복잡도

**위험**: `sticker_reactions` INSERT 이벤트를 각 기록에 매핑하고 집계를 갱신하는 로직이 복잡할 수 있다.

**대응**: 클라이언트에서 이벤트 수신 시 해당 `record_id`의 기록을 찾아 count를 increment. 매핑 실패 시(기록이 피드에 없음) 이벤트 무시. 전체 재조회로 정합성 보장.

### 리스크 3: 진도와 피드 동기화 타이밍

**위험**: 사용자가 진도를 업데이트했으나 피드 화면이 이전 진도로 블러를 유지할 수 있다.

**대응**: `current_page`를 클라이언트 상태로 관리하고, 진도 업데이트 이벤트를 피드 훅에 전파. `spoilerFilter`가 즉시 재평가.

### 리스크 4: 대규모 모임에서의 Realtime 부하

**위험**: 모임원 수가 많을 경우 Realtime 이벤트 빈도가 증가하여 클라이언트 부하가 발생할 수 있다.

**대응**: MVP에서는 모임 규모가 니치 시장 수준(product.md "니치 시장 집중")이므로 이벤트 빈도가 제한적. 확장 단계에서 이벤트 배칭 또는 디바운싱 검토.

---

## 5. 제외 범위 (구현하지 않을 항목)

본 계획은 spec.md §4 제외 범위를 준수한다. 추가로 다음을 구현하지 않는다:

1. **Edge Function**: 피드 조회용 Edge Function은 두지 않는다. PostgREST 직접 호출.
2. **집계 테이블**: 스티커 집계용 별도 테이블은 두지 않는다. GROUP BY 쿼리로 실시간 산출.
3. **서버 측 스포일러 필터링**: 서버는 진도 초과 기록도 반환한다. 블러는 클라이언트에서 결정.
4. **오프라인 캐싱**: MVP에서는 오프라인 피드 조회를 지원하지 않는다. 네트워크 연결 필수.

---

## 6. 완료 정의 (Definition of Done)

- [ ] REQ-FEED-001 ~ REQ-FEED-008 모든 요구사항 구현
- [ ] acceptance.md 모든 시나리오 통과
- [ ] TRUST 5 품질 게이트 통과 (테스트 커버리지 85%+)
- [ ] RLS 정책이 비멤버 접근을 차단함을 검증
- [ ] Realtime 이벤트가 멤버에게만 전달됨을 검증
- [ ] 스포일러 블러가 진도 업데이트 시 즉시 재평가됨을 검증
- [ ] `EmotionRecordCard`(SPEC-UI-001)와 통합 동작 확인
- [ ] 인덱스 `(book_id, page_number)` 활용 검증

---

## 7. 추적성

| 계획 요소 | 연결된 REQ | 소스 |
|-----------|-----------|------|
| Primary Goal | REQ-FEED-001, REQ-FEED-002, REQ-FEED-003, REQ-FEED-004, REQ-FEED-005 | spec.md §3 REQ-FEED-QUERY, REQ-FEED-SPOILER |
| Secondary Goal | REQ-FEED-006, REQ-FEED-007, REQ-FEED-008 | spec.md §3 REQ-FEED-REALTIME |
| Optional Goal | 미결정 5.1, 5.2, 5.3 | spec.md §5 |
