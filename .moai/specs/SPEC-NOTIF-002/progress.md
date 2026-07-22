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
| N2-2 타인 알림 RLS 차단 (통합) | REQ-NOTIF2-001 | PASS | `cd supabase && npx -y tsx scripts/realtime-smoke/n2-2-broadcast-rls.mjs` + `psql -f tests/0020_notifications_realtime_rls_test.sql` | Node.js smoke: B→A broadcast blocked (PASS) + A own-notification received (PASS, positive control). pgTAP 0020 ok 21/306 (6 new N2-2 structural-premise assertions). 서버 SELECT RLS 게이트가 Realtime 브로드캐스트에도 적용됨 종단간 검증 완료 (PR #155, 2026-07-22) |
| N2-3 구독 cleanup (단위) | REQ-NOTIF2-001 | PASS | `npx jest useNotificationsRealtime -t "N2-3"` | unmount 시 `channel.unsubscribe()` + `client.removeChannel(channel)` 1회씩 호출 (8/8 PASS) |
| N2-4 비활성 시 구독 부재 (단위) | REQ-NOTIF2-001 | PASS | `npx jest useNotificationsRealtime -t "N2-4"` | userId 빈 값 시 `channel` 미호출, `subscribe` 미호출 (8/8 PASS) |
| N2-5 포그라운드 수신 갱신 (단위) | REQ-NOTIF2-002 | PASS | `npx jest useNotificationResponse -t "N2-5"` | `addNotificationReceivedListener` 수신 시 `invalidateQueries({ queryKey: [NOTIFICATION_QUERY_PREFIX] })` 1회 (12/12 PASS) |
| N2-6 배너 탭 갱신 (단위) | REQ-NOTIF2-002 | PASS | `npx jest useNotificationResponse -t "N2-6"` | 배너 탭 시 라우팅(N8 유지) + 동일 invalidate 호출 (12/12 PASS) |
| N2-7 읽음 처리 충돌 없음 (단위) | REQ-NOTIF2-002 | PASS | `npx jest useNotificationResponse -t "N2-7"` | 수신/탭 양쪽 invalidate 모두 동일 queryKey([NOTIFICATION_QUERY_PREFIX]) — useMarkAsRead 동일 키로 React Query 정규화 (12/12 PASS) |
| N2-8 pull-to-refresh (단위) | REQ-NOTIF2-003 | PASS | `npx jest NotificationsScreen -t "N2-8"` | RefreshControl 부착 + onRefresh → refetch(getNotifications 재호출) + 갱신 중 refreshing=true, 완료 시 false (8/8 PASS) |
| N2-9 갱신 중 에러 처리 (단위) | REQ-NOTIF2-003 | PASS | `npx jest NotificationsScreen -t "N2-9"` | refetch reject 시 throw/크래시 없음, 이전 목록 유지(isError guard `&& !data` 로 갱신 에러는 이전 데이터 보존), refreshing 해제 (8/8 PASS) |

grep 증거 (결함 해소 — M1):
- `grep -rn "postgres_changes" src/features/notification/` → 1+ 매치 (useNotificationsRealtime.ts)
- `ls supabase/migrations/*enable_realtime_notifications*` → `20260722000001_enable_realtime_notifications.sql` 존재

grep 증거 (결함 해소 — M2):
- `grep -c "invalidateQueries" src/features/notification/useNotificationResponse.ts` → 2 (배너 탭 + 포그라운드 수신 양쪽)

grep 증거 (결함 해소 — M3):
- `grep -c "RefreshControl" src/features/notification/components/NotificationsScreen.tsx` → 2 (import + JSX 부착)

SPEC-NOTIF-001 회귀: `npx jest src/features/notification` → 7 suites / 55 tests PASS (기존 6 suites/41 + M1 신규 1 suite/8 + M2 신규 4 + M3 신규 2 tests, 기존 41 전수 PASS — 회귀 없음).

M4 통합 검증: 3개 REQ 경로(Realtime INSERT / push·배너 invalidate / pull-to-refresh refetch) 모두 동일 queryKey([NOTIFICATION_QUERY_PREFIX]) / refetch 경로로 수렴 — N2-7 이 shared-key 정규화 계약 검증. 단위 suite 전수(58 tests)가 3-경로 통합 검증을 겸함. N2-2(타인 알림 RLS 브로드캐스트 차단)는 acceptance §3.2 로컬 Supabase 통합 영역(Gap).

## §E.3 Run-phase Audit-Ready Signal

```yaml
run_complete_at: 2026-07-22
run_commit_sha: df45bf6              # M4(run-phase 종료) 커밋 — backfill (self-referential 회피)
run_status: audit-ready              # run-phase 완료, sync-phase 대기
ac_pass_count: 9                     # N2-1, N2-2, N2-3, N2-4, N2-5, N2-6, N2-7, N2-8, N2-9
ac_fail_count: 0
ac_gap_count: 0
preserve_list_post_run_count: 0      # PRESERVE 위반 0건 (SPEC-NOTIF-001 인프라 / RLS 정책 본체 무변경)
l44_pre_commit_fetch: performed      # main baseline b7d0e62 사전 확인
l44_post_push_fetch: pending         # push 후 origin/main 일치 검증 예정
new_warnings_or_lints_introduced: 0  # tsc baseline exit 0 → run 종료 exit 0; eslint baseline 0 → run 종료 0
cross_platform_build:
  scope: RN/Expo (RefreshControl + hooks) + SQL migration — 네이티브 빌드 변경 없음
  status: not-applicable-for-run-phase
total_run_phase_files: 11            # 4 신규(migration + 2 hook/test + index) + 7 수정(3 SPEC frontmatter + progress + screen/2 test + response hook + mock)
m1_to_mN_commit_strategy: per-milestone Conventional Commits 직접 main (M1=6d548e6 / M2=094c914 / M3=95932f6 / M4=this)
coverage_new_or_modified_files:
  statements: 96.66
  branches: 86.36
  functions: 90.9
  lines: 97.75
  files:
    - useNotificationsRealtime.ts: stmts 100 / branch 93.75 / lines 100
    - useNotificationResponse.ts: stmts 100 / branch 100 / lines 100
    - NotificationsScreen.tsx: stmts 93.02 / branch 78.94 / lines 95.23 (잔여 103/122 = SPEC-NOTIF-001 baseline 분기 — error-view 렌더 + markAsRead onError, 본 SPEC 이전부터 미커버)
jest_notification_suite: 7 suites / 58 tests PASS (기존 41 전수 PASS — 회귀 없음)
manual_verification_deferred:        # acceptance §3.3 실기기 — 2026-07-22 빌드 c0a0b6a9에서 N2-1/N2-5/N2-8 실기기 PASS 완료
  - N2-1 실시간 반영 (알림 센터 오픈 상태에서 notifications INSERT → 목록 갱신) ✅ PASS 2026-07-22 실기기 (빌드 c0a0b6a9, DB INSERT → 자동 반영 확인)
  - N2-5 포그라운드 수신 갱신 (prod 빌드 푸시 수신 → 캐시 갱신) ✅ PASS 2026-07-22 실기기 (Expo Push 포그라운드 수신 확인)
  - N2-8 pull-to-refresh (당겨서 스피너 + 갱신) ✅ PASS 2026-07-22 실기기 (사용자 pull down 확인)
```

## §E.4 Sync-phase Audit-Ready Signal

```yaml
sync_commit_sha: 999bafce4ac4812a131d70c531f603ccf8321190    # backfill 완료 — self-referential 회피 후 실제 SHA 기록
sync_status: audit-ready                  # sync-phase 완료, sync-auditor 대기
sync_complete_at: 2026-07-22
changelog_entry_position: "[Unreleased] > Added > 알림 센터 실시간 갱신 (SPEC-NOTIF-002)"
b12_self_test_a:
  pre_emission_dup_check: "grep -c 'SPEC-NOTIF-002' CHANGELOG.md → 0 (중복 없음, 본 entry는 첫 등록)"
  ac_count_match: "acceptance.md grep → 9 ACs (9/9 PASS), CHANGELOG entry 명시와 일치"
  file_path_verify: "ls src/features/notification/useNotifications*.{ts,tsx} supabase/migrations/20260722000001* → 모두 존재"
b12_self_test_b:
  frontmatter_transitions: "4 artifacts (spec/plan/acceptance/progress) frontmatter status: in-progress → completed, updated: 2026-07-22"
  spec_body_untouched: "grep -c 'status: completed' .moai/specs/SPEC-NOTIF-002/{spec,plan,acceptance}.md body-only → 0 (본체 미변경, frontmatter만 변경)"
b12_self_test_c:
  conventional_commit_subject: "docs(SPEC-NOTIF-002): sync-phase artifacts (또는 chore(SPEC-NOTIF-002): ...)"
  moai_trailer_present: "🗿 MoAI <email@mo.ai.kr> 트레일러 포함"
  no_amend_no_force: "git log --oneline -1 → --amend/--force 부재"
residual_disclosure:
  n2_2_runtime_smoke: "N2-2 타인 알림 RLS 차단 — PASS 완료 (PR #155 — 로컬 Supabase 종단간 검증, 2026-07-22). 서버 SELECT RLS 게이트가 Realtime 브로드캐스트에도 적용됨 확인 (Node.js smoke + pgTAP 0020). 별도 broadcast RLS policy 불필요 — migration 주석의 open follow-up question 해결됨."
sync_artifacts:
  changelog: "CHANGELOG.md [Unreleased] 섹션에 SPEC-NOTIF-002 entry 추가 (AC 9개, 파일 경로 4개, residual 명시)"
  readme: "README.md 부재 — 갱신 불필요 (CHANGELOG로 대응)"
  mx_tag_validation: "MX tags — run-phase에서 validated (N2-3 cleanup @MX:WARN, N2-5/6 invalidate @MX:NOTE). sync-phase에서 중복/누락 없음 확인"
```

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
