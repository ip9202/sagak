---
id: SPEC-PROFILE-001
title: "마이페이지, 통계 및 보상 — 인수 기준"
version: "1.0.0"
status: completed
created: 2026-06-14
updated: 2026-07-23
author: "강력쇠주먹"
priority: medium
issue_number: 0
labels: [profile, stats, reward, badges, settings, supabase, phase-4, acceptance]
---

# SPEC-PROFILE-001: 인수 기준 (acceptance.md)

## HISTORY

| 날짜 | 버전 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 2026-06-20 | 1.0.1 | sync: DB 실제 스키마/코드 기준 SPEC 정정 (ref_id 제거, 감정 배지 총건수, 경로 my/, Profile 타입, 하이브리드 집계) | sync |
| 2026-06-14 | 1.0.0 | 최초 작성 — 8개 REQ에 대한 Given-When-Then 시나리오, 품질 게이트, 검증 방법 | 강력쇠주먹 |

---

## 1. 인수 시나리오 (Given-When-Then)

### REQ-PROF-001: 자기 프로필 조회

#### 시나리오 P1: 인증 사용자의 자기 프로필 조회 (정상)

**Given** 인증된 사용자(`user-1`)가 마이페이지에 진입한다
**And** `users` 테이블에 `user-1`의 행이 존재한다 (`nickname='독서가'`, `avatar_url='https://...'`, `email='user1@example.com'`)
**When** 시스템이 `GET /users/user-1`을 요청한다
**Then** 시스템은 `user-1`의 행을 전체 컬럼으로 반환한다
**And** 반환 데이터에 `nickname`, `avatar_url`, `email`, `provider`, `reading_alarm_time`, `reading_alarm_enabled`, `created_at`이 포함된다

#### 시나리오 P2: 타인 프로필 조회 시 RLS 차단

**Given** 인증된 사용자(`user-1`)가 다른 사용자(`user-2`)의 프로필을 조회하려 한다
**When** 시스템이 `GET /users/user-2`를 요청한다 (클라이언트가 user-2 id로 쿼리)
**Then** 시스템은 RLS 정책(REQ-DB-014)에 의해 빈 결과를 반환한다
**And** `user-2`의 `email`, `reading_alarm_enabled` 등 민감 컬럼이 노출되지 않는다

> 본 SPEC은 자기 프로필이 주 대상이다. 타인 공개 프로필(nickname, avatar_url)은 `user_profiles` 뷰(REQ-DB-013e)를 통해 Track A(SPEC-CLUB-001)에서 처리한다.

---

### REQ-PROF-002: 프로필 수정 (nickname, avatar_url)

#### 시나리오 P3: 자기 프로필 nickname 수정 (정상)

**Given** 인증된 사용자(`user-1`)가 프로필 수정 화면에 있다
**And** 현재 nickname이 '독서가'이다
**When** 사용자가 nickname을 '책벌레'로 변경하고 저장한다
**Then** 시스템은 `users` 테이블의 `user-1` 행 nickname을 '책벌레'로 UPDATE한다 (RLS `auth.uid()=id` 허용)
**And** 마이페이지 화면에 변경된 nickname이 반영된다

#### 시나리오 P4: 자기 프로필 avatar_url 수정 (정상)

**Given** 인증된 사용자(`user-1`)가 프로필 수정 화면에 있다
**When** 사용자가 avatar_url을 새 이미지 URL로 변경하고 저장한다
**Then** 시스템은 `users` 테이블의 `user-1` 행 avatar_url을 UPDATE한다
**And** 마이페이지 프로필 카드에 새 아바타 이미지가 표시된다

#### 시나리오 P5: 타인 프로필 수정 시 RLS 차단

**Given** 인증된 사용자(`user-1`)가 다른 사용자(`user-2`)의 프로필을 수정하려 한다
**When** 클라이언트가 `PUT /users/user-2`를 요청한다 (비정상 시도)
**Then** 시스템은 RLS 정책(REQ-DB-014 UPDATE)에 의해 UPDATE를 거부한다
**And** 영향받은 행 수가 0이거나 에러가 반환된다
**And** `user-2`의 데이터는 변경되지 않는다

#### 시나리오 P6: 수정 불가 필드 시도

**Given** 인증된 사용자(`user-1`)가 프로필 수정 화면에 있다
**When** 사용자가 화면을 확인한다
**Then** `email`, `provider`, `role` 필드는 수정 UI에 노출되지 않거나 읽기 전용으로 표시된다
**And** 해당 필드들을 통한 UPDATE 시도는 불가능하다

---

### REQ-PROF-003: 프로필 수정 유효성 검증

#### 시나리오 P7: nickname 빈 값 검증 (클라이언트)

**Given** 인증된 사용자가 프로필 수정 화면에서 nickname 필드를 빈 값으로 둔다
**When** 사용자가 저장 버튼을 탭한다
**Then** 시스템은 클라이언트 측에서 빈 값 검증 에러를 표시한다
**And** UPDATE 요청이 서버로 전송되지 않는다

#### 시나리오 P8: nickname 최대 길이 검증

**Given** 인증된 사용자가 nickname 필드에 21자 이상의 문자열을 입력한다
**When** 사용자가 저장 버튼을 탭한다
**Then** 시스템은 클라이언트 측에서 최대 길이(20자) 검증 에러를 표시한다
**And** UPDATE 요청이 서버로 전송되지 않는다

#### 시나리오 P9: nickname 서버 측 NOT NULL 제약 (2차 방어)

**Given** 클라이언트 검증을 우회하여 빈 nickname으로 UPDATE 요청이 서버에 도달한다 (비정상)
**When** 서버가 UPDATE를 시도한다
**Then** 시스템은 `nickname NOT NULL` CHECK 제약(REQ-DB-001)에 의해 UPDATE를 거부한다
**And** 에러가 클라이언트에 반환된다

---

### REQ-PROF-004: 독서 통계 집계 조회

#### 시나리오 P10: 독서 통계 3개 지표 집계 (정상)

**Given** 인증된 사용자(`user-1`)의 데이터가 다음과 같다:
- `user_books` WHERE `user_id=user-1` AND `status='completed'` = 3행
- `reading_sessions` WHERE `user_id=user-1`의 `duration_seconds` 합계 = 36000초 (10시간)
- `emotion_records` WHERE `user_id=user-1` = 25행
**When** 사용자가 마이페이지 통계 섹션을 조회한다
**Then** 시스템은 완독 수 3, 누적 독서 시간 36000초(또는 10시간 표시), 감정 기록 수 25를 반환한다

#### 시나리오 P11: 통계 데이터가 없는 사용자

**Given** 인증된 사용자(`user-2`)가 가입 후 활동이 없다:
- `user_books` WHERE `status='completed'` = 0행
- `reading_sessions` = 0행
- `emotion_records` = 0행
**When** 사용자가 마이페이지 통계 섹션을 조회한다
**Then** 시스템은 완독 수 0, 누적 독서 시간 0, 감정 기록 수 0을 반환한다
**And** 빈 상태 UI가 표시된다 (예: "아직 독서 기록이 없어요")

#### 시나리오 P12: 타인 통계 조회 시 RLS 차단

**Given** 인증된 사용자(`user-1`)가 다른 사용자(`user-2`)의 통계를 조회하려 한다
**When** 클라이언트가 `user-2` id로 통계 쿼리를 시도한다
**Then** 시스템은 RLS 정책에 의해 `user-1` 자기 데이터만 집계한다
**And** `user-2`의 데이터는 집계에 포함되지 않는다

---

### REQ-PROF-005: 통계 데이터 신선도

#### 시나리오 P13: 완독处理后 통계 갱신

**Given** 사용자의 현재 완독 수가 2이다
**When** 사용자가 책 한 권을 완독 처리한다 (SPEC-LIBRARY-001에서 `status='completed'` 전환)
**And** 마이페이지에 진입한다
**Then** 시스템은 완독 수 3을 반환한다 (최신 집계)

#### 시나리오 P14: 감정 기록 추가 후 통계 갱신

**Given** 사용자의 현재 감정 기록 수가 10이다
**When** 사용자가 새 감정 기록을 추가한다 (SPEC-EMOTION-001)
**And** 마이페이지에 진입한다
**Then** 시스템은 감정 기록 수 11을 반환한다 (최신 집계)

> MVP 기본값은 캐시 없음(매 요청 실시간 집계)이다. React Query staleTime(5분) 적용 시, 활동 직후 진입은 invalidate 또는 staleTime 만료로 최신화된다 (미결정 5.2).

---

### REQ-PROF-006: 포인트 내역 조회 (MVP 조회 전용)

#### 시나리오 P15: 포인트 내역 최신순 조회

**Given** 인증된 사용자(`user-1`)의 `point_logs`에 다음 행이 존재한다:
- `amount=100, reason='completion', created_at=T1`
- `amount=10, reason='reaction', created_at=T2` (T2 > T1)
**When** 사용자가 마이페이지 포인트 내역 섹션을 조회한다
**Then** 시스템은 T2 행(reason='reaction')을 최상단으로, T1 행(reason='completion')을 그 다음으로 반환한다 (`created_at DESC`)
**And** 잔여 포인트 합계 110이 표시된다
**Note**: `point_logs` 테이블에 `ref_id` 컬럼은 실제 스키마에 존재하지 않음 (sync 정정)

#### 시나리오 P16: 포인트 내역이 없는 사용자

**Given** 인증된 사용자(`user-2`)의 `point_logs`에 행이 없다
**When** 사용자가 포인트 내역 섹션을 조회한다
**Then** 시스템은 빈 결과를 반환한다
**And** 잔여 포인트 0이 표시된다

#### 시나리오 P17: 타인 포인트 내역 조회 시 RLS 차단

**Given** 인증된 사용자(`user-1`)가 다른 사용자(`user-2`)의 포인트 내역을 조회하려 한다
**When** 클라이언트가 `user-2` id로 point_logs 쿼리를 시도한다
**Then** 시스템은 RLS 정책(REQ-DB-021 — `auth.uid()=user_id`)에 의해 빈 결과를 반환한다
**And** `user-2`의 포인트 내역이 노출되지 않는다

#### 시나리오 P18: 포인트 내역 클라이언트 INSERT 불가

**Given** 인증된 사용자(`user-1`)가 포인트를 직접 적립하려 한다 (비정상 시도)
**When** 클라이언트가 `point_logs` INSERT를 시도한다
**Then** 시스템은 RLS 정책(REQ-DB-021 — point_logs 클라이언트 INSERT 정책 없음)에 의해 INSERT를 거부한다
**And** 포인트 적립은 서버 측(`service_role` 또는 SECURITY DEFINER 트리거)에서만 발생한다

---

### REQ-PROF-007: 성취 배지 시각화 (클라이언트 산정)

#### 시나리오 P19: 완독 배지 획득 (1권 기준)

**Given** 인증된 사용자(`user-1`)의 완독 수가 1이다
**And** 배지 기준 thresholds에 "완독 1권 — first book 배지"가 포함되어 있다 (미결정 5.1 임시값)
**When** 사용자가 마이페이지 배지 섹션을 조회한다
**Then** 시스템은 "first book" 배지를 "획득" 상태(컬러/활성)로 표시한다
**And** "reader"(5권), "bookworm"(10권) 배지는 "잠김" 상태(그레이스케일/비활성)로 표시된다

#### 시나리오 P20: 감정 기록 배지 획득 (10개 기준)

**Given** 인증된 사용자(`user-1`)의 감정 기록 수가 15이다
**And** 배지 기준에 "감정 기록 10개 배지"가 포함되어 있다
**When** 사용자가 마이페이지 배지 섹션을 조회한다
**Then** 시스템은 "10개" 배지를 "획득" 상태로 표시한다
**And** "50개", "100개" 배지는 "잠김" 상태로 표시된다
**Note**: emotion_records 테이블에 감정 종류 컬럼이 없으므로 배지는 총 건수 기준만 (종류별 배지 불가, sync 정정)

#### 시나리오 P21: 배지 실시간 재산정

**Given** 사용자의 완독 수가 4이다 (5권 배지 미충족)
**When** 사용자가 책 한 권을 완독 처리한다 (완독 수 5)
**And** 마이페이지에 진입한다
**Then** 시스템은 통계 데이터 재조회 후 배지를 재산정한다
**And** "reader"(5권) 배지가 "획득" 상태로 변경된다

> 배지는 영구 저장되지 않는다(별도 테이블 없음). 매 마이페이지 진입 시 통계 + 포인트 데이터로 재산정된다.

#### 시나리오 P22: 배지 thresholds 미충족 전체 잠김

**Given** 신규 가입 사용자의 통계가 완독 수 0, 감정 기록 수 0이다
**When** 사용자가 마이페이지 배지 섹션을 조회한다
**Then** 시스템은 모든 배지를 "잠김" 상태로 표시한다
**And** 첫 활동 유도 UI가 표시될 수 있다

---

### REQ-PROF-008: 설정 진입점 및 로그아웃

#### 시나리오 P23: 알림 설정 진입

**Given** 인증된 사용자가 마이페이지 설정 섹션에 있다
**When** 사용자가 "알림 설정" 항목을 탭한다
**Then** 시스템은 SPEC-NOTIF-001 알림 설정 화면으로 이동한다
**And** `reading_alarm_time`, `reading_alarm_enabled` 설정 UI가 표시된다 (SPEC-NOTIF-001 영역)

#### 시나리오 P24: 로그아웃 실행

**Given** 인증된 사용자가 마이페이지 설정 섹션에 있다
**When** 사용자가 "로그아웃" 버튼을 탭한다
**Then** 시스템은 SPEC-AUTH-001의 `signOut` 함수를 호출한다
**And** 세션이 파기된다 (SPEC-AUTH-001 로직)
**And** 로그인 화면으로 리다이렉트된다 (SPEC-NAV-001)

#### 시나리오 P25: 이용약관 링크 (URL 구성됨)

**Given** 마이페이지 설정 섹션에 "이용약관" 항목이 있다
**And** 이용약관 URL이 인프라에 구성되어 있다
**When** 사용자가 "이용약관" 항목을 탭한다
**Then** 시스템은 외부 링크(`Linking.openURL`) 또는 인앱 웹뷰로 이용약관을 표시한다

#### 시나리오 P26: 이용약관 링크 (URL 미구성)

**Given** 마이페이지 설정 섹션에 "이용약관" 항목이 있다
**And** 이용약관 URL이 아직 구성되지 않았다
**When** 사용자가 "이용약관" 항목을 탭한다
**Then** 시스템은 "준비 중입니다" 플레이스홀더를 표시한다

#### 시나리오 P27: 개인정보 처리방침 링크

**Given** 마이페이지 설정 섹션에 "개인정보 처리방침" 항목이 있다
**When** 사용자가 해당 항목을 탭한다
**Then** 시스템은 외부 링크 또는 인앱 웹뷰로 개인정보 처리방침을 표시한다 (또는 "준비 중" 플레이스홀더)

---

## 2. 품질 게이트 (Quality Gates)

### TRUST 5 검증

| 기둥 | 기준 | 검증 방법 |
|------|------|-----------|
| Tested | 85%+ 코드 커버리지 | Jest + @testing-library/react-native, 모든 시나리오 P1-P27 단위/통합 테스트 |
| Readable | 명확한命名, 영어 주석 | ESLint, 코드 리뷰, 한국어 문서화 주석은 code_comments 설정(ko) 준수 |
| Unified | 일관된 스타일 | Prettier, ESLint 규칙, SPEC-UI-001 tokens.ts 기반 스타일링 (색/간격 하드코딩 금지) |
| Secured | RLS 의존, service_role 미사용 | RLS 정책 검증 테스트, 타인 접근/수정 차단 시나리오 P2/P5/P12/P17/P18 |
| Trackable | Conventional commits, SPEC 참조 | `feature/SPEC-PROFILE-001-mypage` 브랜치, 커밋 메시지에 REQ-PROF-XXX 참조 |

### LSP 품질 게이트 (run 단계)

- 0 에러, 0 타입 에러, 0 린트 에러 (TypeScript strict)
- 통계 집계 쿼리 빌더 타입 안정성 검증
- 배지 산정 로직(`badges.ts`) 순수 함수성 검증 (사이드 이펙트 없음)
- 프로필 수정 mutation 에러 처리 타입 안정성

---

## 3. 검증 방법 및 도구

### 3.1 단위 테스트

- **queries**: PostgREST 쿼리 빌더 검증 — P1, P10, P15 시나리오
- **mutations**: 프로필 수정 mutation 검증 — P3, P4 시나리오
- **useUserStats**: 3개 집계 지표 산출 — P10, P11 시나리오
- **usePointLogs**: 포인트 내역 정렬 및 합계 — P15, P16 시나리오
- **badges**: 배지 산정 로직 — P19, P20, P21, P22 시나리오 (thresholds 임시값 기반)

### 3.2 통합 테스트

- **RLS 검증**: Supabase 로컬 개발 환경에서 타인 세션으로 프로필/통계/포인트 조회 시 빈 결과 확인 — P2, P5, P12, P17
- **포인트 클라이언트 INSERT 차단**: 인증된 클라이언트에서 point_logs INSERT 시도 시 거부 확인 — P18
- **통계 실시간 갱신**: 완독 처리/감정 기록 추가 후 마이페이지 진입 시 최신값 확인 — P13, P14
- **배지 재산정**: 활동 후 마이페이지 재진입 시 배지 상태 변경 확인 — P21

### 3.3 수동 검증

- **SPEC-UI-001 통합**: Button, Card, ProgressBar 컴포넌트가 디자인 토큰(amber/brown 팔레트)으로 정상 렌더링되는지 시각 확인
- **다크모드**: 마이페이지 화면의 light/dark 모드 전환 시 가시성 확인
- **접근성**: WCAG AA 터치타겟(44dp), accessibilityLabel 준수
- **로그아웃 플로우**: 로그아웃 버튼 → SPEC-AUTH-001 signOut → 로그인 화면 리다이렉트 전체 흐름 확인

---

## 4. Definition of Done (완료 정의)

- [ ] 시나리오 P1-P27 모두 통과
- [ ] 단위 테스트 커버리지 85%+
- [ ] RLS 정책이 타인 프로필/통계/포인트 접근을 차단함을 통합 테스트로 검증
- [ ] RLS 정책이 타인 프로필 수정을 차단함을 통합 테스트로 검증
- [ ] 포인트 내역이 클라이언트 INSERT 불가로 MVP 조회 전용임을 검증
- [ ] 통계 집계가 실시간으로 정확한 값을 반환함을 검증
- [ ] 배지가 통계 + 포인트 데이터 기반으로 클라이언트 측에서 산정됨을 검증
- [ ] 로그아웃이 SPEC-AUTH-001 signOut를 호출함을 검증
- [ ] SPEC-UI-001 컴포넌트 통합 동작 확인
- [ ] 다크모드 지원 확인
- [ ] TRUST 5 모든 기둥 통과
- [ ] LSP 게이트 0 에러
- [ ] conventional commits + SPEC 참조

---

## 5. 추적성

| 시나리오 | REQ | 검증 유형 |
|----------|-----|-----------|
| P1 | REQ-PROF-001 | 통합 (정상 조회) |
| P2 | REQ-PROF-001 | 통합 (RLS 차단) |
| P3 | REQ-PROF-002 | 통합 (nickname 수정) |
| P4 | REQ-PROF-002 | 통합 (avatar_url 수정) |
| P5 | REQ-PROF-002 | 통합 (RLS 타인 수정 차단) |
| P6 | REQ-PROF-002 | 단위 (수정 불가 필드) |
| P7 | REQ-PROF-003 | 단위 (빈 값 검증) |
| P8 | REQ-PROF-003 | 단위 (최대 길이 검증) |
| P9 | REQ-PROF-003 | 통합 (서버 NOT NULL) |
| P10 | REQ-PROF-004 | 통합 (3개 지표 집계) |
| P11 | REQ-PROF-004 | 단위 (빈 데이터) |
| P12 | REQ-PROF-004 | 통합 (RLS 타인 통계 차단) |
| P13 | REQ-PROF-005 | 통합 (완독 후 갱신) |
| P14 | REQ-PROF-005 | 통합 (감정 기록 후 갱신) |
| P15 | REQ-PROF-006 | 단위 (포인트 내역 정렬) |
| P16 | REQ-PROF-006 | 단위 (빈 포인트) |
| P17 | REQ-PROF-006 | 통합 (RLS 타인 포인트 차단) |
| P18 | REQ-PROF-006 | 통합 (클라이언트 INSERT 불가) |
| P19 | REQ-PROF-007 | 단위 (완독 배지 획득) |
| P20 | REQ-PROF-007 | 단위 (감정 기록 배지) |
| P21 | REQ-PROF-007 | 통합 (배지 재산정) |
| P22 | REQ-PROF-007 | 단위 (전체 잠김) |
| P23 | REQ-PROF-008 | 통합 (알림 설정 진입) |
| P24 | REQ-PROF-008 | E2E (로그아웃) |
| P25 | REQ-PROF-008 | 통합 (이용약관 링크) |
| P26 | REQ-PROF-008 | 단위 (URL 미구성 플레이스홀더) |
| P27 | REQ-PROF-008 | 통합 (개인정보 처리방침 링크) |
