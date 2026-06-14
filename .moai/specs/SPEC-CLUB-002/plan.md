---
id: SPEC-CLUB-002
title: "Track B 개설형 모임 관리 — Implementation Plan"
version: "1.0.0"
status: draft
created: 2026-06-14
updated: 2026-06-14
author: "강력쇠주먹"
priority: high
issue_number: 0
---

# SPEC-CLUB-002 구현 계획

## 개요

본 문서는 SPEC-CLUB-002 요구사항(REQ-CLUBB-001 ~ REQ-CLUBB-017)의 구현 접근법,
마일스톤, 기술 스택 결정, 리스크를 정의한다. 구현 코드는 `/moai:2-run` 단계에서
작성되며, 본 문서는 계획 문서이다.

---

## 1. 기술 스택 결정

### 1.1 신규 의존성

본 SPEC은 **신규 외부 의존성을 추가하지 않는다**. 모든 기능은 기존 스택(PostgREST +
React Native 컴포넌트)으로 구현된다.

### 1.2 기존 의존성 (선행 SPEC에서 이미 설치 또는 예정)

- `@supabase/supabase-js` ^2.45.0 (SPEC-API-001) — PostgREST `clubs`·`club_members` CRUD
- `expo` ~55.0.0, `expo-router` ~5.0.0, `react` 19.2.0, `react-native` 0.83.2
- `typescript` ~5.7.0 (strict 모드)
- `jest` ^29.7.0, `@testing-library/react-native` ^13.3.0

### 1.3 DB 계층 (SPEC-DB-001 이미 구현 완료)

본 SPEC은 **DB 스키마·트리거·RLS 정책을 새로 작성하지 않는다**. 다음 SPEC-DB-001 산출물을
그대로 소비한다:

- `clubs` 테이블 스키마 (REQ-DB-006) — type ENUM, status ENUM, min_members, duration_days 등
- `club_members` 테이블 스키마 (REQ-DB-007) — role ENUM, UNIQUE(club_id, user_id)
- `handle_new_club_host` SECURITY DEFINER 트리거 (REQ-DB-008b) — clubs INSERT 시 host 자동 가입
- `clubs` RLS 정책 (REQ-DB-018) — SELECT `USING(true)`, INSERT `host_id=auth.uid()`, UPDATE/DELETE host만
- `club_members` RLS 정책 (REQ-DB-019) — `fn_user_in_club` 헬퍼 기반 멤버만 SELECT, 본인 DELETE

> 구현 시 DB 계층 검증은 SPEC-DB-001 pgTAP 테스트에 의존하며, 본 SPEC은 클라이언트
> 관점의 RLS 동작 검증에 집중한다.

---

## 2. 파일 구조 (구현 산출물)

```
src/
├── features/club/
│   └── trackB/
│       ├── createClubApi.ts          # 모임 생성 API (REQ-CLUBB-001~005)
│       ├── hostMembershipApi.ts      # host 멤버십 확인 API (REQ-CLUBB-006~008)
│       ├── progressApi.ts            # 진도 동기화 API (REQ-CLUBB-009~012)
│       ├── manageClubApi.ts          # 멤버·상태 관리 API (REQ-CLUBB-013~017)
│       ├── ClubCreateScreen.tsx      # 모임 생성 화면
│       ├── ClubManageScreen.tsx      # 모임 관리 화면 (host)
│       ├── ClubDetailScreen.tsx      # 모임 상세 화면 (공개 조회)
│       └── __tests__/
│           ├── createClubApi.test.ts
│           ├── hostMembershipApi.test.ts
│           ├── progressApi.test.ts
│           └── manageClubApi.test.ts
└── types/
    └── club.ts                       # Club, ClubMember, ClubCreateInput 타입 (gen-types 기반)
```

> `src/types/db.ts`의 `Club`·`ClubMember` 타입(SPEC-API-001 gen-types)을 기반으로
> `ClubCreateInput`(모임 생성 입력), `ClubProgressInput`(진도 업데이트 입력) 타입을 도출한다.

---

## 3. 마일스톤 (우선순위 기반)

### Milestone 1: 모임 생성 API + host 자동 가입 연동 (Priority High)

**목표**: Track B 모임 생성(type='group' 강제, 0명 출발)과 host 자동 가입 트리거 연동을
구현한다.

- REQ-CLUBB-001: `clubs` INSERT 엔드포인트 (PostgREST)
- REQ-CLUBB-002: `type='group'` 강제 (instant 거부)
- REQ-CLUBB-003: 0명 출발 허용 (min_members 게이트 아님)
- REQ-CLUBB-004: 모임 설정 입력(description, duration_days, daily_pages, trigger_page)
- REQ-CLUBB-005: 모임 생성 결과 반환(`.select().single()`)
- REQ-CLUBB-006: 클라이언트 `club_members` INSERT 금지
- REQ-CLUBB-007: host 멤버십 존재 확인 (트리거 검증)
- REQ-CLUBB-008: host 멤버십 조회 권한 (RLS `fn_user_in_club`)

**의존**: SPEC-DB-001 완료(handle_new_club_host 트리거 배포), SPEC-API-001 완료(클라이언트 싱글톤),
SPEC-BOOK-001 완료(book_id 확보).

**완료 조건**: `createClubApi.ts`, `hostMembershipApi.ts` 단위 테스트 통과.
모임 생성 후 host 멤버십 행이 자동 존재함을 통합 테스트로 검증.

### Milestone 2: 진도 동기화 API (Priority High)

**목표**: host 전용 진도 업데이트(daily_pages, trigger_page)와 권한 검증을 구현한다.

- REQ-CLUBB-009: 진도 업데이트 엔드포인트 (PostgREST `clubs` UPDATE)
- REQ-CLUBB-010: 비host 진도 업데이트 차단 (RLS)
- REQ-CLUBB-011: 진도 업데이트 입력 검증 (음수/비정수 차단)
- REQ-CLUBB-012: closed 모임 진도 업데이트 차단

**의존**: Milestone 1 완료 (모임 생성).

**완료 조건**: `progressApi.ts` 단위 테스트 통과. 비host UPDATE 시도 시 RLS 거부 검증.

### Milestone 3: 참가자·상태 관리 API (Priority High)

**목표**: host 권한의 멤버 목록 조회, 모임 상태(active/closed) 관리, 멤버 탈퇴를 구현한다.

- REQ-CLUBB-013: 모임 멤버 목록 조회 (`club_members` SELECT)
- REQ-CLUBB-014: 모임 상태 변경 (active → closed)
- REQ-CLUBB-015: closed → active 재활성화 허용
- REQ-CLUBB-016: 멤버 자발적 탈퇴 (`club_members` DELETE, host 고아 모임 경고)
- REQ-CLUBB-017: 모임 상세 조회 (`clubs` SELECT 단일 행)

**의존**: Milestone 1 완료 (모임 생성), Milestone 2 완료 (진도 동기화).

**완료 조건**: `manageClubApi.ts` 단위 테스트 통과. host 전용 UPDATE, 비host 거부 검증.

### Milestone 4: 모임 생성·관리 화면 통합 (Priority Medium)

**목표**: 모임 생성 화면과 모임 관리 화면(host)을 구현하고, API 레이어와 연동한다.

- `ClubCreateScreen.tsx`: 모임 생성 폼(책 선택, 제목, 설명, 설정), 생성 API 호출
- `ClubManageScreen.tsx`: host 전용 관리 화면(멤버 목록, 진도 동기화, 상태 변경)
- `ClubDetailScreen.tsx`: 공개 모임 상세 조회(모임 정보, 책, 멤버 수)
- SPEC-UI-001 컴포넌트 활용: `Button`, `Card`, `ProgressBar`(진도 표시)

**의존**: Milestone 1~3 완료, SPEC-UI-001 컴포넌트.

**완료 조건**: 화면 간 네비게이션 플로우 통합 테스트 통과.
(SPEC-NAV-001 라우팅 구조와의 통합은 SPEC-NAV-001 완료 후 별도 연동.)

---

## 4. 아키텍처 설계 방향

### 4.1 모임 생성 + host 자동 가입 시퀀스

```
[클라이언트]                              [PostgREST]                    [DB 트리거]
     │                                         │                              │
     │  supabase.from('clubs').insert({        │                              │
     │    host_id: auth.uid(),                 │                              │
     │    book_id, title, type: 'group',       │                              │
     │    description, duration_days, ...      │                              │
     │  }).select().single()                   │                              │
     │ ───────────────────────────────────────>│                              │
     │                                         │                              │
     │                              1. clubs INSERT (RLS WITH CHECK:         │
     │                                 host_id = auth.uid())                  │
     │                                         │ ────────────────────────────>│
     │                                         │                              │
     │                                         │        2. AFTER INSERT       │
     │                                         │        handle_new_club_host  │
     │                                         │        SECURITY DEFINER      │
     │                                         │        club_members INSERT   │
     │                                         │        (club_id, host_id,    │
     │                                         │         role='host')         │
     │                                         │ <────────────────────────────│
     │                                         │                              │
     │                              3. clubs 행 반환 (.select().single())     │
     │ <────────────────────────────────────────│                              │
     │                                         │                              │
     │  4. host 멤버십 확인 (검증용):           │                              │
     │     supabase.from('club_members')       │                              │
     │     .select()                           │                              │
     │     .eq('club_id', newClubId)           │                              │
     │     .eq('user_id', auth.uid())          │                              │
     │     .eq('role', 'host').maybeSingle()   │                              │
     │ ───────────────────────────────────────>│                              │
     │                                         │                              │
     │                              5. host 멤버십 행 반환                    │
     │      (RLS: fn_user_in_club(club_id)=true)│                              │
     │ <────────────────────────────────────────│                              │
```

**핵심 설계 원칙**:
- 클라이언트는 `clubs` INSERT만 수행, `club_members` INSERT는 트리거 단독 처리 (REQ-CLUBB-006)
- host 멤버십 확인은 검증용이며, 트리거 실패 감지 목적 (REQ-CLUBB-007)
- `type='group'` 강제로 instant 모임 생성 차단 (REQ-CLUBB-002)

### 4.2 진도 동기화 권한 흐름

```
[host 클라이언트]                          [PostgREST]                    [RLS 평가]
     │                                         │                              │
     │  supabase.from('clubs')                 │                              │
     │  .update({ daily_pages, trigger_page }) │                              │
     │  .eq('id', clubId)                      │                              │
     │ ───────────────────────────────────────>│                              │
     │                                         │                              │
     │                                         │  RLS UPDATE 평가:            │
     │                                         │  auth.uid() = host_id ?      │
     │                                         │ ────────────────────────────>│
     │                                         │ <────────────────────────────│
     │                                         │                              │
     │                          [host 일치] ───┤  UPDATE 성공                 │
     │ <────────────────────────────────────────│                              │
     │                                         │                              │
     │                          [비host] ──────┤  UPDATE 거부 (0 rows)       │
     │ <────────────────────────────────────────│  에러 반환                   │
```

### 4.3 모임 상태 전환 흐름

```
                         ┌──────────────────┐
                         │ status='active'  │ ←── 모임 생성 (REQ-CLUBB-001)
                         │  (진도 업데이트   │
                         │   허용)           │
                         └────────┬─────────┘
                                  │
                    host 종료 요청 (REQ-CLUBB-014)
                                  │
                                  ▼
                         ┌──────────────────┐
                         │ status='closed'  │ ←── 읽기 전용 전환
                         │ (진도 업데이트    │
                         │  차단, 데이터 보존)│
                         └────────┬─────────┘
                                  │
                    host 재활성화 요청 (REQ-CLUBB-015)
                                  │
                                  ▼
                         ┌──────────────────┐
                         │ status='active'  │ ←── 재활성화 (양방향 허용)
                         └──────────────────┘
```

### 4.4 clubs INSERT 입력 매핑 (REQ-CLUBB-004)

| 입력 필드 | clubs 컬럼 | 제약 | 기본값 |
|----------|-----------|------|--------|
| 책 선택 | `book_id` | NOT NULL (FK) | — (사용자 선택) |
| 모임 제목 | `title` | NOT NULL | — (사용자 입력) |
| 모임 유형 | `type` | CHECK(group/instant) | `'group'` 강제 |
| 호스트 | `host_id` | NOT NULL (FK) | `auth.uid()` 자동 |
| 모임 설명 | `description` | NULL 허용 | NULL |
| 완독 기간 | `duration_days` | NULL 허용 | NULL |
| 일일 페이지 | `daily_pages` | NULL 허용 | NULL |
| 트리거 페이지 | `trigger_page` | NULL 허용 | NULL |
| 최소 인원 | `min_members` | NULL 허용 | NULL (게이트 아님) |
| 상태 | `status` | CHECK(active/closed) | `'active'` (기본값) |

---

## 5. 리스크 및 대응 계획

### 리스크 1: handle_new_club_host 트리거 미배포 (High)

**상황**: SPEC-DB-001 트리거가 로컬 개발 환경에 배포되지 않아 모임 생성 시 host
멤버십이 생성되지 않음.

**영향**: 모임 생성 후 host가 멤버로 등록되지 않아, 진도 업데이트·멤버 조회가 RLS에
의해 거부됨 (fn_user_in_club=false).

**대응**:
- REQ-CLUBB-007 host 멤버십 존재 확인으로 트리거 실패 사전 감지
- `supabase/migrations/` 디렉토리에 트리거 마이그레이션 존재 여부 사전 확인
- 로컬 개발 시 `supabase db reset`으로 마이그레이션 재적용 권장

### 리스크 2: type='instant' 우회 시도 (Medium)

**상황**: 클라이언트 검증을 우회하여 API 직접 호출로 `type='instant'` 모임 생성 시도.

**영향**: instant 모임은 채팅·시그널 로직이 없으므로 고아 상태가 됨.

**대응**:
- REQ-CLUBB-002 클라이언트 단 `type='group'` 강제
- CHECK 제약은 instant를 허용하므로(REQ-DB-006 D15), DB 단 차단은 불가
- 향후 Edge Function 도입 시 서버 단 검증 추가 검토

### 리스크 3: host 고아 모임 (Medium)

**상황**: host가 유일한 멤버인 상태에서 탈퇴(REQ-CLUBB-016)하여 모임에 host가 없게 됨.

**영향**: 모임 관리(진도 업데이트, 상태 변경)가 불가능해짐.

**대응**:
- REQ-CLUBB-016 host 탈퇴 시 사전 경고 표시
- 미결정 사항 6.2 host 위임 로직 향후 도입 검토
- MVP에서는 host 탈퇴 전 모임 종료(status='closed') 유도

### 리스크 4: RLS 권한 모순 (Low)

**상황**: 클라이언트가 `club_members` INSERT를 시도하여 RLS에 의해 거부되지만,
에러 메시지가 불명확하여 디버깅困难.

**영향**: 개발자 경험 저하, 디버깅 시간 증가.

**대응**:
- REQ-CLUBB-006 클라이언트 `club_members` INSERT 금지를 코드 리뷰 체크리스트에 포함
- SPEC-API-001 에러 처리 체계를 통해 RLS 거부 에러를 사용자 친화적 메시지로 변환

### 리스크 5: closed 모임 데이터 보존 정책 미확정 (Low)

**상황**: 미결정 사항 6.1의 closed 모임 데이터 보존 정책이 미확정 상태로, 스토리지 비용
예측이 어려움.

**영향**: 장기 스토리지 비용 증가 가능성.

**대응**:
- 현재 결정(영구 보존)을 기본으로 채택하고, SPEC-FEED-001 구현 시 재검토
- 모니터링: closed 모임 수·관련 emotion_records 수 주기적 확인

---

## 6. 품질 게이트 (TRUST 5)

본 SPEC 구현 시 다음 TRUST 5 기준을 충족해야 한다:

- **Tested**: 모임 생성 API, host 멤버십 확인, 진도 동기화, 상태 관리 단위 테스트.
  목표 커버리지 85% 이상. (REQ-CLUBB-001~017 해당 함수)
- **Readable**: 한국어 주석, 명확한 함수명(`createClub`, `verifyHostMembership`,
  `updateProgress`, `closeClub`, `leaveClub`). 영어 식별자, 한국어 코드 주석
  (language.yaml `code_comments: ko` 준수).
- **Unified**: ESLint + Prettier + TypeScript strict 모드 통과. SPEC-UI-001 코딩 스타일 준수.
- **Secured**: `type='group'` 강제(REQ-CLUBB-002), host 전용 UPDATE RLS 의존(REQ-CLUBB-010),
  클라이언트 `club_members` INSERT 금지(REQ-CLUBB-006), closed 모임 진도 차단(REQ-CLUBB-012).
- **Trackable**: Conventional commits, SPEC-CLUB-002 참조, 각 REQ별 커밋 매핑.
  커밋 메시지 한국어 (language.yaml `git_commit_messages: ko` 준수).

---

## 7. 전문가 컨설팅 권장 영역

본 SPEC은 다음 영역에 대해 전문가 에이전트 컨설팅을 권장한다:

### 7.1 Backend 전문가 (expert-backend)

**대상**: PostgREST RLS 정책 의존성 설계, `handle_new_club_host` 트리거 연동 검증,
클라이언트 관점의 RLS 에러 처리, 멤버 탈퇴 시 고아 모임 방지 로직.

**이유**: Track B 모임 생성은 DB 트리거와 RLS에 강하게 결합되어 있으며, 트리거 실패
시나리오와 RLS 권한 평가 시점에 대한 백엔드 전문 지식이 필요.

### 7.2 Frontend 전문가 (expert-frontend)

**대상**: `ClubCreateScreen.tsx` 모임 생성 폼 UX(책 선택, 설정 입력), `ClubManageScreen.tsx`
host 관리 화면 상태 관리, 로딩/에러 상태 UI 패턴.

**이유**: 모임 생성은 다단계 입력(책 → 제목 → 설정)이며, host 관리 화면은 멤버 목록·
진도 동기화·상태 변경의 복합 상태를 관리해야 하므로 프론트엔드 전문 설계가 필요.

### 7.3 DevOps 전문가 (expert-devops) — 권장

**대상**: `handle_new_club_host` 트리거 마이그레이션 배포 검증, 로컬 개발 환경
(`supabase db reset`)에서 트리거 동작 확인.

**이유**: 트리거 미배포 시 모임 생성이 실패하므로(리스크 1), 마이그레이션 배포 파이프라인
검증이 DevOps 전문 지식을 요구.

---

## 8. 다음 단계

1. 본 SPEC 문서 사용자 승인(Annotation cycle)
2. `/moai:2-run SPEC-CLUB-002`으로 구현 시작
3. 구현 순서: Milestone 1(생성 API + host 가입) → Milestone 2(진도 동기화) →
   Milestone 3(참가자·상태 관리) → Milestone 4(화면 통합)
4. 각 Milestone 완료 후 진척도 추적(`.moai/specs/SPEC-CLUB-002/progress.md`)
5. 모든 Milestone 완료 후 `/moai:3-sync SPEC-CLUB-002`으로 문서화
