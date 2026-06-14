# Query Patterns

Supabase JS Client(PostgREST)와 직접 SQL(Edge Functions)을 혼용하는 쿼리 패턴을
문서화한다. 자주 쓰는 쿼리는 여기에 등록하여 쿼리 최적화와 일관성의 기준점으로 삼는다.

> PostgREST는 RLS 정책을 자동 적용한다. 아래 쿼리는 인증된 사용자 컨텍스트에서
> 실행됨을 전제로 한다(service_role 우회 제외).

---

## Common Queries

Frequently used queries for core application flows.

### 사용자별 독서 기록 페이지네이션

```ts
// Purpose: 사용자 프로필 화면의 독서 기록 목록
// Parameters: userId(uuid), page(int), pageSize(int)
// Returns: 독서 기록 + 책 메타데이터, 최신순

const { data, error } = await supabase
  .from('reading_records')
  .select(`
    id, progress, is_completed, created_at,
    books ( id, title, author, cover_image_url )
  `)
  .eq('user_id', userId)
  .order('created_at', { ascending: false })
  .range(page * pageSize, (page + 1) * pageSize - 1);
```

### 모임별 감정 공유 스트림

```ts
// Purpose: 모임 상세 화면의 감정 공유 피드
// Parameters: clubId(uuid)
// Returns: 모임 멤버들의 최근 감정 공유 (RLS가 모임 멤버 접근 필터링)

const { data, error } = await supabase
  .from('emotion_shares')
  .select(`
    id, emotion_text, created_at,
    users ( nickname, profile_image_url )
  `)
  .eq('reading_records.club_id', clubId)
  .order('created_at', { ascending: false })
  .limit(50);
```

---

## Aggregations

Summary queries used for analytics and business logic.

### 사용자별 완독률 (수익화 핵심 지표)

```sql
-- Purpose: 사용자의 완독한 책 비율 계산 (수익화 데이터 축적)
-- Frequency: 프로필 화면 주기적 갱신
-- Performance note: (user_id, is_completed) 인덱스 권장

SELECT
  user_id,
  COUNT(*) FILTER (WHERE is_completed) AS completed_count,
  COUNT(*) AS total_count,
  ROUND(
    COUNT(*) FILTER (WHERE is_completed)::numeric / NULLIF(COUNT(*), 0) * 100,
    1
  ) AS completion_rate
FROM reading_records
WHERE user_id = $1
GROUP BY user_id;
```

> Supabase에서는 이 집계를 Edge Function 또는 Postgres View로 노출한다.
> 민감 지표이므로 service_role 컨텍스트에서만 집계하고, 사용자에게는 본인 결과만 반환.

### 모임별 활성 멤버 수

```ts
// Purpose: 모임 목록의 활성도 표시
// Returns: 각 모임의 멤버 수
const { data } = await supabase
  .from('club_members')
  .select('club_id')
  .in('club_id', clubIds);
// 클라이언트에서 그룹 카운트, 또는 PostgREST의 count 헤더 활용
```

---

## Reports

Complex queries that power dashboards and exports.

### 전체 완독률 트렌드 (운영자 대시보드)

```sql
-- Purpose: 월별 전체 완독률 트렌드 추적 (제품 성장 지표)
-- Used by: 운영자 대시보드 (service_role 전용)
-- Estimated runtime: < 3s with materialized view (새벽 갱신 권장)

SELECT
  DATE_TRUNC('month', created_at) AS month,
  COUNT(*) FILTER (WHERE is_completed) AS completed_total,
  COUNT(*) AS records_total,
  ROUND(
    COUNT(*) FILTER (WHERE is_completed)::numeric / NULLIF(COUNT(*), 0) * 100,
    1
  ) AS completion_rate
FROM reading_records
GROUP BY DATE_TRUNC('month', created_at)
ORDER BY month DESC;
```

<!--
권장 구현:
- 위 집계를 `mv_completion_stats` Materialized View로 캡슐화
- Edge Function(/functions/v1/admin-stats)에서 service_role로 조회
- 인증된 운영자만 호출 가능하도록 JWT 클레임 검증
-->
