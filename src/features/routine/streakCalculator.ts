/**
 * streak 계산 순수 함수 (SPEC-ROUTINE-001 REQ-ROUT-009)
 *
 * 미결정 6.1 임시방침: 자정(local timezone) 기준.
 * "오늘 세션 종료 여부 → 어제 → ..." 역순 검사로 streak 계산.
 * 하루라도 세션이 없으면 streak=0 으로 리셋.
 *
 * @MX:NOTE: [AUTO] 자정 기준은 YYYY-MM-DD(로컬 tz) 비교. UTC 자정이 아님 — v1.1.0 에서 24시간 윈도우 검토.
 * @MX:SPEC SPEC-ROUTINE-001
 */

/**
 * YYYY-MM-DD(로컬 tz) 문자열을 반환한다.
 */
function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * ended_at ISO 문자열 배열에서 streak(연속 독서 일수) 를 계산한다.
 *
 * @param endedAts 종료된 세션의 ended_at ISO 문자열 배열. null/빈문자열은 무시.
 * @param now 기준 시각 (테스트 주입용). 기본 new Date().
 * @returns streak 일수 (오늘이 없으면 0)
 */
export function calculateStreak(
  endedAts: Array<string | null | undefined>,
  now: Date = new Date(),
): number {
  const validDates = new Set<string>();
  for (const raw of endedAts) {
    if (!raw) continue;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) continue;
    validDates.add(toLocalDateString(d));
  }

  if (validDates.size === 0) return 0;

  let streak = 0;
  const cursor = new Date(now);
  // 오늘부터 역순 검사. 오늘 세션이 없으면 바로 0.
  while (true) {
    const key = toLocalDateString(cursor);
    if (validDates.has(key)) {
      streak += 1;
      // 하루 전으로
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}
