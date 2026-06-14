# 시스템 구조 — 사각 (Sa-gak)

## 플랫폼

iOS/Android 모바일 앱 (React Native + Expo SDK 51+)

## 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                    Client (React Native + Expo)             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ 인증/온보딩 │  │ 도서 서재   │  │ 감정 기록   │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ 모임 관리   │  │ 독서 루틴   │  │ 보상/알림   │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                  Backend (Supabase)                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ PostgreSQL  │  │ PostgREST   │  │ Edge Functions│        │
│  │ (데이터)     │  │ (API)       │  │ (비즈니스 로직)│       │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ Realtime    │  │ Storage     │  │ Auth        │        │
│  │ (실시간 동기)│  │ (파일 저장) │  │ (인증)      │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│               External Services                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ Kakao Book  │  │ OAuth       │  │ Expo        │        │
│  │ (도서 검색) │  │ (카카오/애플/ │  │ (Push)      │        │
│  └─────────────┘  │  구글)      │  └─────────────┘        │
│                   └─────────────┘                         │
└─────────────────────────────────────────────────────────────┘
```

## 주요 모듈

- **인증/온보딩**: 사용자 가입, 로그인, 온보딩 플로우, 프로필 설정
- **도서 검색·서재 관리**: 바코드 스캔, 카카오 도서 API 연동, 책 등록, 진도 추적, 서재 관리
- **감정 기록 아카이브**: 페이지별 감정 입력, 단어/한 줄 기록, 타임라인 뷰, 완독 다이어리
- **연결 시스템**: Track A (합류형 요청), Track B (개설형 모임), 매칭 알고리즘, 메시징
- **모임 관리**: 모임 생성/가입, 진도 동기화, 스포일러 방지 피드, 참가자 관리
- **독서 루틴·알림**: 다정한 알림 설정, 독서 타이머, 습관 추적, 목표 설정
- **보상·아카이빙**: 기록 누적 보상, 성취 배지, 아카이브 시각화, 데이터 내보내기
- **마이페이지·설정**: 사용자 프로필, 알림 설정, 개인정보 처리, 이용약관

> **참고**: 본 데이터 모델은 기획 문서(`.booktalk/pages_06_ERD.md`) 기반으로 설계되었으며, SPEC-DB-001 구현(15개 migration, 272 테스트 통과)으로 `.moai/project/db/` 메타데이터가 동기화 완료되었습니다 (2026-06-14). 상세 스키마·ERD·RLS 정책은 `db/schema.md`·`db/erd.mmd`·`db/rls-policies.md` 참조.

## 데이터 모델

| 엔터티 | 설명 | 주요 관계 |
|-------|------|----------|
| users | 사용자 계정 정보 (인증, 프로필, 설정) | → user_books (1:N), → emotion_records (1:N), → club_members (1:N) |
| books | 책 정보 (ISBN, 제목, 저자, 표지) | → user_books (1:N), → clubs (1:N) |
| user_books | 사용자-책 연결 (진도, 상태, 시작일) | → users (N:1), → books (N:1), → emotion_records (1:N) |
| emotion_records | 감정 기록 (페이지, 단어, 감정, 생성일) | → user_books (N:1), → sticker_reactions (1:N) |
| clubs | 독서 모임 (정보, 진도, 설정) | → books (N:1), → club_members (1:N), → join_requests (1:N) |
| club_members | 모임 멤버 (가입일, 권한) | → users (N:1), → clubs (N:1) |
| join_requests | 가입 요청 (상태, 요청일) | → users (N:1), → clubs (N:1) |
| reading_sessions | 독서 세션 (시작/종료 시간, 지속 시간) | → user_books (N:1) |
| completion_reports | 완독 보고서 (자동 생성된 다이어리) | → user_books (N:1) |
| sticker_reactions | 감정 스티커 반응 (종류, 반응 시간) | → emotion_records (N:1), → users (N:1) |
| point_logs | 포인트 로그 (적립/사용 내역) | → users (N:1) |

> **참고**: 클라이언트는 REST 엔드포인트를 호출하며, 외부 API 연동(Kakao 등)은 Supabase Edge Function이 프록시합니다.

## API 서피스

**Authentication (OAuth)**
- `POST /auth/register` - 사용자 가입
- `POST /auth/login` - 로그인 (카카오/애플/구글 OAuth)
- `POST /auth/logout` - 로그아웃
- `GET /auth/me` - 현재 사용자 정보

**Books (검색/스캔/상세)**
- `GET /books/search` - 클라이언트용 도서 검색 (내부적으로 Edge Function `kakao-book-search` 프록시 호출)
- `POST /books/scan` - 바코드 스캔으로 책 등록
- `GET /books/{id}` - 책 상세 정보
- `GET /books/{id}/cover` - 책 표지 이미지

**Library CRUD (서재 관리)**
- `GET /library` - 내 서재 목록
- `POST /library` - 책 추가 (진도 0)
- `PUT /library/{book_id}` - 진도 업데이트
- `DELETE /library/{book_id}` - 서재에서 삭제

**Records CRUD+sticker (감정 기록)**
- `GET /records/{book_id}` - 특정 책의 감정 기록
- `POST /records` - 새 감정 기록 추가
- `PUT /records/{record_id}` - 기록 수정
- `POST /records/{record_id}/reactions` - 스티커 반응

**Sessions (독서 세션·타이머)**
- `POST /sessions` - 독서 세션 시작
- `PATCH /sessions/{id}/end` - 세션 종료 (지속 시간 기록)
- `GET /sessions/stats` - 독서 통계 (누적 시간, 루틴)

**Clubs CRUD (모임 관리)**
- `GET /clubs` - 내 모임 및 추천 모임
- `POST /clubs` - 새 모임 생성 (Track B)
- `GET /clubs/{id}` - 모임 상세 정보
- `POST /clubs/{id}/join` - 가입 요청 (Track A)
- `PUT /clubs/{id}/progress` - 진도 업데이트
- `GET /clubs/{id}/feed` - 진도별 슬라이딩 피드 (현재 진도 기반 스포일러 블러 처리, Supabase Realtime 구독과 병행)

**Users profile+notifications (사용자 정보)**
- `GET /users/{id}` - 사용자 프로필
- `PUT /users/{id}` - 프로필 업데이트
- `GET /users/{id}/stats` - 독서 통계
- `GET /users/{id}/points` - 포인트 적립/사용 내역 조회 (MVP는 조회 전용, 사용은 후순위)
- `POST /users/{id}/notifications` - 알림 설정

**Edge Functions (카카오 연동, 가입 요청 처리, 완독 보고서)**
- `POST /functions/kakao-book-search` - 카카오 도서 검색 프록시
- `POST /functions/process-join-request` - 가입 요청 처리
- `POST /functions/generate-completion-report` - 완독 다이어리 생성
- `POST /functions/send-notification` - 푸시 알림 발송

## 외부 연동

**Kakao Book API**
- 도서 검색: ISBN/제목/저자로 도서 정보 검색
- 표지 이미지: 저작권 허용 범위 내 표지 이미지 제공
- 데이터 동기화: 주기적으로 도서 정보 업데이트

**OAuth providers**
- Kakao: 한국 사용자 편의성 강화, 간편 로그인
- Apple: 애플 기기 사용자를 위한 Sign in with Apple
- Google: Google 계정 연동, 백업 및 복원 지원