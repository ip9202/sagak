# SPEC-CLUB-003 요약 (spec-compact.md)

> "모임 진도 집계 표시" — SPEC-CLUB-002 가 담당하지 않던 실제 읽기 진도 집계 영역.

## 핵심

host 가 소유한 모임의 멤버 읽기 진도(median) 를 Postgres RPC 로 집계하여 ClubsScreen
ClubCard 에 표시. `ClubsScreen.tsx:309 @MX:TODO` 해소.

## 데이터 흐름

```
user_books_public(뷰, is_public=true)
    ↓ current_page
club_members → clubs(host_id, type='group', status='active') → books(total_pages)
    ↓ percentile_cont(0.5)
get_host_clubs_progress(p_host_id) RPC
    ↓ TABLE(club_id, median_page, member_count_with_progress, total_pages)
useHostClubs(Promise.all 병합)
    ↓ HostClubWithCount[]
ClubsScreen ClubCard (진도 텍스트 + 바)
```

## 주요 결정

| 결정 | 선택 | 이유 |
|------|------|------|
| RLS 데이터 소스 | option (a) user_books_public 뷰 | Track A 와 일관, is_public=false 자동 제외, 권한 상승 최소 |
| 집계 방식 | MEDIAN (avg 기각) | 극단값 왜곡 회피 |
| RPC 보안 | SECURITY INVOKER | 뷰가 이미 authenticated GRANT |
| 멤버 필터 | current_page>0 만 | 0p(미시작) 제외로 의미 있는 median |
| 라운드트립 | Promise.all(2쿼리) 병렬 | PostgREST embedded aggregate + RPC 혼합 불가 |
| RPC 실패 | degradation(0/0/null) | 진도는 보조 정보, 목록은 유지 |

## REQ 목록 (17개)

- REQ-CLUBC-RPC (001~006): RPC 함수, 매개변수 검증, median 계산, user_books_public 소스, total_pages 조인, GRANT
- REQ-CLUBC-HOOK (007~009): HostClubWithCount 확장, RPC 실패 degradation, 캐시 무효화
- REQ-CLUBC-UI (010~015): 진도 텍스트, 바, total_pages NULL 분기, median 0 분기, TODO 해소, 토큰 준수
- REQ-CLUBC-NONDISPLAY (016~017): median 전용, 랭킹/리더보드 금지 (constitution 비과시)

## 제외

- clubs.current_page 컬럼 (거부)
- 모임 피드 진도 (SPEC-FEED-001)
- 비host 상세 진도 (미결정 6.1)
- 평균/랭킹/리더보드 (비과시)
- is_public=false 멤버 (option a 선택)
- 진도 입력 UI (SPEC-LIBRARY-001)
- SPEC-CLUB-002 진도 설정 로직 수정 (완료된 영역)
- Realtime 진도 갱신

## 산출물

- `supabase/migrations/20240627000001_create_get_host_clubs_progress_rpc.sql`
- `src/features/club/trackB/hooks.ts` (useHostClubs 확장)
- `src/features/club/trackB/components/ClubsScreen.tsx` (ClubCard 진도 표시, @MX:TODO 해소)
- gen-types 재생성
