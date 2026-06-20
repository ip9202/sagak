/**
 * 다정한 메시지 카피 상수 (SPEC-ROUTINE-001 REQ-ROUT-004).
 *
 * product.md 시나리오 1 톤앤매너 준수:
 * - 강제적/의무적 표현 금지 ("~하세요", "~해야 합니다")
 * - 부드러운 겨려와 동기부여
 * - 비경쟁 원칙: 좋아요/팔로워/랭킹 표현 없음 (SPEC-UI-002 FROZEN)
 *
 * @MX:NOTE: [AUTO] 모든 카피는 product.md 시나리오 1 기준. 강제 톤 변경 금지.
 * @MX:SPEC SPEC-ROUTINE-001
 */

/**
 * 세션 시작 유도 메시지 (REQ-ROUT-004 WHERE).
 * 활성 세션이 없을 때 타이머 화면에 표시.
 */
export const START_PROMPT = '오늘의 첫 페이지가 당신을 기다리고 있어요' as const;

/**
 * 세션 종료 격려 메시지 (REQ-ROUT-004 WHEN).
 * 세션 종료 후 표시. duration_seconds 에 따라 변형.
 */
export const END_ENCOURAGEMENT = '오늘도 한 페이지, 잘 읽으셨어요' as const;

/**
 * 짧은 세션(5분 미만) 종료 시 격려 메시지.
 * 짧게라도 펼친 용기를 다정하게 인정.
 */
export const END_ENCOURAGEMENT_SHORT =
  '잠깐이라도 책을 펼친 용기가 예뻐요' as const;

/**
 * streak 달성 메시지 (REQ-ROUT-009 WHEN).
 * streak 증가 시 표시 가능. 발자취가 예쁘다는 다정한 표현.
 */
export const STREAK_ACHIEVEMENT =
  '며칠째 책과 함께하는군요. 당신의 발자취가 예뻐요' as const;

/**
 * 일일 목표 달성 축하 메시지 (REQ-ROUT-010).
 * 목표 도달 시 가볍게 닿았다는 다정한 표현.
 */
export const GOAL_ACHIEVED = '오늘의 목표, 가볍게 닿았네요. 수고했어요' as const;

/**
 * 시간 형식 오류 안내 메시지 (REQ-ROUT-005 — 잘못된 형식 거부 시).
 */
export const INVALID_TIME_FORMAT = '올바른 시간 형식이 아닙니다' as const;

/**
 * 세션 종료 후 duration 에 따라 다정한 격려 메시지를 선택한다.
 * 짧은 세션(<300초=5분)은 별도 메시지로 용기를 인정한다.
 *
 * @param durationSeconds 세션 지속 시간(초). null/undefined 시 기본 메시지.
 */
export function pickEndEncouragement(durationSeconds: number | null | undefined): string {
  if (durationSeconds === null || durationSeconds === undefined) {
    return END_ENCOURAGEMENT;
  }
  if (durationSeconds < 300) {
    return END_ENCOURAGEMENT_SHORT;
  }
  return END_ENCOURAGEMENT;
}
