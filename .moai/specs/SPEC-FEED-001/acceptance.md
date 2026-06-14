---
id: SPEC-FEED-001
title: "스포일러 방지 진도별 피드 — 인수 기준"
version: "1.0.0"
status: draft
created: 2026-06-14
updated: 2026-06-14
author: "강력쇠주먹"
priority: medium
issue_number: 0
labels: [feed, realtime, spoiler, club, supabase, phase-3, acceptance]
---

# SPEC-FEED-001: 인수 기준 (acceptance.md)

## HISTORY

| 날짜 | 버전 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 2026-06-14 | 1.0.0 | 최초 작성 — 8개 REQ에 대한 Given-When-Then 시나리오, 품질 게이트, 검증 방법 | 강력쇠주먹 |

---

## 1. 인수 시나리오 (Given-When-Then)

### REQ-FEED-001: 모임 피드 초기 로드

#### 시나리오 F1: 모임 멤버의 피드 조회 (정상)

**Given** 인증된 사용자가 모임 `club-1`의 멤버이다 (`club_members` 행 존재)
**And** 모임 `club-1`의 책(`clubs.book_id=book-1`)에 `visibility='club'`, `club_id=club-1`인 감정 기록이 5개 존재한다
**When** 사용자가 `GET /clubs/club-1/feed`를 요청한다
**Then** 시스템은 5개의 감정 기록을 반환한다
**And** 각 기록은 작성자 공개 프로필(`nickname`, `avatar_url`)을 포함한다
**And** 각 기록은 스티커 집계(`sticker_type`별 count)를 포함한다

#### 시나리오 F2: 비멤버의 피드 조회 (RLS 차단)

**Given** 인증된 사용자가 모임 `club-1`의 멤버가 아니다 (`club_members` 행 없음)
**And** 모임 `club-1`에 `visibility='club'` 감정 기록이 5개 존재한다
**When** 사용자가 `GET /clubs/club-1/feed`를 요청한다
**Then** 시스템은 빈 결과(0행)를 반환한다
**And** RLS 정책(REQ-DB-016)이 `visibility='club'` 기록을 노출하지 않는다

#### 시나리오 F3: 다른 모임의 기록 제외

**Given** 사용자가 모임 `club-1`의 멤버이다
**And** 모임 `club-2`에 `visibility='club'`, `club_id=club-2`인 감정 기록이 존재한다 (같은 책)
**When** 사용자가 `GET /clubs/club-1/feed`를 요청한다
**Then** 시스템은 `club-2`의 기록을 반환하지 않는다 (`club_id` 필터)

---

### REQ-FEED-002: 모임 피드 페이지네이션

#### 시나리오 F4: 무한 스크롤 추가 로드

**Given** 모임 `club-1`에 `visibility='club'` 감정 기록이 50개 존재한다
**And** 초기 로드 페이지 크기가 20행이다
**When** 사용자가 피드 하단에 도달하여 추가 로드를 요청한다
**Then** 시스템은 커서 기반으로 다음 20행을 반환한다
**And** 중복 행이 포함되지 않는다 (`created_at` 기준)

#### 시나리오 F5: 빈 추가 페이지

**Given** 모임 `club-1`에 감정 기록이 15개 존재한다
**And** 초기 로드(20행)가 모든 기록을 반환했다
**When** 사용자가 추가 로드를 요청한다
**Then** 시스템은 빈 결과를 반환한다

---

### REQ-FEED-003: 모임 책 컨텍스트 검증

#### 시나리오 F6: 모임 책과 다른 책 기록 제외

**Given** 모임 `club-1`의 책이 `book-1`이다 (`clubs.book_id=book-1`)
**And** 같은 모임(`club-1`)에 `book_id=book-2`인 기록이 우연히 존재한다 (비정상 상태)
**When** 사용자가 `GET /clubs/club-1/feed`를 요청한다
**Then** 시스템은 `book_id=book-1`인 기록만 반환한다 (`book_id` 필터 적용)

---

### REQ-FEED-004: 진도별 스포일러 블러 처리

#### 시나리오 F7: 진도 초과 기록 블러 처리

**Given** 사용자의 책 `book-1` 진도가 `current_page=50`이다
**And** 피드에 `page_number=80`인 감정 기록이 존재한다
**When** 시스템이 해당 기록을 렌더링한다
**Then** `EmotionRecordCard`의 스포일러 블러(12px blur)가 활성화된다
**And** "진도 이후 내용입니다" 안내 문구가 노출된다

#### 시나리오 F8: 진도 이내 기록 정상 표시

**Given** 사용자의 책 `book-1` 진도가 `current_page=50`이다
**And** 피드에 `page_number=30`인 감정 기록이 존재한다
**When** 시스템이 해당 기록을 렌더링한다
**Then** 스포일러 블러가 적용되지 않는다
**And** 기록 내용이 정상 노출된다

#### 시나리오 F9: 진도 업데이트 시 즉시 블러 재평가

**Given** 사용자의 진도가 `current_page=50`이고 `page_number=80`인 기록이 블러 처리되어 있다
**When** 사용자가 진도를 `current_page=100`으로 업데이트한다
**Then** 서버 재요청 없이 `page_number=80` 기록의 블러가 즉시 해제된다
**And** 기록 내용이 정상 노출된다

---

### REQ-FEED-005: 스포일러 해제 상호작용

#### 시나리오 F10: 블러 해제 (일시)

**Given** 사용자의 진도가 `current_page=50`이고 `page_number=80`인 기록이 블러 처리되어 있다
**When** 사용자가 블러된 기록을 탭한다
**Then** 시스템은 일시적으로(해당 세션 내) 블러를 해제한다
**And** 기록 내용이 노출된다

#### 시나리오 F11: 화면 이탈 시 블러 복원

**Given** 사용자가 블러를 일시 해제한 상태이다 (시나리오 F10)
**When** 사용자가 피드 화면을 이탈했다가 다시 진입한다
**Then** 시스템은 `page_number=80` 기록의 블러를 복원한다 (MVP 기본값: 일시 해제)

---

### REQ-FEED-006: 새 감정 기록 Realtime 구독

#### 시나리오 F12: 새 기록 실시간 반영

**Given** 사용자 A와 사용자 B가 모두 모임 `club-1`의 멤버이다
**And** 사용자 A가 모임 피드 화면을 보고 있다 (Realtime 채널 구독 중)
**When** 사용자 B가 새 감정 기록(`visibility='club'`, `club_id=club-1`)을 작성한다
**Then** 사용자 A의 피드에 새 기록이 실시간으로 추가된다 (상단)
**And** 새 기록은 작성자(B) 프로필과 스티커 집계(초기 0)를 표시한다

#### 시나리오 F13: 비멤버 Realtime 이벤트 미수신

**Given** 사용자 C가 모임 `club-1`의 멤버가 아니다
**And** 사용자 C가 모임 `club-1` 피드 화면에 접근한다 (빈 결과)
**When** 모임 멤버가 새 감정 기록을 작성한다
**Then** 사용자 C는 Realtime 이벤트를 수신하지 않는다 (RLS 적용)
**And** 사용자 C의 화면에 변화가 없다

---

### REQ-FEED-007: 새 스티커 반응 Realtime 구독

#### 시나리오 F14: 스티커 집계 실시간 갱신

**Given** 사용자 A가 모임 피드를 보고 있고 기록 `record-1`의 스티커 집계가 `empathy: 2, touching: 1, comforted: 0`이다
**When** 모임 멤버가 `record-1`에 `sticker_type='comforted'` 반응을 등록한다
**Then** 사용자 A의 화면에서 `record-1`의 집계가 `empathy: 2, touching: 1, comforted: 1`로 갱신된다
**And** `StickerReaction` 컴포넌트의 count가 증가한다

#### 시나리오 F15: 피드에 없는 기록의 스티커 이벤트 무시

**Given** 사용자 A의 피드에 `record-1`~`record-5`만 로드되어 있다 (초기 20행 중 5행)
**When** `record-30`(피드에 없음)에 새 스티커 반응이 등록된다
**Then** 시스템은 이벤트를 무시한다 (매핑 실패)
**And** 사용자 A의 화면에 변화가 없다

---

### REQ-FEED-008: Realtime 재연결 및 에러 처리

#### 시나리오 F16: 네트워크 단절 시 상태 표시

**Given** 사용자가 모임 피드를 보고 있다 (Realtime 구독 중)
**When** 네트워크 연결이 단절된다
**Then** 시스템은 "실시간 연결 끊김 — 재연결 중" 상태를 표시한다
**And** 기존 피드 목록은 유지된다 (이미 로드된 데이터)

#### 시나리오 F17: 재연결 성공 시 누락 보완

**Given** 네트워크 단절 기간 중 모임 멤버가 3개의 새 감정 기록을 작성했다
**When** 네트워크가 복구되고 Realtime 채널이 재연결된다
**Then** 시스템은 전체 피드를 재조회(`GET /clubs/{id}/feed`)한다
**And** 단절 기간 중 작성된 3개의 기록이 포함된다

---

## 2. 품질 게이트 (Quality Gates)

### TRUST 5 검증

| 기둥 | 기준 | 검증 방법 |
|------|------|-----------|
| Tested | 85%+ 코드 커버리지 | Jest + @testing-library/react-native, 모든 시나리오 F1-F17 단위/통합 테스트 |
| Readable | 명확한命名, 영어 주석 | ESLint, 코드 리뷰, 한국어 문서화 주석은 code_comments 설정(ko) 준수 |
| Unified | 일관된 스타일 | Prettier, ESLint 규칙, tokens.ts 기반 스타일링 (색/간격 하드코딩 금지) |
| Secured | RLS 의존, service_role 미사용 | RLS 정책 검증 테스트, 비멤버 접근 차단 시나리오 F2/F13 |
| Trackable | Conventional commits, SPEC 참조 | `feature/SPEC-FEED-001-club-feed` 브랜치, 커밋 메시지에 REQ-FEED-XXX 참조 |

### LSP 품질 게이트 (run 단계)

- 0 에러, 0 타입 에러, 0 린트 에러 (TypeScript strict)
- Realtime 훅의 useEffect cleanup 검증 (메모리 누수 방지)
- 페이지네이션 커서 로직 타입 안정성 검증

---

## 3. 검증 방법 및 도구

### 3.1 단위 테스트

- **spoilerFilter**: `page_number` vs `current_page` 비교 로직 — F7, F8, F9 시나리오
- **queries**: PostgREST 쿼리 빌더 검증 — F1, F3, F6 시나리오
- **useClubFeedRealtime**: 이벤트 수신 및 상태 갱신 — F12, F14, F15 시나리오

### 3.2 통합 테스트

- **RLS 검증**: Supabase 로컬 개발 환경에서 비멤버 세션으로 피드 조회 시 빈 결과 확인 — F2, F13
- **Realtime E2E**: 두 클라이언트 세션(멤버 A, 멤버 B)에서 기록 작성 → 실시간 반영 확인 — F12, F14
- **재연결**: 네트워크 시뮬레이션(오프라인 모드) → 재연결 → 누락 보완 — F16, F17

### 3.3 수동 검증

- **EmotionRecordCard 통합**: SPEC-UI-001 컴포넌트의 스포일러 블러 12px가 정상 동작하는지 시각 확인
- **다크모드**: 피드 화면의 light/dark 모드 전환 시 스포일러 블러 가시성 확인
- **접근성**: WCAG AA 터치타겟(44dp), accessibilityLabel 준수

---

## 4. Definition of Done (완료 정의)

- [ ] 시나리오 F1-F17 모두 통과
- [ ] 단위 테스트 커버리지 85%+
- [ ] RLS 정책이 비멤버 접근을 차단함을 통합 테스트로 검증
- [ ] Realtime 이벤트가 멤버에게만 전달됨을 E2E로 검증
- [ ] 스포일러 블러가 진도 업데이트 시 서버 재요청 없이 재평가됨을 검증
- [ ] `EmotionRecordCard`(SPEC-UI-001) 통합 동작 확인
- [ ] 다크모드 지원 확인
- [ ] TRUST 5 모든 기둥 통과
- [ ] LSP 게이트 0 에러
- [ ] conventional commits + SPEC 참조

---

## 5. 추적성

| 시나리오 | REQ | 검증 유형 |
|----------|-----|-----------|
| F1 | REQ-FEED-001 | 통합 (정상 조회) |
| F2 | REQ-FEED-001 | 통합 (RLS 차단) |
| F3 | REQ-FEED-001, REQ-FEED-003 | 단위 (club_id 필터) |
| F4 | REQ-FEED-002 | 단위 (페이지네이션) |
| F5 | REQ-FEED-002 | 단위 (빈 페이지) |
| F6 | REQ-FEED-003 | 단위 (book_id 필터) |
| F7 | REQ-FEED-004 | 단위 (블러 활성화) |
| F8 | REQ-FEED-004 | 단위 (블러 미적용) |
| F9 | REQ-FEED-004 | 통합 (진도 업데이트 재평가) |
| F10 | REQ-FEED-005 | 단위 (블러 해제) |
| F11 | REQ-FEED-005 | 통합 (화면 이탈 복원) |
| F12 | REQ-FEED-006 | E2E (새 기록 실시간) |
| F13 | REQ-FEED-006 | E2E (비멤버 미수신) |
| F14 | REQ-FEED-007 | E2E (스티커 집계 갱신) |
| F15 | REQ-FEED-007 | 단위 (매핑 실패 무시) |
| F16 | REQ-FEED-008 | 통합 (단절 상태 표시) |
| F17 | REQ-FEED-008 | 통합 (재연결 누락 보완) |
