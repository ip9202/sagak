/**
 * pickCurrentBook 단위 테스트 (SPEC-LIBRARY-001 — 홈 "지금 읽는 책" 정렬 fix)
 *
 * 검증 대상:
 * - 홈 CurrentBook 후보를 updated_at DESC 기준으로 선택한다.
 * - last_progress_at=null 인 신규 reading 책이 updated_at 최신이면 [0]이 된다.
 *   (기존 버그: last_progress_at DESC 정렬 시 null 이 밀려 홈에 안 뜸)
 * - 빈 리스트 → undefined 반환 (빈 상태 분기용).
 *
 * @jest-environment node
 */
import type { LibraryItem } from '../types';
import { pickCurrentBook } from '../pickCurrentBook';

/** 최소 필드만 채운 LibraryItem 팩토리 (테스트 가독성). */
function makeItem(overrides: Partial<LibraryItem>): LibraryItem {
  return {
    id: overrides.id ?? 'ub-x',
    book_id: overrides.book_id ?? 'b-x',
    user_id: overrides.user_id ?? 'u-1',
    status: overrides.status ?? 'reading',
    current_page: overrides.current_page ?? 0,
    is_public: overrides.is_public ?? true,
    last_progress_at: overrides.last_progress_at ?? null,
    created_at: overrides.created_at ?? '2026-06-01T00:00:00Z',
    updated_at: overrides.updated_at ?? '2026-06-01T00:00:00Z',
    books: overrides.books ?? null,
  } as LibraryItem;
}

describe('SPEC-LIBRARY-001 홈 CurrentBook 선택: pickCurrentBook (updated_at DESC)', () => {
  it('빈 리스트면 undefined 를 반환한다', () => {
    expect(pickCurrentBook([])).toBeUndefined();
  });

  it('단일 항목이면 그 항목을 반환한다', () => {
    const only = makeItem({ id: 'ub-1' });
    expect(pickCurrentBook([only])).toBe(only);
  });

  // 핵심 회귀 시나리오: 신규 reading 전환 책(last_progress_at=null)이
  // updated_at 최신이면 홈 [0] 이 되어야 한다.
  it('last_progress_at=null 인 신규 책이 updated_at 최신이면 선택된다', () => {
    const oldProgress = makeItem({
      id: 'ub-old',
      last_progress_at: '2026-06-28T11:34:00Z',
      updated_at: '2026-06-28T11:34:00Z',
    });
    const newReading = makeItem({
      id: 'ub-new',
      last_progress_at: null,
      updated_at: '2026-06-29T12:17:00Z',
    });
    // 입력 순서가 바뀌어도 결과 동일 (순서 무관성)
    expect(pickCurrentBook([oldProgress, newReading])).toBe(newReading);
    expect(pickCurrentBook([newReading, oldProgress])).toBe(newReading);
  });

  it('last_progress_at DESC 입력 순서라도 updated_at 기준으로 재선택한다', () => {
    // DB 실측 데이터 재현: 넥서스(progress 최신), 불편한 편의점(updated_at 최신 but progress null)
    const nexus = makeItem({
      id: 'ub-nexus',
      last_progress_at: '2026-06-28T11:34:00Z',
      updated_at: '2026-06-28T11:34:00Z',
      books: { id: 'b-nexus', title: '넥서스', author: 'a', cover_url: null, total_pages: 400 },
    });
    const unhappy = makeItem({
      id: 'ub-unhappy',
      last_progress_at: null,
      updated_at: '2026-06-29T12:17:00Z',
      books: {
        id: 'b-unhappy',
        title: '불편한 편의점',
        author: 'b',
        cover_url: null,
        total_pages: 300,
      },
    });
    const result = pickCurrentBook([nexus, unhappy]);
    expect(result).toBe(unhappy);
  });

  it('updated_at 동일하면 입력 순서를 유지한다 (안정 선택)', () => {
    const a = makeItem({ id: 'ub-a', updated_at: '2026-06-29T10:00:00Z' });
    const b = makeItem({ id: 'ub-b', updated_at: '2026-06-29T10:00:00Z' });
    expect(pickCurrentBook([a, b])).toBe(a);
  });
});
