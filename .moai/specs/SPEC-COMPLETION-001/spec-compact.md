---
# NOTE: `created` is the canonical field name per MoAI plan workflow Phase 2
# (8-field frontmatter: id, version, status, created, updated, author, priority,
# issue_number). Do NOT rename to `created_at` — orchestrator ruling on MP-3.
id: SPEC-COMPLETION-001
title: "완독 다이어리 및 아카이브 시각화 — Compact View"
spec: SPEC-COMPLETION-001
version: "1.0.0"
status: draft
auto_generated: true
source: spec.md
created: 2026-06-14
updated: 2026-06-14
author: "강력쇠주먹"
priority: medium
issue_number: 0
labels: [completion, diary, archive, visualization, emotion-curve, frontend]
---

# SPEC-COMPLETION-001 Compact

> 본 문서는 spec.md에서 요구사항, 인수 기준, 수정 대상 파일, 제외 범위만 추출한
> 자동 생성 요약본이다. 전체 내용은 spec.md를 참조한다.

---

## 요구사항 모듈 (4개)

### Module 1: REQ-COMP-TRIGGER — 완독 처리 연동

| REQ ID | 요구사항 | 주요 제약 |
|--------|---------|-----------|
| REQ-COMP-001 | 완독 리포트 존재 확인 | PostgREST GET 호출, 최대 3회 재시도(점진 간격), DB 트리거 동일 트랜잭션 커밋 시점 즉시 생성 |
| REQ-COMP-002 | 완독 다이어리 진입점 제공 | status='completed' 항목에 진입 버튼 노출, 탭 시 report_data 조회 후 화면 이동 (UI 위치는 SPEC-LIBRARY-001 협력) |
| REQ-COMP-003 | 타인 리포트 접근 차단 확인 | RLS(REQ-DB-021)가 자동 적용, 클라이언트 추가 검증 불필요, 타인 user_book_id 조회 시 빈 결과 |

**인수 기준 요약**:
- 완독 처리 직후 1회 조회로 report_data 획득 (시나리오 1)
- 재시도 한계 초과 시 에러 상태 + 재시도 버튼 (시나리오 2)
- 진입 버튼 탭 → 다이어리 네비게이션 (시나리오 3)
- 타인 user_book_id 조회 시 빈 배열 (시나리오 4, RLS 신뢰)

---

### Module 2: REQ-COMP-DATA — report_data 파싱 및 검증

| REQ ID | 요구사항 | 주요 제약 |
|--------|---------|-----------|
| REQ-COMP-004 | report_data 스키마 파싱 | ReportData 인터페이스(emotion_curve/highlights/total_records), Zod 런타임 검증, 불일치 시 "데이터 오류" 상태 (빈 상태와 구분) |
| REQ-COMP-005 | 감정 기록 0건 케이스 처리 | total_records=0 + 빈 배열 → "기록된 감정이 없어요" 빈 상태 (에러 아님), 1건 이상 → 차트·리스트 시각화 |

**인수 기준 요약**:
- 정상 report_data → ReportData 타입 객체 생성 (시나리오 5)
- 스키마 불일치(키 누락, 타입 오류) → "데이터 오류" 상태 (시나리오 6)
- total_records=0 → 빈 상태 메시지, 차트/리스트 미렌더 (시나리오 7)
- total_records>=1 → 감정 곡선 + 하이라이트 렌더 (시나리오 8)

---

### Module 3: REQ-COMP-VIEW — 완독 다이어리 시각화

| REQ ID | 요구사항 | 주요 제약 |
|--------|---------|-----------|
| REQ-COMP-006 | 감정 곡선 차트 시각화 | emotion_curve 포인트 1개 이상 시 선형/바 차트, 감정별 고유 색상 토큰(SPEC-UI-001), 라이브러리 미결정(6.1) |
| REQ-COMP-007 | 하이라이트 감정 기록 표시 | highlights 카드 리스트(페이지/감정/내용), SPEC-UI-001 EmotionRecordCard 패턴 재사용 |
| REQ-COMP-008 | 총 감정 기록 수 표시 | total_records "이 책에서 남긴 감정 N개" 헤더 표시 |

**인수 기준 요약**:
- 감정 곡선 3개+ 포인트 차트 렌더, 색상 토큰 적용 (시나리오 9)
- 하이라이트 카드 리스트, 디자인 패턴 일관성 (시나리오 10)
- 총 기록 수 헤더 표시, 0건 케이스 포함 (시나리오 11)

---

### Module 4: REQ-COMP-CELEBRATE — 완독 성취 표시

| REQ ID | 요구사항 | 주요 제약 |
|--------|---------|-----------|
| REQ-COMP-009 | 완독 축하 메시지 표시 | "이 책과의 여정을 완성하셨어요" 다이어리 상단, 에러 상태 시 미표시, 애니메이션 범위 미결정(6.3) |
| REQ-COMP-010 | 완독 배지 표시 | 축하 메시지 영역 배지 아이콘, SPEC-UI-001 강조색(amber brown #C17B2F) 적용 |

**인수 기준 요약**:
- 축하 메시지 상단 표시, 에러 시 미표시 (시나리오 12)
- 완독 배지 아이콘 + 강조색 토큰 (시나리오 13)

---

## 인수 기준 요약 (시나리오 1~17)

| 시나리오 | 검증 REQ | 핵심 검증 |
|----------|----------|----------|
| 1 | REQ-COMP-001 | 완독 처리 직후 1회 조회로 report_data 획득 |
| 2 | REQ-COMP-001 | 재시도 로직, 최대 초과 시 에러 상태 |
| 3 | REQ-COMP-002 | 진입 버튼 노출 + 탭 시 화면 이동 |
| 4 | REQ-COMP-003 | 타인 user_book_id 빈 결과 (RLS 신뢰) |
| 5 | REQ-COMP-004 | 정상 report_data → ReportData 파싱 |
| 6 | REQ-COMP-004 | 스키마 불일치 → "데이터 오류" 상태 |
| 7 | REQ-COMP-005 | total_records=0 → 빈 상태 메시지 |
| 8 | REQ-COMP-005 | total_records>=1 → 차트·리스트 렌더 |
| 9 | REQ-COMP-006 | 감정 곡선 차트 + 색상 토큰 |
| 10 | REQ-COMP-007 | 하이라이트 카드 리스트 + 디자인 일관성 |
| 11 | REQ-COMP-008 | 총 기록 수 헤더 표시 |
| 12 | REQ-COMP-009 | 축하 메시지 상단 표시 (에러 시 미표시) |
| 13 | REQ-COMP-010 | 완독 배지 + 강조색 토큰 |
| 14 (엣지) | — | 완독 사이클 멱등성 (UNIQUE 유지) |
| 15 (엣지) | — | 대량 하이라이트(50+) 렌더링 성능 |
| 16 (엣지) | — | 오프라인 에러 처리 |
| 17 (엣지) | — | 세션 만료 인증 에러 처리 |

---

## 수정 대상 파일 (Files to Modify/Create)

### 신규 생성 파일 (10개)

| 파일 | 유형 | 내용 |
|------|------|------|
| `src/features/completion/completionApi.ts` | 신규 | PostgREST GET 래퍼, 재시도 로직 |
| `src/features/completion/types.ts` | 신규 | ReportData 인터페이스 + Zod 스키마 |
| `src/features/completion/useCompletionReport.ts` | 신규 | 조회 hook, 상태 관리 |
| `src/features/completion/CompletionDiaryScreen.tsx` | 신규 | 완독 다이어리 메인 화면 |
| `src/features/completion/EmotionCurveChart.tsx` | 신규 | 감정 곡선 차트 컴포넌트 |
| `src/features/completion/HighlightList.tsx` | 신규 | 하이라이트 카드 리스트 |
| `src/features/completion/CelebrationHeader.tsx` | 신규 | 축하 메시지 + 배지 |
| `src/features/completion/__tests__/completionApi.test.ts` | 신규 | API 단위 테스트 |
| `src/features/completion/__tests__/useCompletionReport.test.ts` | 신규 | hook 테스트 |
| `src/features/completion/__tests__/CompletionDiaryScreen.test.tsx` | 신규 | 화면 통합 테스트 |

### 수정 대상 파일 (협력 SPEC과 공유)

| 파일 | 수정 내용 | 협력 SPEC |
|------|----------|-----------|
| `app/(tabs)/library/[bookId]/completion.tsx` (예상) | 완독 다이어리 라우트 | SPEC-NAV-001, SPEC-LIBRARY-001 |
| `src/features/library/*.tsx` | 완독 상태 시 진입 버튼 | SPEC-LIBRARY-001 |
| `src/theme/tokens.ts` (필요 시) | 감정별 색상 토큰 확장 | SPEC-UI-001 |

---

## 제외 범위 (Exclusions)

본 SPEC은 다음을 포함하지 않는다:

1. **report_data 생성·집계 로직** — DB 트리거 PL/pgSQL이 단독 처리 (SPEC-DB-001 REQ-DB-010). 본 SPEC은 읽기 전용 소비자.
2. **Edge Function `generate-completion-report` 구현** — DB 트리거 호출 대상 아님, 향후 리치 콘텐츠용 예비 (SPEC-DB-001 + 본 SPEC 제외)
3. **완독 처리 플로우 (status 전환 UI)** — SPEC-LIBRARY-001 영역
4. **완독 취소(reading 복귀) 시 다이어리 유지 정책** — 후순위 결정, 본 SPEC 범위 밖
5. **리치 콘텐츠 (이미지 카드, 자동 영상)** — 확장 단계
6. **공유 기능** — SNS/메신저 공유 본 SPEC 밖
7. **인쇄/PDF 내보내기** — 본 SPEC 밖
8. **다이어리 자동 갱신** — 완독 후 추가 감정 기록 반영 안 함 (스냅샷), 후순위

---

## 미결정 사항 (해결 상태)

1. **감정 곡선 차트 라이브러리** — 미해결 (옵션 A 순수 SVG / B react-native-chart-kit / C victory-native, RUN 단계 프로토타이핑 후 확정)
2. **하이라이트 선정 알고리즘** — 해결됨 (SPEC-DB-001 트리거 PL/pgSQL에 위임, 본 SPEC은 있는 그대로 렌더링)
3. **축하 애니메이션 범위** — 미해결 (옵션 A 정적 텍스트+배지 MVP 기본 / B 경량 애니메이션 / C 풀 컨페티)
