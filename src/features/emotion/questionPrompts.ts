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
  '다음엔 어떤 부분이 궁금해졌나요?',
  '주인공과 나, 어떤 점이 달랐나요?',
  '이 대목에서 멈춰 생각해본 적 있나요?',
  '읽으면서 떠오른 사람이 있었나요?',
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

/**
 * 무작위 프롬프트를 반환한다.
 * React 컴포넌트에서 useState(() => getRandomPrompt()) 로 마운트 시 1회 호출하면
 * 화면 진입마다 다른 프롬프트가 표시되면서도 입력 중에는 유지된다.
 * (render 시마다 호출하면 입력 중 질문이 바뀌는 문제가 있으니 마운트 1회만 호출.)
 *
 * @MX:NOTE: [AUTO] REQ-EMO-005 확장 — 페이지 고정(seed) 대신 매 진입마다 무작위 제안. selectPrompt(결정적)는 테스트/일관성 경로로 유지.
 */
export function getRandomPrompt(): string {
  const index = Math.floor(Math.random() * QUESTION_PROMPTS.length);
  return QUESTION_PROMPTS[index];
}
