/**
 * spoilerFilter 단위 테스트 (SPEC-FEED-001 T-A2)
 *
 * 검증 대상 (F7/F8 — 클라이언트 진도 기반 스포일러 판정):
 * - page_number > currentPage → spoiler (currentPage > 0 일 때)
 * - page_number <= currentPage → spoiler 아님
 * - 본인 기록(user_id === viewerUserId) → 항상 spoiler 아님
 * - currentPage === 0 (독서 전) → 타인 기록은 모두 spoiler
 * - page_number null → 0 취급
 *
 * 이 로직은 src/features/emotion/emotionApi.ts listEmotionRecords 의
 * safe/spoiler 분할 규칙(EC-7/EC-8) 과 동일한 의미론을 mirror 한다.
 * 본 테스트는 SPEC-FEED-001 Feed 도메인이 동일 규칙을 독립 순수함수로
 * 재노출하는지 검증한다.
 */
import {
  isSpoilerForRecord,
  mapFeedItems,
} from '../spoilerFilter';
import type { EmotionRecordWithAuthor } from '../../emotion/types';

function buildRecord(
  overrides: Partial<EmotionRecordWithAuthor> = {},
): EmotionRecordWithAuthor {
  return {
    id: 'r1',
    book_id: 'b1',
    user_id: 'u2',
    page_number: 50,
    content: 'c',
    visibility: 'club',
    club_id: 'c1',
    created_at: '2026-06-19T00:00:00Z',
    updated_at: null,
    users: { nickname: '독자', avatar_url: null },
    sticker_reactions: [],
    ...overrides,
  } as EmotionRecordWithAuthor;
}

describe('SPEC-FEED-001 T-A2: isSpoilerForRecord', () => {
  describe('타인 기록 — page_number 기준', () => {
    it('F8: page_number > currentPage → spoiler', () => {
      const rec = buildRecord({ user_id: 'u2', page_number: 120 });
      expect(isSpoilerForRecord(rec, 100, 'u1')).toBe(true);
    });

    it('F8: page_number <= currentPage → spoiler 아님', () => {
      const rec = buildRecord({ user_id: 'u2', page_number: 95 });
      expect(isSpoilerForRecord(rec, 100, 'u1')).toBe(false);
    });

    it('EC-8 경계: page_number == currentPage → spoiler 아님', () => {
      const rec = buildRecord({ user_id: 'u2', page_number: 100 });
      expect(isSpoilerForRecord(rec, 100, 'u1')).toBe(false);
    });

    it('page_number 가 currentPage 보다 1 많으면 spoiler', () => {
      const rec = buildRecord({ user_id: 'u2', page_number: 101 });
      expect(isSpoilerForRecord(rec, 100, 'u1')).toBe(true);
    });
  });

  describe('본인 기록 — 항상 spoiler 아님', () => {
    it('본인 기록은 page_number > currentPage 여도 spoiler 아님', () => {
      const rec = buildRecord({ user_id: 'u1', page_number: 500 });
      expect(isSpoilerForRecord(rec, 10, 'u1')).toBe(false);
    });

    it('본인 기록은 currentPage=0 여도 spoiler 아님', () => {
      const rec = buildRecord({ user_id: 'u1', page_number: 100 });
      expect(isSpoilerForRecord(rec, 0, 'u1')).toBe(false);
    });
  });

  describe('EC-7: currentPage=0 (독서 전) — 타인 기록은 모두 spoiler', () => {
    it('currentPage=0, 타인 page_number=0 → spoiler', () => {
      const rec = buildRecord({ user_id: 'u2', page_number: 0 });
      expect(isSpoilerForRecord(rec, 0, 'u1')).toBe(true);
    });

    it('currentPage=0, 타인 page_number=null → spoiler (null 은 0 취급이지만 타인이므로 spoiler)', () => {
      const rec = buildRecord({ user_id: 'u2', page_number: null });
      expect(isSpoilerForRecord(rec, 0, 'u1')).toBe(true);
    });
  });

  describe('page_number null 처리', () => {
    it('currentPage > 0 일 때 타인 page_number=null → null 을 0 으로 취급 → spoiler 아님', () => {
      const rec = buildRecord({ user_id: 'u2', page_number: null });
      // null → 0, currentPage=50, 0 <= 50 → safe (spoiler 아님)
      expect(isSpoilerForRecord(rec, 50, 'u1')).toBe(false);
    });
  });
});

describe('SPEC-FEED-001 T-A2: mapFeedItems', () => {
  it('각 항목에 isSpoiler 계산 결과를 부여한다', () => {
    const items: EmotionRecordWithAuthor[] = [
      buildRecord({ id: 'safe', user_id: 'u2', page_number: 30 }),
      buildRecord({ id: 'spoil', user_id: 'u3', page_number: 200 }),
      buildRecord({ id: 'mine', user_id: 'u1', page_number: 999 }),
    ];

    const mapped = mapFeedItems(items, 100, 'u1');

    expect(mapped).toHaveLength(3);
    expect(mapped[0].isSpoiler).toBe(false);
    expect(mapped[1].isSpoiler).toBe(true);
    expect(mapped[2].isSpoiler).toBe(false);
  });

  it('원본 id/필드는 보존된다', () => {
    const items: EmotionRecordWithAuthor[] = [
      buildRecord({ id: 'keep-id', content: '원본 내용' }),
    ];

    const [mapped] = mapFeedItems(items, 100, 'u1');
    expect(mapped.id).toBe('keep-id');
    expect(mapped.content).toBe('원본 내용');
  });

  it('빈 배열 입력 → 빈 배열 반환', () => {
    expect(mapFeedItems([], 100, 'u1')).toEqual([]);
  });
});
