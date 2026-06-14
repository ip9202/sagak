# Seed Data

Supabase 생태계의 시드 전략을 따른다. 로컬 개발용 시드는 `supabase/seed.sql`에 보관하며,
`supabase db reset` 실행 시 자동으로 적용된다.

---

## Seed Strategy

Describe the overall approach to creating test and development data.

**Strategy**: hybrid (정적 SQL 시드 + 개발용 팩토리 스크립트)
- 정적 SQL: `supabase/seed.sql` — 결정적 데모 데이터셋(로컬/스테이징)
- 팩토리: Jest 테스트에서 `@faker-js/faker` 기반 팩토리 — 격리된 단위/통합 테스트

**Seeding tool**: Supabase CLI (`supabase/seed.sql` 자동 적용) + 테스트 팩토리(Jest)

**When seeds run**:
- [x] `supabase db reset` / `supabase db push` (로컬 개발)
- [ ] CI before integration tests (별도 테스트 팩토리 사용)
- [ ] Staging environment resets (anonymized snapshot 사용 검토)
- [ ] Other: _TBD_

**Seed order** (FK 제약 준수):

1. `users` 프로필 (Supabase Auth 시드 계정과 매칭)
2. `books` 도서 카탈로그 (Kakao API 캐싱 결과 대용)
3. `reading_records` 독서 기록 (users × books)
4. `clubs` + `club_members` 모임 및 멤버
5. `emotion_shares` 감정 공유 (reading_records 기반)
6. `push_tokens` 알림 토큰 (users 기반)

---

## Fixture Locations

| Environment | Path | Format | Notes |
|-------------|------|--------|-------|
| Development | `supabase/seed.sql` | SQL | 데모 사용자/책/모임 전체 데이터셋, `supabase db reset` 시 자동 적용 |
| Test / CI | `__tests__/factories/` | TypeScript (Jest) | `@faker-js/faker` 기반 격리 팩토리, 데이터베이스 의존 최소화 |
| Staging | _TBD_ | _TBD_ | 익명화된 프로덕션 스냅샷 사용 검토 (감정 데이터 민감도 고려) |

---

## Dev vs Prod Data

**Always seed in dev/test** (안전한 테스트 데이터):

- 가상 사용자 프로필 (`alice@sagak.dev`, `bob@sagak.dev`, 감정 공유 독서 모임 호스트)
- 샘플 도서 10종 (Kakao API 응답 형식의 캐싱 데이터, 실제 ISBN 사용 가능)
- 데모 독서 모임 2~3개 (오너/멤버 역할 포함)
- 진행률 0%/50%/100% 독서 기록 (완독률 로직 검증용)
- 샘플 감정 공유 기록 (과시용 좋아요가 아닌 단순 공유 패턴)
- Expo 테스트 푸시 토큰 (`ExponentPushToken[...]` 형식)

**Never seed in production** (프로덕션에 절대 들어가면 안 되는 데이터):

- `@sagak.dev` / `@example.com` 도메인 이메일
- 하드코딩된 비밀번호 또는 API 키 (Kakao REST API 키 포함)
- 가상 감정 데이터 (프로덕션 감정 분석/완독률 통계 오염)
- Expo 테스트 토큰 (실제 알림 발송 오작동)

**Production data that IS safe to seed** (참조/정적 데이터):

- 기본 알림 템플릿 (다정한 독서 알림, 모임 초대, 공감 반응)
- 시스템 정의 역할 (`owner`, `member`)
- 감정 카테고리/태그 사전 (정적 분류 체계)
- 기능 플래그 정의 (값이 아닌 정의만)
