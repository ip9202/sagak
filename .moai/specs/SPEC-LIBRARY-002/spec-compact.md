# SPEC-LIBRARY-002: 병행 독서 지원 (Compact)

## 개요 (Overview)

사용자의 실제 사용 패턴(다중 책 병행 독서)와 충돌하는 `enforce_single_reading` 정책을 철회하고, 메인 홈 UI, 서재 상태 전환, 공개 reader list 가시성을 개선하는 SPEC입니다.

## 핵심 변경 (Key Changes)

### 1. 정책 철회 (Policy Withdrawal)
- `enforce_single_reading` 정책 (SPEC-LIBRARY-001 정책 5.5) 철회
- 트리거/함수/인덱스 DROP (`20240630000001` migration 회수)
- SPEC-LIBRARY-001에 `(RESCINDED by SPEC-LIBRARY-002)` 표시

### 2. 메인 다중 표시 (Multi-Book Display)
- 홈 화면에 reading 상태인 책 **다중 표시** (기존: 단일 표시)
- 정렬: `last_progress_at DESC` (최근 진도 기준)

### 3. 각 BookCard 기록 버튼 (Per-Book Record Button)
- 기존 "오늘의 감정 기록하기" 헤더 CTA 제거
- 각 BookCard에 독립적인 "기록하기" 버튼 추가

### 4. 상태 전환 비배타 (Non-Exclusive Status Transition)
- `reading → reading` (기존 reading 유지)
- 사용자 명시적 `reading → shelved` 전환만 허용 (자동 배타 전환 제거)

### 5. 공개 가시성 회귀 수정 (Public Visibility Regression Fix)
- 공개 책(`is_public=true`)의 reader list 정상 노출 확인

## 기술 구현 (Technical Implementation)

### DB Migration (M1)
- `20240630000001_enforce_single_reading_policy.sql` 회수
- `enforce_single_reading()` 트리거/함수 DROP
- `user_books_one_reading_per_user` 부분 UNIQUE 인덱스 DROP
- `idx_user_books_user_status` (user_id, status) 복합 인덱스 신설

### UI 변경 (M2, M3)
- `src/features/library/components/BookCard.tsx` — 기록 버튼 추가
- `src/features/library/HomeScreen.tsx` — 다중 reading 렌더링
- `app/(tabs)/library.tsx` — status 전환 로직 정리

## 동기화 (Sync)

- SPEC-LIBRARY-001 in-place amendment (D-NEW-1 경로)
- 본 SPEC: `draft → in-progress → completed` (3-phase close)
- 의존 SPEC: SPEC-LIBRARY-001, SPEC-DB-001, SPEC-API-001

## 성과 (Outcome)

- 실제 사용자 행동 반영 (다중 독서 지원)
- DB 제약 조건 완화 (단일 reading 제거)
- UI 일관성 개선 (상태 전환 정리)
