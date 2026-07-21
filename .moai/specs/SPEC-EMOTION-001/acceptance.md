---
id: SPEC-EMOTION-001
title: "감정 아카이브 및 스티커 반응 — 인수 기준"
version: "1.0.0"
status: draft
created: 2026-06-14
updated: 2026-06-14
author: "강력쇠주먹"
priority: high
issue_number: 0
labels: [emotion, archive, sticker, acceptance, phase-2]
---

# SPEC-EMOTION-001: 인수 기준 (acceptance.md)

## HISTORY

| 날짜 | 버전 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 2026-06-14 | 1.0.0 | 최초 작성 — Given/When/Then 시나리오, 엣지 케이스, 품질 게이트 | 강력쇠주먹 |

---

## 1. 인수 시나리오 (Given / When / Then)

### REQ-EMO-RECORD: 감정 기록 CRUD

#### 시나리오 1.1: 감정 기록 생성 성공 (public)

**Given** 인증된 사용자가 서재에 등록된 책(`book_id=B1`, `current_page=100`)을 보유하고 있다
**When** 사용자가 `page_number=95`, `content="이 문장에서 멈췄다"`, `visibility="public"`으로 감정 기록 생성을 요청한다
**Then** 시스템은 `emotion_records`에 새 행을 INSERT하고 201 Created를 반환한다
**And** 반환된 행의 `user_id`는 요청자의 `auth.uid()`와 일치한다
**And** 반환된 행의 `club_id`는 `null`이다

#### 시나리오 1.2: 감정 기록 생성 성공 (club)

**Given** 인증된 사용자가 모임 `club_id=C1`의 멤버이다
**When** 사용자가 `book_id=B1`, `page_number=95`, `content="감동"`, `visibility="club"`, `club_id=C1"`로 감정 기록 생성을 요청한다
**Then** 시스템은 201 Created를 반환한다
**And** 반환된 행의 `visibility`는 `"club"`, `club_id`는 `C1`이다

#### 시나리오 1.3: 감정 기록 생성 실패 — 빈 content

**Given** 인증된 사용자가 감정 기록 입력 화면에 있다
**When** 사용자가 `content=""`(빈 문자열) 또는 공백만 있는 content로 생성을 요청한다
**Then** 클라이언트는 제출을 차단하고 "내용을 입력해주세요" 안내를 표시한다
**And** PostgREST 요청은 발생하지 않는다

#### 시나리오 1.4: 감정 기록 생성 실패 — visibility=club 시 club_id 누락

**Given** 인증된 사용자가 감정 기록 생성을 요청한다
**When** `visibility="club"`이지만 `club_id`를 생략한다
**Then** 시스템은 DB CHECK 제약 위반으로 400 Bad Request를 반환한다
**And** 클라이언트는 "모임 감정 기록은 모임을 선택해야 합니다" 메시지를 표시한다

#### 시나리오 1.5: 감정 기록 생성 실패 — 비인증

**Given** 비인증 상태의 클라이언트가 있다
**When** 감정 기록 생성을 요청한다
**Then** 시스템은 401 Unauthorized를 반환한다
**And** `emotion_records`에 행이 생성되지 않는다

#### 시나리오 1.6: 감정 기록 조회 — 스포일러 필터 적용

**Given** 인증된 사용자의 `user_books.current_page=100`이다
**And** 책 B1에 다음 감정 기록이 존재한다: 기록 X(`page_number=95`, public), 기록 Y(`page_number=120`, public), 기록 Z(`page_number=95`, club, 타 사용자의 비공개 모임)
**When** 사용자가 책 B1의 감정 기록 목록을 조회한다
**Then** 기본 응답에는 기록 X만 포함된다 (`page_number=95 <= 100`)
**And** 기록 Y는 `page_number=120 > 100`이므로 기본 응답에서 제외된다
**And** 기록 Z는 RLS(모임 비멤버)에 의해 제외된다

#### 시나리오 1.7: 감정 기록 조회 — 작성자 조인 + 스티커 집계

**Given** 감정 기록 X(`user_id=U1`)에 스티커 반응 `empathy` 3개, `touching` 2개가 존재한다
**When** 사용자가 기록 X가 포함된 목록을 조회한다
**Then** 기록 X의 응답에 `users: { nickname, avatar_url }` 조인 데이터가 포함된다
**And** 기록 X의 응답에 `sticker_reactions: [{ sticker_type: "empathy", count: 3 }, { sticker_type: "touching", count: 2 }]` 집계가 포함된다

#### 시나리오 1.8: 감정 기록 수정 성공 — 본인

**Given** 인증된 사용자가 본인 소유의 감정 기록(`id=R1`, `content="원래 내용"`)을 보유하고 있다
**When** 사용자가 `content="수정된 내용"`으로 수정을 요청한다
**Then** 시스템은 200 OK를 반환하고 행의 `content`가 변경된다
**And** `updated_at`이 갱신된다

#### 시나리오 1.9: 감정 기록 수정 실패 — 타인

**Given** 인증된 사용자가 타인(`user_id=U2`)의 감정 기록을 알고 있다
**When** 사용자가 해당 기록의 `content` 수정을 요청한다
**Then** 시스템은 RLS 정책에 의해 UPDATE를 거부한다 (0 row affected 또는 403)
**And** 기록의 `content`는 변경되지 않는다

#### 시나리오 1.10: 감정 기록 수정 — page_number 변경 불가

**Given** 인증된 사용자가 본인 소유의 감정 기록(`page_number=95`)을 보유하고 있다
**When** 사용자가 `page_number=200`으로 수정을 요청한다 (content와 함께)
**Then** 시스템은 `content`는 변경하지만 `page_number`는 무시한다 (클라이언트가 page_number를 요청 본문에서 제외)
**And** 또는 클라이언트가 page_number 필드를 비활성화하여 수정 불가하도록 UI가 강제한다

#### 시나리오 1.11: 감정 기록 삭제 성공 — 본인

**Given** 인증된 사용자가 본인 소유의 감정 기록(`id=R1`)을 보유하고 있다
**And** 기록 R1에 스티커 반응 5개가 연관되어 있다
**When** 사용자가 기록 R1 삭제를 요청한다
**Then** 시스템은 204 No Content를 반환한다
**And** `emotion_records`에서 R1 행이 삭제된다
**And** 연관된 `sticker_reactions` 5개가 FK `ON DELETE CASCADE`에 의해 자동 삭제된다

#### 시나리오 1.12: 감정 기록 삭제 실패 — 타인

**Given** 인증된 사용자가 타인의 감정 기록 ID를 알고 있다
**When** 사용자가 해당 기록 삭제를 요청한다
**Then** 시스템은 RLS 정책에 의해 DELETE를 거부한다 (0 row affected)
**And** 기록은 삭제되지 않는다

---

### REQ-EMO-GUIDE: 안전한 글쓰기 울타리 (단어 질문지)

#### 시나리오 2.1: 단어 질문지 제안 표시

**Given** 인증된 사용자가 감정 기록 입력 화면을 열었다
**When** 화면이 로드된다
**Then** 화면 상단(또는 입력 폼 근처)에 1~2개의 짧은 질문 프롬프트가 노출된다
**And** 질문은 정적 풀(3~5개)에서 라운드 로빈 또는 랜덤으로 선택된다

#### 시나리오 2.2: 단어 질문지 선택 — 자유 입력 허용

**Given** 사용자가 질문 프롬프트를 보고 있다
**When** 사용자가 질문을 무시하고 자유 입력으로 content를 작성한다
**Then** 시스템은 자유 입력을 허용한다 (질문 선택이 강제가 아님)
**And** 제출 시 질문 정보는 `emotion_records`에 저장되지 않는다 (content만 저장)

#### 시나리오 2.3: 단어 질문지 — content 힌트로만 작동

**Given** 사용자가 질문 프롬프트 "이 페이지에서 멈춘 문장은?"을 본다
**When** 사용자가 해당 질문에 답하는 content를 작성한다
**Then** 시스템은 content를 일반 감정 기록으로 저장한다
**And** 질문-응답 매핑 메타데이터는 저장하지 않는다 (MVP)

---

### REQ-EMO-STICKER: 스티커 반응 (3종, 409 처리)

#### 시나리오 3.1: 스티커 반응 등록 성공

**Given** 인증된 사용자가 타인의 감정 기록(`id=R1`)을 조회할 수 있다 (public 또는 모임 멤버)
**When** 사용자가 `sticker_type="empathy"`로 스티커 반응 등록을 요청한다
**Then** 시스템은 `sticker_reactions`에 `(record_id=R1, user_id=me, sticker_type=empathy)` 행을 INSERT하고 201 Created를 반환한다

#### 시나리오 3.2: 스티커 반응 등록 — 자기 반응 허용

**Given** 인증된 사용자가 본인 소유의 감정 기록(`id=R2`)을 보유하고 있다
**When** 사용자가 본인 기록에 `sticker_type="comforted"` 스티커를 등록한다
**Then** 시스템은 201 Created를 반환한다 (자기 반응 허용, SPEC-DB-001 비즈니스 가정 2.2.4)

#### 시나리오 3.3: 스티커 반응 등록 실패 — 중복 (409 Conflict)

**Given** 인증된 사용자가 이미 기록 R1에 `sticker_type="empathy"` 반응을 등록한 상태이다
**When** 사용자가 다시 기록 R1에 `sticker_type="touching"` 반응 등록을 요청한다
**Then** 시스템은 UNIQUE `(record_id, user_id)` 제약 위반으로 409 Conflict를 반환한다
**And** 기존 반응은 `empathy`로 유지된다 (업서트 미적용)
**And** 클라이언트는 "이미 반응한 기록입니다. 기존 반응을 취소 후 다시 시도하세요" 안내를 표시한다

#### 시나리오 3.4: 스티커 반응 등록 실패 — 잘못된 sticker_type

**Given** 인증된 사용자가 스티커 반응 등록을 요청한다
**When** `sticker_type="happy"` (ENUM 값이 아님)로 요청한다
**Then** 시스템은 400 Bad Request를 반환한다
**And** `sticker_reactions`에 행이 생성되지 않는다

#### 시나리오 3.5: 스티커 반응 취소 성공

**Given** 인증된 사용자가 기록 R1에 등록한 스티커 반응을 보유하고 있다
**When** 사용자가 해당 반응 취소(DELETE)를 요청한다
**Then** 시스템은 204 No Content를 반환한다
**And** `sticker_reactions`에서 해당 행이 삭제된다

#### 시나리오 3.6: 스티커 반응 취소 실패 — 타인 반응

**Given** 인증된 사용자가 타인의 스티커 반응 존재를 알고 있다
**When** 사용자가 타인의 반응 취소를 요청한다
**Then** 시스템은 RLS 정책에 의해 DELETE를 거부한다 (0 row affected)
**And** 반응은 삭제되지 않는다

#### 시나리오 3.7: 스티커 종류 변경 — 2단계 프로세스

**Given** 인증된 사용자가 기록 R1에 `empathy` 반응을 보유하고 있다
**When** 사용자가 "스티커를 touching으로 교체" 액션을 선택한다
**Then** 클라이언트는 내부적으로 DELETE(기존 empathy 취소) → POST(touching 등록) 순차 실행한다
**And** 두 요청 모두 성공하면 최종적으로 `touching` 반응이 등록된다
**And** 중간 단계에서 네트워크 실패 시 사용자에게 재시도 안내를 표시한다

---

### REQ-EMO-SPOILER: 스포일러 방지 블러 + 타임라인

#### 시나리오 4.1: 스포일러 블러 활성화

**Given** 인증된 사용자의 `user_books.current_page=100`이다
**And** 피드에 `page_number=150`인 감정 기록이 포함되어 있다 (사용자가 "스포일러 포함 보기" 선택)
**When** 해당 기록이 `EmotionRecordCard`로 렌더링된다
**Then** 카드 본문 영역에 12px blur 효과가 적용된다 (SPEC-UI-001 REQ-FE-024)
**And** 블러 영역에 "진도 이후 내용입니다" 안내 문구가 노출된다

#### 시나리오 4.2: 스포일러 블러 일시 해제

**Given** 스포일러 블러가 활성화된 감정 기록 카드가 표시되어 있다
**When** 사용자가 블러 영역을 탭한다
**Then** 블러가 일시적으로 해제되어 본문이 노출된다
**And** 사용자가 해당 화면을 이탈하면 블러가 복원된다 (일시 해제, 미결정 5.3 기본값)

#### 시나리오 4.3: 타임라인 — 시간순 정렬 (기본값)

**Given** 책 B1에 감정 기록이 여러 개 존재한다
**When** 사용자가 타임라인 뷰를 연다
**Then** 기본 정렬은 `created_at DESC`(최신순)로 적용된다
**And** 각 기록은 `EmotionRecordCard`로 표시되고 스포일러 블러가 적용된다

#### 시나리오 4.4: 타임라인 — 페이지순 정렬

**Given** 사용자가 타임라인 뷰를 보고 있다
**When** 사용자가 "페이지순" 정렬 토글을 선택한다
**Then** 기록이 `page_number ASC`로 정렬된다
**And** 동일 `page_number` 내에서는 `created_at ASC`(오래된 순)로 2차 정렬된다

#### 시나리오 4.5: 공개 범위 제어 — public → club 전환

**Given** 인증된 사용자가 본인의 `visibility="public"` 감정 기록을 보유하고 있다
**When** 사용자가 해당 기록을 `visibility="club"`, `club_id=C1`으로 수정한다
**Then** 시스템은 200 OK를 반환하고 `visibility`, `club_id`가 갱신된다
**And** 이후 타 사용자 중 C1 모임 비멤버는 해당 기록을 조회할 수 없다 (RLS)

#### 시나리오 4.6: 공개 범위 제어 — club → public 전환

**Given** 인증된 사용자가 `visibility="club"`, `club_id=C1"`인 감정 기록을 보유하고 있다
**When** 사용자가 `visibility="public"`으로 수정한다
**Then** 시스템은 200 OK를 반환하고 `visibility`가 `"public"`으로 갱신된다
**And** `club_id`는 `null`로 설정된다 (또는 무시됨)

---

## 2. 엣지 케이스 (Edge Cases)

### EC-1: 감정 기록 생성 — 존재하지 않는 book_id

**시나리오**: 사용자가 존재하지 않는 `book_id`로 감정 기록 생성을 요청한다
**기대 동작**: FK 제약 위반으로 400 Bad Request 반환. 클라이언트는 "책 정보를 찾을 수 없습니다" 안내.

### EC-2: 감정 기록 생성 — 서재에 등록하지 않은 책

**시나리오**: 사용자가 `user_books`에 등록하지 않은 책에 감정 기록을 작성하려 한다
**기대 동작**: 클라이언트가 사전 검증하여 "서재에 등록된 책만 감정 기록을 작성할 수 있습니다" 안내. (SPEC-LIBRARY-001 연동)

### EC-3: 스티커 반응 — 존재하지 않는 record_id

**시나리오**: 사용자가 존재하지 않는 `record_id`로 스티커 반응 등록을 요청한다
**기대 동작**: FK 제약 위반으로 400 Bad Request 반환.

### EC-4: 스티커 반응 — 삭제된 기록에 대한 반응

**시나리오**: 기록 R1이 삭제된 후, 사용자가 R1에 대한 스티커 반응 등록을 요청한다
**기대 동작**: FK 제약 위반(또는 이미 CASCADE로 반응도 삭제됨)으로 400 반환.

### EC-5: 타임라인 — 감정 기록 0건

**시나리오**: 책 B1에 감정 기록이 하나도 없다
**기대 동작**: 타임라인 뷰에 빈 상태 UI("아직 감정 기록이 없습니다. 첫 기록을 남겨보세요") 표시.

### EC-6: 타임라인 — 대량 기록 페이지네이션

**시나리오**: 책 B1에 감정 기록이 1000개 이상 존재한다
**기대 동작**: 페이지네이션(예: 20개씩) 적용. 스크롤 시 추가 로드. 성능 저하 없음.

### EC-7: 스포일러 — current_page = 0 (독서 시작 전)

**시나리오**: 사용자의 `user_books.current_page=0`이다 (아직 읽기 시작하지 않음)
**기대 동작**: 모든 감정 기록이 스포일러로 간주되어 블러 처리. 단, 본인 기록은 예외 없이 표시.

### EC-8: 스포일러 — page_number 동일 (경계값)

**시나리**: 기록의 `page_number=100`이고 사용자 `current_page=100`이다
**기대 동작**: 스포일러 아님 (`page_number <= current_page`이므로 블러 없음).

### EC-9: visibility=club — 탈퇴한 모임의 기록

**시나리오**: 사용자가 모임 C1에서 탈퇴했다. 과거에 C1에 `visibility=club`으로 작성한 기록이 있다
**기대 동작**: RLS `fn_user_in_club`이 false를 반환하여 사용자가 본인 기록을 더 이상 읽을 수 없다. 이는 알려진 제약사항이며, 본인 기록은 `user_id` 조건으로 별도 조회 경로 제공 필요 (MVP에서는 수용).

### EC-10: 동시 스티커 등록 — 레이스 컨디션

**시나리오**: 두 사용자가 동시에 같은 기록에 스티커를 등록한다
**기대 동작**: DB UNIQUE 제약이 직렬화 보장. 각각 201 Created 반환 (서로 다른 user_id이므로 충돌 없음).

### EC-11: 동시 스티커 등록 — 동일 사용자 중복 요청

**시나리오**: 동일 사용자가 두 번의 빠른 탭으로 같은 기록에 스티커를 등록한다
**기대 동작**: 첫 요청은 201, 두 번째 요청은 409 Conflict. 클라이언트는 낙관적 업데이트 후 409 수신 시 롤백.

### EC-12: 감정 기록 content 매우 긴 입력

**시나리오**: 사용자가 500자 이상의 content를 입력한다
**기대 동작**: 클라이언트가 120자 상한(입력 필드 maxLength)으로 사전 차단. DB는 `text` 타입이므로 강제하지 않음.

---

## 3. 품질 게이트 (Definition of Done)

### 3.1 기능 완성도

- [ ] REQ-EMO-001 ~ REQ-EMO-010 모든 요구사항 구현
- [ ] 시나리오 1.1 ~ 4.6 모든 인수 시나리오 통과
- [ ] 엣지 케이스 EC-1 ~ EC-12 처리 검증

### 3.2 테스트 커버리지

- [ ] 클라이언트 코드 85%+ 커버리지 (Jest + @testing-library/react-native)
- [ ] 권한 거부 시나리오(타인 수정/삭제, 비인증) 테스트 포함
- [ ] 스티커 409 시나리오 테스트 포함
- [ ] 스포일러 블러 활성화/해제 테스트 포함
- [ ] 공개 범위(public/club) 전환 테스트 포함

### 3.3 TRUST 5

- [ ] **Tested**: 85%+ 커버리지, 권한/UNIQUE/CHECK 거부 시나리오 포함
- [ ] **Readable**: 한국어 주석, 명확한 함수명, tokens.ts 사용
- [ ] **Unified**: StyleSheet.create 패턴, ESLint/Prettier 통과
- [ ] **Secured**: RLS 의존 검증, service_role 미사용, 입력 검증(content 비어있지 않음)
- [ ] **Trackable**: conventional commits (`feat(emotion):`, `fix(emotion):`), SPEC-EMOTION-001 참조

### 3.4 통합 검증

- [ ] SPEC-DB-001 RLS 정책(REQ-DB-016/017)과 클라이언트 동작 일치
- [ ] SPEC-UI-001 `EmotionRecordCard`(REQ-FE-024), `StickerReaction`(REQ-FE-025) 컴포넌트 소비
- [ ] SPEC-LIBRARY-001 책 컨텍스트(`book_id`, `current_page`) 통합
- [ ] PostgREST 응답 에러 코드(400/401/403/409) 클라이언트 메시지 매핑

### 3.5 LSP 품질 게이트 (Run Phase)

- [ ] TypeScript strict 컴파일 에러 0건
- [ ] ESLint 에러 0건, 경고 0건
- [ ] Jest 테스트 100% 통과

---

## 4. 검증 방법 및 도구

| 항목 | 도구 | 기준 |
|------|------|------|
| 클라이언트 유닛 테스트 | Jest + @testing-library/react-native | 85%+ 커버리지 |
| API 통합 테스트 | PostgREST 목업 + Supabase 로컬 | 시나리오 1.1~4.6 통과 |
| 권한 테스트 | RLS pgTAP (SPEC-DB-001) + 클라이언트 권한 거부 시나리오 | 타인 접근 100% 차단 |
| 스티커 UNIQUE | 409 시나리오 자동화 테스트 | 중복 요청 409 반환 |
| 타입 안정성 | tsc --strict | 에러 0건 |
| 린트 | ESLint | 에러 0건 |
| 접근성 | EmotionRecordCard accessibilityLabel | WCAG AA 준수 (SPEC-UI-001 상속) |

---

## 5. 미검증 항목 (Out of Scope for Acceptance)

다음 항목은 본 SPEC 인수 범위에서 제외한다:

1. **단어 질문지 진도 구간 매핑**: 미결정 5.1. 정적 풀 라운드 로빈만 검증.
2. **스포일러 블러 영구 해제**: 미결정 5.3. 일시 해제만 검증.
3. **감정 기록 수정 시간 제한**: 미결정 5.2. 무제한 수정 검증.
4. **완독 다이어리 집계**: SPEC-COMPLETION-001 영역.
5. **모임 피드 Realtime**: SPEC-FEED-001 영역.
