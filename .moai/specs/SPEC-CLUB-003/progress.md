# SPEC-CLUB-003 진행 추적 (progress.md)

> 초기 상태 — 모든 REQ pending. Run 단계에서 각 항목 완료 시 업데이트.

---

## REQ 완료 현황

| REQ | 설명 | 상태 | 비고 |
|-----|------|------|------|
| REQ-CLUBC-001 | RPC 시그니처 | pending | |
| REQ-CLUBC-002 | 매개변수 검증 | pending | |
| REQ-CLUBC-003 | median 계산 (current_page>0) | pending | |
| REQ-CLUBC-004 | SECURITY INVOKER + user_books_public | pending | |
| REQ-CLUBC-005 | books.total_pages 조인 | pending | |
| REQ-CLUBC-006 | GRANT + 마이그레이션 | pending | |
| REQ-CLUBC-007 | HostClubWithCount 확장 + 병합 | pending | |
| REQ-CLUBC-008 | RPC 실패 degradation | pending | |
| REQ-CLUBC-009 | 캐시 무효화 일관성 | pending | |
| REQ-CLUBC-010 | 진도 텍스트 표시 | pending | |
| REQ-CLUBC-011 | 진도 바 표시 (total_pages 존재 시) | pending | |
| REQ-CLUBC-012 | total_pages NULL 시 바 생략 | pending | |
| REQ-CLUBC-013 | median 0 시 대체 텍스트 | pending | |
| REQ-CLUBC-014 | @MX:TODO 해소 | pending | ClubsScreen.tsx:309 |
| REQ-CLUBC-015 | SPEC-UI-002 토큰 준수 | pending | |
| REQ-CLUBC-016 | median 전용, 개인 비교 금지 | pending | constitution 비과시 |
| REQ-CLUBC-017 | 리더보드/순위 금지 | pending | constitution 비과시 |

---

## 마일스톤 진행

| 마일스톤 | 범위 | 상태 |
|----------|------|------|
| M1 | DB/RPC (마이그레이션, 함수, pgTAP) | pending |
| M2 | Hook (useHostClubs 확장) | pending |
| M3 | UI (ClubCard 진도 표시) | pending |
| M4 | MX 해소 + 회귀 | pending |

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
