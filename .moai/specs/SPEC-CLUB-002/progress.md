---
id: SPEC-CLUB-002
title: "Track B 개설형 모임 관리 — 진행 상황"
version: "0.2.0"
status: in-progress
created: 2026-06-19
updated: 2026-06-19
---

# SPEC-CLUB-002 진행 상황 (M1-M3 데이터/API 계층)

## 스키마 정합성 복구 완료 (2026-06-19)

M2 블로컈였던 clubs 진도 컬럼 부재가 해결되었다:

- 마이그레이션 `supabase/migrations/20240618000006_add_club_reading_plan_columns.sql` 로 clubs 에
  `daily_pages`, `trigger_page`, `duration_days` 추가 (모두 NULL 허용, `CHECK >= 0`).
- dev Supabase 적용 + `src/types/supabase.ts` gen-types 재생성 완료 — clubs Row/Insert/Update
  모두에 진도 컬럼 반영됨 (직접 검증: grep `daily_pages|trigger_page|duration_days`).
- SPEC/plan.md v1.1.0 으로 정합성 복구 (title→name, min_members 제거, 진도 컬럼 정의).

이전 제약(M1 시점)과 달리 이제 M2 가 구현 가능해졌다.

## 마일스톤 진척도

| 마일스톤 | REQ | 상태 | 비고 |
|----------|-----|------|------|
| M1 모임 생성 API | REQ-CLUBB-001~008 | **완료** | name 매핑 적용 |
| M2 진도 동기화 API | REQ-CLUBB-009~012 | **완료** | progressApi.ts — 진도 컬럼 반영됨 |
| M3 참가자·상태 API | REQ-CLUBB-013~017 | **완료** | status/type/club_members 기반 |

## 완료 산출물

| 파일 | 라인 수 | 설명 |
|------|--------|------|
| `src/features/club/trackB/types.ts` | 71 | gen-types 기반 도메인 타입 + CreateClubInput |
| `src/features/club/trackB/clubApi.ts` | 135 | createClub / verifyHostMembership / getClubDetail (M1, M3 일부) |
| `src/features/club/trackB/progressApi.ts` | 109 | updateProgress (M2, REQ-CLUBB-009~012) |
| `src/features/club/trackB/memberApi.ts` | 122 | getClubMembers / closeClub / reactivateClub / leaveClub (M3) |
| `src/features/club/trackB/index.ts` | 14 | barrel export (M1+M2+M3) |
| `src/features/club/trackB/__tests__/clubApi.test.ts` | 250 | 10 테스트 |
| `src/features/club/trackB/__tests__/progressApi.test.ts` | 188 | 11 테스트 (S13~S16 시나리오) |
| `src/features/club/trackB/__tests__/memberApi.test.ts` | 210 | 11 테스트 |

## 품질 게이트 결과 (M2 포함 최종)

- `npm run typecheck` (tsc --noEmit) exit 0
- `npm test`: 821 통과 / 0 실패 (기존 810 + M2 신규 11)
- `npm run lint` exit 0 (clean)

## 반복 이력

| 일시 | 항목 | 완료/실패 누적 |
|------|------|---------------|
| 2026-06-19 | 사전 분석(SPEC/plan/gen-types 교차검증) | 스키마 충돌 발견 |
| 2026-06-19 | M1 RED-GREEN (clubApi) | +10 테스트 통과 |
| 2026-06-19 | M3 RED-GREEN (memberApi) | +11 테스트 통과 |
| 2026-06-19 | 품질 게이트 (tsc/jest/lint) M1+M3 | 전부 통과 |
| 2026-06-19 | M2 블로커 해결 (마이그레이션 + gen-types 재생성) | 스키마 확정 |
| 2026-06-19 | M2 RED-GREEN-REFACTOR (progressApi) | +11 테스트 통과 |
| 2026-06-19 | 품질 게이트 (tsc/jest/lint) M1+M2+M3 | 821 통과, 전부 통과 |

## REQ-CLUBB-009~012 대비 완료 상태

| REQ | 시나리오 | 구현 | 테스트 |
|-----|---------|------|--------|
| REQ-CLUBB-009 (host 진도 UPDATE) | S13 | updateProgress (daily_pages, trigger_page UPDATE) | daily_pages+trigger_page UPDATE, 부분 업데이트, null 초기화 (3 테스트) |
| REQ-CLUBB-010 (비host 차단) | S14 | RLS 42501 → normalizeError RLS_DENIED 매핑 | RLS_DENIED throw, NETWORK throw (2 테스트) |
| REQ-CLUBB-011 (입력 검증) | S15 | validateProgressField (음수/비정수 → VALIDATION) | 음수 dailyPages, 음수 triggerPage, 비정수, 0 허용 (4 테스트) |
| REQ-CLUBB-012 (closed 차단) | S16 | options.status='closed' 사전 차단 | closed VALIDATION throw, active 정상 (2 테스트) |
