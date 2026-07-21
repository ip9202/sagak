## Task Decomposition
SPEC: SPEC-PROFILE-001
Methodology: TDD (RED-GREEN-REFACTOR)
Execution: sub-agent (solo), Standard harness
Branch: feature/SPEC-PROFILE-001-mypage

> 전략(manager-strategy)에서 확정된 9 TDD 사이클 + RLS 통합 테스트. 의존성 순서: types → 순수함수 → queries → mutations → hooks → components → screens.
> Drift Guard 기준 planned_files. 실제 구현 시 이 목록에서 벗어나면 progress.md에 기록.

| Task ID | Description | Requirement | Dependencies | Planned Files | Status |
|---------|-------------|-------------|--------------|---------------|--------|
| T-001 | Profile/ProfileUpdateInput/UserStats/PointLog/Badge/BadgeInput 타입 정의 (DB 스키마 우선: ref_id 제거, email/alarm/role 포함) | REQ-PROF-001/004/006/007 | - | src/features/profile/types.ts | pending |
| T-002 | computeBadges 순수 함수 + thresholds 상수 (5.1 임시값) | REQ-PROF-007 (P19/20/22) | T-001 | src/features/profile/badges.ts, __tests__/badges.test.ts | pending |
| T-003 | getUserStats 집계 (3개 지표 Promise.all 병렬: COUNT head:true + SUM JS) | REQ-PROF-004 (P10/11) | T-001 | src/features/profile/queries.ts, __tests__/queries.test.ts | pending |
| T-004 | getProfile + getPointLogs PostgREST (전체 컬럼, created_at DESC) | REQ-PROF-001/006 (P1/15/16) | T-001 | src/features/profile/queries.ts (+tests) | pending |
| T-005 | updateProfile mutation + nickname 검증(빈값/20자), routine alarmApi.ts 패턴 참조 | REQ-PROF-002/003 (P3/4/7/8) | T-001 | src/features/profile/mutations.ts, __tests__/mutations.test.ts | pending |
| T-006 | useProfile/useUserStats(staleTime 5분)/usePointLogs 훅 + invalidate 전략 | REQ-PROF-005 (P13/14) | T-003/4/5 | src/features/profile/{useProfile,useUserStats,usePointLogs}.ts | pending |
| T-007 | StatCard + BadgeCard 컴포넌트 (.pen F15-My 토큰 스타일, 획득/잠김 시각화) | REQ-PROF-004/007 시각화 | T-002 | src/features/profile/components/{StatCard,BadgeCard}.tsx | pending |
| T-008 | index.ts barrel export | - | T-001~7 | src/features/profile/index.ts | pending |
| T-009 | my.tsx 통계/배지/포인트 섹션 통합 (기존 프로필 카드+로그아웃 유지) | REQ-PROF-001/004/006/007 (P10/19) | T-006/7 | app/(tabs)/my.tsx (수정), __tests__/my.test.tsx (수정) | pending |
| T-010 | my/edit.tsx 프로필 수정 화면 (nickname/avatar_url) | REQ-PROF-002/003 (P3/4/6) | T-005 | app/(tabs)/my/edit.tsx (신규), __tests__/my-edit.test.tsx | pending |
| T-011 | 설정 섹션 (이용약관/개인정보처리방침 링크 또는 "준비 중" 플레이스홀더) + 로그아웃 진입점 정비 | REQ-PROF-008 (P24/25/26/27) | T-009 | app/(tabs)/my.tsx (수정) | pending |
| T-012 | RLS 통합 테스트 (타인 접근/수정/INSERT 차단 — pgTAP 패턴参照, 인프라 확인 후) | REQ-PROF-001/002/004/006 (P2/5/12/17/18) | T-003/4/5 | supabase/test/profile_rls.test.sql (또는 도메인 __tests__/rls) | pending |

## acceptance 시나리오 → 테스트 매핑

| 유형 | 시나리오 | 담당 태스크 |
|------|----------|-------------|
| 단위 (Jest) | P6(수정불가필드), P7(빈값), P8(길이), P11(빈통계), P15(정렬), P16(빈포인트), P19/20/22(배지), P26(플레이스홀더) | T-002/3/4/5/7 |
| 통합 (Jest+mock) | P1(조회), P3/4(수정), P10(집계), P13/14(갱신), P21(재산정), P23(알림진입), P25/27(링크) | T-003/4/5/6/9/11 |
| RLS (pgTAP/Supabase 로컬) | P2/5(프로필), P12(통계), P17/18(포인트) | T-012 |
| 수동/E2E | P24(로그아웃), P9(서버 NOT NULL) | 검증 단계 |

## 핵심 결정 사항 (승인됨)

- **집계**: COUNT=`head:true`, SUM=JS 합산 (routine 일관성)
- **루트**: my.tsx 확장 + my/edit.tsx (plan.md profile/ 경로 폐기)
- **타입**: profile 전용 Profile 타입 신규, auth UserProfile 수정 금지
- **배지**: 순수 함수 computeBadges, thresholds 5.1 임시값
- **캐시**: 통계·포인트 staleTime 5분, 프로필 staleTime 0
- **SPEC 불일치**: DB 실제 코드 우선, /moai sync에서 SPEC 정정 (ref_id 제거, 감정 종류별 배지 제외)
