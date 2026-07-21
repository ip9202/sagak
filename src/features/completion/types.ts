/**
 * 완독 다이어리 도메인 타입 (SPEC-COMPLETION-001)
 *
 * DB completion_reports.report_data(jsonb) 의 클라이언트 도메인 모델.
 * report_data 는 gen-types 에서 Json(unknown) 으로 생성되므로 런타임 검증이 필요하다.
 * 본 모듈은 의존성 없는 순수 타입 가드 isReportData() 만 제공한다 (Zod 미사용, REQ-COMP-004).
 *
 * 계약 (SPEC-DB-001 트리거 PL/pgSQL 산출물과 1:1 일치):
 * - emotion_curve: [{ page_number, emotion_count }] — 페이지별 감정 기록 수
 * - highlights: [{ page_number, content }] — 최근 기록 최대 5건
 * - total_records: 전체 감정 기록 수
 *
 * @MX:SPEC SPEC-COMPLETION-001
 */

/**
 * 감정 곡선 단일 포인트 (REQ-COMP-006).
 * page_number: 페이지 번호, emotion_count: 해당 페이지 감정 기록 수.
 */
export interface EmotionCurvePoint {
  page_number: number;
  emotion_count: number;
}

/**
 * 하이라이트 단일 항목 (REQ-COMP-007).
 * page_number: 페이지 번호, content: 기록 내용.
 * 감정 종류 필드는 존재하지 않는다 (DB 스키마상 없음).
 */
export interface Highlight {
  page_number: number;
  content: string;
}

/**
 * completion_reports.report_data 파싱 결과 (REQ-COMP-004/005).
 */
export interface ReportData {
  emotion_curve: EmotionCurvePoint[];
  highlights: Highlight[];
  total_records: number;
}

/**
 * unknown 값이 배열인지 확인하는 헬퍼.
 */
function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

/**
 * unknown 값이 EmotionCurvePoint 인지 확인한다.
 */
function isEmotionCurvePoint(value: unknown): value is EmotionCurvePoint {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.page_number === 'number' &&
    typeof v.emotion_count === 'number'
  );
}

/**
 * unknown 값이 Highlight 인지 확인한다.
 */
function isHighlight(value: unknown): value is Highlight {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.page_number === 'number' &&
    typeof v.content === 'string'
  );
}

/**
 * 순수 타입 가드: unknown 값이 ReportData 스키마와 일치하는지 검증한다 (REQ-COMP-004).
 *
 * 의존성이 없고 부작용이 없는 순수 함수. 스키마 불일치 시 false 반환.
 * 호출자(completionApi.fetchReport) 가 false 를 AppError(category=VALIDATION) 로 변환한다.
 * 빈 상태(total_records=0 + 빈 배열) 도 유효 스키마로 통과시킨다 (빈 상태와 데이터 오류 구분).
 *
 * @MX:NOTE: [AUTO] 빈 상태(total_records=0, 빈 배열)와 스키마 불일치를 구분한다 — 둘 다 isReportData 통과 여부로 판별하며, 빈 상태는 에러가 아니다.
 * @MX:SPEC SPEC-COMPLETION-001
 */
export function isReportData(value: unknown): value is ReportData {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (!isArray(v.emotion_curve)) return false;
  if (!isArray(v.highlights)) return false;
  if (typeof v.total_records !== 'number') return false;
  if (!v.emotion_curve.every(isEmotionCurvePoint)) return false;
  if (!v.highlights.every(isHighlight)) return false;
  return true;
}
