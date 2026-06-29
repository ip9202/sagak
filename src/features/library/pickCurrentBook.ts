/**
 * 홈 "지금 읽는 책" 선택 규칙 (SPEC-LIBRARY-001 정책 5.2 fix)
 *
 * 홈 CurrentBook 은 updated_at DESC 기준 첫 항목을 선택한다.
 * - 새로 reading 상태로 전환/추가한 책은 진행 기록이 없어 last_progress_at=null 이지만,
 *   updated_at 이 최신이므로 홈 [0] 으로 노출되어야 한다 (사용자 기대).
 * - 서재 화면(LibraryScreen) 정렬은 last_progress_at DESC 를 유지 — 홈과 분리.
 *
 * @MX:ANCHOR: [AUTO] 홈 CurrentBook 선택 규칙의 단일 진실 원천 (fan_in: 홈 index.tsx + 본 테스트).
 * @MX:REASON: last_progress_at DESC 정렬이 신규 reading 책(null)을 홈에서 밀어내는 버그 회귀 방지. 정책 5.2 홈/서재 분리 규칙이 여기에 캡슐화된다.
 * @MX:SPEC SPEC-LIBRARY-001
 */
import type { LibraryItem } from './types';

/**
 * updated_at DESC 기준으로 홈 CurrentBook 후보를 선택한다.
 * 빈 리스트면 undefined 반환 (홈 빈 상태 분기용).
 *
 * @param list - useLibrary({status:'reading'}) 결과
 * @returns updated_at 이 가장 최신인 항목 (동순위면 입력 순서 첫 항목)
 */
export function pickCurrentBook(
  list: LibraryItem[] | undefined | null,
): LibraryItem | undefined {
  if (!list || list.length === 0) return undefined;
  // reduce 로 안정적 최대값 선택 — 동순위(updated_at 동일) 시 첫 항목 유지.
  return list.reduce((best, cur) =>
    cur.updated_at > best.updated_at ? cur : best,
  );
}
