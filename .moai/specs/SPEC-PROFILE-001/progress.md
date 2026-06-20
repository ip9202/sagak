## SPEC-PROFILE-001 Progress

- Started: 2026-06-20
- Methodology: TDD (RED-GREEN-REFACTOR) per quality.yaml
- Phase 0.5 skipped: memory_guard disabled
- Phase 0.9 complete: language=TypeScript (Expo RN SDK 55), inject moai-lang-typescript
- Phase 0.95 complete: Scale-based mode=Standard (단일 프론트엔드 도메인, ~10-13 파일), execution=sub-agent(solo), harness=standard
- Lessons loaded: 11 lessons from auto-memory (key: #3 SPEC 인터페이스 실제 코드 검증, #9 .pen 레퍼런스 실제 열람, #8 develop docs sync PR 필수, #1 LSP vs tsc/jest 둘 다 실행)
- Design frame verified: `.moai/design/sagak.pen` F15 my 화면 노드 존재 (line 1350 "마이페이지", Profile/Stats/Stat-완독/Stat-독서시간/Stat-감정기록/Row-독서 통계/EmptyState). Pencil MCP disabled → CLI(Read/grep) 직접 열람
- Existing pattern survey complete:
  - routine: 클라이언트 집계 방식 (RPC 대신 행 fetch 후 JS SUM/COUNT), users UPDATE 패턴(alarmApi.ts)
  - auth: useSession() → session.user.id, signOut in AuthContext, UserProfile 타입(auth/types.ts)
  - lib: getSupabaseClient() 싱글톤, getQueryClient() (staleTime 0, retry 1)
  - 화면: app/(tabs)/my.tsx 이미 존재 (plan.md의 profile/ 경로와 불일치 → my.tsx 우선)
  - 테스트: jest-expo, jest.mock supabase client, @testing-library/react-native, QueryClientProvider wrapper
- Path discrepancy noted: plan.md `app/(tabs)/profile/` vs actual `app/(tabs)/my.tsx` → strategy에서 실제 코드 기준 정립
