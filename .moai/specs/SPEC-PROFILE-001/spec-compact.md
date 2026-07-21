---
id: SPEC-PROFILE-001
title: "마이페이지, 통계 및 보상 — Compact"
version: "1.0.1"
status: draft
created: 2026-06-14
updated: 2026-06-20
author: "강력쇠주먹"
priority: medium
issue_number: 0
labels: [profile, stats, reward, badges, settings, supabase, phase-4, compact]
---

# SPEC-PROFILE-001: Compact 요약

> 본 문서는 spec.md의 핵심만 추약한 실행용 요약이다. 상세는 spec.md를 참조한다.

## 핵심 범위

마이페이지에서 자기 프로필 조회/수정(nickname, avatar_url), 독서 통계(완독 수, 누적 시간, 감정 기록 수) 실시간 집계, 포인트 내역 조회(MVP 조회 전용), 성취 배지 클라이언트 산정(별도 테이블 없음), 설정 진입점(알림·공개 범위·이용약관·개인정보 처리방침), 로그아웃(SPEC-AUTH-001 위임)을 제공한다.

## 데이터 흐름

```
[프로필]
  users 베이스 테이블 ──RLS(REQ-DB-014, auth.uid()=id)──→ 자기 행 전체 컬럼 조회
  users UPDATE ──RLS(REQ-DB-014, auth.uid()=id)──→ nickname, avatar_url 수정
  user_profiles 뷰(REQ-DB-013e) ──타인 공개 프로필──→ Track A(SPEC-CLUB-001)에서 처리

[통계 — 실시간 집계, 캐시 테이블 없음]
  user_books (status='completed') COUNT → 완독 수
  reading_sessions SUM(duration_seconds) → 누적 독서 시간
  emotion_records COUNT(user_id=auth.uid()) → 감정 기록 수

[포인트 — MVP 조회 전용]
  point_logs SELECT ──RLS(REQ-DB-021, auth.uid()=user_id)──→ created_at DESC
  클라이언트 INSERT 불가 (서버 service_role만 적립)

[배지 — 클라이언트 측 산정, 별도 테이블 없음]
  통계(완독 수, 감정 기록 수) + 포인트 reason별 집계 + 연속 독서일
  → badges.ts가 thresholds 기준으로 획득/잠김 판정 → BadgeCard 시각화
```

## 요구사항 (8개)

### REQ-PROF-PROFILE (프로필 조회/수정)

| REQ | 요약 |
|-----|------|
| REQ-PROF-001 | 마이페이지 진입 시 자기 `users` 행 전체 컬럼 조회 (RLS 자기 행만). 타인은 RLS로 숨김, 공개 프로필은 `user_profiles` 뷰로 Track A에서 처리 |
| REQ-PROF-002 | `PUT /users/{id}`로 nickname, avatar_url 수정 (RLS `auth.uid()=id` UPDATE). 타인 수정 RLS 거부. email/provider/role 수정 불가 |
| REQ-PROF-003 | nickname 빈 값(클라이언트+서버 NOT NULL), 최대 길이 20자(클라이언트) 검증 |

### REQ-PROF-STATS (독서 통계 집계)

| REQ | 요약 |
|-----|------|
| REQ-PROF-004 | `GET /users/{id}/stats`로 3개 지표 실시간 집계: 완독 수(user_books status=completed COUNT), 누적 독서 시간(reading_sessions SUM), 감정 기록 수(emotion_records COUNT). PostgREST 직접 쿼리 |
| REQ-PROF-005 | 활동(완독/세션/감정 기록) 후 진입 시 최신 집계. MVP 캐시 없음(매 요청 실시간), React Query staleTime 5분 임시 |

### REQ-PROF-REWARD (포인트 내역 + 배지 + 설정)

| REQ | 요약 |
|-----|------|
| REQ-PROF-006 | `GET /users/{id}/points`로 point_logs 최신순 조회 (RLS 본인만). 잔여 포인트 합계 표시. MVP 조회 전용(클라이언트 INSERT 불가). Note: `ref_id` 컬럼은 실제 스키마에 없음 |
| REQ-PROF-007 | 배지 클라이언트 측 산정(별도 테이블 없음). 통계+포인트 reason 집계 기반. thresholds 임시값(완독 1/5/10권, 연속 3/7/30일, 감정 **총수** 10/50/100개). 종류별 배지는 DB 제한으로 불가. 획득(컬러)/잠김(그레이스케일) 시각화 |
| REQ-PROF-008 | 설정 진입점: 알림 설정(SPEC-NOTIF-001 이동), 공개 범위(진입점만, SPEC-EMOTION-001), 이용약관·개인정보 처리방침(링크/플레이스홀더), 로그아웃(SPEC-AUTH-001 signOut 호출) |

## 핵심 가정

1. **통계는 실시간 집계** — 별도 캐시 테이블 없음. PostgREST 집계 쿼리로 산출
2. **포인트는 MVP 조회 전용** — 사용(exchange)은 후순위. point_logs INSERT는 서버 측만
3. **배지는 클라이언트 산정** — 별도 배지 테이블 없음. 통계+포인트 데이터로 매 진입 시 재산정
4. **RLS 단독 권한 검증** — 자기 users 행만(REQ-DB-014), point_logs도 본인만(REQ-DB-021)
5. **로그아웃은 SPEC-AUTH-001 위임** — 본 SPEC은 버튼 UI만, signOut 함수 호출

## 제외 범위

- 포인트 사용/굿즈 교환 (후순위, product.md 수익화 전략)
- 프리미엄 유료화 (비목표)
- 데이터 내보내기 (확장)
- 관리자 기능 (admin 예약, SPEC-DB-001)
- 타인 프로필 상세 (Track A에서 user_profiles 뷰로 처리)
- 영구 배지 저장 (별도 테이블 없음)
- 통계 캐시 테이블 (실시간 집계)
- 알림 설정 저장 로직 (SPEC-NOTIF-001)
- 세션 파기/로그아웃 로직 (SPEC-AUTH-001)
- Edge Function (PostgREST 직접 호출)

## 미결정 사항

| ID | 이슈 | 임시 방침 | 해결 시점 |
|----|------|-----------|-----------|
| 5.1 | 배지 thresholds | 완독 1/5/10권, 연속 3/7/30일, 감정 10/50/100개 | v1.1.0 (데이터 기반 조정) |
| 5.2 | 통계 캐싱 전략 | 캐시 없음 + React Query staleTime 5분 | v1.1.0 (Materialized View 검토) |
| 5.3 | 프로필 수정 필드 범위 | nickname, avatar_url만 | v1.1.0 (bio 컬럼 추가 검토) |
| 5.4 | 연속 독서일 산정 로직 | UTC→로컬 타임존 날짜 distinct count | v1.1.0 (서버 측 산정 검토) |
| 5.5 | 공개 범위 기본값 설정 | 진입점만 제공 (SPEC-EMOTION-001에서 기록별 선택) | v1.1.0 (users.default_visibility 컬럼 검토) |

## 의존성

| 선행 SPEC | 소비 산출물 |
|-----------|-------------|
| SPEC-DB-001 | users(REQ-DB-001, RLS REQ-DB-014), user_profiles 뷰(REQ-DB-013e), point_logs(REQ-DB-011, RLS REQ-DB-021), reading_sessions(REQ-DB-009), emotion_records(REQ-DB-004), user_books(REQ-DB-003), 인덱스 |
| SPEC-AUTH-001 | 세션(auth.uid()), signOut 로그아웃, 온보딩 프로필 설정 패턴 |
| SPEC-ROUTINE-001 | reading_sessions 로직, 통계 집계 패턴 |
| SPEC-EMOTION-001 | emotion_records 구조, 감정 기록 수 집계원 |
| SPEC-NOTIF-001 | 알림 설정 엔드포인트, reading_alarm_time/enabled 컬럼 |
| SPEC-UI-001 | Button, Card, ProgressBar, ThemeProvider, 디자인 토큰 |
| SPEC-API-001 | Supabase 클라이언트, 인증 헤더 |

## 구현 산출물 (참고)

```
src/features/profile/
  queries.ts              # GET /users/{id}, /users/{id}/stats, /users/{id}/points (PostgREST)
  mutations.ts            # PUT /users/{id} 프로필 수정
  useProfile.ts           # 자기 프로필 조회 훅
  useUserStats.ts         # 독서 통계 집계 훅
  usePointLogs.ts         # 포인트 내역 조회 훅
  badges.ts               # 배지 산정 로직 (클라이언트 측)
  BadgeCard.tsx           # 배지 시각화 컴포넌트
  types.ts                # UserProfile, UserStats, PointLog, Badge
```

마이페이지 화면, 프로필 수정 화면, 설정 섹션.
