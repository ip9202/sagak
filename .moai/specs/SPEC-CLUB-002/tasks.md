# SPEC-CLUB-002 M1-M3 작업 목록

## 블로커 (사용자 결정 필요)

- [x] **M2 진도 동기화 스키마 부재**: 해결됨 — 마이그레이션 `20240618000006_add_club_reading_plan_columns.sql` 로 clubs 진도 컬럼 추가 + dev Supabase 적용 + gen-types 재생성 완료.

## M1: 모임 생성 API (clubApi.ts)
- [x] types.ts: gen-types 기반 ClubRow/ClubMemberRow/ClubInsert + 도메인 타입
- [x] RED: createClub 테스트 (type='group' 강제, host_id 주입, name 매핑)
- [x] GREEN: createClub 구현
- [x] RED: verifyHostMembership 테스트 (트리거 동작 관측)
- [x] GREEN: verifyHostMembership 구현
- [x] RED: getClubDetail 테스트
- [x] GREEN: getClubDetail 구현

## M2: 진도 동기화 API (progressApi.ts)
- [x] RED: updateProgress 테스트 — host UPDATE 성공 (S13), 부분 업데이트, null 초기화
- [x] RED: 비host RLS 거부 테스트 (S14, 42501 → RLS_DENIED)
- [x] RED: 입력 검증 테스트 (S15, 음수/비정수 → VALIDATION, 0 허용)
- [x] RED: closed 모임 차단 테스트 (S16, status='closed' → VALIDATION)
- [x] GREEN: updateProgress 구현 + validateProgressField 헬퍼
- [x] REFACTOR: M1/M3 패턴 일관성 점검, types.ts 주석 정정

## M3: 참가자·상태 관리 API (memberApi.ts)
- [x] RED: getClubMembers 테스트
- [x] GREEN: getClubMembers 구현
- [x] RED: closeClub / reactivateClub 테스트
- [x] GREEN: closeClub / reactivateClub 구현
- [x] RED: leaveClub 테스트 (본인 탈퇴)
- [x] GREEN: leaveClub 구현

## 공통
- [x] index.ts barrel export (M1+M2+M3)
- [x] tsc --noEmit exit 0
- [x] npm test 전체 통과 (821)
- [x] npm run lint clean
