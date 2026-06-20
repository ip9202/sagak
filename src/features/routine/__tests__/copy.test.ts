/**
 * copy 단위 테스트 (SPEC-ROUTINE-001 REQ-ROUT-004)
 *
 * 검증 대상:
 * - R9/R10/R21/R23: 다정한 메시지 상수 값
 * - pickEndEncouragement: duration 에 따른 메시지 선택
 *
 * 강제적/의무적 표현이 포함되지 않았는지도 검증 (톤앤매너 준수).
 */
import {
  START_PROMPT,
  END_ENCOURAGEMENT,
  END_ENCOURAGEMENT_SHORT,
  STREAK_ACHIEVEMENT,
  GOAL_ACHIEVED,
  INVALID_TIME_FORMAT,
  pickEndEncouragement,
} from '../copy';

// 강제적 표현 키워드 — product.md 비목표. 카피에 등장하면 안 됨.
const FORBIDDEN_PATTERNS = [/하세요$/, /해야 합니/, /반드시/, /의무/];

describe('SPEC-ROUTINE-001 REQ-ROUT-004: copy constants', () => {
  const ALL_COPIES = [
    ['START_PROMPT', START_PROMPT],
    ['END_ENCOURAGEMENT', END_ENCOURAGEMENT],
    ['END_ENCOURAGEMENT_SHORT', END_ENCOURAGEMENT_SHORT],
    ['STREAK_ACHIEVEMENT', STREAK_ACHIEVEMENT],
    ['GOAL_ACHIEVED', GOAL_ACHIEVED],
    ['INVALID_TIME_FORMAT', INVALID_TIME_FORMAT],
  ] as const;

  it.each(ALL_COPIES)('%s 는 빈 문자열이 아니다', (_name, value) => {
    expect(value.length).toBeGreaterThan(0);
  });

  it.each(ALL_COPIES)('%s 는 강제적/의무적 표현을 포함하지 않는다', (_name, value) => {
    for (const pattern of FORBIDDEN_PATTERNS) {
      expect(value).not.toMatch(pattern);
    }
  });

  it('R10: START_PROMPT 는 "오늘의 첫 페이지가 당신을 기다리고 있어요"', () => {
    expect(START_PROMPT).toBe('오늘의 첫 페이지가 당신을 기다리고 있어요');
  });

  it('R9: END_ENCOURAGEMENT 는 "오늘도 한 페이지, 잘 읽으셨어요"', () => {
    expect(END_ENCOURAGEMENT).toBe('오늘도 한 페이지, 잘 읽으셨어요');
  });

  it('R21: STREAK_ACHIEVEMENT 는 발자취 언급', () => {
    expect(STREAK_ACHIEVEMENT).toContain('발자취');
  });
});

describe('SPEC-ROUTINE-001 REQ-ROUT-004: pickEndEncouragement', () => {
  it('duration null → 기본 격려 메시지', () => {
    expect(pickEndEncouragement(null)).toBe(END_ENCOURAGEMENT);
  });

  it('duration undefined → 기본 격려 메시지', () => {
    expect(pickEndEncouragement(undefined)).toBe(END_ENCOURAGEMENT);
  });

  it('짧은 세션(<300초) → 짧은 세션 격려 메시지', () => {
    expect(pickEndEncouragement(120)).toBe(END_ENCOURAGEMENT_SHORT);
  });

  it('5분(300초) 경계 → 기본 메시지', () => {
    expect(pickEndEncouragement(300)).toBe(END_ENCOURAGEMENT);
  });

  it('긴 세션(1800초) → 기본 격려 메시지', () => {
    expect(pickEndEncouragement(1800)).toBe(END_ENCOURAGEMENT);
  });
});
