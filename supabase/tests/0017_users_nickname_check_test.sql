-- Users Nickname CHECK Test for SPEC-AUTH-001 hardening M1
-- Migration 00017: users_nickname_format CHECK 제약조건 검증
--
-- 검증 항목:
--   1. CHECK 제약조건 존재 (col_has_check)
--   2. 21자 닉네임 INSERT 실패
--   3. 빈 닉네임 INSERT 실패 (CHECK 위반, char_length=0)
--   4. newline(chr(10)) 포함 닉네임 INSERT 실패
--   5. 유효 1-20자 닉네임 INSERT 성공

BEGIN;
SELECT plan(5);

-- Test 1: nickname 컬럼에 CHECK 제약조건 존재
SELECT col_has_check('public', 'users', 'nickname', 'users.nickname should have CHECK constraint (users_nickname_format)');

-- Test 2: 21자 닉네임은 거부되어야 함 (CHECK 위반, SQLSTATE 23514)
SELECT throws_ok(
    $sql$INSERT INTO public.users (id, email, nickname, provider)
        VALUES (gen_random_uuid(), 'test21@x.com', '123456789012345678901', 'google')$sql$,
    '23514'
);

-- Test 3: 빈 닉네임은 거부되어야 함 (NOT NULL은 통과하지만 CHECK 위반, char_length=0)
SELECT throws_ok(
    $sql$INSERT INTO public.users (id, email, nickname, provider)
        VALUES (gen_random_uuid(), 'testempty@x.com', '', 'google')$sql$,
    '23514'
);

-- Test 4: newline(chr(10)) 포함 닉네임은 거부되어야 함 (C0 제어문자)
SELECT throws_ok(
    $sql$INSERT INTO public.users (id, email, nickname, provider)
        VALUES (gen_random_uuid(), 'testnl@x.com', 'nick' || chr(10) || 'name', 'google')$sql$,
    '23514'
);

-- Test 5: 유효한 1-20자 닉네임은 성공해야 함
SELECT lives_ok(
    $sql$INSERT INTO public.users (id, email, nickname, provider)
        VALUES (gen_random_uuid(), 'testok@x.com', '유효닉네임', 'google')$sql$,
    '1-20자 한글 닉네임은 users_nickname_format CHECK 를 통과해야 함'
);

SELECT * FROM finish();
ROLLBACK;
