# SPEC-NOTIF-002 — 진행 추적 (progress.md)

> Run-phase 진행 추적. `manager-develop`이 §E.2/§E.3을, `manager-docs`가 §E.4를, orchestrator가 §F를 작성한다 (spec-frontmatter-schema.md § progress.md Section Map).

## §E.1 Plan-phase Audit-Ready Signal

- plan_status: audit-ready
- plan_complete_at: 2026-07-22
- plan_auditor_verdict: iter2 PASS (score 0.97, monotonic 0.80→0.97)
- implementation_kickoff_approval: granted (사용자 승인)
- artifacts: spec.md + plan.md + acceptance.md (Tier M, 3 artifacts)
- depends_on: SPEC-NOTIF-001 (status: completed, 2026-07-22)

## §E.2 Run-phase Evidence

AC PASS/FAIL matrix (acceptance.md 시나리오 + 검증 명령 + 실제 출력). 누적 — Milestone 진행에 따라 갱신.

| 시나리오 | REQ | 상태 | 검증 방법 / 명령 | 실제 출력 |
|----------|-----|------|------------------|-----------|
| N2-1 Realtime 자동 반영 (단위) | REQ-NOTIF2-001 | PASS | `npx jest useNotificationsRealtime -t "N2-1"` | INSERT 이벤트 수신 시 `invalidateQueries({ queryKey: [NOTIFICATION_QUERY_PREFIX] })` 1회 호출 (8/8 PASS) |
| N2-2 타인 알림 RLS 차단 (통합) | REQ-NOTIF2-001 | GAP | acceptance §3.2 로컬 Supabase 통합 | 로컬 Supabase 미기동 — 서버 RLS 게이트는 단위 테스트 범위 밖 (Residual: N2-2 runtime smoke 필요) |
| N2-3 구독 cleanup (단위) | REQ-NOTIF2-001 | PASS | `npx jest useNotificationsRealtime -t "N2-3"` | unmount 시 `channel.unsubscribe()` + `client.removeChannel(channel)` 1회씩 호출 (8/8 PASS) |
| N2-4 비활성 시 구독 부재 (단위) | REQ-NOTIF2-001 | PASS | `npx jest useNotificationsRealtime -t "N2-4"` | userId 빈 값 시 `channel` 미호출, `subscribe` 미호출 (8/8 PASS) |

grep 증거 (결함 해소 — M1):
- `grep -rn "postgres_changes" src/features/notification/` → 1+ 매치 (useNotificationsRealtime.ts)
- `ls supabase/migrations/*enable_realtime_notifications*` → `20260722000001_enable_realtime_notifications.sql` 존재

SPEC-NOTIF-001 회귀: `npx jest src/features/notification` → 7 suites / 49 tests PASS (기존 6 suites/41 tests + 신규 1 suite/8 tests, 기존 41 전수 PASS — 회귀 없음).

## §F Phase 4 Mode Selection

**입력 파라미터**:
- tier: M
- scope (파일 수): ~5-8 files (신규 `useNotificationsRealtime.ts` + `useNotificationResponse.ts` 수정 + `NotificationsScreen.tsx` 수정 + notifications publication migration + 테스트 3-4종)
- domain count: 2 (frontend hooks/components + Supabase DB migration)
- file language mix: TypeScript/TSX + SQL migration
- concurrency benefit: LOW (coding-heavy — Anthropic coding-task parallelism caveat)

**모드 평가**:
| 모드 | 선택 | 근거 |
|------|------|------|
| trivial | ✗ | Tier M, 결함 3종 + 신규 훅 + migration — 자명 아님 |
| background | ✗ | run-phase는 구현(Write) — 읽기 전용 아님 |
| agent-team (RETIRED) | ✗ | Mode 3 retired |
| parallel | ✗ | coding-heavy, domain <3 → Anthropic coding-task parallelism caveat |
| workflow | ✗ | 신규 코드/다규칙 작업 — 기계적 단일 변환 아님 |
| **sub-agent** | **✓ 선택** | coding-heavy Tier M — Milestone별 순차 위임이 안전 기본 |

**Decision**: `sub-agent` (Mode 5)

**Justification**: SPEC-NOTIF-002는 React Native 훅 + 컴포넌트 + Supabase migration을 다루는 coding-heavy 작업으로, Anthropic의 "대부분의 코딩 작업은 연구보다 진정 병렬화 가능한 작업이 적다"는 권고에 따라 Milestone(M1→M2→M3→M4)별 순차 `manager-develop` 위임이 적절. M1(Realtime 구독 훅 + publication migration)이 가장 결정-가역성 높고 `useClubFeedRealtime.ts` 선례 준용으로 디리스크됨. domain 수(2)와 scope(~5-8 files) 모두 Mode 4 자동 선택 임계치(≥3 domains, ≥10 files) 미만.

**진행 모드**: 자율 (`/goal ac_converge`) — 사용자 승인(Implementation Kickoff Approval). 단위/통합 테스트 범위까지 무인 진행, 실기기 수동 검증(N2-1/N2-5/N2-8) 단계에서 사용자 개입 전환.

**Plan-auditor**: iter2 PASS (score 0.97, monotonic 0.80→0.97, skip-eligible — 단 Kickoff Approval 별도 mandatory 통과).
