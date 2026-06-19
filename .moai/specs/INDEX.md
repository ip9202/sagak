# 사각(Sa-gak) SPEC 카탈로그 — MVP 완결 로드맵

> **생성**: 2026-06-14
> **작성자**: 강력쇠주먹
> **목적**: 현재 구현 완료된 SPEC-DB-001(백엔드)·SPEC-UI-001(프론트엔드 파운데이션)을
> 제외한, MVP 완결에 필요한 14개 도메인 SPEC의 마스터 인덱스.
> **단일 출처(SSOT)**: 본 카탈로그의 도메인 분할은 `.moai/project/product.md`(핵심 기능) +
> `.moai/project/structure.md`(API 서피스) + `.moai/project/tech.md`(기술 스택)에 기반.
> 각 SPEC의 데이터 모델은 `.moai/project/db/`(SPEC-DB-001 산출물)에 기반.

---

## 1. 현재 구현 상태 (제외 대상)

| SPEC | 버전 | 범위 | 상태 |
|------|------|------|------|
| SPEC-DB-001 | 1.2.0 | 백엔드 — 12개 엔터티 스키마 + 21개 RLS 정책 + 트리거 + 보안 뷰 | ✅ 100% 완료 |
| SPEC-UI-001 | 1.0.0 | 프론트엔드 파운데이션 — 디자인 토큰 + 6개 컴포넌트 + ThemeProvider | ✅ 100% 완료 |

> 본 카탈로그의 14개 SPEC은 위 두 SPEC을 **선행 의존성**으로 갖는다.

---

## 2. MVP SPEC 로드맵 (Phase별)

### 의존성 그래프

```
Phase 1 (파운데이션)
  SPEC-API-001 ────────┬─→ SPEC-AUTH-001 ──→ SPEC-NAV-001
                       │
Phase 2 (핵심 도메인)  │
  SPEC-BOOK-001 ───────┤
       │               │
       ▼               │
  SPEC-LIBRARY-001 ◀───┘
       │
       ├─→ SPEC-EMOTION-001 ──→ SPEC-COMPLETION-001
       │
       ├─→ SPEC-CLUB-001 ──→ SPEC-CLUB-002
       │         │                 │
       │         └────────┬────────┘
       │                  ▼
       │           SPEC-FEED-001 ◀── SPEC-EMOTION-001
       │
       ├─→ SPEC-ROUTINE-001
       │
Phase 4 (참여/유지)
  SPEC-NOTIF-001 ◀── SPEC-API-001, SPEC-AUTH-001
  SPEC-PROFILE-001 ◀── SPEC-AUTH-001, SPEC-ROUTINE-001, SPEC-EMOTION-001

Phase 5 (배포)
  SPEC-DEPLOY-001 ◀── (모든 도메인 SPEC 완료 후 최종)
```

### Phase 요약

| Phase | SPEC 수 | 범위 | 산출물 유형 |
|-------|---------|------|------------|
| 0 | 1 | 화면 패턴 디자인 시스템 (모든 도메인 SPEC 선행 의존성) | 디자인 SSOT |
| 1 | 3 | 인프라·인증·네비게이션 | 클라이언트 파운데이션 |
| 2 | 4 | 개인 독서 경험(도서/서재/감정/완독) | 도메인 기능 + 화면 |
| 3 | 3 | 소셜 연결(Track A/B + 피드) | 도메인 기능 + Realtime |
| 4 | 3 | 참여·유지(루틴/알림/마이) | 도메인 기능 + 외부 API |
| 5 | 1 | 배포·CI/CD | 인프라 자동화 |
| **계** | **15** | — | — |

---

## 3. SPEC 상세 카탈로그

### Phase 1 — 파운데이션

#### SPEC-API-001: Supabase 클라이언트 통합 및 API 레이어
- **도메인**: INFRA
- **우선순위**: high
- **상태**: ✅ 구현 완료 (16/19 REQ, 84% — 2026-06-15 PR #3 머지)
- **핵심 범위**: `@supabase/supabase-js` 클라이언트 싱글톤, 환경 변수 관리(dev/prod 분리), 타입 안전 쿼리 래퍼, 공통 에러 처리·재시도, 인증 헤더 자동 주입
- **완료 REQ**: REQ-API-001~007 (클라이언트 싱글톤, 설정, gen-types 기반, 세션 저장소), REQ-API-011~018 (에러 계층 구조, 재시도, Edge Function 래퍼, 공개 API, 단위 테스트, 환경 변수 분리, EAS Build 통합, 디버깅)
- **연기 REQ**: REQ-API-008~010 (12엔터티/ENUM/뷰 타입 — SPEC-DB-001 스키마 배포 후 gen-types 실행 필요)
- **DB 엔터티**: 해당 없음 (클라이언트 인프라)
- **API/Edge Function**: 모든 PostgREST 엔드포인트 기반
- **의존성**: SPEC-DB-001(스키마), SPEC-UI-001(프로젝트 구조)
- **구현 산출물**: `src/config/env.ts`, `src/lib/supabase/client.ts`, `src/lib/supabase/storageAdapter.ts`, `src/lib/api/errors.ts`, `src/lib/api/retry.ts`, `src/lib/api/edgeFunctions.ts`, `src/errors/AppError.ts`, `.env*`
- **제외**: Edge Function 구현 로직(각 도메인 SPEC 처리)

#### SPEC-AUTH-001: OAuth 인증 및 세션 관리
- **도메인**: AUTH
- **우선순위**: high
- **핵심 범위**: 카카오/네이버/구글 OAuth 로그인, 세션 관리(JWT), 자동 로그인, 로그아웃, 온보딩 프로필 설정(nickname/avatar), AuthContext 전역 상태, 인증 가드용 세션 훅
- **OAuth 제공자**: 카카오/네이버/구글 (v1.0.1, 2026-06-17) — Apple 제외(App Store Guideline 4.8 한국 예외 적용), 네이버는 Supabase Custom OIDC로 연동
- **DB 엔터티**: `users`(프로필), `auth.users`(Supabase 내부)
- **API/Edge Function**: Supabase Auth (`signInWithOAuth`, `signOut`, `getSession`)
- **의존성**: SPEC-API-001
- **구현 산출물**: `src/auth/AuthContext.tsx`, `src/auth/useSession.ts`, `app/(auth)/*`(로그인/온보딩 화면)
- **제외**: OAuth 앱 등록·콜백 URL 인프라 설정(SPEC-DEPLOY-001 영역), 온보딩 건너뛰기 분기 정책은 본 SPEC에서 정의

#### SPEC-NAV-001: 네비게이션 및 라우팅 구조
- **도메인**: NAV
- **우선순위**: high
- **핵심 범위**: Expo Router 파일 시스템 라우팅, 4개 탭(홈/서재/모임/마이) + 스택 네비게이션, 인증 가드(미인증 시 로그인 리다이렉트), 딥링크, 탭바 아이콘/스타일링
- **DB 엔터티**: 해당 없음
- **API/Edge Function**: 해당 없음
- **의존성**: SPEC-AUTH-001(인증 가드)
- **구현 산출물**: `app/(tabs)/_layout.tsx`, `app/(tabs)/index.tsx` 등 4개 탭, `app/(auth)/_layout.tsx`, 인증 가드 컴포넌트
- **제외**: 각 탭의 실제 화면 콘텐츠(각 도메인 SPEC 처리), 본 SPEC은 라우팅 골격 + 빈 화면 셸만

---

### Phase 2 — 핵심 도메인 (개인 독서 경험)

#### SPEC-BOOK-001: 도서 검색 및 등록
- **도메인**: BOOK
- **우선순위**: high
- **상태**: ✅ 구현 완료 (M1~M4 전부, PR #8 852f0ac M1+M2 + PR #9 a293e8d M3+M4, 2026-06-17)
- **핵심 범위 (완료 M1~M4)**: Kakao Book Search API 연동(Edge Function `kakao-book-search` 프록시, CORS 해결), 수동 검색(ISBN/제목/저자), 검색 결과 캐싱, 책 등록 → `books` 테이블 업서트, 책 상세 조회, 바코드 스캔(`expo-camera`), 도서 검색/상세 화면
- **DB 엔터티**: `books`(캐시 카탈로그)
- **API/Edge Function**: `POST /functions/kakao-book-search`, `books` SELECT/INSERT
- **의존성**: SPEC-API-001
- **구현 산출물**: `src/types/book.ts`, `src/features/book/{searchApi,bookDetailApi,index,barcode}.ts`, `supabase/functions/kakao-book-search/`, `app/(tabs)/book-search/*`, `app/(tabs)/book-detail/*`
- **제외**: 표지 이미지 Storage 업로드, 실제 Kakao API 키 배포(SPEC-DEPLOY-001)

#### SPEC-LIBRARY-001: 개인 서재 관리
- **도메인**: LIBRARY
- **우선순위**: high
- **상태**: ✅ 구현 완료 (16/16 REQ, PR #10 b3a5043, 2026-06-16, 545 테스트, 커버리지 85.92%)
- **핵심 범위**: 내 서재 CRUD, 진도 추적(`current_page` 업데이트 → `last_progress_at` 자동 갱신), 독서 상태 관리(reading/completed/shelved), 공개/비공개 설정(`is_public`), 서재 목록 정렬/필터
- **DB 엔터티**: `user_books`, `books`
- **API/Edge Function**: `/library` CRUD 엔드포인트
- **의존성**: SPEC-BOOK-001(책 등록), SPEC-AUTH-001(사용자 식별)
- **구현 산출물**: `src/features/library/*.ts`(API·hooks), 서재 화면, 책 상세 화면
- **제외**: 완독 다이어리 생성(SPEC-COMPLETION-001 — DB 트리거가 자동 처리하지만 UI는 별도)

#### SPEC-EMOTION-001: 감정 아카이브 및 스티커 반응
- **도메인**: EMOTION
- **상태**: ✅ 구현 완료 (10/10 REQ, PR #12 머지 a1ce6cf, 2026-06-17, 627 테스트 통과, 커버리지 92.47%)
- **우선순위**: high
- **핵심 범위**: 페이지별 감정 기록(단어/한 줄) CRUD, 안전한 글쓰기 울타리(단어 질문지 유도), 공감 스티커 반응(3종: empathy/touching/comforted, 기록당 사용자당 1개), 스포일러 방지 블러(`EmotionRecordCard` 활용), 타임라인 뷰, 공개 범위 제어(visibility: public/club)
- **DB 엔터티**: `emotion_records`, `sticker_reactions`
- **API/Edge Function**: `/records` CRUD + `/records/{id}/reactions`
- **의존성**: SPEC-LIBRARY-001(책 컨텍스트), SPEC-UI-001(`EmotionRecordCard`, `StickerReaction` 컴포넌트)
- **구현 산출물**: `src/features/emotion/*.ts`, 감정 기록 입력 화면, 타임라인 화면
- **제외**: 모임 피드 내 감정 표시(SPEC-FEED-001), 완독 다이어리 집계(SPEC-COMPLETION-001)

#### SPEC-COMPLETION-001: 완독 다이어리 및 아카이브 시각화
- **도메인**: COMPLETION
- **상태**: ✅ 구현 완료 (10/10 REQ, PR #14 머지 463996e, 2026-06-17, 커버리지 91.92%)
- **핵심 범위**: `completion_reports.report_data` 시각화(감정 곡선, 하이라이트, 총 기록 수), "이 책과의 여정" 다이어리 뷰, 완독 성취 표시. **Note**: 완독 처리 플로우(reading → completed 전환 트리거)는 SPEC-LIBRARY-001 협력 영역. 본 SPEC은 report_data 읽기 전용 소비자(UI 시각화)만 구현.
- **진입 버튼 계약 (REQ-COMP-002)**: 완독 다이어리 진입 버튼 UI는 SPEC-LIBRARY-001과 협력 필요(계약만 정의, 구현 연기).
- **DB 엔터티**: `completion_reports` (DB 트리거가 자동 생성), `user_books`(상태 전환은 SPEC-LIBRARY-001)
- **API/Edge Function**: `GET /completion_reports`(조회, PostgREST 직접), `generate-completion-report` Edge Function은 예비(DB 트리거가 이미 자동 생성)
- **의존성**: SPEC-EMOTION-001(감정 데이터 원천), SPEC-DB-001(report_data 생성 트리거), SPEC-UI-001(토큰 전용 스타일링)
- **구현 산출물**: `src/features/completion/*.ts` (7 source + 4 test), 완독 다이어리 화면, 순수 SVG 차트
- **제외**: 리치 콘텐츠(이미지 카드 등) 생성 Edge Function(확장 단계)

---

### Phase 3 — 소셜 연결 (Track A/B)

#### SPEC-CLUB-001: Track A 합류형 요청
- **도메인**: CLUB (SOCIAL-A)
- **우선순위**: high
- **상태**: ✅ 구현 완료 (12/12 REQ, PR #21 1fcf062, 2026-06-19, 789 테스트, 커버리지 93.44%)
- **핵심 범위**: 같은 책 읽는 독자에게 "같이 읽어요" 요청(Track A), `join_requests` 상태 기계(pending → accepted/declined), host 승인/거절 UI, Track A 활성·공개 독자 목록(`user_books_public` 뷰 활용), 요청 메시지, `process-join-request` Edge Function
- **DB 엔터티**: `join_requests`, `club_members`, `clubs`, `user_books_public`(뷰)
- **API/Edge Function**: `/clubs/{id}/join`, `process-join-request` Edge Function
- **의존성**: SPEC-LIBRARY-001(독자 목록), SPEC-AUTH-001(사용자 식별)
- **구현 산출물**: `src/features/club/trackA/*.ts`, 독자 목록 화면, 요청/응답 화면, `supabase/functions/process-join-request/`
- **알려진 제한사항**: Edge Function `process-join-request`는 M-1/M-2 pre-prod 보안 요구사항(RLS 정책, 요청 검증)에 대한 완전한 구현이 아닌 skeleton 상태. 실제 프로덕션 배포 전에 보안 강화 필요. (progress.md M1-M5 섹션 참조)
- **제외**: Track B 모임 생성(SPEC-CLUB-002), 실시간 피드(SPEC-FEED-001)

#### SPEC-CLUB-002: Track B 개설형 모임 관리
- **도메인**: CLUB (SOCIAL-B)
- **우선순위**: high
- **상태**: ✅ 구현 완료 (17/17 REQ, PR #23 c6920fe, 2026-06-19, 861 테스트)
- **핵심 범위**: 함께 읽기 모임 생성(0명 출발, host 자동 가입 트리거 연동), 모임 설정(duration_days/daily_pages/trigger_page), 진도 동기화, 참가자 관리(host 권한), 모임 상태 관리(active/closed)
- **DB 엔터티**: `clubs`(진도 계획 컬럼 daily_pages/trigger_page/duration_days, migration 0006), `club_members`(host 자동 가입)
- **API/Edge Function**: `/clubs` CRUD, `/clubs/{id}/progress`
- **의존성**: SPEC-CLUB-001(상태 기계 패턴 공유), SPEC-BOOK-001(모임용 책)
- **구현 산출물**: `src/features/club/trackB/*.ts`, 모임 생성 화면, 모임 관리 화면(host)
- **제외**: 실시간 채팅(type=instant, 비목표), 모임 피드(SPEC-FEED-001)

#### SPEC-FEED-001: 스포일러 방지 진도별 피드
- **도메인**: FEED
- **우선순위**: medium
- **핵심 범위**: 진도별 슬라이딩 피드(현재 진도 기준 블러 처리), Supabase Realtime 구독(새 감정 기록/스티커 실시간 반영), 모임원 감정 기록 표시(visibility=club), 스포일러 해제 상호작용
- **DB 엔터티**: `emotion_records`(visibility=club), `clubs`(진도)
- **API/Edge Function**: `/clubs/{id}/feed`, Supabase Realtime(postgres_changes)
- **의존성**: SPEC-CLUB-001/002(모임 컨텍스트), SPEC-EMOTION-001(감정 데이터)
- **구현 산출물**: `src/features/feed/*.ts`, 모임 피드 화면, Realtime 훅
- **제외**: 실시간 팝업 채팅(비목표), 좋아요/팔로우(비목표)

---

### Phase 4 — 참여/유지

#### SPEC-ROUTINE-001: 독서 루틴 및 타이머
- **도메인**: ROUTINE
- **우선순위**: medium
- **핵심 범위**: 다정한 독서 알림 설정(`reading_alarm_time`, `reading_alarm_enabled`), 독서 타이머(`reading_sessions` 시작/종료, `duration_seconds` 기록), 독서 습관 추적(연속 일수·누적 시간), 목표 설정
- **DB 엔터티**: `reading_sessions`, `users`(alarm 설정)
- **API/Edge Function**: `/sessions`, `/sessions/stats`
- **의존성**: SPEC-LIBRARY-001(책 컨텍스트)
- **구현 산출물**: `src/features/routine/*.ts`, 독서 타이머 화면, 루틴 통계 위젯
- **제외**: 백그라운드 타이머 정확도 한계 문서화, 로컬 알림 스케줄링은 SPEC-NOTIF-001과 협력

#### SPEC-NOTIF-001: 푸시 알림 및 알림 센터
- **도메인**: NOTIF
- **우선순위**: medium
- **핵심 범위**: Expo Push Notifications 통합(토큰 관리), 알림 센터(`notifications` 테이블 읽음 처리), 알림 타입별 처리(reading_reminder/join_request_received/join_accepted/sticker_received/completion/club_signal), 알림 설정 UI, `send-notification` Edge Function
- **DB 엔터티**: `notifications`
- **API/Edge Function**: `/users/{id}/notifications`, `send-notification` Edge Function
- **의존성**: SPEC-API-001, SPEC-AUTH-001(토큰-사용자 매핑)
- **구현 산출물**: `src/features/notification/*.ts`, 알림 센터 화면, `supabase/functions/send-notification/`
- **제외**: SMS/이메일 채널, 마케팅 푸시

#### SPEC-PROFILE-001: 마이페이지, 통계 및 보상
- **도메인**: PROFILE
- **우선순위**: medium
- **핵심 범위**: 사용자 프로필 조회/수정(`user_profiles` 뷰), 독서 통계(완독 수·누적 시간·감정 기록 수), 포인트 내역 조회(`point_logs`, MVP 조회 전용), 성취 배지 시각화, 설정(알림/공개범위), 이용약관·개인정보 처리방침 링크
- **DB 엔터티**: `users`, `point_logs`, `reading_sessions`(통계)
- **API/Edge Function**: `/users/{id}`, `/users/{id}/stats`, `/users/{id}/points`
- **의존성**: SPEC-AUTH-001(프로필), SPEC-ROUTINE-001(통계), SPEC-EMOTION-001(기록 수)
- **구현 산출물**: `src/features/profile/*.ts`, 마이페이지 화면, 통계 대시보드
- **제외**: 포인트 사용(굿즈 교환, 후순위), 프리미엄 유료화(비목표), 데이터 내보내기(확장)

---

### Phase 5 — 배포

#### SPEC-DEPLOY-001: 빌드, 배포 및 CI/CD
- **도메인**: DEPLOY / DEVOPS
- **우선순위**: medium
- **상태**: 🔄 진행 중 (M1+M5 머지됨, PR #15 2514263, 2026-06-17; M2 CI / M3 Sentry SDK / M4 Submit / M6 Edge Function 미완료 — M6은 SPEC-CLUB-001 / SPEC-NOTIF-001 의존으로 블로킹)
- **핵심 범위**: EAS Build(iOS/Android 크로스 플랫폼 빌드), EAS Submit(TestFlight/Play Console), GitHub Actions CI/CD 파이프라인(코드 푸시 시 빌드·테스트·배포), Sentry 에러 추적 통합, 환경 분리(dev/staging/prod), 버전 관리·태깅 자동화, OAuth 앱 등록·콜백 URL 인프라 설정, Supabase Storage 버킷 정책
- **DB 엔터티**: 해당 없음 (인프라)
- **API/Edge Function**: 해당 없음 (인프라 구성)
- **의존성**: 모든 도메인 SPEC(최종 통합 후 배포)
- **구현 산출물**: `eas.json`, `.github/workflows/*.yml`, `sentry.properties` / Sentry CLI 통합, 환경 변수 문서, 배포 매뉴얼
- **제외**: 데스크톱 웹 버전(비목표), A/B 테스트 인프라(확장)

---

## 4. 도메인 분류 요약

| 도메인 코드 | SPEC | 수 |
|------------|------|----|
| INFRA | SPEC-API-001 | 1 |
| AUTH | SPEC-AUTH-001 | 1 |
| NAV | SPEC-NAV-001 | 1 |
| BOOK | SPEC-BOOK-001 | 1 |
| LIBRARY | SPEC-LIBRARY-001 | 1 |
| EMOTION | SPEC-EMOTION-001, SPEC-COMPLETION-001 | 2 |
| CLUB | SPEC-CLUB-001, SPEC-CLUB-002, SPEC-FEED-001 | 3 |
| ROUTINE | SPEC-ROUTINE-001 | 1 |
| NOTIF | SPEC-NOTIF-001 | 1 |
| PROFILE | SPEC-PROFILE-001 | 1 |
| DEPLOY | SPEC-DEPLOY-001 | 1 |

---

## 5. 비목표 (MVP 제외 — SPEC 작성 대상 아님)

product.md "비목표" + SPEC-DB-001 "제외 범위" 기반:
- 실시간 매칭 및 팝업 채팅 (`type=instant`, `chat_messages` 테이블)
- 실시간 독서실/스터디룸 기능
- 좋아요/팔로워 경쟁 메커니즘 (과시 엔진 회피)
- 데스크톱 웹 버전
- 포인트 사용(굿즈 교환) 로직
- 프리미엄 유료화 기능
- 데이터 마이그레이션/시드 데이터 자동화
- 관리자 모듈 (`role='admin'` 권한 정책)

---

## 6. 진행 추적

| Phase | SPEC | spec.md | plan.md | acceptance.md | 상태 |
|-------|------|---------|---------|---------------|------|
| 1 | SPEC-API-001 | ✅ | ✅ | ✅ | 구현 완료 (16/19 REQ, 84% — REQ-008~010 스키마 의존으로 SPEC-DB-001 배포 후 연기) |
| 1 | SPEC-AUTH-001 | ✅ | ✅ | ✅ | 구현 완료 (18/18 REQ, PR #11 머지 c6630ae, 2026-06-17, OAuth 제공자: kakao/naver/google) |
| 1 | SPEC-NAV-001 | ✅ | ✅ | ✅ | 구현 완료 (13/13 REQ, PR #7 머지 8fa545b, 317 테스트, 커버리지 82.5%) |
| 2 | SPEC-BOOK-001 | ✅ | ✅ | ✅ | 구현 완료 (M1~M4 전부, PR #8 852f0ac M1+M2 + PR #9 a293e8d M3+M4, 2026-06-17) |
| 2 | SPEC-LIBRARY-001 | ✅ | ✅ | ✅ | 구현 완료 (16/16 REQ, PR #10 b3a5043, 2026-06-16, 545 테스트, 커버리지 85.92%) |
| 2 | SPEC-EMOTION-001 | ✅ | ✅ | ✅ | 구현 완료 (10/10 REQ, PR #12 머지 a1ce6cf, 2026-06-17, 커버리지 92.47%) |
| 2 | SPEC-COMPLETION-001 | ✅ | ✅ | ✅ | 구현 완료 (10/10 REQ, PR #14 머지 463996e, 2026-06-17, 커버리지 91.92%) |
| 3 | SPEC-CLUB-001 | ✅ | ✅ | ✅ | 구현 완료 (12/12 REQ, PR #21 1fcf062, 2026-06-19, 789 테스트, 커버리지 93.44%) |
| 3 | SPEC-CLUB-002 | ✅ | ✅ | ✅ | 구현 완료 (17/17 REQ, PR #23 c6920fe, 2026-06-19, 861 테스트) |
| 3 | SPEC-FEED-001 | ✅ | ✅ | ✅ | SPEC 작성 완료 (8 REQ) |
| 4 | SPEC-ROUTINE-001 | ✅ | ✅ | ✅ | SPEC 작성 완료 (10 REQ) |
| 4 | SPEC-NOTIF-001 | ✅ | ✅ | ✅ | SPEC 작성 완료 (13 REQ) |
| 4 | SPEC-PROFILE-001 | ✅ | ✅ | ✅ | SPEC 작성 완료 (8 REQ) |
| 5 | SPEC-DEPLOY-001 | ✅ | ✅ | ✅ | 진행 중 (M1+M5 머지, PR #15 2514263, 2026-06-17; M2/M3/M4/M6 미완료 — M6 블로킹: CLUB/NOTIF 의존) |
| 0 | SPEC-UI-002 | ✅ | ✅ | ✅ | SPEC 작성 완료 (25 REQ) — 화면 패턴, 14개 도메인 SPEC 선행 의존성 |

**총 REQ 수: 219개 / 15개 SPEC 전체 작성 완료 (2026-06-14)**

> **참고 (2026-06-19)**: SPEC-DEPLOY-001은 부분 진행(M1+M5 머지, PR #15 2514263) 상태이므로 **구현 완료 카운트에서 제외**한다. M2(CI)/M3(Sentry SDK)/M4(Submit)/M6(Edge Function)가 남아있으며, M6은 SPEC-CLUB-001 머지 완료로 블로킹 해제(progress.md M1-M5 섹션 참조). 완료 카운트는 DEPLOY가 6개 마일스톤 전부 통과한 시점에만 증가한다.

---

## 9. 구현 완료 SPEC 요약 (2026-06-19 기준)

### Phase 1 파운데이션 — 100% 완결

| Phase | 구현 완료 SPEC | 구현 일자 | PR | 커밋 | REQ 완료율 | 테스트 | 커버리지 |
|-------|---------------|----------|----|----|-----------|--------|---------|
| 1 | SPEC-UI-001 | 2026-06-14 | #1 | 92c100f | 25/25 (100%) | 72/72 | 93.68% |
| 1 | SPEC-DB-001 | 2026-06-14 | - | - | 15/15 (100%) | 272/272 | 88%+ |
| 1 | SPEC-API-001 | 2026-06-15 | #3 | e5d01d9 | 16/19 (84%) | 198/198 | 96%+ |
| 1 | SPEC-AUTH-001 | 2026-06-17 | #11 | c6630ae | 18/18 (100%) | 317/317 | 85%+ |
| 1 | SPEC-NAV-001 | 2026-06-16 | #7 | 8fa545b | 13/13 (100%) | 317/317 | 82.5% |

### Phase 2 핵심 도메인 — 100% 완결

| Phase | 구현 완료 SPEC | 구현 일자 | PR | 커밋 | REQ 완료율 | 테스트 | 커버리지 |
|-------|---------------|----------|----|----|-----------|--------|---------|
| 2 | SPEC-BOOK-001 | 2026-06-17 | #8+#9 | 852f0ac+a293e8d | 16/16 (100%) | 462/462 | 94%+ |
| 2 | SPEC-LIBRARY-001 | 2026-06-16 | #10 | b3a5043 | 16/16 (100%) | 545/545 | 85.92% |
| 2 | SPEC-EMOTION-001 | 2026-06-17 | #12 | a1ce6cf | 10/10 (100%) | 627/627 | 92.47% |
| 2 | SPEC-COMPLETION-001 | 2026-06-17 | #14 | 463996e | 10/10 (100%) | 683/683 | 91.92% |

### Phase 3 소셜 연결 — 진행 중 (2/3 완료)

| Phase | 구현 완료 SPEC | 구현 일자 | PR | 커밋 | REQ 완료율 | 테스트 | 커버리지 |
|-------|---------------|----------|----|----|-----------|--------|---------|
| 3 | SPEC-CLUB-001 | 2026-06-19 | #21 | 1fcf062 | 12/12 (100%) | 789/789 | 93.44% |
| 3 | SPEC-CLUB-002 | 2026-06-19 | #23 | c6920fe | 17/17 (100%) | 861/861 | - |

**Phase 1 완결 상태**: 인프라·인증·네비게이션 파운데이션 100% 완성. 도메인 SPEC(SPEC-BOOK-001, SPEC-LIBRARY-001 등) 구현 준비 완료.

**Phase 2 완결 상태 (2026-06-19 기준)**: 개인 독서 경험 4개 SPEC(BOOK, LIBRARY, EMOTION, COMPLETION) 모두 구현 완료. 도메인 기능 + 화면 + 테스트 완비.

**Phase 3 진행 상태 (2026-06-19 기준)**: 2/3 완료 — SPEC-CLUB-001(Track A 합류형 요청) 완료, SPEC-CLUB-002(Track B 개설형 모임) 완료. SPEC-FEED-001(진도별 피드) 구현 대기.

**미구현 SPEC (4개)**: SPEC-FEED-001(Phase 3), SPEC-ROUTINE-001(Phase 4), SPEC-NOTIF-001(Phase 4), SPEC-PROFILE-001(Phase 4).

---

---

## 8. 구현 완료 SPEC 추적

### SPEC-API-001: Supabase 클라이언트 통합 및 API 레이어
- **구현 완료일**: 2026-06-15
- **머지**: PR #3 (commit e5d01d9, develop 브랜치)
- **구현 범위**: 16/19 REQ (84%) — REQ-API-001~007, REQ-API-011~018 완료
- **연기 REQ**: REQ-API-008~010 (gen-types entity 타입 — SPEC-DB-001 스키마 배포 후 Supabase CLI gen-types 실행 필요)
- **테스트**: 198개 통과, 커버리지 96%+
- **새로운 의존성**: `@react-native-async-storage/async-storage` 2.2.0
- **공개 API**:
  - `getSupabiceClient` — Supabase 클라이언트 싱글톤 (src/lib/supabase/client.ts)
  - `normalizeError` — 에러 표준화 (src/lib/api/errors.ts)
  - `classifyError` — 에러 카테고리 분류 (src/lib/api/errors.ts)
  - `retryWithBackoff` — 지수 백오프 재시도 (src/lib/api/retry.ts)
  - `getUserFriendlyMessage` — 사용자 표시용 메시지 (src/lib/api/errors.ts)
  - `logToSentry` — 에러 로깅 (src/lib/api/errors.ts)
  - `invokeEdgeFunction` — Edge Function 래퍼 (src/lib/api/edgeFunctions.ts)
  - `supabaseStorageAdapter` — 세션 저장소 어댑터 (src/lib/supabase/storageAdapter.ts)
- **새로운 디렉토리**:
  - `src/config/` — 환경 변수 검증 (env.ts)
  - `src/lib/supabase/` — Supabase 클라이언트 및 세션 저장소
  - `src/lib/api/` — API 에러 처리 및 Edge Function 래퍼
  - `src/errors/` — 공통 에러 클래스 계층 (AppError + 7 서브클래스)
- **보안 수정사항**: service_role 키 클라이언트 노출 이슈 리뷰에서 발견/수정 (security-mitigations.md 참조)
- **후속 의존성**: 모든 도메인 SPEC(SPEC-AUTH-001, SPEC-NAV-001, SPEC-BOOK-001 등)이 이 파운데이션 위에 구현됨

---

## 7. 추적성

| 소스 문서 | 활용 |
|----------|------|
| `.moai/project/product.md` | 핵심 기능·사용 시나리오·비목표 (도메인 식별) |
| `.moai/project/structure.md` | API 서피스·데이터 모델·외부 연동 (SPEC별 API 매핑) |
| `.moai/project/tech.md` | 기술 스택·제약사항 (구현 산출물 기반) |
| `.moai/project/db/` (SPEC-DB-001 산출물) | 엔터티·RLS 정책 (각 SPEC DB 의존성) |
| `.moai/specs/SPEC-DB-001/` | 백엔드 완성 범위 (제외 확인) |
| `.moai/specs/SPEC-UI-001/` | 프론트엔드 파운데이션 완성 범위 (제외 확인) |
| `.booktalk/pages_*` | 기획 SSOT (각 SPEC 상세 작성 시 참조) |

---

버전: 1.2.0
분류: SPEC 카탈로그 (인덱스)
상태: 15개 SPEC 전체 작성 완료 (run 단계 대기)

---

## 8. 글로벌 디자인 의존성 선언 (2026-06-14 추가)

**모든 14개 도메인 SPEC은 SPEC-UI-002(화면 패턴 디자인 시스템)을 선행 의존성으로 가진다.**

run 워크플로우 실행 시, MoAI 오케스트레이터는 각 도메인 SPEC의 구현 에이전트 프롬프트에 다음을 **반드시 주입**해야 한다:
1. `.moai/specs/SPEC-UI-002/spec.md` — 화면 패턴 REQ (3계층 레이아웃, 헤더 균일성, 카드 밀도, 빈/로딩/에러 상태, 탭바 규칙)
2. Pencil 레퍼런스: `.moai/design/sagak.pen` — 4개 핵심 탭 화면(F03-Home/F04-Library/F11-Clubs/F15-My) + 2개 빈 상태 화면(F04-Library-Empty/F11-Clubs-Empty) + 7개 재사용 컴포넌트(StatusBar/TabBar/BookCard/PrimaryButton/GhostButton/EmotionRecordCard/EmptyState)
3. `.moai/design/system.md` — 디자인 시스템 SSOT (토큰 테이블, craft 원칙)
4. `src/theme/tokens.ts` — `$` 변수만 사용, 하드코딩 금지

이 선언은 개별 plan.md를 14번 수정하는 대신 run 단계에서 중앙 집중적으로 일관성을 강제한다. `.claude/rules/moai/design/constitution.md` FROZEN zone(v3.4.0)이 이를 보장한다.
