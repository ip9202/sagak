---
id: SPEC-PROFILE-001
title: "마이페이지, 통계 및 보상"
version: "1.0.0"
status: draft
created: 2026-06-14
updated: 2026-06-14
author: "강력쇠주먹"
priority: medium
issue_number: 0
labels: [profile, stats, reward, badges, settings, supabase, phase-4]
---

# SPEC-PROFILE-001: 마이페이지, 통계 및 보상

## HISTORY

| 날짜 | 버전 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 2026-06-20 | 1.0.1 | sync: DB 실제 스키마/코드 기준 SPEC 정정 (ref_id 제거, 감정 배지 총건수, 경로 my/, Profile 타입, 하이브리드 집계) | sync |
| 2026-06-14 | 1.0.0 | 최초 작성 — 마이페이지 프로필 조회/수정(user_profiles 뷰 + users UPDATE), 독서 통계(reading_sessions/emotion_records 집계), 포인트 내역 조회(point_logs MVP 조회 전용), 성취 배지 클라이언트 산정, 설정(알림·공개 범위), 이용약관·개인정보 처리방침 링크, 로그아웃(SPEC-AUTH-001 연동). SPEC-DB-001 REQ-DB-001/011/013e/014/021, SPEC-AUTH-001/ROUTINE-001/EMOTION-001/NOTIF-001 의존 | 강력쇠주먹 |

---

## 1. 환경 (Environment)

- **백엔드**: Supabase (관리형 PostgreSQL + PostgREST + Edge Functions)
- **인증**: Supabase Auth (세션 기반, JWT — SPEC-AUTH-001)
- **데이터 엔터티**:
  - `users` (SPEC-DB-001 REQ-DB-001) — 사용자 프로필 원본 테이블. 컬럼: `id`, `email`, `nickname`, `avatar_url`, `provider`, `reading_alarm_time`, `reading_alarm_enabled`, `role(default 'member')`, `created_at`, `updated_at`. 자기 행은 RLS(REQ-DB-014)로 전체 컬럼 조회/수정 허용
  - `user_profiles` 보안 뷰 (SPEC-DB-001 REQ-DB-013e) — `SELECT id, nickname, avatar_url FROM users`. 타인 공개 프로필 노출용. 본 SPEC은 **자기 프로필**이 주 대상이며, 타인 노출은 Track A(SPEC-CLUB-001)에서 처리
  - `point_logs` (SPEC-DB-001 REQ-DB-011) — 포인트 적립/사용 내역. 컬럼: `id`, `user_id`, `amount`, `reason(ENUM completion/reaction/exchange)`, `created_at`. MVP **조회 전용**, 사용(exchange) 로직은 후순위. **Note**: `ref_id` 컬럼은 실제 스키마에 존재하지 않음 (sync 단계 DB 실제 코드 기준 정정)
  - `reading_sessions` (SPEC-DB-001 REQ-DB-009) — 독서 세션 로그. `duration_seconds`, `pages_read`. 누적 독서 시간 집계원
  - `emotion_records` (SPEC-DB-001 REQ-DB-004) — 감정 기록. 감정 기록 수 집계원
  - `user_books` (SPEC-DB-001 REQ-DB-003) — 서재. `status='completed'` 행 수 = 완독 수 집계원
- **성능 인덱스** (SPEC-DB-001 §4 / schema.md):
  - `reading_sessions (user_id, book_id)` — 독서 발자취/통계 집계
  - `emotion_records (user_id, created_at DESC)` — 감정 기록 수 집계
  - `point_logs` — RLS `auth.uid()=user_id` 필터 (인덱스는 user_id 기준)
- **RLS 정책** (이미 SPEC-DB-001로 구현됨):
  - `users` (REQ-DB-014): 읽기/쓰기 = `auth.uid()=id` (자기 행만 전체 컬럼). 타인 행은 RLS로 숨김, 공개 프로필은 `user_profiles` 뷰로만
  - `point_logs` (REQ-DB-021): 읽기 = `auth.uid()=user_id` (본인만, **조회 전용**). 클라이언트 INSERT/UPDATE 정책 없음 (서버 측 `service_role`만)
  - `reading_sessions` (REQ-DB-021): 읽기/수정 = `auth.uid()=user_id` (본인만)
  - `emotion_records` (REQ-DB-016): 읽기 = 본인 OR `visibility='public'` OR (`visibility='club'` AND 멤버). 집계는 본인 것(`auth.uid()=user_id`)만
- **API 서피스** (structure.md "Users profile+notifications"):
  - `GET /users/{id}` — 사용자 프로필 조회 (자기 행 전체 컬럼, RLS)
  - `PUT /users/{id}` — 프로필 업데이트 (nickname, avatar_url — 미결정 5.3 필드 범위)
  - `GET /users/{id}/stats` — 독서 통계 (완독 수, 누적 독서 시간, 감정 기록 수 집계)
  - `GET /users/{id}/points` — 포인트 적립/사용 내역 조회 (MVP 조회 전용, 사용은 후순위)
  - `POST /users/{id}/notifications` — 알림 설정 (SPEC-NOTIF-001 연동, 본 SPEC은 설정 UI 진입점만)
- **의존성**:
  - **SPEC-AUTH-001** (선행): 세션 관리, `auth.uid()` 식별, 로그아웃 엔드포인트, 온보딩 프로필 설정(nickname/avatar) 패턴. 본 SPEC은 로그아웃 버튼 UI를 두되, 로직은 SPEC-AUTH-001의 `signOut` 호출
  - **SPEC-ROUTINE-001** (선행): `reading_sessions` 세션 로직, `/sessions/stats` 통계 쿼리 패턴. 본 SPEC의 `/users/{id}/stats`는 reading_sessions + emotion_records 집계를 통합
  - **SPEC-EMOTION-001** (선행): `emotion_records` 구조. 감정 기록 수 집계원
  - **SPEC-NOTIF-001** (선행): 알림 설정 엔드포인트 `POST /users/{id}/notifications`, `reading_alarm_time`/`reading_alarm_enabled` 컬럼. 본 SPEC은 설정 UI 진입점만 제공, 저장 로직은 SPEC-NOTIF-001
  - **SPEC-UI-001** (선행): 6가지 컴포넌트(Button, Card, ProgressBar 등), ThemeProvider/useTheme, 디자인 토큰
  - **SPEC-API-001** (선행): Supabase 클라이언트 싱글톤, 인증 헤더 자동 주입
  - **SPEC-DB-001** (선행): 스키마, RLS 정책, 보안 뷰, 인덱스
- **플랫폼**: React Native + Expo SDK 55 (TypeScript strict). 클라이언트는 PostgREST 직접 호출, `service_role` 키 사용 금지
- **참조 SSOT**:
  - `.moai/project/product.md` 핵심 기능 "감정 아카이브 기반 보상: 기록 누적을 통한 성취감 제공과 재미 요소", 수익화 전략 "데이터 축적 우선, 포인트 사용 후순위", 비목표 "프리미엄 유료화", 비목표 "좋아요/팔로워 경쟁"
  - `.moai/project/structure.md` API 서피스 "Users profile+notifications — `GET /users/{id}`, `PUT /users/{id}`, `GET /users/{id}/stats`, `GET /users/{id}/points`", 주요 모듈 "마이페이지·설정"
  - `.moai/project/tech.md` 백엔드 "PostgreSQL의 RLS(Row Level Security)를 통해 구현", 인증 "세션 관리는 JWT 토큰"
  - `.moai/project/db/schema.md` (users, point_logs, reading_sessions 스키마, RLS 정책, 인덱스)

---

## 2. 가정 (Assumptions)

### 2.1 아키텍처 가정

**Note**: 본 섹션의 일부 가정은 실제 구현과 다릅니다. DB 실제 스키마/코드 기준으로 정정됨 (sync 2026-06-20):
- 가정 2.1.1: 통계 집계는 **하이브리드** 방식 (COUNT는 head:true, SUM은 클라이언트 JS)
- 가정 2.1.2: point_logs.ref_id는 실제 스키마에 존재하지 않음
- 가정 2.1.3: 배지는 종류별이 아닌 **총건수** 기반 (emotion_records에 종류 컬럼 없음)
- 화면 경로는 `app/(tabs)/profile/`이 아닌 `app/(tabs)/my.tsx` (실제 구현)
- auth/types.ts UserProfile은 auth 전용이며, Profile 도메인은 별도 Profile 타입 사용

1. **독서 통계는 실시간 집계 쿼리로 산출**: 별도 캐시/집계 테이블(`user_stats` 등)을 두지 않는다. `GET /users/{id}/stats` 요청 시 `reading_sessions`(누적 `duration_seconds` SUM), `emotion_records`(본인 기록 COUNT), `user_books`(`status='completed'` COUNT)를 PostgREST 집계 쿼리로 산출한다. MVP 규모(product.md "니치 시장 집중")에서는 실시간 집계 비용이 허용 범위 내이다. 캐싱 전략은 미결정 5.2로 연기.
2. **포인트 내역은 MVP 조회 전용**: `GET /users/{id}/points`는 `point_logs` SELECT만 수행한다. 포인트 차감/사용(exchange reason) 로직은 product.md 수익화 전략 "포인트 사용 후순위"에 따라 본 SPEC 범위 밖이다. `point_logs` INSERT는 서버 측(`service_role` 또는 SECURITY DEFINER 트리거)에서만 발생하며, 완독(completion)/스티커 반응(reaction) 시 자동 적립된다 (적립 트리거는 SPEC-DB-001 영역이 아닌 각 도메인 SPEC에서 처리).
3. **배지는 클라이언트 측 산정**: 별도 배지 테이블(`badges`, `user_badges`)을 두지 않는다. 배지 획득 여부는 클라이언트가 통계 데이터(완독 수, 연속 독서일, 감정 기록 누적 수, 포인트 reason별 집계)를 기준으로 산정한다 (단순성 — product.md "1인 풀스택 운영 전제"). 배지 기준 thresholds는 미결정 5.1로 연기.
4. **RLS에 의존**: 모든 읽기/쓰기 권한 검증은 DB RLS(REQ-DB-014/021)가 단독 수행한다. 클라이언트나 Edge Function은 권한 로직을 중복 구현하지 않는다. 자기 프로필은 `users` 베이스 테이블에서 전체 컬럼 조회(REQ-DB-014), 타인 공개 프로필은 `user_profiles` 뷰(REQ-DB-013e)로만 제한 컬럼 노출.
5. **프로필 수정은 자기 행만**: `PUT /users/{id}`는 `auth.uid()=id` 조건에서만 허용된다 (REQ-DB-014 UPDATE 정책). 타인 프로필 수정은 RLS로 차단된다. `role='admin'`에 대한 타인 행 수정 권한은 MVP에서 정의하지 않는다 (SPEC-DB-001 REQ-DB-014 비고).

### 2.2 비즈니스 가정

1. **보상은 성취감 중심**: product.md 핵심 기능 "감정 아카이브 기반 보상: 기록 누적을 통한 성취감 제공과 재미 요소". 배지와 통계는 사용자의 독서 여정을 시각화하여 성취감을 제공하며, 과시/경쟁(product.md 비목표 "좋아요/팔로워 경쟁")이 아닌 자기 성찰 도구이다.
2. **포인트 사용(굿즈 교환)은 후순위**: product.md 수익화 전략 "데이터 축적 우선". MVP에서 포인트는 적립(completion/reaction) 내역 조회만 제공하며, 사용(exchange)은 후순위 기능이다. `point_logs.reason='exchange'` 행은 MVP에서 존재하지 않는다 (ENUM 값은 전방향 호환을 위해 유지).
3. **배지 기준은 정성적 임계값**: 완독 N권, 연속 독서 N일, 감정 기록 누적 N개 등의 thresholds는 초기값을 임시로 설정하고 사용자 피드백으로 조정한다. 미결정 5.1 참조.
4. **연속 독서일은 reading_sessions 기반**: `reading_sessions.started_at`(또는 `created_at`)의 날짜를 기준으로 연속 독서일을 산정한다. 별도 `reading_streaks` 테이블은 두지 않는다 (단순성). 단, 연속일 산정 로직의 정확도(자정 기준, 타임존 처리)는 미결정 5.4로 연기.
5. **로그아웃은 SPEC-AUTH-001 위임**: 본 SPEC은 마이페이지 하단에 로그아웃 버튼 UI를 제공하되, 세션 파기 로직은 SPEC-AUTH-001의 `signOut` 함수를 호출한다. 본 SPEC에서 세션 관리를 재구현하지 않는다.

---

## 3. 요구사항 (Requirements)

> 본 SPEC은 3개 요구사항 모듈로 구성된다: REQ-PROF-PROFILE, REQ-PROF-STATS, REQ-PROF-REWARD.

### REQ-PROF-PROFILE: 프로필 조회 및 수정 (user_profiles 뷰, users UPDATE)

**목적**: 인증된 사용자가 자기 프로필을 조회하고 nickname/avatar_url을 수정할 수 있게 한다. structure.md API 서피스 "`GET /users/{id}`", "`PUT /users/{id}`"의 데이터 계층.

#### REQ-PROF-001: 자기 프로필 조회

**WHEN** 인증된 사용자가 마이페이지에 진입하면,
**THEN** 시스템은 RLS 정책(REQ-DB-014)에 의해 자기 `users` 행을 전체 컬럼(`id`, `nickname`, `avatar_url`, `email`, `provider`, `reading_alarm_time`, `reading_alarm_enabled`, `created_at`)으로 조회해야 한다.

> 타인의 프로필은 본 SPEC 범위 밖이다. Track A(SPEC-CLUB-001)에서 `user_profiles` 뷰(REQ-DB-013e — nickname, avatar_url만)로 노출한다. 본 SPEC은 자기 프로필이 주 대상이다.

#### REQ-PROF-002: 프로필 수정 (nickname, avatar_url)

**WHILE** 인증된 사용자가 자기 프로필 수정 화면에서 nickname 또는 avatar_url을 입력 중일 때,
**THEN** 시스템은 RLS 정책(REQ-DB-014 — `auth.uid()=id` UPDATE)에 의해 자기 행의 수정을 허용해야 한다. 수정 가능한 필드 범위는 미결정 사항 5.3으로 연기하되, MVP 기본값은 `nickname`, `avatar_url` 두 필드이다.

**IF** 인증된 사용자가 타인의 `users` 행을 수정하려 하면,
**THEN** 시스템은 RLS 정책에 의해 UPDATE를 거부해야 한다 (빈 영향 행 또는 에러). 클라이언트는 자기 `id`(`auth.uid()`)가 아닌 `{id}`로의 PUT 요청을 차단한다.

> `email`, `provider`, `role`은 수정 불가 필드이다. `email`은 OAuth 제공자 관리, `provider`는 가입 경로 고정, `role`은 admin 권한 예약(SPEC-DB-001 REQ-DB-001). `reading_alarm_time`, `reading_alarm_enabled`는 SPEC-NOTIF-001 알림 설정에서 처리.

#### REQ-PROF-003: 프로필 수정 유효성 검증

**WHILE** nickname 필드가 수정 중일 때,
**THEN** 시스템은 클라이언트 측에서 빈 값(empty string)과 최대 길이(임시 20자)를 검증해야 한다. 서버 측 CHECK 제약은 SPEC-DB-001 REQ-DB-001에 `nickname NOT NULL`이 정의되어 있으므로, 빈 값 UPDATE는 서버에서 거부된다.

> avatar_url은 Supabase Storage URL 또는 외부 URL을 허용한다. Storage 업로드 정책은 SPEC-DB-001 제외 범위 6(Storage 버킷 설정)이며, 본 SPEC은 URL 문자열 저장만 다룬다.

---

### REQ-PROF-STATS: 독서 통계 집계 (완독 수, 누적 시간, 감정 기록 수)

**목적**: 사용자의 독서 활동을 집계하여 성취감을 제공한다. structure.md API 서피스 "`GET /users/{id}/stats`"의 데이터 계층.

#### REQ-PROF-004: 독서 통계 집계 조회

**WHEN** 인증된 사용자가 마이페이지 통계 섹션을 조회하면,
**THEN** 시스템은 RLS 정책에 의해 자기 데이터만 집계하여 다음 3개 지표를 반환해야 한다:
- **완독 수**: `user_books` WHERE `user_id=auth.uid()` AND `status='completed'`의 행 수 (COUNT)
- **누적 독서 시간**: `reading_sessions` WHERE `user_id=auth.uid()`의 `duration_seconds` 합계 (SUM), 초 단위
- **감정 기록 수**: `emotion_records` WHERE `user_id=auth.uid()`의 행 수 (COUNT, 모든 visibility 포함)

> 집계는 PostgREST 직접 쿼리로 수행한다 (가정 2.1.1). 별도 Edge Function은 두지 않는다 (제외 범위 9). `user_id` 필터는 RLS에 의해 자동 적용되나, 명시적 필터로 쿼리 성능을 최적화한다.

#### REQ-PROF-005: 통계 데이터 신선도

**WHILE** 사용자가 독서 활동(완독 처리, 세션 종료, 감정 기록 추가)을 수행한 후 마이페이지에 진입하면,
**THEN** 시스템은 최신 집계 데이터를 반환해야 한다. 캐싱 전략은 미결정 사항 5.2로 연기하되, MVP 기본값은 캐시 없음(매 요청 실시간 집계)이다.

> 완독 처리는 SPEC-LIBRARY-001, 세션 종료는 SPEC-ROUTINE-001, 감정 기록 추가는 SPEC-EMOTION-001에서 각각 트리거된다. 본 SPEC은 집계 조회만 다룬다.

---

### REQ-PROF-REWARD: 포인트 내역 조회 및 배지 시각화

**목적**: 포인트 적립 내역을 조회하고, 통계 기반 배지를 시각화하여 재미 요소를 제공한다. structure.md API 서피스 "`GET /users/{id}/points`"의 데이터 계층.

#### REQ-PROF-006: 포인트 내역 조회 (MVP 조회 전용)

**WHEN** 인증된 사용자가 마이페이지 포인트 내역 섹션을 조회하면,
**THEN** 시스템은 RLS 정책(REQ-DB-021 — `auth.uid()=user_id`)에 의해 자기 `point_logs` 행을 `created_at DESC` 순으로 반환해야 한다. 각 행은 `amount`, `reason(ENUM completion/reaction/exchange)`, `created_at`을 포함한다.

**WHILE** 포인트 내역을 구성할 때,
**THEN** 시스템은 `amount`의 합계(잔여 포인트)를 표시해야 한다. MVP에서 `reason='exchange'` 행은 존재하지 않으나 (가정 2.2.2), ENUM은 전방향 호환을 위해 유지된다.

> 포인트 사용(굿즈 교환)은 product.md 수익화 전략 "후순위"이며 본 SPEC 범위 밖이다. `point_logs` INSERT는 서버 측에서만 발생한다 (가정 2.1.2). 본 SPEC은 SELECT만 다룬다.

#### REQ-PROF-007: 성취 배지 시각화 (클라이언트 산정)

**WHERE** 마이페이지 배지 섹션이 존재하면,
**THEN** 시스템은 REQ-PROF-004 통계 데이터와 REQ-PROF-006 포인트 reason별 집계를 기반으로 배지 획득 여부를 클라이언트 측에서 산정해야 한다 (가정 2.1.3 — 별도 테이블 없음). **Note**: emotion_records 테이블에 감정 종류 컬럼이 없으므로 감정 배지는 총 누적 수 기준만 산정 가능. 배지 카테고리 예시:
- **완독 배지**: 완독 수 기준 (예: 1권, 5권, 10권 — thresholds는 미결정 5.1)
- **연속 독서 배지**: 연속 독서일 기준 (예: 7일, 30일 — 산정 로직은 미결정 5.4)
- **감정 기록 배지**: 감정 기록 **총 수** 기준 (예: 10개, 50개, 100개). 종류별 배지는 DB 스키마 제한으로 불가
- **포인트 배지**: 포인트 reason별 집계 기준 (completion 횟수, reaction 받은 횟수)

**IF** 사용자가 배지 기준을 충족하면,
**THEN** 시스템은 해당 배지를 "획득" 상태로 시각화하고(컬러/활성), 미충족 배지는 "잠김" 상태(그레이스케일/비활성)로 표시해야 한다.

> 배지는 영구 저장되지 않는다(별도 테이블 없음). 매 마이페이지 진입 시 통계 데이터로 재산정된다. 이는 단순성을 위한 설계 결정이며 (product.md "1인 풀스택 운영 전제"), 향후 영구 배지 저장이 필요하면 확장 단계에서 `user_badges` 테이블 도입을 검토한다.

#### REQ-PROF-008: 설정 진입점 및 로그아웃

**WHERE** 마이페이지 설정 섹션이 존재하면,
**THEN** 시스템은 다음 진입점을 제공해야 한다:
- **알림 설정**: SPEC-NOTIF-001 알림 설정 화면으로 이동 (`reading_alarm_time`, `reading_alarm_enabled` 토글)
- **공개 범위 설정**: 감정 기록 visibility 기본값 설정 (미결정 5.5 — MVP에서는 진입점만 제공, 실제 로직은 SPEC-EMOTION-001)
- **이용약관**: 외부 링크(또는 인앱 웹뷰)로 연결
- **개인정보 처리방침**: 외부 링크(또는 인앱 웹뷰)로 연결
- **로그아웃**: SPEC-AUTH-001 `signOut` 함수 호출 (가정 2.2.5)

**WHEN** 사용자가 로그아웃 버튼을 탭하면,
**THEN** 시스템은 SPEC-AUTH-001의 로그아웃 로직을 호출해야 하며, 본 SPEC은 세션 파기를 재구현하지 않는다. 로그아웃 성공 시 로그인 화면으로 리다이렉트된다 (SPEC-AUTH-001/NAV-001 영역).

> 이용약관·개인정보 처리방침 URL은 인프라 설정(SPEC-DEPLOY-001 영역)이며, 본 SPEC은 링크 컴포넌트만 제공한다. URL이 미구성인 경우 "준비 중" 플레이스홀더를 표시한다.

---

## 4. 제외 범위 (Exclusions)

본 SPEC은 다음을 포함하지 않는다:

1. **포인트 사용(굿즈 교환) 로직**: product.md 수익화 전략 "포인트 사용 후순위". `point_logs.reason='exchange'` INSERT, 포인트 차감, 굿즈 교환 플로우는 후순위 기능이다. 본 SPEC은 `point_logs` SELECT(조회)만 다룬다.
2. **프리미엄 유료화 기능**: product.md 비목표 "프리미엄 유료화". 고급 분석, 맞춤 추천 등 유료 구독 기능은 MVP 밖이다.
3. **데이터 내보내기**: 사용자 데이터(감정 기록, 통계) CSV/JSON 내보내기는 확장 단계 기능이다. product.md 수익화 전략에 언급되나 MVP 범위 밖.
4. **관리자 기능**: SPEC-DB-001 REQ-DB-001에 따라 `role='admin'`은 예약값이다. 관리자 모듈(사용자 프로필 조정, 콘텐츠 관리)은 MVP에서 정의하지 않는다.
5. **타인 프로필 상세**: 본 SPEC은 자기 프로필이 주 대상이다. 타인 공개 프로필(nickname, avatar_url) 노출은 `user_profiles` 뷰(REQ-DB-013e)를 통해 Track A(SPEC-CLUB-001)에서 처리한다. 본 SPEC은 타인 프로필 조회 UI를 두지 않는다.
6. **영구 배지 저장**: 별도 `badges`/`user_badges` 테이블은 두지 않는다 (가정 2.1.3). 배지는 클라이언트 측 실시간 산정이다.
7. **통계 캐시 테이블**: `user_stats` 등 별도 집계 테이블은 두지 않는다 (가정 2.1.1). 실시간 집계 쿼리로 산출.
8. **Edge Function 로직**: 통계 집계, 포인트 내역 조회는 PostgREST 직접 호출로 처리한다. 전용 Edge Function은 두지 않는다.
9. **알림 설정 저장 로직**: `reading_alarm_time`, `reading_alarm_enabled` 저장은 SPEC-NOTIF-001 영역이다. 본 SPEC은 설정 UI 진입점만 제공한다.
10. **세션 관리 / 로그아웃 로직**: 세션 파기, 토큰 삭제는 SPEC-AUTH-001 영역이다. 본 SPEC은 로그아웃 버튼 UI만 제공한다.
11. **Storage 버킷 설정**: 아바타 이미지 업로드용 Storage 정책은 SPEC-DB-001 제외 범위 6이며, 본 SPEC은 avatar_url 문자열 저장만 다룬다.

---

## 5. 미결정 사항 (Open Questions)

### 5.1 배지 기준 thresholds — 미해결

**상태**: 완독 N권, 연속 독서 N일, 감정 기록 N개, 포인트 reason별 N회 등의 배지 획득 기준이 정의되지 않았다.

**임시 방침**: MVP 초기값은 다음과 같이 설정한다:
- 완독 배지: 1권(first book), 5권(reader), 10권(bookworm)
- 연속 독서 배지: 3일(streak), 7일(week), 30일(month)
- 감정 기록 배지: 10개, 50개, 100개
- 포인트 completion 배지: 1회, 5회, 10회

사용자 피드백 및 데이터 기반으로 조정한다.

**해결 시점**: v1.1.0에서 thresholds 확정 및 사용자 설정(배지 알림 on/off) 검토.

### 5.2 통계 캐싱 전략 — 미해결

**상태**: `GET /users/{id}/stats`의 집계 쿼리를 매 요청마다 실시간 수행할지, 클라이언트/서버 캐시를 둘지 결정되지 않았다.

**임시 방침**: MVP 기본값은 캐시 없음(매 요청 실시간 집계). 니치 시장 규모(product.md)에서는 허용 범위 내. 클라이언트 측 React Query 캐시(staleTime 5분)로 네트워크 요청 빈도 감소 가능.

**해결 시점**: v1.1.0에서 사용자 증가 시 서버 측 Materialized View 또는 캐시 테이블 도입 검토.

### 5.3 프로필 수정 가능 필드 범위 — 부분 해결

**상태**: `PUT /users/{id}`로 수정 가능한 필드가 `nickname`, `avatar_url` 외에 더 있는지(예: 자기소개 `bio` 컬럼 추가 여부)가 명확하지 않다. SPEC-DB-001 REQ-DB-001에는 `bio` 컬럼이 정의되어 있지 않다.

**임시 방침**: MVP에서는 `nickname`, `avatar_url` 두 필드만 수정 가능. `bio` 등 추가 필드는 확장 단계에서 스키마 마이그레이션과 함께 검토.

**해결 시점**: v1.1.0에서 `bio` 컬럼 추가 필요성 재평가.

### 5.4 연속 독서일 산정 로직 — 미해결

**상태**: `reading_sessions` 기반 연속 독서일 산정의 정확도(자정 기준, 사용자 타임존 처리, 하루 여러 세션 중복 처리)가 정의되지 않았다.

**임시 방침**: MVP에서는 `reading_sessions.started_at`(UTC)을 사용자 로컬 타임존으로 변환 후 날짜별 distinct count로 연속일을 산정한다. 단, 타임존 경계 엣지 케이스(자정 직전/직후 세션)의 정확도는 보장하지 않는다.

**해결 시점**: v1.1.0에서 타임존 처리 로직 고도화 및 서버 측 산정(Edge Function) 검토.

### 5.5 공개 범위 기본값 설정 — 미해결

**상태**: 감정 기록 visibility 기본값(public vs club)을 사용자가 마이페이지에서 설정할 수 있는지, 설정 저장 위치가 명확하지 않다. SPEC-DB-001 `users` 테이블에 `default_visibility` 컬럼이 없다.

**임시 방침**: MVP에서는 공개 범위 설정 진입점만 제공하되, 실제 로직은 SPEC-EMOTION-001에서 기록 작성 시점에 선택하는 방식이다. 사용자 기본값 저장은 `users` 테이블에 컬럼 추가 마이그레이션 필요.

**해결 시점**: v1.1.0에서 `users.default_visibility` 컬럼 추가 검토 및 SPEC-EMOTION-001 연동.

---

## 6. 추적성 (Traceability)

| TAG | 요구사항 | 소스 |
|-----|---------|------|
| SPEC-PROFILE-001 | REQ-PROF-001 ~ REQ-PROF-008 | `.moai/project/product.md` 핵심 기능 "감정 아카이브 기반 보상"·수익화 전략·비목표, `.moai/project/structure.md` API "Users profile+notifications — `GET/PUT /users/{id}`, `GET /users/{id}/stats`, `GET /users/{id}/points`"·주요 모듈 "마이페이지·설정", `.moai/project/tech.md` 백엔드 RLS·인증 JWT, SPEC-DB-001 REQ-DB-001/009/011/013e/014/021, SPEC-AUTH-001 프로필·로그아웃, SPEC-ROUTINE-001 통계, SPEC-EMOTION-001 감정 기록 수, SPEC-NOTIF-001 알림 설정, `.moai/project/db/schema.md` 스키마·RLS·인덱스 |

### 의존성 역추적

| 의존 SPEC | 본 SPEC이 소비하는 산출물 |
|-----------|--------------------------|
| SPEC-DB-001 | `users`(REQ-DB-001 — nickname, avatar_url, RLS 자기 행), `user_profiles` 뷰(REQ-DB-013e — 타인 공개 프로필, 본 SPEC은 자기 프로필 위주), `point_logs`(REQ-DB-011 — reason ENUM, MVP 조회 전용), `reading_sessions`(REQ-DB-009 — duration_seconds 집계), `emotion_records`(REQ-DB-004 — 기록 수 집계), `user_books`(REQ-DB-003 — status='completed' 완독 수), RLS(REQ-DB-014 users 자기 행, REQ-DB-021 point_logs/reading_sessions 본인만), 인덱스 `(user_id, book_id)`/`(user_id, created_at DESC)` |
| SPEC-AUTH-001 | 세션 관리(`auth.uid()`), 로그아웃 엔드포인트(`signOut`), 온보딩 프로필 설정 패턴 |
| SPEC-ROUTINE-001 | `reading_sessions` 세션 로직, `/sessions/stats` 통계 쿼리 패턴, 누적 독서 시간 집계 |
| SPEC-EMOTION-001 | `emotion_records` 구조, 감정 기록 수 집계원, visibility 제어(공개 범위 설정 진입점) |
| SPEC-NOTIF-001 | 알림 설정 엔드포인트(`POST /users/{id}/notifications`), `reading_alarm_time`/`reading_alarm_enabled` 컬럼, 설정 UI 진입점 |
| SPEC-UI-001 | Button, Card, ProgressBar 컴포넌트, ThemeProvider/useTheme, 디자인 토큰(색/간격) |
| SPEC-API-001 | Supabase 클라이언트 싱글톤, 인증 헤더 자동 주입 |
