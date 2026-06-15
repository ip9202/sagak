-- SPEC-AUTH-001 후속 hardening M1: 닉네임 서버측 CHECK 제약조건
-- Migration: 0017_users_nickname_check
-- Entity: users.nickname
-- 배경: 클라이언트(src/auth/onboarding.tsx NICKNAME_MAX_LENGTH=20) 검증은
--       변조 가능하므로, DB 계층에서 닉네임 길이/문자 무결성을 강제한다.
--       RLS + 파라미터화 쿼리가 이미 인젝션을 막으므로, 본 제약은
--       데이터 무결성 및 UI/UX 손상 방지(레이아웃 깨짐, 피드 조작)가 목적이다.
--
-- idempotent: ADD CONSTRAINT 는 IF NOT EXISTS 미지원이므로
--             DO 블록에서 존재 여부 확인 후 추가 (재실행 안전).

-- 1. 닉네임 CHECK 제약조건 추가
--    - 길이: 1~20자 (char_length, 문자 단위)
--    - C0 제어문자(U+0000~U+001F) 및 DEL(U+007F) 거부
--    - C1 제어문자(U+0080~U+009F) 거부
--    - Zero-width / 방향 제어 / BOM 특수문자 거부
--      (U+200B ZWSP, U+200C ZWNJ, U+200D ZWJ, U+2060 WJ,
--       U+202E RLO, U+202D LRO, U+200E LRM, U+200F RLM, U+FEFF BOM/ZWNBSP)
--
--    참고: chr() 기반 position()=0 검사를 사용하여 PostgreSQL 15+ UTF-8에서
--          정규식 escape 모호성(\xNN, \uXXXX) 없이 안전하게 멀티바이트 문자를 거부한다.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'users_nickname_format'
          AND conrelid = 'public.users'::regclass
    ) THEN
        ALTER TABLE public.users
            ADD CONSTRAINT users_nickname_format CHECK (
                -- 길이 제한 (1~20자, 문자 단위)
                char_length(nickname) BETWEEN 1 AND 20
                -- C0 제어문자(U+0000~U+001F) 및 DEL(U+007F) 거부
                AND nickname !~ ('[' || chr(0) || '-' || chr(31) || chr(127) || ']')
                -- C1 제어문자(U+0080~U+009F) 거부
                AND nickname !~ ('[' || chr(128) || '-' || chr(159) || ']')
                -- Zero-width / 방향 제어 / BOM 특수문자 거부 (position()=0 은 미포함 의미)
                AND position(chr(8203) IN nickname) = 0  -- U+200B Zero-Width Space
                AND position(chr(8204) IN nickname) = 0  -- U+200C Zero-Width Non-Joiner
                AND position(chr(8205) IN nickname) = 0  -- U+200D Zero-Width Joiner
                AND position(chr(8288) IN nickname) = 0  -- U+2060 Word Joiner
                AND position(chr(8238) IN nickname) = 0  -- U+202E Right-to-Left Override
                AND position(chr(8237) IN nickname) = 0  -- U+202D Left-to-Right Override
                AND position(chr(8206) IN nickname) = 0  -- U+200E Left-to-Right Mark
                AND position(chr(8207) IN nickname) = 0  -- U+200F Right-to-Left Mark
                AND position(chr(65279) IN nickname) = 0 -- U+FEFF BOM / Zero-Width No-Break Space
            );
    END IF;
END;
$$;

-- 2. handle_new_user 트리거 함수 교체 (CRITICAL)
--    배경: 기존 함수가 nickname 기본값으로 split_part(NEW.email,'@',1)을 사용하는데,
--          이메일 localpart가 20자를 초과하면 위 CHECK 제약을 위반하여
--          OAuth 신규 가입이 전체적으로 실패하게 된다.
--    해결: left(..., 20) 로 잘라낸다. 사용자가 raw_user_id_data 로 넘긴 nickname도 동일 처리.
--    주의: 트리거는 악의적 입력(제어문자 포함 nickname)을 정제하지 않는다.
--          제어문자가 포함된 입력은 CHECK 위반으로 가입이 실패하는 것이 의도된 동작이다.
--          (이메일 localpart는 일반적으로 제어문자/zero-width를 포함하지 않는다.)
--    기존 트리거(on_auth_user_created)는 auth.users 에 이미 연결되어 있으므로
--    함수만 CREATE OR REPLACE 하면 자동으로 새 본문이 호출된다.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.users (id, email, nickname, avatar_url, provider)
    VALUES (
        NEW.id,
        NEW.email,
        -- 기본 닉네임을 20자로 잘라 CHECK 제약 위반 방지 (SPEC-AUTH-001 hardening M1)
        left(COALESCE(NEW.raw_user_id_data->>'nickname', split_part(NEW.email, '@', 1)), 20),
        NEW.raw_user_id_data->>'avatar_url',
        NEW.raw_user_id_data->>'provider'
    );
    RETURN NEW;
END;
$$;

COMMENT ON CONSTRAINT users_nickname_format ON public.users IS
    'SPEC-AUTH-001 hardening M1: 닉네임 1~20자 길이 + 제어문자/zero-width/RTL/BOM 거부 (클라이언트 검증 우회 방어)';
