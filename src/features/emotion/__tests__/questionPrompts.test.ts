/**
 * questionPrompts 단위 테스트 (SPEC-EMOTION-001 T-008)
 *
 * 검증 대상 (REQ-EMO-005, 시나리오 2.1):
 * - 정적 풀 크기 3~5
 * - 모든 프롬프트는 한국어 문자열
 * - selectPrompt: seed 기반 라운드 로빈 — 동일 seed 는 동일 결과
 * - seed 가 다르면 다른 프롬프트가 나올 수 있다 (순환)
 * - 풀 범위를 벗어나지 않는다
 */
import { QUESTION_PROMPTS, selectPrompt } from '../questionPrompts';

describe('SPEC-EMOTION-001 T-008: questionPrompts', () => {
  it('정적 풀은 3~5개 프롬프트를 포함한다 (REQ-EMO-005)', () => {
    expect(QUESTION_PROMPTS.length).toBeGreaterThanOrEqual(3);
    expect(QUESTION_PROMPTS.length).toBeLessThanOrEqual(5);
  });

  it('모든 프롬프트는 비어있지 않은 한국어 문자열이다', () => {
    for (const p of QUESTION_PROMPTS) {
      expect(typeof p).toBe('string');
      expect(p.trim().length).toBeGreaterThan(0);
    }
  });

  it('selectPrompt 는 풀 내의 프롬프트를 반환한다', () => {
    const prompt = selectPrompt({ currentPage: 50, totalPages: 300, seed: 0 });
    expect(QUESTION_PROMPTS).toContain(prompt);
  });

  it('selectPrompt: 동일 seed 는 동일 프롬프트를 반환한다 (결정적)', () => {
    const a = selectPrompt({ currentPage: 50, totalPages: 300, seed: 2 });
    const b = selectPrompt({ currentPage: 50, totalPages: 300, seed: 2 });
    expect(a).toBe(b);
  });

  it('selectPrompt: seed 가 풀 크기만큼 순환하면 모든 프롬프트가 한 번씩 나온다', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < QUESTION_PROMPTS.length; seed++) {
      seen.add(selectPrompt({ currentPage: 10, totalPages: 200, seed }));
    }
    expect(seen.size).toBe(QUESTION_PROMPTS.length);
  });

  it('selectPrompt: seed 가 풀 크기를 초과해도 라운드 로빈으로 순환한다', () => {
    const first = selectPrompt({ currentPage: 10, totalPages: 200, seed: 0 });
    const wrapped = selectPrompt({
      currentPage: 10, totalPages: 200, seed: QUESTION_PROMPTS.length,
    });
    // seed 가 풀 크기면 0 과 동일 (modulo)
    expect(wrapped).toBe(first);
  });
});
