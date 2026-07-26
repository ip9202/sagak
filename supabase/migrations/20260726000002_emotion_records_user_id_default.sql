-- Migration: emotion_records.user_id DEFAULT auth.uid() 추가
--
-- 배경: emotion_records.user_id 가 NOT NULL 인데 DEFAULT 가 없어,
-- emotionApi(createEmotionRecord) 가 user_id 를 생략(RLS 주입 가정)하면
-- INSERT 가 NOT NULL 위반 또는 RLS INSERT CHECK(auth.uid() = user_id=NULL) 실패로 거부됨.
-- emotionApi 주석은 "DEFAULT(auth.uid())가 있어 생략 허용"이라 했으나 실제 DB엔 누락된 상태.
--
-- 해결: user_id DEFAULT auth.uid() 설정 — 클라이언트 생략 시 서버가 auth.uid()로 채운다.
-- RLS INSERT 정책(WITH CHECK auth.uid() = user_id)과 정합.
--
-- @MX:NOTE: [AUTO] emotion_records.user_id DEFAULT auth.uid() — emotionApi 생략 패턴과 정합. 기존 코드 주석이 DEFAULT 존재를 가정했으나 실제 DB엔 누락되어 있던 회귀.
-- @MX:SPEC SPEC-EMOTION-001

ALTER TABLE public.emotion_records
  ALTER COLUMN user_id SET DEFAULT auth.uid();
