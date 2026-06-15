# Design Specification

> **기반**: `.moai/specs/INDEX.md`(14개 SPEC 카탈로그) + `.moai/project/product.md`. 본 문서의 화면 목록은 14개 도메인 SPEC에서 파생되었으며, 각 화면은 담당 SPEC과 1:1로 매핑된다. Pencil `.pen` 파일의 프레임 ID는 본 문서의 Frame ID와 대응한다.

## Functional Inventory

| Feature / Page | 담당 SPEC | 화면 수 |
|---------------|---------|--------|
| 온보딩/로그인 (OAuth) | SPEC-AUTH-001 | 2 |
| 홈 (메인) | SPEC-NAV-001 + 복합 | 1 |
| 서재 목록 | SPEC-LIBRARY-001 | 1 |
| 책 상세 (진도) | SPEC-LIBRARY-001 | 1 |
| 도서 검색/바코드 | SPEC-BOOK-001 | 2 |
| 감정 입력 | SPEC-EMOTION-001 | 1 |
| 감정 타임라인 | SPEC-EMOTION-001 | 1 |
| 완독 다이어리 | SPEC-COMPLETION-001 | 1 |
| 모임 목록/탐색 | SPEC-CLUB-002 | 1 |
| 모임 생성 (Track B) | SPEC-CLUB-002 | 1 |
| 모임 상세/피드 | SPEC-CLUB-001 + SPEC-FEED-001 | 1 |
| Track A 독자 목록/요청 | SPEC-CLUB-001 | 1 |
| 독서 타이머 | SPEC-ROUTINE-001 | 1 |
| 알림 센터 | SPEC-NOTIF-001 | 1 |
| 마이페이지/통계 | SPEC-PROFILE-001 | 1 |
| **계** | | **17** |

## Information Architecture

```
Root
├── (auth) — 미인증 그룹
│   ├── login                    [SPEC-AUTH-001] OAuth 3종 로그인
│   └── onboarding               [SPEC-AUTH-001] 닉네임/아바타 설정
├── (tabs) — 인증 후 메인
│   ├── index (홈)               [SPEC-NAV-001] 다정한 알림 + 진행중 책 + 오늘의 기록 CTA
│   ├── library (서재)
│   │   ├── index                [SPEC-LIBRARY-001] 서재 목록 (상태별 필터)
│   │   ├── search               [SPEC-BOOK-001] 도서 검색/바코드
│   │   ├── scan                 [SPEC-BOOK-001] 바코드 스캔 전체화면
│   │   └── [bookId]             [SPEC-LIBRARY-001] 책 상세 + 진도 + 타임라인 진입
│   ├── clubs (모임)
│   │   ├── index                [SPEC-CLUB-002] 모임 목록/추천 + 생성 CTA
│   │   ├── new                  [SPEC-CLUB-002] Track B 모임 생성
│   │   ├── readers              [SPEC-CLUB-001] Track A 독자 목록
│   │   └── [clubId]             [SPEC-CLUB-001 + FEED-001] 모임 상세 + 진도별 피드
│   └── my (마이)
│       ├── index                [SPEC-PROFILE-001] 프로필 + 통계 + 배지
│       ├── stats                [SPEC-PROFILE-001] 독서 통계 상세
│       ├── timer                [SPEC-ROUTINE-001] 독서 타이머
│       └── notifications        [SPEC-NOTIF-001] 알림 센터
└── [bookId]/emotion             [SPEC-EMOTION-001] 감정 입력 (모달/스택)
    [bookId]/timeline            [SPEC-EMOTION-001] 감정 타임라인
    [bookId]/completion          [SPEC-COMPLETION-001] 완독 다이어리
```

## Frame-by-Frame Design Goals

각 화면은 **하나의 주된 의도(One primary intent)**를 갖는다 (Mobile App 가이드라인).

### 인증 그룹
- **F01 login**: 카카오/애플/구글 3버튼. 의도: "가장 편한 방법으로 시작"
- **F02 onboarding**: 닉네임 입력 + 아바타 선택. 의도: "나를 소개하는 한 줄"

### 홈
- **F03 home**: 다정한 알림 카드 + 현재 읽는 책(진도바) + "오늘의 첫 페이지" CTA. 의도: "지금 읽고 있는 책으로"

### 서재
- **F04 library**: 상태 탭(읽는중/완독/보관) + BookCard 리스트. 의도: "내 책장 둘러보기"
- **F05 book-detail**: 표지 + 진도 + 감정 기록 타임라인 진입 + 완독 처리. 의도: "이 책과의 여정"
- **F06 search**: 검색바 + 최근/인기 + 결과 카드. 의도: "찾는 책 더하기"
- **F07 scan**: 카메라 전체화면 + ISBN 인식 오버레이. 의도: "바코드로 빠르게"

### 감정 (제품 핵심)
- **F08 emotion-input**: 단어 질문지 유도 + 한 줄 입력 + 공개범위 토글. 의도: "지금 느낌 한 조각"
- **F09 timeline**: 페이지순 감정 카드(스포일러 블러) + 스티커 집계. 의도: "감정 흐름 돌아보기"

### 완독
- **F10 completion**: 감정 곡선 차트 + 하이라이트 + 총 기록 수 + 축하. 의도: "이 여정의 완성"

### 모임
- **F11 clubs-list**: 모임 카드(책·진도·인원) + 추천 + 생성 FAB. 의도: "함께 읽을 모임 찾기"
- **F12 club-create**: 책 선택 + 기간/일일분량 + 제목/소개. 의도: "모임 열기 (0명도 OK)"
- **F13 readers**: 같은 책 공개 독자 카드 + "같이 읻요" 요청 버튼. 의도: "같은 페이지의 독자"
- **F14 club-detail**: 모임 정보 + 진도 동기화 + **진도별 슬라이딩 피드**(스포일러 블러, Realtime). 의도: "함께 읽는 지금"

### 마이
- **F15 my**: 프로필 + 통계 요약(완독/시간/기록수) + 배지 + 설정 진입. 의도: "나의 독서 발자국"
- **F16 stats**: 누적 시간·streak·감정 기록 통계 차트. 의도: "내 독서 리듬"
- **F17 timer**: 현재 책 + 타이머(시작/종료) + 오늘 누적. 의도: "지금 5분만 읽기"
- **F18 notifications**: 알림 리스트(타입별 아이콘) + 읽음 처리. 의도: "새 소식 확인"

## Empty State Design

| 화면 | 빈 상태 메시지 | CTA |
|------|--------------|-----|
| F04 library | "책장이 비어 있어요. 첫 책을 등록해볼까요?" | 책 검색하기 |
| F09 timeline | "아직 기록이 없어요. 첫 페이지의 느낌을 남겨보세요" | 감정 기록하기 |
| F11 clubs | "아직 모임이 없어요. 직접 열어볼까요?" | 모임 만들기 |
| F13 readers | "지금 같이 읽는 독자가 없어요. 혼자 먼저 시작해보세요" | — |
| F18 notifications | "모든 알림을 확인했어요. 편안한 독서 되세요" | — |

## Implementation Priority

| Frame | Priority | 담당 SPEC |
|-------|----------|-----------|
| F01-F02, F03-F05 | High | Phase 1-2 (파운데이션 + 핵심) |
| F06-F10 | High | Phase 2 (감정 핵심 가치) |
| F11-F14 | High | Phase 3 (소셜) |
| F15-F18 | Medium | Phase 4 (참여/유지) |

## Acceptance Criteria

- [ ] 17개 화면 프레임이 Pencil `.pen`에 생성됨
- [ ] 모든 화면이 `$` 변수(tokens.ts 대응)만 사용 — 하드코딩 금지
- [ ] 타이틀 사이즈 앱 전체 균일
- [ ] 탭바(F03/F04/F11/F15) 4개 진입점 캡슐형 일관
- [ ] 빈 상태 5종 F04/F09/F11/F13/F18 구현
- [ ] 스포일러 블러 패턴 F09/F14 일관 (blur 12px)
- [ ] WCAG AA 대비 4.5:1 모든 텍스트 충족

---
_Last updated: 2026-06-14_
_Populated by: 14개 SPEC 카탈로그(INDEX.md) + product.md 기반_
