---
id: SPEC-DEPLOY-001
title: "Build, Deploy & CI/CD — Compact Reference"
version: "1.0.1"
status: implemented
created: 2026-06-14
updated: 2026-06-24
author: "강력쇠주먹"
priority: medium
issue_number: 0
---

# SPEC-DEPLOY-001 컴팩트 참조 (spec-compact.md)

> 본 문서는 spec.md / plan.md / acceptance.md의 핵심만을 압축한 빠른 참조용이다. 상세 내용은 각 원본 문서를 참조한다.

---

## 1. 정체성

- **SPEC ID**: SPEC-DEPLOY-001
- **도메인**: DEPLOY / DEVOPS
- **우선순위**: medium
- **Phase**: 5 (최종) — 14개 MVP SPEC의 마지막
- **의존성**: 모든 13개 도메인 SPEC 완료 후 통합 배포
- **산출물 유형**: 인프라 자동화 (코드 + 콘솔 설정 + 매뉴얼)

---

## 2. 핵심 범위 (5개 모듈, 24개 REQ)

| 모듈                 | REQ 수 | 핵심 내용                                         |
| -------------------- | ------ | ------------------------------------------------- |
| REQ-DEPLOY-BUILD     | 5      | EAS Build (iOS/Android, 환경 분리, 재현성)        |
| REQ-DEPLOY-SUBMIT    | 3      | EAS Submit (TestFlight, Play Console, 크리덴셜)   |
| REQ-DEPLOY-CICD      | 5      | GitHub Actions (CI 게이트, Git Flow, 태깅, hotfix)|
| REQ-DEPLOY-OBSERVE   | 5      | ~~Sentry (에러 추적, 환경 분리, 소스맵, 릴리즈)~~ **철회 (2026-07-07, PR #140)** |
| REQ-DEPLOY-INFRA     | 6      | OAuth, Storage 버킷, Edge Function, Supabase 프로비저닝 |

---

## 3. 주요 산출물

- `eas.json` (3개 빌드 프로필)
- `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`
- `.env.example`, `.env.development`, `.env.staging`, `.env.production`
- `docs/deployment.md` (배포 매뉴얼)
- OAuth 콘솔 설정 (Kakao/Naver/Google)
- Supabase 프로젝트 3개 (dev/staging/prod)
- Storage 버킷: `book-covers`, `avatars`
- Edge Function 배포: `kakao-book-search`, `process-join-request`, `send-notification`

---

## 4. 위임받은 인프라 항목 (다른 SPEC → 본 SPEC)

| 위임 항목                         | 위임한 SPEC                              | 본 SPEC REQ       |
| --------------------------------- | ---------------------------------------- | ----------------- |
| OAuth 앱 등록·콜백 URL            | SPEC-DB-001, SPEC-API-001, SPEC-AUTH-001 | REQ-DEPLOY-019    |
| Supabase Auth 제공자 활성화       | SPEC-DB-001, SPEC-API-001                | REQ-DEPLOY-020    |
| Storage 버킷 정책                 | SPEC-DB-001                              | REQ-DEPLOY-021    |
| Edge Function 배포 (3종)          | SPEC-BOOK-001, SPEC-CLUB-001, SPEC-NOTIF-001 | REQ-DEPLOY-022 |
| Supabase 프로젝트 프로비저닝      | SPEC-API-001                             | REQ-DEPLOY-023    |
| 환경 변수 구조                    | SPEC-API-001                             | REQ-DEPLOY-018, 024 |

---

## 5. 제외 범위

데스크톱 웹, A/B 테스트 인프라, 블루-그린/카나리 배포, 다중 리전, DB 복제 자동화, Fastlane 자동화(미결정), 관리자 모듈, 데이터 마이그레이션 자동화, Docker/Kubernetes.

---

## 6. 미결정 사항 요약

| #  | 항목                                            | 상태        |
| -- | ----------------------------------------------- | ----------- |
| 1  | CI/CD 트리거 분기                               | 해결됨      |
| 2  | 빌드 캐시 전략                                  | 미해결      |
| 3  | Fastlane 스토어 메타데이터 자동화               | 미해결      |
| 4  | ~~Sentry 릴리즈 트래킹 연동 방식~~ **철회 (2026-07-07)** | N/A (REQ 무효) |
| 5  | 로컬 빌드 vs 클라우드 빌드 비용 최적화          | 미해결      |
| 6  | 환경 분리: 별도 프로젝트 vs 단일 프로젝트+RLS  | 해결됨      |

---

## 7. Git Flow 준수

- `main` / `develop` / `feature/*` / `release/*` / `hotfix/*` 브랜치 모델
- SemVer (MAJOR.MINOR.PATCH), 태그 `vX.Y.Z`는 main에만
- hotfix 듀얼 머지(main + develop) 자동 검증
- CI/CD 트리거: develop→staging, release 태그→production, hotfix→patch production

---

## 8. 마일스톤 요약

1. **M1 (High)**: 환경 변수 + EAS Build 파운데이션 — ✅ 완료 (PR #15, 2514263, 2026-06-17)
2. **M2 (High)**: GitHub Actions CI 파이프라인 — ✅ 완료 (PR #52, 86729fb, 2026-06-24)
3. **M3 (High)**: ~~Sentry 통합 및 관측 인프라~~ **철회 (2026-07-07, PR #140)** — 사용자 결정으로 Sentry 통합 제거. REQ-DEPLOY-014~017 무효.
4. **M4 (Medium)**: EAS Submit 및 스토어 배포 자동화 — ✅ 완료 (PR #52, 86729fb, 2026-06-24)
5. **M5 (Medium)**: OAuth 인프라 + Storage 버킷 프로비저닝 — ✅ 완료 (문서화만, PR #15)
6. **M6 (Medium)**: Edge Function 배포 + Supabase 프로비저닝 (최종 통합 게이트) — ✅ 완료 (PR #52, 86729fb, 2026-06-24)

> **구현 진행 상태 (2026-06-24, 갱신 2026-07-07)**: 본 SPEC은 **완료(implemented)** 상태이다. 모든 6개 마일스톤(M1~M6) 구현 완료 및 머지됨 (PR #52, 86729fb). **철회 (2026-07-07, PR #140)**: 사용자 결정으로 Sentry 통합 제거. REQ-DEPLOY-014~017 무효. 상세 진행 로그는 `progress.md` 참조.

> **§6 #6 결정 (2026-07-01)**: 단일 프로젝트(lqltwbpocbgoxvhlmjdo) prod 승격 정책 채택. dev는 로컬 Docker, prod는 단일 클라우드, staging은 prod 동일 클라우드 + ENV flag 구분. 별도 클라우드 프로젝트 생성은 MVP 이후 검토.

---

## 9. 인수 DoD 핵심

- 19개 REQ 인수 기준 통과 (REQ-DEPLOY-014~017 철회로 24→19개)
- 첫 프로덕션 릴리즈 v1.0.0 양 스토어 심사 제출
- 세 환경 Supabase 프로젝트 + Edge Function 3종 배포
- 세 OAuth 제공자(Kakao/Naver/Google) 로그인 검증
- TRUST 5 게이트 5/5 통과

---

## 10. 14개 SPEC 완결 선언

본 SPEC(SPEC-DEPLOY-001)은 14개 MVP SPEC 카탈로그(INDEX.md)의 **마지막 SPEC**이다. 본 SPEC의 구현 완료는 사각(Sa-gak) MVP의 인프라 완결을 의미한다.

| Phase | SPEC 수 | 범위                     |
| ----- | ------- | ------------------------ |
| 1     | 3       | 파운데이션 (API/AUTH/NAV)|
| 2     | 4       | 핵심 도메인 (개인 독서)  |
| 3     | 3       | 소셜 연결 (Track A/B)    |
| 4     | 3       | 참여/유지 (루틴/알림/마이)|
| 5     | 1       | **배포 (본 SPEC)**       |
| 계    | 14      | MVP 완결                 |

---

버전: 1.0.0
분류: 컴팩트 참조 (Compact Reference)
상태: in-progress (M1+M5 머지됨 PR #15 2514263, 2026-06-17; M2/M3/M4/M6 미완료)
