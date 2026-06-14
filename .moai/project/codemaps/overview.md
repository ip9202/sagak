# 아키텍처 개요 — 사각 (Sa-gak)

> 이 문서는 **placeholder**입니다. 코드베이스가 생성된 이후 `/moai codemaps` 실행으로 상세 아키텍처 문서가 보완됩니다.

## 프로젝트 목표

사각(Sa-gak)은 종이책 독자가 읽는 순간의 감정을 기록·축적해 나만의 아카이브로 키우고, 같은 책을 읽는 사람들과 느슨하게 연결되는 **독서 동반자 모바일 앱**입니다.

- **플랫폼**: iOS / Android (React Native + Expo SDK 51+)
- **백엔드**: Supabase (PostgreSQL + PostgREST + Edge Functions + Realtime)
- **언어**: TypeScript
- **핵심 가치**: 감정 아카이브 우선 · 느슨한 연결 · 니치 시장 집중 · 비수익화(데이터 축적 우선)

## 시스템 경계 (고수준)

```
[ Mobile App (RN+Expo) ] ←→ [ Supabase Backend ] ←→ [ External APIs ]
                              - PostgreSQL (RLS)
                              - Edge Functions
                              - Auth (Kakao/Apple/Google)
                              - Realtime / Storage
```

## 향후 보완 예정 항목

코드 구현이 시작되면 다음 문서들이 생성됩니다:
- `modules.md` — 모듈별 책임과 공개 인터페이스
- `dependencies.md` — 내외부 의존성 그래프
- `entry-points.md` — 앱 진입점, 라우트, Edge Function 핸들러
- `data-flow.md` — 요청 생명주기, 상태 관리 패턴

## 관련 문서

- 제품 정의: `../product.md`
- 시스템 구조: `../structure.md`
- 기술 스택: `../tech.md`
- DB 스키마: `../db/schema.md`, `../db/erd.mmd`
- 브랜드 컨텍스트: `../brand/`
