---
id: SPEC-EMOTION-001
title: "감정 아카이브 및 스티커 반응 — Compact"
version: "1.0.0"
status: draft
created: 2026-06-14
updated: 2026-06-14
author: "강력쇠주먹"
priority: high
issue_number: 0
labels: [emotion, archive, sticker, compact, phase-2]
---

# SPEC-EMOTION-001: Compact (요구사항 + 인수기준 + 제외 범위)

> 본 문서는 spec.md, acceptance.md에서 핵심만 추출한 실행 요약이다. 상세 내용은 각 원본 문서 참조.

---

## 1. 요구사항 (REQ)

### REQ-EMO-RECORD: 감정 기록 CRUD

| REQ ID | 요구사항 (EARS 요약) |
|--------|---------------------|
| REQ-EMO-001 | 감정 기록 생성: 서재 등록된 책에 대해 `emotion_records` INSERT (`page_number`, `content`, `visibility`, `club_id`). visibility=club 시 club_id 필수 (DB CHECK). |
| REQ-EMO-002 | 감정 기록 조회: RLS 허용 행(본인 OR public OR club 멤버) 반환 + 작성자 조인 + 스티커 집계 + 스포일러 필터(`page_number lte current_page`). |
| REQ-EMO-003 | 감정 기록 수정: 본인만. `content`, `visibility`, `club_id`만 수정 가능. `user_id`, `book_id`, `page_number` 고정. |
| REQ-EMO-004 | 감정 기록 삭제: 본인만. FK CASCADE로 연관 sticker_reactions 자동 삭제. |

### REQ-EMO-GUIDE: 안전한 글쓰기 울타리

| REQ ID | 요구사항 (EARS 요약) |
|--------|---------------------|
| REQ-EMO-005 | 단어 질문지 제안: 진도 기반 1~2개 짧은 질문 프롬프트 노출. 강제 아님(자유 입력 허용). 정적 풀(3~5개) 라운드 로빈. |

### REQ-EMO-STICKER: 스티커 반응

| REQ ID | 요구사항 (EARS 요약) |
|--------|---------------------|
| REQ-EMO-006 | 스티커 등록: `sticker_reactions` INSERT. ENUM empathy/touching/comforted. 자기 반응 허용. UNIQUE 위반 시 409 Conflict (업서트 미적용). |
| REQ-EMO-007 | 스티커 취소: 본인만 DELETE 가능. |

### REQ-EMO-SPOILER: 스포일러 블러 + 타임라인

| REQ ID | 요구사항 (EARS 요약) |
|--------|---------------------|
| REQ-EMO-008 | 스포일러 블러: `page_number > current_page` 시 `EmotionRecordCard` 12px blur 활성화. 탭 시 일시 해제 (화면 이탈 시 복원). |
| REQ-EMO-009 | 타임라인: 시간순(기본) / 페이지순 토글. 페이지순 시 동일 페이지 내 시간순 2차 정렬. |
| REQ-EMO-010 | 공개 범위 제어: visibility=public/club. club 시 club_id 필수 + 모임 멤버 검증 (RLS fn_user_in_club). |

---

## 2. 인수 기준 요약

### 핵심 시나리오

| # | 시나리오 | 기대 결과 |
|---|---------|-----------|
| 1.1 | public 감정 기록 생성 | 201 Created, user_id 자동 주입, club_id=null |
| 1.2 | club 감정 기록 생성 | 201 Created, club_id 설정 |
| 1.3 | 빈 content 생성 | 클라이언트 차단, PostgREST 미호출 |
| 1.4 | visibility=club + club_id 누락 | 400 Bad Request (DB CHECK 위반) |
| 1.6 | 조회 + 스포일러 필터 | page_number <= current_page 행만 반환 |
| 1.7 | 조회 + 작성자 조인 + 스티커 집계 | users 조인 + sticker_reactions GROUP BY 포함 |
| 1.9 | 타인 기록 수정 | RLS 거부 (0 row affected) |
| 1.11 | 본인 기록 삭제 | 204 + 연관 sticker_reactions CASCADE 삭제 |
| 3.1 | 스티커 등록 | 201 Created |
| 3.2 | 자기 기록에 스티커 | 201 Created (자기 반응 허용) |
| 3.3 | 중복 스티커 등록 | 409 Conflict (업서트 미적용) |
| 3.4 | 잘못된 sticker_type | 400 Bad Request (ENUM 위반) |
| 3.5 | 스티커 취소 | 204 No Content |
| 4.1 | 스포일러 블러 | 12px blur + 안내 문구 |
| 4.2 | 블러 일시 해제 | 탭 시 해제, 화면 이탈 시 복원 |
| 4.4 | 타임라인 페이지순 | page_number ASC + created_at ASC 2차 정렬 |

### 엣지 케이스 요약

| # | 엣지 케이스 | 기대 동작 |
|---|------------|-----------|
| EC-1 | 존재하지 않는 book_id | 400 FK 위반 |
| EC-2 | 서재 미등록 책 | 클라이언트 사전 차단 |
| EC-7 | current_page=0 (독서 전) | 본인 기록 제외 모두 블러 |
| EC-8 | page_number = current_page 경계 | 스포일러 아님 (블러 없음) |
| EC-11 | 동일 사용자 중복 탭 | 첫 요청 201, 둘째 409 |

---

## 3. 제외 범위 (Out of Scope)

1. **모임 피드 내 감정 표시** → SPEC-FEED-001
2. **완독 다이어리 집계(report_data 시각화)** → SPEC-COMPLETION-001
3. **스티커 커스텀 SVG 에셋 디자인** → SPEC-UI-001 (자리만 확보)
4. **좋아요/팔로우 기능** → 비목표 (product.md)
5. **실시간 채팅(type=instant)** → 비목표 (MVP 밖)
6. **감정 기록 검색/필터(태그, 키워드)** → 확장 단계
7. **감정 기록 멘션/외부 SNS 공유** → MVP 밖
8. **전용 Edge Function** → PostgREST 직접 호출로 처리

---

## 4. 미결정 사항 요약

| # | 항목 | 상태 | 임시 방침 |
|---|------|------|-----------|
| 5.1 | 단어 질문지 구체 문구 + 진도 구간 매핑 | 미해결 | 정적 풀(3~5개) 라운드 로빈 |
| 5.2 | 감정 기록 수정 허용 범위(시간 제한) | 부분 해결 | 시간 제한 없음, updated_at만 표시 |
| 5.3 | 스포일러 블러 해제 영구 vs 일시 | 부분 해결 | 일시 해제(화면 이탈 시 복원) |

---

## 5. 의존성 요약

| 의존 SPEC | 소비 산출물 |
|-----------|------------|
| SPEC-DB-001 | emotion_records(REQ-DB-004), sticker_reactions(REQ-DB-005), RLS(REQ-DB-016/017), ENUM sticker_type, UNIQUE(record_id, user_id) |
| SPEC-UI-001 | EmotionRecordCard(REQ-FE-024, blur 12px), StickerReaction(REQ-FE-025) |
| SPEC-LIBRARY-001 | 책 컨텍스트(book_id, user_books.current_page), 서재 등록 검증 |
