---
id: SPEC-FEED-001
title: "스포일러 방지 진도별 피드 — Compact"
version: "1.1.0"
status: implemented
created: 2026-06-14
updated: 2026-06-20
author: "강력쇠주먹"
priority: medium
issue_number: 0
labels: [feed, realtime, spoiler, club, supabase, phase-3, compact]
---

# SPEC-FEED-001: Compact 요약

> 본 문서는 spec.md의 핵심만 추약한 실행용 요약이다. 상세는 spec.md를 참조한다.

## 핵심 범위

모임(`club_id`) 단위 진도별 슬라이딩 피드. 모임원의 `visibility='club'` 감정 기록을 표시하며, 현재 사용자 진도 초과 페이지는 클라이언트 측에서 블러 처리. Supabase Realtime(postgres_changes)로 새 기록/스티커 실시간 반영.

## 데이터 흐름

```
emotion_records (visibility=club, club_id) ──RLS(REQ-DB-016)──→ 피드 조회
  ↓ fn_user_in_club (REQ-DB-013d) 멤버십 검증
  ↓ 인덱스 (book_id, page_number) 페이지네이션
  ↓ 클라이언트 spoilerFilter (page_number vs current_page) → 블러 12px

Realtime postgres_changes ──RLS 적용──→ 멤버에게만 이벤트 전달
  ↓ emotion_records INSERT → 피드 목록 추가
  ↓ sticker_reactions INSERT → 집계 갱신
```

## 요구사항 (8개)

### REQ-FEED-QUERY (모임 피드 조회)

| REQ | 요약 |
|-----|------|
| REQ-FEED-001 | 모임 멤버가 `GET /clubs/{id}/feed` 요청 시 `visibility='club'`, `club_id` 매칭 기록 반환. 비멤버는 RLS로 빈 결과. 작성자 프로필 + 스티커 집계 포함 |
| REQ-FEED-002 | 커서 기반 페이지네이션 (`created_at` DESC). 무한 스크롤. 임시 페이지 크기 20행 |
| REQ-FEED-003 | 피드 기록의 `book_id`가 모임 책(`clubs.book_id`)과 일치. 클라이언트 필터 |

### REQ-FEED-SPOILER (진도별 스포일러 블러)

| REQ | 요약 |
|-----|------|
| REQ-FEED-004 | `page_number > user_books.current_page` 시 `EmotionRecordCard` 블러 12px + "이 기록은 내 진도를 넘었어요"(FROZEN UI-001 기준, v1.1.0 정정). 진도 업데이트 시 서버 재요청 없이 즉시 재평가 |
| REQ-FEED-005 | 블러 탭 시 일시 해제 (MVP 기본값). 화면 이탈 시 복원 |

### REQ-FEED-REALTIME (Supabase Realtime 구독)

| REQ | 요약 |
|-----|------|
| REQ-FEED-006 | `emotion_records` INSERT 시 멤버 클라이언트에 Realtime 이벤트. 피드 상단에 새 행 추가. 비멤버 미수신 (RLS) |
| REQ-FEED-007 | `sticker_reactions` INSERT 시 해당 기록 집계 increment. 피드에 없는 기록 이벤트는 무시 |
| REQ-FEED-008 | 단절 시 자동 재연결 + 상태 표시. 재연결 성공 시 전체 피드 재조회로 누락 보완 |

## 핵심 가정

1. **스포일러 블러는 클라이언트 측** — 서버는 진도 초과 기록도 반환, 클라이언트가 `page_number` vs `current_page`로 결정
2. **RLS 단독 권한 검증** — 클라이언트/Edge Function 권한 로직 미구현. Realtime에도 동일 RLS 적용
3. **MVP는 모임 피드만** — 공개(public) 전체 피드는 비목표
4. **좋아요/팔로우 없음** — 상호작용은 스티커 3종만

## 제외 범위

- 실시간 팝업 채팅 (비목표)
- 좋아요/팔로우 (비목표)
- 공개(public) 전체 피드 (비목표)
- 피드 검색/필터
- 알림 (SPEC-NOTIF-001)
- 감정 기록 CRUD (SPEC-EMOTION-001)
- Edge Function (PostgREST 직접 호출)

## 미결정 사항

| ID | 이슈 | 임시 방침 | 해결 시점 |
|----|------|-----------|-----------|
| 5.1 | 블러 해제 영구 vs 세션 | 일시 해제 (화면 이탈 시 복원) | v1.1.0 |
| 5.2 | Realtime 재연결 백오프 | Supabase 기본 동작 의존 | v1.1.0 (지수 백오프 검토) |
| 5.3 | 초기 로드 페이지 크기 | 20행 | v1.1.0 (성능 데이터 기반) |

## 의존성

| 선행 SPEC | 소비 산출물 |
|-----------|-------------|
| SPEC-DB-001 | emotion_records(REQ-DB-004), RLS(REQ-DB-016/017/019), fn_user_in_club(REQ-DB-013d), user_profiles 뷰(REQ-DB-013e), 인덱스 (book_id, page_number) |
| SPEC-EMOTION-001 | 스포일러 블러 패턴, 스티커 집계, visibility 제어 |
| SPEC-UI-001 | EmotionRecordCard(REQ-FE-024, 블러 12px), StickerReaction(REQ-FE-025) |
| SPEC-CLUB-001/002 | 모임 컨텍스트, club_id, book_id |
| SPEC-API-001 | Supabase 클라이언트, Realtime 채널, 인증 헤더 |

## 구현 산출물 (참고)

```
src/features/feed/
  queries.ts              # GET /clubs/{id}/feed (PostgREST)
  useClubFeed.ts          # 피드 조회 훅 (초기 로드 + 페이지네이션)
  useClubFeedRealtime.ts  # Realtime 구독 훅
  spoilerFilter.ts        # 클라이언트 측 스포일러 결정
  types.ts                # FeedItem, StickerAgg
```

모임 피드 화면, `EmotionRecordCard` 통합.
