# SPEC-CLUB-003 구현 계획 (plan.md)

> SPEC-CLUB-003 "모임 진도 집계 표시" 구현 전략. 본 문서는 WHAT/HOW 를 다루며, 세부 코드는
> Run 단계(TDD RED-GREEN-REFACTOR) 에서 작성한다. 모든 결정은 spec.md 가정(2.1, 2.2)과
> 일치한다.

---

## 1. 기술 결정 요약

### 1.1 RLS 데이터 접근: Option (a) — `user_books_public` 뷰

**결정**: RPC 함수 `get_host_clubs_progress` 는 `SECURITY INVOKER` 로 선언하고
`user_books_public` 뷰만 SELECT 한다.

**근거**:
- Track A `src/features/club/trackA/readersApi.ts:16 READERS_SELECT` 가 이미 동일 뷰를
  소비 중 — 데이터 소스 일관성
- `user_books_public` 뷰는 `is_public=true` 행만 노출하며 `authenticated` 역할에 SELECT 가
  부여됨(`supabase/migrations/20240614000014_enable_rls.sql:88-102`) — 별도 권한 부여 불필요
- `is_public=false` 멤버의 진도가 집계에서 자동 제외되는 것이 프라이버시 정합(공개 설정한
  독자의 진도만 모임 컨텍스트에 노출)
- SECURITY DEFINER 함수의 권한 상승 표면 최소화 — DEFINDER 는 꼭 필요한 경우(fn_user_in_club
  등 RLS 재귀 회피)에만 사용

**기각된 대안 (Option b — SECURITY DEFINER + `user_books` 직접 SELECT)**:
- 장점: `is_public=false` 멤버 포함 가능
- 단점: 권한 상승 표면 증가, Track A 와 데이터 소스 불일치, "비공개 독자 진도도 host 가 본다"
  는 프라이버시 해석이 명확하지 않음
- 기각 이유: 현재 제품 요구사항이 "비공개 독자 진도 포함" 을 요구하지 않음. option a 가
  더 보수적이며 일관적임.

**보안 메모**: RPC 는 `auth.uid()` 를 직접 사용하지 않고 `p_host_id` 매개변수를 받는다.
클라이언트는 항상 `auth.uid()` 를 전달한다. 설령 타인 UUID 가 전달되더라도 노출되는 것은
공개 설정된 독자의 진도뿐이므로 정보 유출 위험은 없다.

### 1.2 집계 방식: MEDIAN (avg 기각)

**결정**: `percentile_cont(0.5) WITHIN GROUP (ORDER BY current_page)` 사용.

**근거**:
- avg 는 극단값에 민감 — 한 명이 0p, 한 명이 300p 인 2인 모임에서 avg=150 은 왜곡
- median 은 그룹 추세를 더 안정적으로 대변
- PostgREST embedded aggregate(`club_members(count)` 등)는 `percentile_cont` 미지원 → RPC 필수

**정책**: `current_page > 0` 인 멤버만 median 에 포함(REQ-CLUBC-003).
이유: `current_page` 기본값 0(진도 미시작). 0p 를 포함하면 모임 시작 직후 "p.0" 만 표시되어
의미 없음. 단, `member_count_with_progress` 로 host 가 "진도 입력 멤버 수" 를 별도 인지.

### 1.3 라운드트립 최소화

**결정**: `useHostClubs` 의 `Promise.all([clubs SELECT, RPC])` 병렬 실행 + 클라이언트 merge.

**근거**:
- PostgREST 는 embedded aggregate 와 RPC 를 동일 쿼리에 섞을 수 없음
- 직렬 실행 대신 병렬로 대기 시간 숨김
- 2-라운드트립이 최소임(단일 쿼리 불가)

**병합 로직**: `club_id` 기준 Map 조회 O(N+M).

### 1.4 RPC 실패 시 degradation

**결정**: RPC 에러 시 전체 `useHostClubs` 실패시키지 않고 진도 필드 기본값(0, 0, null) 채움.

**근거**: 진도는 보조 정보. 모임 목록 자체(이름, 멤버 수, 상태)는 RPC 장애와 무관하게
표시되어야 함.

---

## 2. 마이그레이션 및 RPC 설계

### 2.1 마이그레이션 파일

`supabase/migrations/20240627000001_create_get_host_clubs_progress_rpc.sql`

### 2.2 RPC 함수 시그니처 (의사 코드)

```sql
CREATE OR REPLACE FUNCTION public.get_host_clubs_progress(p_host_id uuid)
RETURNS TABLE (
    club_id uuid,
    median_page integer,
    member_count_with_progress integer,
    total_pages integer
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
    SELECT
        c.id AS club_id,
        COALESCE(
            percentile_cont(0.5) WITHIN GROUP (
                ORDER BY ubp.current_page
            )::integer,
            0
        ) AS median_page,
        COUNT(ubp.current_page)::integer AS member_count_with_progress,
        b.total_pages
    FROM public.clubs c
    LEFT JOIN public.club_members cm ON cm.club_id = c.id
    LEFT JOIN public.user_books_public ubp
        ON ubp.user_id = cm.user_id
        AND ubp.book_id = c.book_id
        AND ubp.current_page > 0
    LEFT JOIN public.books b ON b.id = c.book_id
    WHERE c.host_id = p_host_id
        AND c.type = 'group'
        AND c.status = 'active'
    GROUP BY c.id, b.total_pages;
$$;

GRANT EXECUTE ON FUNCTION public.get_host_clubs_progress(uuid) TO authenticated;
```

> 상세 SQL 은 Run 단계에서 작성. 위는 계약 명시용 의사 코드.

### 2.3 RLS 동작 분석

- `clubs` RLS: `USING(true)` for SELECT — host_id 필터와 무관하게 authenticated 가 모든 club
  행을 볼 수 있음. WHERE 절이 `host_id = p_host_id` 로 필터링.
- `club_members` RLS: `fn_user_in_club(club_id)` — 본인이 속한 모임만. **주의**: host 는
  자신의 모임에 속하므로 host 모임의 멤버는 모두 보임. 그러나 RPC 가 SECURITY INVOKER 이면
  club_members RLS 가 적용되어 host 의 모임 멤버만 조인됨. 이는 의도된 동작(host 가 자신의
  모임 진도만 집계)과 일치.
- `user_books_public` 뷰: 뷰 자체가 `is_public=true` 필터 + `authenticated` GRANT. INVOKER 도
  동일 필터 적용.
- `books` RLS: `USING(true)` — 모든 authenticated 가 total_pages 조회 가능.

> 잠재 이슈: `club_members` LEFT JOIN 시 host 가 아닌 다른 모임의 멤버는 RLS 로 가려짐.
> 그러나 WHERE `c.host_id = p_host_id` 로 이미 host 모임으로 좁혀졌으므로, host 모임의
> 멤버는 모두 보임. 정합.

### 2.4 gen-types 영향

RPC 반환 타입은 `supabase gen types` 실행 시 `Database["public"]["Functions"]["get_host_clubs_progress"]["Returns"]` 로 생성됨. 클라이언트는 이 타입을 사용.

---

## 3. Hook 계층 통합

### 3.1 `HostClubWithCount` 타입 확장

```ts
export type HostClubWithCount = ClubRow & {
  member_count: number;
  median_page: number;             // 신규
  member_count_with_progress: number; // 신규
  progress_total_pages: number | null; // 신규
};
```

### 3.2 `useHostClubs` queryFn 수정

```ts
queryFn: async (): Promise<HostClubWithCount[]> => {
  const client = getSupabaseClient();
  const [clubsResult, progressResult] = await Promise.all([
    client
      .from('clubs')
      .select('*, club_members(count)')
      .eq('host_id', userId)
      .order('created_at', { ascending: false }),
    client.rpc('get_host_clubs_progress', { p_host_id: userId }),
  ]);

  // clubsResult 에러 → throw (기존 동작)
  if (clubsResult.error) throw normalizeError(clubsResult.error);

  // progressResult 에러 → degradation (REQ-CLUBC-008)
  const progressMap = new Map<string, { median_page: number; mcp: number; tp: number | null }>();
  if (progressResult.error) {
    console.warn('[useHostClubs] progress RPC failed, degrading', progressResult.error);
  } else if (progressResult.data) {
    for (const row of progressResult.data) {
      progressMap.set(row.club_id, {
        median_page: row.median_page ?? 0,
        mcp: row.member_count_with_progress ?? 0,
        tp: row.total_pages ?? null,
      });
    }
  }

  // 병합
  const rows = clubsResult.data ?? [];
  return rows.map((row) => {
    const count = row.club_members?.[0]?.count;
    const { club_members: _drop, ...rest } = row;
    const prog = progressMap.get(row.id);
    return {
      ...rest,
      member_count: typeof count === 'number' ? count : 0,
      median_page: prog?.median_page ?? 0,
      member_count_with_progress: prog?.mcp ?? 0,
      progress_total_pages: prog?.tp ?? null,
    };
  });
}
```

> 상세 구현은 Run 단계에서 TDD 로 작성. 위는 계약 명시.

### 3.3 queryKey 변경 없음

기존 `['club', 'trackb', 'host', userId]` 유지. 진도 데이터가 동일 캐시에 병합됨.

---

## 4. UI 계층

### 4.1 ClubCard 진도 표시 추가

`ClubsScreen.tsx` 의 `ClubCard` 컴포넌트 내, 기존 `멤버 N명` 텍스트 아래에:

1. median 텍스트: `p.{median} · 진도 {member_count_with_progress}명` 또는 median=0 시 `아직 진도가 없어요`
2. 진도 바: `progress_total_pages != null && > 0` 일 때만 렌더링

### 4.2 `.pen` 노드 참조

- Track/Fill: `.pen` F11-Clubs RmILS Progress 노드 참조
- Pct 텍스트: `.pen` RmILS Pct 라인
- Run 단계에서 Pencil MCP(`.pen` CLI grep)로 실제 노드 속성(padding, radius, fill 색상) 확인 후 구현

### 4.3 SPEC-UI-002 토큰 매핑

| 요소 | 토큰 |
|------|------|
| 진도 텍스트 | `typography.label`, `theme.colors.text.tertiary` |
| Track 배경 | `theme.colors.bg.subtle` 또는 `theme.colors.brand[100]` |
| Track radius | `theme.radius.full` |
| Track 높이 | `theme.spacing[2]`(8px) 또는 `.pen` 확인값 |
| Fill 색상 | `theme.colors.brand[500]` |
| gap | `theme.spacing[1]` |

> Run 단계에서 `.pen` 실제 값으로 토큰 매핑 확정.

### 4.4 `@MX:TODO` 해소

`ClubsScreen.tsx:309` 의 `@MX:TODO` 블록 제거. GREEN 단계에서 MX 리포트에 "TODO 제거 1건" 기록.

---

## 5. 리스크

| 리스크 | 영향 | 완화 |
|--------|------|------|
| `club_members` LEFT JOIN + RLS 상호작용 예상과 다를 수 있음 | median 집계가 누락됨 | pgTAP 통합 테스트로 검증(Run 단계) |
| `user_books_public` 뷰의 `is_public=false` 제외가 host 에게 예상치 못한 "진도 0" 유발 | host 가 멤버 진도를 못 봄 | `member_count_with_progress` 로 host 가 "0명 입력" 인지 가능 |
| RPC 성능(host 모임 다수 + 멤버 다수) | 응답 지연 | 인덱스(clubs.host_id, club_members.club_id) 확인; 필요 시 materialized view 검토(후순위) |
| `books.total_pages` 자주 NULL | 바 미표시 빈번 | 텍스트 fallback(REQ-CLUBC-012) 으로 UX 보장 |

---

## 6. 마일스톤 (우선순위 기반, 시간 추정 없음)

- **M1 (High)**: 마이그레이션 + RPC 함수 + GRANT. pgTAP 단위 테스트(median 정확성, RLS 동작,
  empty 결과, total_pages NULL).
- **M2 (High)**: `useHostClubs` 확장 — 타입, Promise.all 병합, degradation. 단위 테스트(RPC
  성공/실패/빈 데이터).
- **M3 (High)**: ClubCard 진도 표시 — 텍스트, 바, total_pages NULL 분기, median 0 분기.
  컴포넌트 테스트(Testing Library).
- **M4 (Medium)**: `@MX:TODO` 해소 + MX 리포트. E2E 회귀(실기기 — 기존 ClubsScreen 동작 유지).

---

## 7. 의존성 및 선행 조건

- dev/prod Supabase 에 마이그레이션 적용 후 gen-types 재생성 필요(클라이언트 RPC 반환 타입)
- SPEC-CLUB-002 PR #23(c6920fe) 이미 머지됨 — `useHostClubs`, `HostClubWithCount`, ClubsScreen
  모두 존재
- SPEC-UI-002 토큰(`typography.label`, `radius.full`, `brand[500]`) 이미 존재

---

## 8. 테스트 전략 (TDD)

| 레이어 | 도구 | 대상 |
|--------|------|------|
| DB/RPC | pgTAP | median 정확성(홀수/짝수 멤버), current_page>0 필터, is_public=false 제외, host_id 필터, type/status 필터, total_pages NULL |
| Hook | Vitest + msw/msw-supabase | RPC 성공 병합, RPC 실패 degradation, 빈 RPC 결과, clubs 실패 시 throw |
| UI | Vitest + Testing Library | median>0 + total_pages>0 (바 표시), median=0 (대체 텍스트), total_pages NULL (바 생략), member_count_with_progress 표시 |
| 회귀 | 수동(실기기) | 기존 ClubsScreen 목록 렌더링, ClubCard 레이아웃, closed 모임 표시 |

> Run 단계에서 RED-GREEN-REFACTOR 로 각 레이어별 구현. tasks.md 참조.
