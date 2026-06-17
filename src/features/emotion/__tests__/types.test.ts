/**
 * types 단위 테스트 (SPEC-EMOTION-001 T-001)
 *
 * 검증 대상:
 * - Visibility 리터럴 좁히기 ('public' | 'club')
 * - EmotionRecordRow 가 DB Row 파생
 * - EmotionRecordWithAuthor 작성자 조인 + 스티커 집계 포함
 * - StickerAggregate 형태 { sticker_type, count }
 * - CreateEmotionInput / UpdateEmotionInput 구조
 * - page_number null 허용 (Row)
 */
import type {
  Visibility,
  EmotionRecordRow,
  EmotionRecordWithAuthor,
  StickerAggregate,
  CreateEmotionInput,
  UpdateEmotionInput,
  EmotionSortOption,
} from '../types';
import type { StickerType } from '../../../types';

describe('SPEC-EMOTION-001 T-001: emotion 도메인 타입', () => {
  it('Visibility 는 public | club 리터럴만 허용한다', () => {
    const pub: Visibility = 'public';
    const club: Visibility = 'club';
    expect([pub, club]).toEqual(['public', 'club']);
  });

  it('EmotionRecordRow 는 DB Row 의 모든 컬럼을 포함한다', () => {
    const row: EmotionRecordRow = {
      id: 'r1',
      book_id: 'b1',
      user_id: 'u1',
      page_number: 95,
      content: '멈췄다',
      visibility: 'public',
      club_id: null,
      created_at: '2026-06-17T00:00:00Z',
      updated_at: null,
    };
    expect(row.id).toBe('r1');
    expect(row.page_number).toBe(95);
  });

  it('page_number 는 null 을 허용한다 (DB Row nullable)', () => {
    const row: EmotionRecordRow = {
      id: 'r2',
      book_id: 'b1',
      user_id: 'u1',
      page_number: null,
      content: 'x',
      visibility: 'public',
      club_id: null,
      created_at: '2026-06-17T00:00:00Z',
      updated_at: null,
    };
    expect(row.page_number).toBeNull();
  });

  it('StickerAggregate 는 sticker_type + count 형태다', () => {
    const agg: StickerAggregate = { sticker_type: 'empathy', count: 3 };
    expect(agg.count).toBe(3);
  });

  it('EmotionRecordWithAuthor 는 row + users 조인 + sticker 집계를 포함한다', () => {
    const record: EmotionRecordWithAuthor = {
      id: 'r1',
      book_id: 'b1',
      user_id: 'u1',
      page_number: 95,
      content: 'c',
      visibility: 'public',
      club_id: null,
      created_at: '2026-06-17T00:00:00Z',
      updated_at: null,
      users: { nickname: '독자', avatar_url: null },
      sticker_reactions: [
        { sticker_type: 'empathy', count: 2 },
        { sticker_type: 'touching', count: 1 },
      ],
    };
    expect(record.users?.nickname).toBe('독자');
    expect(record.sticker_reactions).toHaveLength(2);
  });

  it('CreateEmotionInput 은 user_id 를 포함하지 않는다 (RLS 자동 주입)', () => {
    const input: CreateEmotionInput = {
      bookId: 'b1',
      pageNumber: 95,
      content: '멈췄다',
      visibility: 'public',
      clubId: null,
    };
    expect(input).not.toHaveProperty('userId');
    expect(input).not.toHaveProperty('user_id');
  });

  it('CreateEmotionInput 의 clubId 는 club 가시성 시 필요하다 (타입 수준)', () => {
    const input: CreateEmotionInput = {
      bookId: 'b1',
      pageNumber: 95,
      content: 'c',
      visibility: 'club',
      clubId: 'club-1',
    };
    expect(input.visibility).toBe('club');
    expect(input.clubId).toBe('club-1');
  });

  it('UpdateEmotionInput 은 content/visibility/clubId 만 허용한다 (page_number/user_id/book_id 고정)', () => {
    const patch: UpdateEmotionInput = {
      content: '수정',
      visibility: 'club',
      clubId: 'c1',
    };
    expect(patch).not.toHaveProperty('pageNumber');
    expect(patch).not.toHaveProperty('bookId');
    expect(patch).not.toHaveProperty('userId');
  });

  it('EmotionSortOption 은 time | page 리터럴이다', () => {
    const time: EmotionSortOption = 'time';
    const page: EmotionSortOption = 'page';
    expect([time, page]).toEqual(['time', 'page']);
  });

  it('StickerType 은 empathy/touching/comforted 이다 (src/types 재사용)', () => {
    const t: StickerType = 'comforted';
    expect(t).toBe('comforted');
  });
});
