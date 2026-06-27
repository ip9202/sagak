# SPEC-CLUB-003 진행 추적 (progress.md)

> 초기 상태 — 모든 REQ pending. Run 단계에서 각 항목 완료 시 업데이트.

---

## REQ 완료 현황

| REQ | 설명 | 상태 | 비고 |
|-----|------|------|------|
| REQ-CLUBC-001 | RPC 시그니처 | done | migration 20240627000001, pgTAP 0019 |
| REQ-CLUBC-002 | 매개변수 검증 | done | host_id WHERE 필터 (RPC 본문) |
| REQ-CLUBC-003 | median 계산 (current_page>0) | done | percentile_cont + COALESCE |
| REQ-CLUBC-004 | SECURITY INVOKER + user_books_public | done | 뷰 소스, INVOKER |
| REQ-CLUBC-005 | books.total_pages 조인 | done | LEFT JOIN, NULL 허용 |
| REQ-CLUBC-006 | GRANT + 마이그레이션 | done | GRANT TO authenticated (anon 거부) |
| REQ-CLUBC-007 | HostClubWithCount 확장 + 병합 | done | hooks.ts Promise.all + Map 병합 |
| REQ-CLUBC-008 | RPC 실패 degradation | done | RPC 에러 흡수, 0/0/null 폴백 |
| REQ-CLUBC-009 | 캐시 무효화 일관성 | done | 기존 [...CLUBB_KEY_ROOT,'host'] 유지 |
| REQ-CLUBC-010 | 진도 텍스트 표시 | done | ClubProgress "p.X · 진도 N명" |
| REQ-CLUBC-011 | 진도 바 표시 (total_pages 존재 시) | done | Track/Fill, fillPct clamp 100% |
| REQ-CLUBC-012 | total_pages NULL 시 바 생략 | done | 조건부 렌더링 |
| REQ-CLUBC-013 | median 0 시 대체 텍스트 | done | "아직 진도가 없어요" |
| REQ-CLUBC-014 | @MX:TODO 해소 | done | ClubsScreen.tsx TODO 블록 제거, ClubProgress 분리 |
| REQ-CLUBC-015 | SPEC-UI-002 토큰 준수 | done | spacing/radius/typography/colors 토큰만 |
| REQ-CLUBC-016 | median 전용, 개인 비교 금지 | done | median + 입력 멤버 수만 표시 |
| REQ-CLUBC-017 | 리더보드/순위 금지 | done | 리더보드 UI 미구현 (비과시 준수) |

---

## 마일스톤 진행

| 마일스톤 | 범위 | 상태 |
|----------|------|------|
| M1 | DB/RPC (마이그레이션, 함수, pgTAP) | done (SQL 작성 — pgTAP 실행은 DB 접근 환경 필요) |
| M2 | Hook (useHostClubs 확장) | done |
| M3 | UI (ClubCard 진도 표시) | done |
| M4 | MX 해소 + 회귀 | done (@MX:TODO 제거, 1304 테스트 통과) |

---

## Re-planning Gate 추적

> Run 단계에서 각 이터레이션 종료 시 완료된 AC 수 + 에러 수 델타를 기록.
> 3회 연속 AC 완료율 0 → stagnation 플래그.

| 이터레이션 | 완료 AC 수 | 누적 AC | 에러 델타 | 비고 |
|------------|-----------|---------|-----------|------|
| (초기) | 0 | 0/17 | — | Run 대기 |

---

## 메모

- 2026-06-27: SPEC 최초 작성. 모든 REQ pending.
- RLS 결정: option (a) — user_books_public 뷰 (plan.md Section 1.1 참조)
- 집계: MEDIAN, current_page>0 만 포함 (plan.md Section 1.2)
- 핵심 TODO: ClubsScreen.tsx:309 @MX:TODO 해소 (REQ-CLUBC-014)
