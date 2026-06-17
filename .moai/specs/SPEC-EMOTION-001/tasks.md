---
spec: SPEC-EMOTION-001
title: "감정 아카이브 및 스티커 반응 — 작업 분해"
version: "1.0.0"
created: 2026-06-17
author: "manager-strategy"
methodology: TDD (RED-GREEN-REFACTOR)
---

# SPEC-EMOTION-001 작업 분해 (tasks.md)

> 10개 원자 태스크. 각 태스크 = 1개 TDD 사이클(RED-GREEN-REFACTOR).
> 의존성 순서 준수 (plan.md 마일스톤 1-10 매핑). 모든 태스크는 co-located 테스트 포함.

## 의존성 그래프

```
T-001 (types) ─┬─→ T-002 (emotionApi.create)
               ├─→ T-003 (emotionApi.list)        ─┐
               └─→ T-005 (stickerApi)              │
                                                    ├─→ T-006 (useEmotionRecords) ─┐
T-002 ──→ T-004 (emotionApi.update/delete) ────────┘                                │
                                                                                    ├─→ T-009 (EmotionInputScreen)
T-005 ──→ T-007 (useStickerReaction) ──────────────────────────────────────────────┤
                                                                                    └─→ T-010 (TimelineScreen)
T-008 (questionPrompts) ───────────────────────────────────────────────────────────────→ T-009
T-001~T-008 ────────────────────────────────────────────→ T-009 (통합 테스트)
T-001~T-009 ────────────────────────────────────────────→ T-010 (TRUST 5 게이트)
```

## 태스크 테이블

| Task ID | Description | Requirement | Dependencies | Planned Files | Status |
|---------|-------------|-------------|--------------|---------------|--------|
| T-001 | API 응답/입력 타입 정의 (`EmotionRecordRow`, `EmotionRecordWithAuthor`, `StickerAggregate`, `CreateEmotionInput`, `UpdateEmotionInput`, `Visibility`) — `Database['public']['Tables']['emotion_records']` 파생 + 작성자 조인/스티커 집계 확장 타입. `src/types/index.ts`의 기본 `EmotionRecord`/`StickerType`을 재사용(확장) | REQ-EMO-001~010 (전역 타입 기반) | (없음 — 최초 기반) | `src/features/emotion/types.ts`, `src/features/emotion/__tests__/types.test.ts` | done |
| T-002 | `emotionApi.create(input)` — `emotion_records` INSERT (user_id 자동 주입은 RLS + 클라이언트 주입). content 빈 값/visibility=club 시 club_id 누락 사전 검증 → `VALIDATION` AppError throw (PostgREST 미호출). 400/401 RLS 에러 `normalizeError` 정규화 | REQ-EMO-001, EC-1, EC-2 | T-001 | `src/features/emotion/emotionApi.ts` (create 함수만), `src/features/emotion/__tests__/emotionApi.create.test.ts` | done |
| T-003 | `emotionApi.list({ bookId, userId, currentPage, sort, includeSpoiler })` — 가장 복잡한 쿼리. (a) RLS visible 행 조회 (b) `users` 조인(nickname/avatar) (c) `sticker_reactions` GROUP BY 집계 (d) 클라이언트에서 `page_number > currentPage` 스포일러 분할 → `{ safe: EmotionRecordWithAuthor[], spoiler: EmotionRecordWithAuthor[] }`. sort: `'time'`(created_at DESC) \| `'page'`(page_number ASC, created_at ASC 2차) | REQ-EMO-002 | T-001, T-002 | `src/features/emotion/emotionApi.ts` (list 추가), `src/features/emotion/__tests__/emotionApi.list.test.ts` | done |
| T-004 | `emotionApi.update(id, patch, userId)` + `emotionApi.delete(id, userId)` — 본인만(page_number/user_id/book_id 고정, content/visibility/club_id만 patch). RLS 거부 시 0 row affected → NOT_FOUND/RLS_DENIED 분류. delete는 FK CASCADE로 sticker_reactions 연쇄 삭제 (서버 측) | REQ-EMO-003, REQ-EMO-004 | T-002 | `src/features/emotion/emotionApi.ts` (update/delete 추가), `src/features/emotion/__tests__/emotionApi.updateDelete.test.ts` | done |
| T-005 | `stickerApi.{precheck, create, delete, aggregateByRecord}` — (a) `precheck(recordId, userId)`: 사전 존재 조회 (b) `create(recordId, stickerType, userId)`: INSERT, 409(23505 UNIQUE) → VALIDATION + `UNIQUE_VIOLATION_MESSAGE` 매핑 (c) `delete(recordId, userId)`: RLS DELETE (d) `aggregateByRecord(recordId)`: GROUP BY 집계. ENUM 위반 400 처리 | REQ-EMO-006, REQ-EMO-007, EC-3, EC-4, EC-10, EC-11 | T-001 | `src/features/emotion/stickerApi.ts`, `src/features/emotion/__tests__/stickerApi.test.ts` | done |
| T-006 | `useEmotionRecords({ bookId, userId, currentPage, sort })` — `useQuery` (queryKey: `['emotion','list',{bookId,userId,sort,includeSpoiler}]`). `useCreateEmotionRecord`/`useUpdateEmotionRecord`/`useDeleteEmotionRecord` mutation — optimistic update + snapshot rollback + `invalidateQueries` root key `['emotion',{bookId,userId}]`. library feature 패턴(`mutateCachedItem`/`rollbackSnapshots`) 준수 | REQ-EMO-001~004 (캐시 일관성) | T-002, T-003, T-004 | `src/features/emotion/useEmotionRecords.ts`, `src/features/emotion/__tests__/useEmotionRecords.test.ts` | done |
| T-007 | `useStickerReaction({ recordId, userId, bookId })` — `useCreateSticker`/`useDeleteSticker` mutation. (a) 생성 전 precheck (b) optimistic: 캐시의 해당 record sticker count 증가 (c) 409 수신 시 rollback + "이미 반응한 기록입니다" 안내 (d) `useReplaceSticker`: DELETE→POST 순차, 중간 실패 시 복구 안내. 캐시 무효화는 emotion list 키로 전파(sticker 집계가 list에 포함되므로) | REQ-EMO-006, REQ-EMO-007, EC-11 | T-005, T-006 | `src/features/emotion/useStickerReaction.ts`, `src/features/emotion/__tests__/useStickerReaction.test.ts` | done |
| T-008 | `questionPrompts` 정적 풀(3-5개) + `selectPrompt(currentPage, totalPages, seed)` 라운드 로빈 선택기. 진도 구간 매핑은 v1.1.0 연기(미결정 5.1) — MVP는 단순 라운드 로빈. 외부 의존성 없음 | REQ-EMO-005 | T-001 | `src/features/emotion/questionPrompts.ts`, `src/features/emotion/__tests__/questionPrompts.test.ts` | done |
| T-009 | `EmotionInputScreen({ bookId, userId, currentPage, totalPages })` — 페이지 선택기, content 입력(maxLength 120, 빈 값 차단), `questionPrompts` 제안 표시(자유 입력 허용), visibility 토글(public/club), club 선택. `useCreateEmotionRecord` 연동. `tokens.ts` 변수만 사용(FROZEN 규칙) | REQ-EMO-001, REQ-EMO-005, REQ-EMO-010, EC-2, EC-12 | T-006, T-008 | `src/features/emotion/EmotionInputScreen.tsx`, `src/features/emotion/__tests__/EmotionInputScreen.test.tsx` | done |
| T-010 | `TimelineScreen({ bookId, userId, currentPage })` — `EmotionRecordCard` 목록 렌더링, sort 토글(time/page), 스포일러 블러(`isSpoiler` prop 전달, 탭 시 일시 해제, 화면 이탈 시 복원), 빈 상태 UI(EC-5), 대량 데이터 페이지네이션(EC-6). `useEmotionRecords` + `useStickerReaction` 연동 | REQ-EMO-002, REQ-EMO-008, REQ-EMO-009, EC-5, EC-6, EC-7, EC-8 | T-006, T-007 | `src/features/emotion/TimelineScreen.tsx`, `src/features/emotion/__tests__/TimelineScreen.test.tsx` | done |

## 통합 품질 게이트 (plan.md 마일스톤 9-10)

각 태스크의 co-located 테스트가 plan.md 마일스톤 9(Jest)를 충족한다.
아래 항목들은 T-001~T-010 완료 후 일괄 검증(plan.md 마일스톤 10 TRUST 5):

- [ ] 클라이언트 코드 85%+ 커버리지 (`jest --coverage`)
- [ ] ESLint 에러 0건, 경고 0건
- [ ] `tsc --noEmit` strict 에러 0건
- [ ] 권한 거부 시나리오(타인 수정/삭제, 비인증) 테스트 포함 — T-004, T-005
- [ ] 스티커 409 시나리오 테스트 포함 — T-005, T-007
- [ ] 스포일러 블러 활성화/해제 테스트 포함 — T-010
- [ ] 공개 범위(public/club) 전환 테스트 포함 — T-004, T-009
- [ ] EC-1 ~ EC-12 엣지 케이스 분산 검증 완료

## 태스크 완료 기준 (각 태스크 공통)

1. **RED**: 실패하는 테스트 작성 (jest.mock `getSupabaseClient`, 체인 모킹 패턴 — library 테스트 참조)
2. **GREEN**: 최소 구현으로 테스트 통과
3. **REFACTOR**: `@MX:NOTE`/`@MX:ANCHOR` 태그 추가, 한국어 주석, `tokens.ts` 변수 사용 확인
4. **커버리지**: 해당 파일 85%+ (istanbul)
5. **드리프트 가드**: 계획된 파일 경로와 실제 수정 경로 일치 (drift ≤ 30%)

## 파일 경로 요약 (총 8 소스 + 8 테스트)

```
src/features/emotion/
├── types.ts
├── emotionApi.ts
├── stickerApi.ts
├── useEmotionRecords.ts
├── useStickerReaction.ts
├── questionPrompts.ts
├── EmotionInputScreen.tsx
├── TimelineScreen.tsx
└── __tests__/
    ├── types.test.ts
    ├── emotionApi.create.test.ts
    ├── emotionApi.list.test.ts
    ├── emotionApi.updateDelete.test.ts
    ├── stickerApi.test.ts
    ├── useEmotionRecords.test.ts
    ├── useStickerReaction.test.ts
    ├── questionPrompts.test.ts
    ├── EmotionInputScreen.test.tsx
    └── TimelineScreen.test.tsx
```
