---
id: SPEC-API-001
title: "Supabase Client Integration & API Layer — Compact View"
version: "1.0.0"
status: draft
created: 2026-06-14
updated: 2026-06-14
author: "강력쇠주먹"
priority: high
issue_number: 0
---

# SPEC-API-001 요약 (Compact)

> 본 문서는 spec.md와 acceptance.md의 요약본으로 자동 생성된다. 전체 내용은 원본 파일 참조.

---

## 요구사항 (Requirements) — 19개 REQ, 4개 모듈

### REQ-API-CLIENT: 클라이언트 싱글톤 및 설정 (5 REQ)

| REQ ID | 요구사항 요약 | 인수 시나리오 |
|--------|--------------|--------------|
| REQ-API-001 | `src/lib/supabase.ts` 단일 싱글톤 인스턴스 유지 | C1: 동일 참조 반환 |
| REQ-API-002 | 세션 영속화(persistSession), 자동 갱신(autoRefreshToken), JWT 헤더 자동 주입 | C2: 세션 영속화, C3: 자동 JWT 헤더 |
| REQ-API-003 | Realtime 채널 API(`supabase.channel()`) 접근 보장 | C4: 채널 접근 |
| REQ-API-004 | `invokeEdgeFunction` 공통 래퍼 (4개 Edge Function 진입점) | C5: Edge Function 호출 |
| REQ-API-005 | 환경 변수 누락 시 fail-fast (초기화 거부) | C6: fail-fast 검증 |

### REQ-API-TYPES: gen-types 타입 안전성 (5 REQ)

| REQ ID | 요구사항 요약 | 인수 시나리오 |
|--------|--------------|--------------|
| REQ-API-006 | `src/types/db.ts` gen-types 자동 생성 파일 유지 (수동 편집 금지) | T1: 파일 존재 + 주석 |
| REQ-API-007 | `createClient<Database>()` 제네릭 적용 | T2: 타입 안전 클라이언트 |
| REQ-API-008 | 12개 엔터티 Row 타입 도출 (User, Book, UserBook 등) | T3: 12개 타입 매핑 |
| REQ-API-009 | `sticker_type` ENUM 타입 노출 | T5: ENUM 타입 |
| REQ-API-010 | `user_profiles`, `user_books_public` 보안 뷰 타입 노출 | T6: 뷰 타입 |

> 추가: T4(존재하지 않는 테이블 컴파일 에러), T7(gen-types 재실행 동기화)

### REQ-API-ERROR: 공통 에러 처리 및 재시도 (5 REQ)

| REQ ID | 요구사항 요약 | 인수 시나리오 |
|--------|--------------|--------------|
| REQ-API-011 | `normalizeError` 함수 (Supabase 에러 → ApiError 변환) | E1: 에러 정규화 |
| REQ-API-012 | 7개 에러 카테고리 분류 (NETWORK, AUTH, RLS_DENIED, VALIDATION, NOT_FOUND, SERVER, UNKNOWN) | E2-E6: 각 카테고리 분류 |
| REQ-API-013 | NETWORK/SERVER만 지수 백오프(1s/2s/4s) 최대 3회 재시도 | E2: NETWORK 재시도, E6: SERVER 재시도 |
| REQ-API-014 | `getUserFriendlyMessage` 한국어 사용자 친화적 메시지 매핑 | E7: 한국어 메시지 |
| REQ-API-015 | UNKNOWN 에러 및 재시도 실패 시 Sentry 호환 구조화 로깅 | E8: Sentry 로깅 |

### REQ-API-ENV: 환경 변수 관리 및 검증 (4 REQ)

| REQ ID | 요구사항 요약 | 인수 시나리오 |
|--------|--------------|--------------|
| REQ-API-016 | `.env.example` + `.env` + `.env.staging` + `.env.production` 파일 구조 | V1: 파일 구조, V7: 템플릿 완전성 |
| REQ-API-017 | `app.config.ts`에서 환경 변수를 `extra` 필드에 주입 | V3: 주입, V4: 런타임 접근 |
| REQ-API-018 | 런타임 환경 변수 검증 (fail-fast) | V5: 누락 시 에러 |
| REQ-API-019 | EAS Build 프로필별 dev/staging/prod 환경 분리 | V6: 환경 분리 |

> 추가: V2(.env gitignore 제외)

---

## 인수 기준 요약 — 28개 시나리오 + 6개 엣지 케이스

### 시나리오 분포

| 모듈 | 시나리오 수 | 범위 |
|------|-----------|------|
| REQ-API-CLIENT | C1-C6 (6개) | 싱글톤, 세션, Realtime, Edge Function, fail-fast |
| REQ-API-TYPES | T1-T7 (7개) | gen-types, 타입 매핑, ENUM, 보안 뷰 |
| REQ-API-ERROR | E1-E8 (8개) | 정규화, 7 카테고리, 재시도, 한국어 메시지, 로깅 |
| REQ-API-ENV | V1-V7 (7개) | 파일 구조, 주입, 검증, 환경 분리 |
| 엣지 케이스 | 6개 | 세션 만료, 재연결, SecureStore 초과, 수동 편집, 병렬 호출, 키 누출 방지 |

### 핵심 품질 게이트

- TypeScript strict 컴파일 에러 0건
- 단위 테스트 커버리지 85%+
- `service_role` 키 번들 미포함 (보안)
- `.env` 파일 `.gitignore` 처리
- gen-types 수동 편집 금지 주석 존재

---

## 제외 범위 (Exclusions) — 8개 항목

1. **Edge Function 구현 로직** — 각 도메인 SPEC 처리 (본 SPEC은 `invoke()` 인프라만)
2. **OAuth 제공자 설정** — SPEC-AUTH-001, SPEC-DEPLOY-001
3. **인증 플로우 UI 및 로직** — SPEC-AUTH-001 (본 SPEC은 세션 영속화 설정만)
4. **데이터 페칭 라이브러리 선택** — 미결정(Open Question 6.1), 후속 SPEC 확정
5. **오프라인 캐싱 전략** — 미결정(Open Question 6.2), MVP 후순위
6. **도메인 화면 구현** — 각 도메인 SPEC
7. **Storage 업로드 로직** — 각 도메인 SPEC (본 SPEC은 Storage 접근성만 보장)
8. **Supabase 프로젝트 생성 및 마이그레이션 배포** — SPEC-DEPLOY-001

---

## 미결정 사항 (Open Questions) 요약

| ID | 항목 | 상태 | 해결 시점 |
|----|------|------|----------|
| 6.1 | 데이터 페칭 라이브러리 (React Query vs SWR vs 순수 훅) | 미해결 | SPEC-AUTH-001 또는 SPEC-BOOK-001 |
| 6.2 | 오프라인 캐싱 전략 | 미해결 | Phase 4 이후 재검토 |
| 6.3 | 세션 저장소 (SecureStore vs AsyncStorage) | 미해결 | `/moai:2-run` 시 토큰 길이 측정 후 결정 |

---

## 의존성 그래프

```
SPEC-DB-001 (v1.2.0) ✅ ──┐
                          ├──→ SPEC-API-001 (본 SPEC) ──→ SPEC-AUTH-001
SPEC-UI-001 (v1.0.0) ✅ ──┘                           ──→ SPEC-NAV-001
                                                     ──→ 모든 도메인 SPEC (BOOK/LIBRARY/EMOTION/CLUB/...)
```

---

## 추적성 요약

| 소스 문서 | 활용 |
|----------|------|
| `.moai/project/structure.md` | API 서피스 (모든 엔드포인트 목록) |
| `.moai/project/tech.md` | 기술 스택, 빌드/배포, 개발 환경 |
| `.moai/project/db/schema.md` | 12개 엔터티, ENUM, 보안 뷰 (gen-types 기반) |
| `.moai/specs/SPEC-DB-001/spec.md` | 선행 의존성 — 스키마/RLS 완료 |
| `.moai/specs/SPEC-UI-001/spec.md` | 선행 의존성 — 프로젝트 구조/TypeScript 설정 |
| `.moai/specs/INDEX.md` | SPEC 카탈로그 — 본 SPEC 위치 (Phase 1 파운데이션) |
