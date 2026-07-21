---
id: SPEC-PROFILE-001
title: "마이페이지, 통계 및 보상 — 구현 계획"
version: "1.0.0"
status: draft
created: 2026-06-14
updated: 2026-06-14
author: "강력쇠주먹"
priority: medium
issue_number: 0
labels: [profile, stats, reward, badges, settings, supabase, phase-4, plan]
---

# SPEC-PROFILE-001: 구현 계획 (plan.md)

## HISTORY

| 날짜 | 버전 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 2026-06-20 | 1.0.1 | sync: DB 실제 스키마/코드 기준 SPEC 정정 (ref_id 제거, 감정 배지 총건수, 경로 my/, Profile 타입, 하이브리드 집계) | sync |
| 2026-06-14 | 1.0.0 | 최초 작성 — 3개 마일스톤, 기술 접근, 아키텍처 방향, 리스크 대응 | 강력쇠주먹 |

---

## 1. 마일스톤 (우선순위 기반)

> 본 계획은 시간 예측을 사용하지 않으며, 우선순위 기반 마일스톤으로 진행 순서를 정의한다.

### Primary Goal (1순위): 프로필 조회/수정 + 독서 통계 집계

**범위**: REQ-PROF-PROFILE + REQ-PROF-STATS

**산출물**:
- `src/features/profile/queries.ts` — `GET /users/{id}`, `GET /users/{id}/stats` PostgREST 쿼리 함수
- `src/features/profile/mutations.ts` — `PUT /users/{id}` 프로필 수정(nickname, avatar_url) mutation
- `src/features/profile/useProfile.ts` — 자기 프로필 조회 훅
- `src/features/profile/useUserStats.ts` — 독서 통계 집계 훅 (완독 수, 누적 시간, 감정 기록 수)
- `src/features/profile/types.ts` — UserProfile, UserStats 타입
- 마이페이지 화면 (`app/(tabs)/profile/index.tsx` 또는 유사 경로) — 프로필 카드 + 통계 대시보드
- 프로필 수정 화면 (`app/(tabs)/profile/edit.tsx`)

**완료 기준**:
- 인증된 사용자가 마이페이지 진입 시 자기 프로필(전체 컬럼)이 표시된다
- 완독 수, 누적 독서 시간, 감정 기록 수가 실시간 집계로 표시된다
- nickname, avatar_url 수정 후 저장 시 `users` 테이블에 반영된다 (RLS 자기 행만)
- 타인 id로 PUT 요청 시 RLS로 거부된다
- `email`, `provider`, `role`은 수정 UI에서 노출되지 않거나 비활성화된다

**의존성 완료 조건**: SPEC-AUTH-001 (세션, auth.uid()), SPEC-ROUTINE-001 (reading_sessions 로직), SPEC-EMOTION-001 (emotion_records 구조), SPEC-API-001 (Supabase 클라이언트), SPEC-UI-001 (컴포넌트, 토큰)

### Secondary Goal (2순위): 포인트 내역 조회 + 배지 시각화

**범위**: REQ-PROF-REWARD (REQ-PROF-006, REQ-PROF-007)

**산출물**:
- `src/features/profile/usePointLogs.ts` — `GET /users/{id}/points` 포인트 내역 조회 훅 (created_at DESC)
- `src/features/profile/badges.ts` — 배지 기준 산정 로직 (클라이언트 측, 통계 + 포인트 reason별 집계 기반)
- `src/features/profile/BadgeCard.tsx` — 배지 시각화 컴포넌트 (획득/잠김 상태)
- 포인트 내역 섹션 (마이페이지 내)
- 배지 섹션 (마이페이지 내)

**완료 기준**:
- 포인트 내역이 최신순으로 표시되며, 잔여 포인트 합계가 노출된다
- MVP에서 `reason='exchange'` 행이 없어도 정상 동작한다
- 배지가 통계 데이터(완독 수, 연속 독서일, 감정 기록 수, 포인트 reason) 기반으로 클라이언트 측에서 산정된다
- 배지 기준 충족 시 "획득" 상태(컬러/활성), 미충족 시 "잠김" 상태(그레이스케일/비활성)로 표시된다
- 배지 thresholds는 미결정 5.1 임시값을 사용한다

**의존성 완료 조건**: Primary Goal 완료 (통계 집계 데이터 필요)

### Optional Goal (3순위): 설정 진입점 + 로그아웃 + 미결정 사항 해결

**범위**: REQ-PROF-008 + 미결정 사항 해결

**산출물**:
- 설정 섹션 (마이페이지 내) — 알림 설정, 공개 범위, 이용약관, 개인정보 처리방침, 로그아웃 진입점
- 로그아웃 버튼 — SPEC-AUTH-001 `signOut` 호출
- 이용약관·개인정보 처리방침 링크 컴포넌트 (URL 미구성 시 "준비 중" 플레이스홀더)
- 배지 thresholds 사용자 피드백 기반 조정 — 미결정 5.1
- 통계 캐싱 전략(React Query staleTime) 적용 — 미결정 5.2
- 연속 독서일 타임존 처리 개선 — 미결정 5.4

**완료 기준**:
- 알림 설정 진입 시 SPEC-NOTIF-001 알림 설정 화면으로 이동한다
- 로그아웃 버튼 탭 시 SPEC-AUTH-001 로그아웃 로직이 호출되고 로그인 화면으로 리다이렉트된다
- 이용약관·개인정보 처리방침 링크가 정상 동작한다 (또는 플레이스홀더 표시)
- 미결정 사항 5.1, 5.2, 5.4의 임시 방침이 적용된다

---

## 2. 기술 접근 (Technical Approach)

### 2.1 프로필 조회/수정 계층

- **PostgREST 직접 호출**: `GET /users/{id}`는 `users` 테이블 SELECT where `id=eq.{auth.uid()}`로 구성한다. RLS(REQ-DB-014)가 자기 행만 반환한다. 별도 Edge Function은 두지 않는다 (제외 범위 8).
- **프로필 수정**: `PUT /users/{id}`는 `users` UPDATE where `id=eq.{auth.uid()}`로 구성한다. 수정 필드는 `nickname`, `avatar_url`만 (미결정 5.3). RLS(REQ-DB-014 UPDATE)가 자기 행만 허용한다.
- **유효성 검증**: nickname 빈 값/최대 길이(20자)는 클라이언트 측에서 검증. 서버 CHECK 제약(`nickname NOT NULL`, REQ-DB-001)이 2차 방어.
- **수정 불가 필드**: `email`, `provider`, `role`은 수정 UI에서 노출하지 않거나 읽기 전용으로 표시. `reading_alarm_time`, `reading_alarm_enabled`는 SPEC-NOTIF-001 알림 설정 화면에서 처리.

### 2.2 독서 통계 집계 계층

- **하이브리드 집계 방식** (실제 구현 기준 정정): `GET /users/{id}/stats`는 3개 지표를 혼합 방식으로 산출:
  - 완독 수: `user_books` SELECT COUNT where `user_id=eq.{auth.uid()}` AND `status=eq.completed` (PostgREST head:true)
  - 누적 독서 시간: `reading_sessions` 전체 행 fetch → 클라이언트 JS에서 `duration_seconds` SUM 계산 (PostgREST는 SUM 없음, routine 패턴)
  - 감정 기록 수: `emotion_records` SELECT COUNT where `user_id=eq.{auth.uid()}` (PostgREST head:true)
- **인덱스 활용**: `reading_sessions (user_id, book_id)` 인덱스로 집계 최적화. `emotion_records (user_id, created_at DESC)` 인덱스 활용.
- **캐싱**: 클라이언트 측 React Query(staleTime 5분 임시값)로 네트워크 요청 빈도 감소 (미결정 5.2). 서버 측 캐시는 MVP에서 도입하지 않는다.

### 2.3 포인트 내역 조회 계층

- **PostgREST SELECT**: `GET /users/{id}/points`는 `point_logs` SELECT where `user_id=eq.{auth.uid()}` ORDER BY `created_at DESC`로 구성한다. RLS(REQ-DB-021)가 자기 행만 반환한다.
- **잔여 포인트 합계**: 클라이언트에서 `amount` SUM을 산정하여 표시. 별도 서버 집계 쿼리 불필요 (MVP 규모).
- **조회 전용**: `point_logs` INSERT/UPDATE는 클라이언트에서 수행하지 않는다 (가정 2.1.2). 서버 측(`service_role` 또는 SECURITY DEFINER 트리거)에서만 적립 발생.

### 2.4 배지 산정 계층 (클라이언트 측)

- **데이터 소스**: REQ-PROF-004 통계(완독 수, 감정 기록 수) + REQ-PROF-006 포인트 reason별 집계 + 연속 독서일(reading_sessions 날짜 distinct count).
- **산정 로직**: `badges.ts`가 통계 데이터를 입력받아 배지 카테고리별 획득 여부(boolean)를 산출. thresholds는 미결정 5.1 임시값 사용.
- **영구 저장 없음**: 배지 상태는 매 마이페이지 진입 시 재산정 (가정 2.1.3). 별도 테이블 없음.
- **시각화**: `BadgeCard` 컴포넌트가 획득/잠김 상태를 컬러/그레이스케일로 표시. SPEC-UI-001 디자인 토큰(amber/brown 팔레트) 활용.

### 2.5 설정 진입점 및 로그아웃 계층

- **알림 설정**: SPEC-NOTIF-001 알림 설정 화면으로 네비게이션. 본 SPEC은 진입점(Button/Card)만 제공.
- **공개 범위 설정**: MVP에서는 진입점만 제공 (미결정 5.5). 실제 로직은 SPEC-EMOTION-001 기록 작성 시점 선택.
- **이용약관·개인정보 처리방침**: 외부 링크(`Linking.openURL`) 또는 인앱 웹뷰. URL은 인프라 설정(SPEC-DEPLOY-001). 미구성 시 "준비 중" 플레이스홀더.
- **로그아웃**: SPEC-AUTH-001 `signOut` 함수 호출. 세션 파기 로직은 본 SPEC에서 재구현하지 않는다 (가정 2.2.5).

### 2.6 상태 관리

- **프로필 상태**: React Query로 `users` 행 캐싱. 수정 mutation 성공 시 캐시 invalidate.
- **통계 상태**: React Query(staleTime 5분 임시값)로 통계 집계 캐싱 (미결정 5.2).
- **포인트 내역**: React Query로 `point_logs` 목록 캐싱. 페이지네이션(필요 시) 지원.
- **배지 상태**: 통계 + 포인트 데이터 파생 상태(derived state). 별도 캐시 없음.

---

## 3. 아키텍처 설계 방향

### 3.1 모듈 구조

```
src/features/profile/
  queries.ts              # PostgREST 쿼리 함수 (GET /users/{id}, /users/{id}/stats, /users/{id}/points)
  mutations.ts            # 프로필 수정 mutation (PUT /users/{id})
  useProfile.ts           # 자기 프로필 조회 훅
  useUserStats.ts         # 독서 통계 집계 훅
  usePointLogs.ts         # 포인트 내역 조회 훅
  badges.ts               # 배지 기준 산정 로직 (클라이언트 측)
  types.ts                # UserProfile, UserStats, PointLog, Badge 타입
  index.ts                # 공개 API
```

화면:
```
app/(tabs)/my.tsx        # 마이페이지 메인 (프로필 카드 + 통계 + 배지 + 포인트 내역 + 설정 진입점) — NOTE: profile/ 경로 아님
app/(tabs)/my/edit.tsx   # 프로필 수정 (nickname, avatar_url)
```

### 3.2 데이터 흐름

```
[마이페이지 진입]
  → useProfile (users SELECT, RLS 자기 행)
  → useUserStats (3개 집계 쿼리 병렬)
  → usePointLogs (point_logs SELECT, RLS 자기 행)
  → badges.ts (통계 + 포인트 데이터로 배지 산정)
  → 마이페이지 화면 렌더링

[프로필 수정]
  → edit.tsx에서 nickname/avatar_url 입력
  → mutations.ts (users UPDATE, RLS 자기 행)
  → 캐시 invalidate → useProfile 재조회
  → 마이페이지 화면 갱신

[로그아웃]
  → 설정 섹션 로그아웃 버튼 탭
  → SPEC-AUTH-001 signOut 호출
  → 세션 파기 → 로그인 화면 리다이렉트 (SPEC-NAV-001)
```

### 3.3 RLS 및 인덱스 연동

- **조회 권한**: RLS(REQ-DB-014 users, REQ-DB-021 point_logs/reading_sessions/emotion_records)가 자기 행만 노출. 클라이언트 권한 로직 불필요.
- **수정 권한**: RLS(REQ-DB-014 UPDATE)가 `auth.uid()=id` 조건에서만 users UPDATE 허용. 타인 수정 자동 차단.
- **집계 성능**: 인덱스 `(user_id, book_id)`(reading_sessions), `(user_id, created_at DESC)`(emotion_records)로 집계 쿼리 최적화.
- **조회 전용 보장**: point_logs는 클라이언트 SELECT 정책만 존재(REQ-DB-021). INSERT/UPDATE는 서버 측 service_role만.

---

## 4. 리스크 및 대응 계획

### 리스크 1: 통계 집계 쿼리 성능

**위험**: 사용자의 reading_sessions/emotion_records 행이 증가할 경우, 매 마이페이지 진입 시 3개 집계 쿼리의 응답 시간이 증가할 수 있다.

**대응**: MVP에서는 니치 시장 규모(product.md)이므로 허용 범위 내. 클라이언트 React Query 캐시(staleTime 5분)로 요청 빈도 감소. v1.1.0에서 Materialized View 또는 캐시 테이블 도입 검토 (미결정 5.2).

### 리스크 2: 배지 thresholds 부적합

**위험**: 임시 thresholds(미결정 5.1)가 사용자 기대와 맞지 않아 성취감이 저하될 수 있다 (너무 쉽거나 어렵거나).

**대응**: MVP 초기값을 보수적으로 설정하고, 사용자 피드백 및 데이터(배지 획득률 분포)로 조정. v1.1.0에서 thresholds 확정.

### 리스크 3: 연속 독서일 산정 부정확

**위험**: 타임존 경계 엣지 케이스(자정 직전/직후 세션)에서 연속일이 잘못 산정될 수 있다 (미결정 5.4).

**대응**: MVP에서는 UTC → 로컬 타임존 변환 후 날짜 distinct count로 산정. 엣지 케이스 정확도는 보장하지 않으나, 일반적인 사용 패턴에서는 허용 범위 내. v1.1.0에서 서버 측 산정(Edge Function) 검토.

### 리스크 4: 프로필 수정 필드 범위 변동

**위험**: 향후 `bio` 등 추가 필드(미결정 5.3)가 필요해질 경우, 스키마 마이그레이션과 본 SPEC 업데이트가 필요하다.

**대응**: MVP에서는 nickname, avatar_url만 수정 가능. 추가 필드 필요성은 사용자 피드백으로 평가 후 v1.1.0에서 검토.

---

## 5. 제외 범위 (구현하지 않을 항목)

본 계획은 spec.md §4 제외 범위를 준수한다. 추가로 다음을 구현하지 않는다:

1. **Edge Function**: 프로필 조회/수정, 통계 집계, 포인트 내역 조회용 Edge Function은 두지 않는다. PostgREST 직접 호출.
2. **집계 캐시 테이블**: `user_stats` 등 별도 집계 테이블은 두지 않는다. 실시간 집계 쿼리로 산출.
3. **배지 영구 저장 테이블**: `badges`, `user_badges` 테이블은 두지 않는다. 클라이언트 측 실시간 산정.
4. **포인트 적립 트리거**: point_logs INSERT 로직(완독/스티커 반응 시 적립)은 각 도메인 SPEC(SPEC-COMPLETION-001, SPEC-EMOTION-001) 또는 서버 측 트리거 영역이다. 본 SPEC은 조회만.
5. **알림 설정 저장**: `reading_alarm_time`, `reading_alarm_enabled` 저장은 SPEC-NOTIF-001 영역. 본 SPEC은 진입점만.
6. **오프라인 캐싱**: MVP에서는 오프라인 프로필/통계 조회를 지원하지 않는다. 네트워크 연결 필수.

---

## 6. 완료 정의 (Definition of Done)

- [ ] REQ-PROF-001 ~ REQ-PROF-008 모든 요구사항 구현
- [ ] acceptance.md 모든 시나리오 통과
- [ ] TRUST 5 품질 게이트 통과 (테스트 커버리지 85%+)
- [ ] RLS 정책이 타인 프로필 접근/수정을 차단함을 검증
- [ ] 통계 집계가 실시간으로 정확한 값을 반환함을 검증
- [ ] 포인트 내역이 MVP 조회 전용으로 동작함을 검증 (클라이언트 INSERT 불가)
- [ ] 배지가 통계 + 포인트 데이터 기반으로 클라이언트 측에서 산정됨을 검증
- [ ] 로그아웃이 SPEC-AUTH-001 signOut를 호출함을 검증
- [ ] SPEC-UI-001 컴포넌트(Button, Card, ProgressBar)와 통합 동작 확인
- [ ] 다크모드 지원 확인

---

## 7. 추적성

| 계획 요소 | 연결된 REQ | 소스 |
|-----------|-----------|------|
| Primary Goal | REQ-PROF-001, REQ-PROF-002, REQ-PROF-003, REQ-PROF-004, REQ-PROF-005 | spec.md §3 REQ-PROF-PROFILE, REQ-PROF-STATS |
| Secondary Goal | REQ-PROF-006, REQ-PROF-007 | spec.md §3 REQ-PROF-REWARD |
| Optional Goal | REQ-PROF-008, 미결정 5.1/5.2/5.4 | spec.md §3 REQ-PROF-REWARD, §5 |
