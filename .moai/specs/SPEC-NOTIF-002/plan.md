---
id: SPEC-NOTIF-002
title: "알림 센터 실시간 갱신 — 구현 계획"
version: "0.1.0"
status: in-progress
created: 2026-07-22
updated: 2026-07-22
author: "강력쇠주먹"
priority: P2
phase: "v1.2.0"
module: "src/features/notification"
lifecycle: spec-anchored
tags: "notif, realtime, supabase, react-query, notification-center, refresh, plan"
tier: M
depends_on: [SPEC-NOTIF-001]
---

# SPEC-NOTIF-002: 구현 계획 (plan.md)

## §A. Context

### §A.1 작업 위치

- **Project root**: `/Users/ip9202/develop/vibe/sagak`
- **영향 모듈**: `src/features/notification/` (React Native + Expo + Supabase + TanStack Query)
- **Route**: Hybrid Trunk main 직접 (1인 OSS, Tier M)

### §A.2 SPEC 아티팩트 경로

- `.moai/specs/SPEC-NOTIF-002/spec.md` (본 SPEC, REQ 3개 + 제약 + Out of Scope)
- `.moai/specs/SPEC-NOTIF-002/plan.md` (본 파일)
- `.moai/specs/SPEC-NOTIF-002/acceptance.md` (Given-When-Then 시나리오 + DoD)

### §A.3 진단 증거 (truth source — grep 관측)

| 결함 | grep 증거 | 영향 파일 |
|------|-----------|-----------|
| Realtime 구독 부재 | `grep -rn "channel\|postgres_changes\|\.on('INSERT')\|realtime" src/features/notification/` → 0건 (channel은 `setNotificationChannelAsync`만) | `src/features/notification/useNotifications.ts` (또는 신규 훅) |
| invalidateQueries 미연결 | `grep -n "invalidateQueries\|invalidate" src/features/notification/useNotificationResponse.ts` → 0건 | `src/features/notification/useNotificationResponse.ts` |
| RefreshControl 부재 | `grep -n "RefreshControl\|ScrollView\|onRefresh" src/features/notification/components/NotificationsScreen.tsx` → ScrollView만 | `src/features/notification/components/NotificationsScreen.tsx` |

### §A.4 재사용 자산 (truth source)

- 쿼리 키: `NOTIFICATION_QUERY_PREFIX`, `NOTIFICATIONS_KEY`, `UNREAD_COUNT_KEY` (`useNotifications.ts`/`useUnreadCount.ts` 정의).
- invalidateQueries 패턴: `useMarkAsRead.ts`/`useMarkAllAsRead.ts`가 `qc.invalidateQueries({ queryKey: [NOTIFICATION_QUERY_PREFIX] })` 사용 — 동일 패턴을 `useNotificationResponse`에 적용.
- **Realtime 구독 훅 정준 패턴 (M1 최고 위력 디리스크 자산)**: `src/features/feed/useClubFeedRealtime.ts` (131행) — `client.channel(name)` → `.on('postgres_changes', {event, schema, table, filter}, cb)` (cb는 `invalidateQueries`) → `channel.subscribe(statusCb)` + cleanup `channel.unsubscribe()` + `client.removeChannel(channel)`. REQ-NOTIF2-001 구독 훅은 이 패턴을 `notifications` 테이블 INSERT에 그대로 준용한다(신규 추상화 금지).
- **Realtime publication 구성 선례**: `supabase/migrations/20240620000001_enable_realtime_feed.sql` — `ALTER PUBLICATION supabase_realtime ADD TABLE ...` + `REPLICA IDENTITY FULL`. 새 notifications publication 마이그레이션(M1)이 이 선례를 준용한다.
- Supabase RLS: `notifications_select_own` (REQ-DB-021) — publication 구성 후 브로드캐스트 자동 게이트(§C 결정, feed 선례 검증 완료).

### §A.5 PRESERVE 목록 (변경 금지)

- SPEC-NOTIF-001 인프라: `registerForPush.ts`, `registerToken.ts`, `usePushTokenRegistration.ts`, Edge Function `send-notification`, FCM V1 크리덴셜, `google-services.json`, EAS 빌드 설정.
- 템플릿 시스템(`routeMapper.ts`), 읽음 처리 로직(`useMarkAsRead.ts`, `useMarkAllAsRead.ts` — 패턴은 참조하되 본체 변경 금지).
- **notifications RLS 정책 본체 (`notifications_select_own`, REQ-DB-021)**: PRESERVE — 새 Realtime publication 마이그레이션(M1)은 publication 구성(`ALTER PUBLICATION ... ADD TABLE` + `REPLICA IDENTITY FULL`)만 수행하고, 기존 RLS 정책 본체는 변경 금지.
- 다른 SPEC 디렉토리, 런타임 관리 파일(`.moai/state/*`, `.moai/cache/*`).

---

## §B. Known Issues (B1-B12 중 도메인 해당 항목)

### B4. Frontmatter Canonical Schema

- `created:`/`updated:`/`tags:` 사용 (snake_case 금지). 본 SPEC plan-phase 아티팩트는 이미 준수.

### B5. CI 3-tier Awareness

- spec-lint / eslint / jest 각각 독립 실패 가능. 신규 결함 vs 기존 baseline 구분 필요.

### B6. spec-lint Heading Convention

- spec.md `### Out of Scope — <topic>` H3 서브헤딩 + `-` bullet (본 SPEC은 5개 H3 서브헤딩으로 준수).

### B9. Git Commit + Push Performed Directly (Hybrid Trunk 1인 OSS)

- manager-develop는 본 SPEC scope에서 main 직접 커밋+푸시 권장 (Tier M). Conventional Commits + `🗿 MoAI <email@mo.ai.kr>` 트레일러.

### B10. Untouched Paths PRESERVE (Scope Discipline)

- SPEC-NOTIF-001 인프라(PRESERVE §A.5) 및 다른 SPEC 디렉토리 건드리지 않음. runtime-managed 파일 금지.

---

## §C. Pre-flight (사전 검증)

run-phase 진입 전 아래 사전 확인이 필요하다 (일부는 plan-phase에서 결정 불가 — run-phase가 실제 코드로 검증):

```bash
# 1. 현재 브랜치 + baseline
git branch --show-current   # Hybrid Trunk: main
git rev-parse HEAD

# 2. 기존 lint baseline (신규 vs 기존 결함 구분)
npm run lint 2>&1 | tail -5   # 또는 프로젝트 lint 스크립트

# 3. Supabase Realtime publication 구성 확정 (§C 결정 사항)
#    - notifications 테이블이 아직 publication에 없음을 grep로 재확인
grep -rn "ALTER PUBLICATION.*notifications\|ADD TABLE.*notifications" supabase/migrations/ || echo "notifications publication 마이그레이션 필요 (예상됨 — M1에서 추가)"
#    - 기존 feed 선례 20240620000001_enable_realtime_feed.sql 의 RLS-broadcast 패턴 준용 확정

# 4. PRESERVE 대상 파일 존재 확인
ls src/features/notification/{useMarkAsRead,useMarkAllAsRead,useNotifications,useUnreadCount,useNotificationResponse}.ts

# 5. 결함 재확인 (진단 변동 없음 확인)
grep -rn "postgres_changes" src/features/notification/ || echo "Realtime 구독 여전히 부재 (예상됨)"
grep -c "invalidateQueries" src/features/notification/useNotificationResponse.ts   # 0 예상
grep -c "RefreshControl" src/features/notification/components/NotificationsScreen.tsx   # 0 예상
```

**[해결됨] Supabase Realtime RLS 적용 범위 — publication 별도 구성 필요로 확정** — `notifications` 테이블은 현재 어떤 Realtime publication에도 포함되어 있지 않다(grep 관측: `supabase/migrations/`에 `ALTER PUBLICATION ... notifications` 매치 0건). 따라서 새 마이그레이션에서 `ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications` + `REPLICA IDENTITY FULL` 구성이 필요하다. 구성 후 기존 `notifications_select_own` RLS 정책(REQ-DB-021)이 브로드캐스트를 자동 게이트한다 — 이는 기존 feed 선례 `supabase/migrations/20240620000001_enable_realtime_feed.sql`(`emotion_records`/`sticker_reactions` 대상, 주석 인용 "Supabase Realtime 는 postgres_changes 브로드캐스트 시 테이블의 SELECT RLS 정책을 그대로 적용한다")이 검증한 동일 패턴이다. lessons #10 "Realtime RLS는 publication 별도 구성" 확정.

---

## §D. Constraints (DO NOT VIOLATE)

- **PRESERVE**: SPEC-NOTIF-001 인프라(§A.5) 회귀 금지. 읽음 처리 로직 본체 변경 금지(패턴 참조만).
- **새 notifications publication migration**: IN-SCOPE (M1에서 추가 — `ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications` + `REPLICA IDENTITY FULL` 만). 기존 `notifications_select_own` RLS 정책 본체는 PRESERVE — migration이 정책을 변경하면 안 됨.
- **Forbidden**: `--no-verify`, `--amend`, main force-push, 크리덴셜/`.env` 수정, `google-services.json` 수정, FCM V1 키 재업로드.
- **Required**: Conventional Commits, `🗿 MoAI <email@mo.ai.kr>` 트레일러, `code_comments: ko`.
- **기존 패턴 재사용**: invalidateQueries는 `useMarkAsRead` 패턴 그대로. 신규 추상화/패턴 도입 금지.

---

## §E. Self-Verification Deliverables

run-phase 완료 보고 시 아래 항목 포함 (verification-claim-integrity §3 5-섹션 형식: Claim / Evidence / Baseline-attribution / Gaps / Residual-risk):

- **E1. AC Binary PASS/FAIL Matrix** — acceptance.md 각 AC에 대해 PASS/FAIL + 검증 명령 + 실제 출력.
- **E2. lint/tsc/jest 결과** — 0 신규 에러 (baseline과 구분).
- **E3. 결함 해소 grep 증거** — Realtime 구독/invalidateQueries/RefreshControl 각각 신규 매치 관측.
- **E4. SPEC-NOTIF-001 회귀 없음** — 기존 notification 테스트 suite 전수 PASS.
- **E5. 커밋 SHA + push 결과** — 직접 SHA 검증 (manager-git-hallucination-verify).
- **E6. Blocker 보고 (있을 시)** — Realtime RLS publication 별도 구성 필요 등.

---

## §F. Milestones (decision-reversibility 순서 — 인터페이스 결정 우선, 기계적 작업 후순)

### M1: Realtime INSERT 구독 훅 + cleanup (REQ-NOTIF2-001)

**가장 결정-가역성 높은 마일스턴** — Realtime API shape, 채널명, 구독 훅 시그니처, RLS publication 검증이 모두 이 단계에서 확정된다.

작업:
- **notifications 테이블 Realtime publication 추가 migration** (`supabase/migrations/<timestamp>_enable_realtime_notifications.sql` — `ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications` + `REPLICA IDENTITY FULL`, `20240620000001_enable_realtime_feed.sql` 선례 준용). 기존 `notifications_select_own` RLS 정책 본체는 변경 금지(PRESERVE §A.5) — publication 구성만 추가.
- Supabase Realtime `postgres_changes` INSERT 이벤트 채널 구독 훅 작성 — `src/features/feed/useClubFeedRealtime.ts` 정준 패턴 준용 (`client.channel(name)` → `.on('postgres_changes', {event:'INSERT', schema:'public', table:'notifications', filter:`user_id=eq.${userId}`}, cb)` → `channel.subscribe(statusCb)`). `useNotifications` 진입 시 또는 신규 `useNotificationsRealtime` 훅 — ANALYZE에서 기존 구조 기반 결정.
- 화면 진입 시 구독 수립, unmount 시 cleanup(useEffect cleanup — `channel.unsubscribe()` + `client.removeChannel(channel)`, feed 선례와 동일).
- 수신 이벤트 → `queryClient.invalidateQueries({ queryKey: [NOTIFICATION_QUERY_PREFIX] })` 트리거 (invalidate ONLY — 직접 캐시 조작 금지, AP-2 및 feed 선례 일관성).
- RLS 적용 검증(§C 결정 사항 확인) — 타인 알림 수신 안 됨 확인(통합 테스트 — acceptance.md §3.2 N2-2).

완료 기준: 인증된 사용자의 새 알림 INSERT 시 캐시가 갱신되고, 타인 알림은 수신되지 않으며, cleanup이 누수 없이 동작함을 단위/통합 테스트로 검증.

### M2: useNotificationResponse invalidateQueries 연결 (REQ-NOTIF2-002)

작업:
- `useNotificationResponse.ts`에 `useQueryClient` 도입.
- `addNotificationResponseReceivedListener`(배너 클릭) 콜백에 `qc.invalidateQueries({ queryKey: [NOTIFICATION_QUERY_PREFIX] })` 추가.
- 포그라운드 수신(`addNotificationReceivedListener`) 콜백에도 동일 invalidate 추가 — 수신 즉시 목록 갱신.
- 기존 `useMarkAsRead` 패턴 그대로 재사용(신규 추상화 금지).

완료 기준: 푸시 수신 및 배너 클릭 시 알림 목록 쿼리가 무효화되어 재조회됨을 테스트로 검증.

### M3: RefreshControl 부착 (REQ-NOTIF2-003)

작업:
- `NotificationsScreen.tsx`의 `ScrollView`에 `RefreshControl` prop 추가.
- `onRefresh` → `useNotifications().refetch` 연결.
- `refreshing` state를 `isFetching`/`refetch` Promise 기반으로 관리.

완료 기준: 화면을 아래로 당길 때 로딩 스피너 표시 후 갱신 완료 시 스피너 해제됨을 단위 테스트로 검증.

### M4: 통합 검증 + 품질 게이트

작업:
- 3개 REQ 통합 시나리오(새 알림 → 3 경로 반영) 테스트.
- SPEC-NOTIF-001 기존 테스트 suite 회귀 없음 확인(jest 전수).
- lint/tsc 0 신규 에러.
- TRUST 5 게이트 통과.

완료 기준: acceptance.md 모든 AC PASS, 회귀 없음, 게이트 green.

---

## §G. Anti-Patterns

- **AP-1**: Realtime 구독을 컴포넌트 외부(모듈 최상위)에서 수립 → cleanup 누수. 반드시 useEffect 내에서.
- **AP-2**: invalidateQueries 대신 직접 `setQueryData`로 캐시 조작 — 기존 패턴(invalidate)에서 벗어난 신규 패턴 도입 금지 (REQ-NOTIF2-002 명시).
- **AP-3**: SPEC-NOTIF-001 읽음 처리 로직(`useMarkAsRead`) 본체 수정 — 패턴은 참조하되 본체는 PRESERVE.
- **AP-4**: pull-to-refresh를 별도 상태 관리 라이브러리로 추가 — React Native 내장 `RefreshControl` 사용.
- **AP-5**: "Realtime이 안 되면 polling으로 폴백" 등 scope 확장 — 본 SPEC은 Realtime + invalidate + RefreshControl 3종만. 폴백 정책은 Out of Scope.

---

## §H. Cross-References

- `SPEC-NOTIF-002/spec.md` — REQ 3개 + 제약 + Out of Scope 5종.
- `SPEC-NOTIF-002/acceptance.md` — Given-When-Then 시나리오 + DoD.
- `SPEC-NOTIF-001/acceptance.md` §1 시나리오 N7 — 본 SPEC 분리 근거.
- `SPEC-NOTIF-001/plan.md` §N7-D — 체크리스트 4번째 항목 부분 통과 + 본 SPEC 이관.
- `.claude/agents/moai/manager-spec.md` — plan-phase 아티팩트 소유권.
- `.claude/rules/moai/development/spec-frontmatter-schema.md` — frontmatter 12 필드 스키마.
- `lessons.md` #10 (Realtime RLS publication 별도 구성) — §C 사전 검증 참조.
