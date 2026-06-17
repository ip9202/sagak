/**
 * 단어 질문지 정적 풀 + 라운드 로빈 선택기 (SPEC-EMOTION-001 T-008)
 *
 * REQ-EMO-005: 감정 기록 입력 시 1~2개의 짧은 질문 프롬프트를 제안한다.
 * 강제가 아니며 자유 입력을 허용한다 (시나리오 2.2).
 *
 * MVP 전략 (미결정 5.1 임시 방침): 진도 구간 매핑 없이 정적 풀(5개) 라운드 로빈.
 * v1.1.0 에서 진도 구간 매핑 도입 예정.
 *
 * @MX:NOTE: [AUTO] 정적 풀 — 외부 의존성 없음. EmotionInputScreen 이 seed(currentPage 등) 로 호출한다.
 * @MX:SPEC SPEC-EMOTION-001
 */

/**
 * 감정 기록 유도 질문 정적 풀 (한국어).
 * 입력 장벽을 낮추기 위한 힌트용 — 사용자는 무시하고 자유 입력 가능.
 */
export const QUESTION_PROMPTS: readonly string[] = [
  '이 페이지에서 멈춘 문장은?',
  '지금 가장 크게 와닿은 감정은?',
  '주인공의 선택, 어떻게 생각하나요?',
  '오늘 읽은 부분 중 가장 기억에 남는 장면은?',
  '이 문장이 왜 마음에 닿았을까요?',
] as const;

export interface SelectPromptArgs {
  /** 현재 진도 (향후 진도 구간 매핑용, 현재 미사용) */
  currentPage: number;
  /** 총 페이지 (향후 진도 구간 매핑용, 현재 미사용) */
  totalPages: number;
  /** 라운드 로빈 시드 — 보통 currentPage 또는 기록 인덱스. 동일 seed → 동일 프롬프트. */
  seed: number;
}

/**
 * seed 기반 라운드 로빈으로 프롬프트 1개를 선택한다.
 * 동일 seed 는 항상 동일 프롬프트를 반환한다 (결정적, 화면 재진입 시 일관성).
 * 진도 구간 매핑은 v1.1.0 연기로 현재 seed modulo 만 사용한다.
 */
export function selectPrompt(args: SelectPromptArgs): string {
  const index = ((args.seed % QUESTION_PROMPTS.length) + QUESTION_PROMPTS.length) % QUESTION_PROMPTS.length;
  return QUESTION_PROMPTS[index];
}
