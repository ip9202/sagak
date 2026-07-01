# 마이그레이션 Runbook: enforce_single_reading_policy (정책 5.5)

> SPEC-LIBRARY-001 · 정책 5.5 · `user_books` reading 단일 보장
> 대상 마이그레이션: `supabase/migrations/20240630000001_enforce_single_reading_policy.sql`
> 적용 방식: **Supabase SQL Editor 수동 실행 (dev → prod)**
> 작성일: 2026-07-01

---

## 1. 개요

본 runbook은 SPEC-LIBRARY-001 **정책 5.5(reading 단일 보장)** 를 dev → prod 순으로 안전하게 적용하기 위한 운용 절차다. 정책의 요지는 다음과 같다.

- 한 사용자(`user_id`)는 동시에 **최대 1개의 `status='reading'` 행**만 보유한다.
- 새 reading이 발생(INSERT reading 또는 비-reading → reading UPDATE)하면, **기존 reading 행이 자동으로 `'shelved'`로 배타 전환**된다 (trigger 구동).
- 동시에 두 트랜잭션이 같은 사용자의 reading으로 전환하려 하면, **부분 UNIQUE 인덱스가 한쪽을 `unique_violation(23505)`로 롤백**시킨다 (동시성 최종 방어선).

마이그레이션은 4단계로 구성되며 **순서가 절대적**이다.

1. 다중 reading 데이터 정리 (`ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY updated_at DESC, id DESC)`, `rn>1` 행을 `shelved`로 전환)
2. 부분 UNIQUE 인덱스 `user_books_one_reading_per_user` ON `(user_id) WHERE status='reading'`
3. `status` 컬럼 기본값 `'reading'` → `'shelved'`
4. `enforce_single_reading()` plpgsql 함수 + `BEFORE INSERT OR UPDATE OF status` 트리거

> **로컬 검증 상태**: 시나리오 A~E가 로컬 Supabase에서 이미 통과되었다. 본 runbook은 dev/prod **운용 적용**만을 다룬다.

---

## 2. ⚠️ 핵심 주의사항

### 2.1 트리거 이름 `enforce_single_reading` 불변 (CRITICAL)

PostgreSQL은 **같은 시점(BEFORE ROW)에 발생한 트리거를 `tgname`의 알파벳순으로 실행**한다. `user_books` 테이블의 BEFORE 관련 트리거 실행 순서는 다음과 같다.

| 순서 | 트리거 이름 | 역할 |
|------|------------|------|
| 1 | `enforce_single_reading` | 기존 reading → shelved 배타 전환 |
| 2 | `on_user_books_update` | last_progress_at / completed_at 비즈니스 로직 |
| 3 | `trg_user_books_updated_at` | updated_at 자동 갡신 |

**`enforce_single_reading`이 알파벳순으로 가장 앞서기 때문에** 부분 UNIQUE 인덱스 검사 이전에 기존 reading 행을 먼저 `shelved`로 전환할 수 있다. 트리거 이름을 변경하면 (예: `z_enforce_reading`) `on_user_books_update` / `trg_user_books_updated_at` 보다 뒤에서 실행되거나, 더 치명적으로는 **부분 UNIQUE 인덱스가 먼저 위반을 감지하여 정상적인 배타 전환마저 `23505`로 실패**하게 된다.

> **규칙**: 트리거 이름 `enforce_single_reading`은 **절대 변경하지 않는다**. 롤백/재적용 시에도 동일 이름을 유지한다.

### 2.2 Step-1 정리는 service_role 전체 사용자 영향

Step-1 데이터 정리는 **모든 사용자의 다중 reading 행을 일괄 `shelved`로 전환**한다. 이는 service_role(BYPASSRLS)로 실행되며 RLS가 적용되지 않는다. 따라서:

- dev에서 **시나리오 E(정리 결정성) 재검증**을 먼저 통과해야 prod에 동일 정리를 적용할 수 있다.
- 정리 대상은 사전 측정(Phase 0)에서 정량화하고, Phase 1에서 백업 테이블로 원본 상태를 보존한다.

### 2.3 dev 선행 절대 원칙

prod 적용은 **dev Phase 0~5 전 단계 통과 후에만** 허용된다. dev 시나리오 E 재검증이 실패하면 prod 적용을 즉시 중단하고 원인을 분석한다.

---

## 3. Phase 0: 사전 영향 측정 (dev)

**목적**: 다중 reading 사용자 수와 정리 대상 행 수를 적용 전에 정량화하여 rollback 기준점을 확보한다.

1. Supabase 대시보드(dev) → SQL Editor → New query
2. `supabase/snippets/00_pre_impact_measure.sql` 내용을 붙여넣고 실행
3. 결과 해석:
   - `multi_reading_user_count` = 다중 reading 행을 가진 사용자 수
   - `cleanup_target_row_count` = `rn>1`로 판정되어 `shelved`로 전환될 행 수
   - `per_user_breakdown` = 사용자별 현재 reading 행 목록 (어떤 행이 보존되고 어떤 행이 전환될지 점검)

> **기대 결과**: `multi_reading_user_count`와 `cleanup_target_row_count`를 기록한다. Phase 3 시나리오 E 검증 시 이 값들이 정리 결과와 일치하는지 교차 확인한다. `per_user_breakdown`에서 각 사용자별로 `updated_at DESC, id DESC` 기준 최신 1개만 reading으로 잔류해야 한다.

---

## 4. Phase 1: 백업 (dev)

**목적**: Step-1 정리로 인해 `shelved`로 전환될 행들의 원본 상태를 보존하여, 필요 시 행 단위 복원을 가능하게 한다.

1. SQL Editor에서 `supabase/snippets/01_backup_affected_rows.sql` 실행 (MUTATING — CREATE TABLE)
2. 확인:
   - `backup_enforce_single_reading` 테이블이 생성되었는지
   - 행 수가 Phase 0의 `cleanup_target_row_count`와 일치하는지

```sql
-- 확인용 (SELECT-only)
SELECT count(*) FROM public.backup_enforce_single_reading;
```

> 백업 테이블은 마이그레이션 정상 완료 후에도 일정 기간 보존한다 (롤백 시 행 단위 복원에 필요). 삭제 시점은 prod 안정화 후 별도 결정한다.

---

## 5. Phase 2: 마이그레이션 적용 (dev)

**목적**: 4단계 마이그레이션을 한 트랜잭션으로 적용한다.

1. 프로젝트 루트의 `supabase/migrations/20240630000001_enforce_single_reading_policy.sql` 파일을 텍스트 편집기로 열어 내용을 복사
2. SQL Editor에 붙여넣고 실행
3. Supabase SQL Editor는 기본적으로 전체 스크립트를 하나의 묶음으로 실행한다. 오류가 없어야 한다.

> **주의**: 마이그레이션 스크립트는 순서가 절대적이다. 부분 UNIQUE 인덱스(Step 2)는 다중 reading 행이 존재하면 생성 시점에 실패하므로, Step 1 정리가 반드시 먼저 실행되어야 한다. 스크립트를 부분 실행하지 말고 전체를 한 번에 실행한다.

실행 후 즉시 Phase 3으로 넘어간다.

---

## 6. Phase 3: 시나리오 E 재검증 — 정리 결정성

**목적**: Step-1 정리 후 모든 사용자가 reading 행을 최대 1개만 가지며, 보존된 행이 `updated_at DESC, id DESC` 기준 최신인지 확인한다.

1. SQL Editor에서 `supabase/snippets/02_scenario_e_cleanup_determinism.sql` 실행 (SELECT-only)
2. 기대 결과:
   - `(1)` `users_with_multiple_reading` = 0
   - `(2)` 결정성 교차 검증 결과 **0행 반환** (보존 reading 행이 `[원본 updated_at DESC, id DESC]` 기준 최신과 일치). 정렬 키가 현재 updated_at이 아닌 **원본 updated_at**임에 주의 — 전환된 행은 `trg_user_books_updated_at` 트리거가 updated_at을 갱신하므로, 현재값 기준 정렬은 정상 케이스를 거짓 양성으로 오판한다.

> 실패 시: 즉시 `08_rollback.sql` 실행 후 원인 분석. prod 적용 금지.

---

## 7. Phase 4: 시나리오 A~D 회귀

**목적**: 트리거 동작, 동시성 방어, no-op, completion_reports 무회귀를 dev에서 최종 확인한다.

순서대로 실행:

| 순서 | 스니펫 | 시나리오 | MUTATING |
|------|--------|----------|----------|
| 1 | `03_scenario_a_exclusive_switch.sql` | A: 배타 전환 | YES (테스트 INSERT/UPDATE + 정리) |
| 2 | `04_scenario_b_concurrency_23505.sql` | B: 동시성 23505 | YES (테스트 INSERT + 정리) |
| 3 | `05_scenario_c_noop.sql` | C: no-op | YES (테스트 UPDATE + 정리) |
| 4 | `06_scenario_d_completion_reports.sql` | D: completion_reports 무회귀 | YES (테스트 UPDATE + 정리) |

각 스니펫은 지정된 **테스트용 user/book**을 사용하며, 마지막에 테스트 행을 정리(cleanup)하여 잔류물을 남기지 않는다. 시나리오 B의 진정한 동시성은 단일 SQL Editor 세션에서 재현할 수 없으므로, 스니펫은 단일 연결 시뮬레이션(두 번째 reading INSERT가 23505로 거부되는지)을 제공하며, **부분 UNIQUE 인덱스가 동시성의 권위 있는 방어선**임을 명시한다.

> 어느 시나리오든 예상과 다른 결과가 나오면 rollback 후 원인 분석.

---

## 8. Phase 5: 사후 검증 (dev)

**목적**: 마이그레이션 결과 객체(인덱스, 트리거, 함수, 기본값, 실행 순서)가 스펙과 일치하는지 최종 점검한다.

1. SQL Editor에서 `supabase/snippets/07_post_verify.sql` 실행 (SELECT-only)
2. 기대 결과 (모두 충족해야 함):
   - 부분 UNIQUE 인덱스 `user_books_one_reading_per_user` 존재 + `valid` + WHERE 절 `((status)::text = 'reading'::text)`
   - 트리거 `enforce_single_reading` 존재 + `enabled`
   - 트리거 실행 순서: `enforce_single_reading`이 `on_user_books_update`, `trg_user_books_updated_at`보다 먼저 (알파벳순)
   - 함수 `enforce_single_reading()` 존재
   - `status` 컬럼 기본값 `'shelved'::text`

> dev Phase 0~5 전 단계 통과 시에만 Phase 6(prod)로 진행한다.

---

## 9. Phase 6: prod 동일 적용

> **전제**: dev Phase 0~5가 모두 통과되었을 것. dev 프로젝트 ref: `lqltwbpocbgoxvhlmjdo`. prod 프로젝트 ref는 `.env.production` 참조.

prod Supabase 대시보드에서 **동일한 시퀀스**를 그대로 실행한다.

| 단계 | 스니펫 | dev와 동일 |
|------|--------|-----------|
| Phase 0 | `00_pre_impact_measure.sql` | O |
| Phase 1 | `01_backup_affected_rows.sql` | O |
| Phase 2 | 마이그레이션 파일 전체 | O |
| Phase 3 | `02_scenario_e_cleanup_determinism.sql` | O |
| Phase 4 | `03` ~ `06` 순서대로 | O |
| Phase 5 | `07_post_verify.sql` | O |

prod는 실사용자 데이터가 있으므로 Phase 0 측정값을 **반드시 기록**하고, Phase 3 시나리오 E 결과와 일치하는지 교차 확인한다. 정리 대상 행 수가 dev와 크게 다르면 (예: 예상치 못한 다중 reading 다수) 적용을 일시 중단하고 원인을 분석한다.

---

## 10. 롤백 계획

마이그레이션 적용 후 심각한 회귀가 발견되면 `supabase/snippets/08_rollback.sql`을 실행한다.

롤백 작업:
1. `DROP TRIGGER enforce_single_reading`
2. `DROP FUNCTION enforce_single_reading()`
3. `DROP INDEX user_books_one_reading_per_user`
4. `ALTER TABLE user_books ALTER COLUMN status SET DEFAULT 'reading'`

> **⚠️ 중요**: 롤백은 **객체(트리거/함수/인덱스/기본값)만 제거**한다. Step-1 정리로 인해 `shelved`로 전환된 행은 **자동으로 reading으로 복원되지 않는다**. 행 단위 복원은 Phase 1에서 만든 `backup_enforce_single_reading` 백업 테이블이 필요하다. 수동 복원 쿼리 예시:

```sql
-- 행 단위 복원(필요 시). backup 테이블의 원본 상태 기준.
-- 주의: 복원 후 부분 UNIQUE 인덱스가 제거된 상태에서만 실행할 것.
UPDATE public.user_books ub
SET status = b.original_status
FROM public.backup_enforce_single_reading b
WHERE ub.id = b.original_id;
```

> 복원 쿼리는 롤백(부분 UNIQUE 제거) 이후에만 실행해야 한다. 그렇지 않으면 다중 reading 복원 시 인덱스 위반이 발생한다.

---

## 11. 파일 목록

| 파일 | 용도 |
|------|------|
| `docs/migration-enforce-single-reading.md` | 본 runbook |
| `supabase/snippets/00_pre_impact_measure.sql` | Phase 0 사전 영향 측정 (SELECT) |
| `supabase/snippets/01_backup_affected_rows.sql` | Phase 1 백업 (CREATE TABLE) |
| `supabase/snippets/02_scenario_e_cleanup_determinism.sql` | Phase 3 시나리오 E (SELECT) |
| `supabase/snippets/03_scenario_a_exclusive_switch.sql` | Phase 4 시나리오 A (MUTATING + cleanup) |
| `supabase/snippets/04_scenario_b_concurrency_23505.sql` | Phase 4 시나리오 B (MUTATING + cleanup) |
| `supabase/snippets/05_scenario_c_noop.sql` | Phase 4 시나리오 C (MUTATING + cleanup) |
| `supabase/snippets/06_scenario_d_completion_reports.sql` | Phase 4 시나리오 D (MUTATING + cleanup) |
| `supabase/snippets/07_post_verify.sql` | Phase 5 사후 검증 (SELECT) |
| `supabase/snippets/08_rollback.sql` | 롤백 (DROP 객체) |

---

*최종 확인: 2026-07-01. 마이그레이션 원본은 변경하지 않는다. 모든 산출물은 대시보드 수동 실행용이다.*
