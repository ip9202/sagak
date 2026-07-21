## Task Decomposition
SPEC: SPEC-FEED-001
Methodology: TDD (RED-GREEN-REFACTOR)
Branch: feature/SPEC-FEED-001-club-feed

Source: manager-strategy execution plan (2026-06-19, approved)

| Task ID | Description | Requirement | Dependencies | Planned Files | Status |
|---------|-------------|-------------|--------------|---------------|--------|
| T-A1 | 피드 타입 정의 (emotion types 재사용 import) | REQ-FEED-001/002/003 | - | src/features/feed/types.ts | pending |
| T-A2 | 스포일러 필터 순수 함수 (page vs current_page, 본인 항상 safe) | REQ-FEED-004 | T-A1 | src/features/feed/spoilerFilter.ts, __tests__/spoilerFilter.test.ts | pending |
| T-A3 | 피드 쿼리 (PostgREST select + club_id/visibility/book_id 필터 + 복합 커서) | REQ-FEED-001/002/003 | T-A1 | src/features/feed/queries.ts, __tests__/queries.test.ts | pending |
| T-A4 | useClubFeed 훅 (useInfiniteQuery, 커서 페이지네이션) | REQ-FEED-002 | T-A3 | src/features/feed/useClubFeed.ts | pending |
| T-B1 | ClubFeedScreen (FlatList + EmotionRecordCard + 세션 revealed state + 빈/로딩/에러) | REQ-FEED-004/005 | T-A2,A4 | src/features/feed/components/ClubFeedScreen.tsx, __tests__/ClubFeedScreen.test.tsx | pending |
| T-B2 | 피드 라우트 + 모임 상세 CTA | REQ-FEED-001 | T-B1 | app/(tabs)/clubs/[clubId]/feed.tsx, app/(tabs)/clubs/[clubId].tsx (edit), src/features/feed/index.ts | pending |
| T-C1 | useClubFeedRealtime (channel 2리스너 + invalidate + cleanup + 상태) | REQ-FEED-006/007/008 | T-A4 | src/features/feed/useClubFeedRealtime.ts, __tests__/useClubFeedRealtime.test.ts | pending |
| T-C2 | Realtime 통합 (ClubFeedScreen 연결 상태 배지) | REQ-FEED-008 | T-B1,T-C1 | src/features/feed/components/ClubFeedScreen.tsx (edit) | pending |
| T-D1 | F14 .pen 모임 피드 화면 프레임 (Pencil MCP) | REQ-SCREEN-* (UI-002) | T-B1 | .moai/design/sagak.pen | pending |

## Acceptance Criteria → Scenario Map (F1-F17)

| AC | Scenario | REQ | Task | Verify |
|----|----------|-----|------|--------|
| AC-1 | F1 멤버 피드 조회 (프로필+스티커) | FEED-001 | T-A3 | 단위(queries) |
| AC-2 | F2 비멤버 빈 결과 (RLS) | FEED-001 | T-A3 | 통합(RLS) |
| AC-3 | F3 다른 club_id 제외 | FEED-001/003 | T-A3 | 단위 |
| AC-4 | F4 무한스크롤 중복 없음 | FEED-002 | T-A3/A4 | 단위(커서) |
| AC-5 | F5 빈 추가 페이지 | FEED-002 | T-A4 | 단위 |
| AC-6 | F6 book_id !== club.book_id 제외 | FEED-003 | T-A3 | 단위 |
| AC-7 | F7 page>current 블러 | FEED-004 | T-A2 | 단위(spoilerFilter) |
| AC-8 | F8 page<=current 정상 | FEED-004 | T-A2 | 단위 |
| AC-9 | F9 진도 업데이트 즉시 재평가 | FEED-004 | T-B1 | 통합 |
| AC-10 | F10 블러 탭 일시 해제 | FEED-005 | T-B1 | 단위+통합 |
| AC-11 | F11 화면 이탈 복원 | FEED-005 | T-B1 | 통합 |
| AC-12 | F12 새 기록 Realtime | FEED-006 | T-C1 | E2E |
| AC-13 | F13 비멤버 미수신 (RLS) | FEED-006 | T-C1 | E2E |
| AC-14 | F14 스티커 집계 갱신 | FEED-007 | T-C1 | 단위+E2E |
| AC-15 | F15 매핑 실패 무시 | FEED-007 | T-C1 | 단위 |
| AC-16 | F16 단절 상태 표시 | FEED-008 | T-C1 | 통합 |
| AC-17 | F17 재연결 재조회 | FEED-008 | T-C1 | 통합 |

## Drift Guard Baseline
- planned_new_files: 8 (types, spoilerFilter, queries, useClubFeed, useClubFeedRealtime, ClubFeedScreen, index, feed.tsx route)
- planned_edits: 2 ([clubId].tsx CTA, ClubFeedScreen Realtime 통합)
- planned_tests: 4
- planned_design: 1 (.pen F14)
