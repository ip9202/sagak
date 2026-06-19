---
name: completion-spec-divergence-fix
description: SPEC-COMPLETION-001 report_data 스키마 시정 사례 (2026-06-17) — DB 트리거 실제 산출물 vs SPEC 문서 불일치 사전 수정
metadata:
  type: project
---

SPEC-COMPLETION-001(완독 다이어리)의 report_data 스키마가 DB 트리거 실제 산출물과 불일치하여
구현 전 시정 (2026-06-17).

**시정 내용**:
- DB 트리거 `generate_completion_report()` (supabase/migrations/20240614000010)의 실제 산출:
  `emotion_curve[].{page_number, emotion_count}` (감정 수량 집계, 종류 필드 없음),
  `highlights[].{page_number, content}` (최근 5건, 종류 필드 없음),
  `total_records`(number).
- 기존 SPEC 문서는 `{page, emotion, count}` / `{page, content, emotion}` 을 가정 → REQ-COMP-006
  "감정 종류별 고유 색상" 에 데이터 근거가 없었음.
- 3가지 바인딩 결정: (1) 스키마 시정 후 구현, (2) 순수 타입 가드 isReportData() + AppError(VALIDATION)
  (zod 미설치, EMOTION 정책 일관), (3) 정적 텍스트+배지 MVP (애니메이션 없음).
- 6.1(차트 라이브러리) 해결: 순수 SVG (react-native-svg@15.15.3 이미 설치).
- REQ-COMP-006 시정: 단일 brand-500 토큰(colors.brand[500]=#C17B2F), 범례 없음.

**Why**: Lesson #3 (인터페이스 분기 구현 전 수정) 의 재발생 사례. SPEC-NAV-001(7개 분기)과
동일한 패턴 — SPEC 문서의 가정이 실제 코드와 다르면 구현 전에 코드(source of truth) 기준으로 맞춘다.

**How to apply**: completion 도메인 작업 시 report_data 스키마는 항상 DB 마이그레이션 파일을
source of truth로 삼는다. 감정 종류별 분류/색상은 데이터에 존재하지 않으므로 절대 추가하지 말 것.
관련: [[lessons]] #3.
