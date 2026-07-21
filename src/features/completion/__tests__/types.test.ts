/**
 * types 단위 테스트 (SPEC-COMPLETION-001, REQ-COMP-004, 시나리오 5/6)
 *
 * 검증 대상:
 * - isReportData: 정상 report_data → true (시나리오 5)
 * - isReportData: total_records 키 누락 → false (시나리오 6 좌)
 * - isReportData: emotion_curve[0].page_number 가 문자열 → false (시나리오 6 우)
 * - isReportData: emotion_curve/highlights 가 배열이 아님 → false
 * - isReportData: highlights[0].content 가 문자열이 아님 → false
 * - isReportData: null / 비객체 → false
 * - 빈 상태(total_records=0 + 빈 배열) → true (데이터 오류와 구분)
 */
import {
  isReportData,
  type ReportData,
  type EmotionCurvePoint,
  type Highlight,
} from '../types';

describe('SPEC-COMPLETION-001 REQ-COMP-004: isReportData 타입 가드', () => {
  it('시나리오 5: 정상 report_data 를 통과시킨다', () => {
    const data: unknown = {
      emotion_curve: [{ page_number: 12, emotion_count: 3 }],
      highlights: [{ page_number: 12, content: '마음이 찡해졌다' }],
      total_records: 47,
    };
    expect(isReportData(data)).toBe(true);
  });

  it('시나리오 5: 파싱 결과 필드값에 접근할 수 있다', () => {
    const data: unknown = {
      emotion_curve: [{ page_number: 12, emotion_count: 3 }],
      highlights: [{ page_number: 12, content: '마음이 찡해졌다' }],
      total_records: 47,
    };
    if (isReportData(data)) {
      const rd: ReportData = data;
      expect(rd.emotion_curve[0].page_number).toBe(12);
      expect(rd.emotion_curve[0].emotion_count).toBe(3);
      expect(rd.highlights[0].content).toBe('마음이 찡해졌다');
      expect(rd.total_records).toBe(47);
    } else {
      throw new Error('should be valid');
    }
  });

  it('시나리오 6 좌: total_records 키가 누락되면 false', () => {
    const data: unknown = { emotion_curve: [], highlights: [] };
    expect(isReportData(data)).toBe(false);
  });

  it('시나리오 6 우: emotion_curve[0].page_number 가 문자열이면 false', () => {
    const data: unknown = {
      emotion_curve: [{ page_number: '12', emotion_count: 3 }],
      highlights: [],
      total_records: 1,
    };
    expect(isReportData(data)).toBe(false);
  });

  it('emotion_curve[0].emotion_count 가 문자열이면 false', () => {
    const data: unknown = {
      emotion_curve: [{ page_number: 1, emotion_count: '3' }],
      highlights: [],
      total_records: 1,
    };
    expect(isReportData(data)).toBe(false);
  });

  it('emotion_curve 가 배열이 아니면 false', () => {
    const data: unknown = {
      emotion_curve: { page_number: 1 },
      highlights: [],
      total_records: 0,
    };
    expect(isReportData(data)).toBe(false);
  });

  it('highlights 가 배열이 아니면 false', () => {
    const data: unknown = {
      emotion_curve: [],
      highlights: 'none',
      total_records: 0,
    };
    expect(isReportData(data)).toBe(false);
  });

  it('highlights[0].content 가 문자열이 아니면 false', () => {
    const data: unknown = {
      emotion_curve: [],
      highlights: [{ page_number: 1, content: 123 }],
      total_records: 1,
    };
    expect(isReportData(data)).toBe(false);
  });

  it('highlights[0].page_number 가 숫자가 아니면 false', () => {
    const data: unknown = {
      emotion_curve: [],
      highlights: [{ page_number: '1', content: 'x' }],
      total_records: 1,
    };
    expect(isReportData(data)).toBe(false);
  });

  it('total_records 가 숫자가 아니면 false', () => {
    const data: unknown = {
      emotion_curve: [],
      highlights: [],
      total_records: '0',
    };
    expect(isReportData(data)).toBe(false);
  });

  it('null 은 false', () => {
    expect(isReportData(null)).toBe(false);
  });

  it('비객체(문자열)는 false', () => {
    expect(isReportData('hello')).toBe(false);
  });

  it('undefined 는 false', () => {
    expect(isReportData(undefined)).toBe(false);
  });

  it('빈 상태(total_records=0 + 빈 배열)는 true (데이터 오류와 구분)', () => {
    const data: unknown = {
      emotion_curve: [],
      highlights: [],
      total_records: 0,
    };
    expect(isReportData(data)).toBe(true);
  });

  it('다중 포인트/다중 하이라이트 정상 케이스', () => {
    const curve: EmotionCurvePoint[] = [
      { page_number: 1, emotion_count: 2 },
      { page_number: 5, emotion_count: 5 },
      { page_number: 10, emotion_count: 1 },
    ];
    const highs: Highlight[] = [
      { page_number: 1, content: '첫인상' },
      { page_number: 5, content: '절정' },
    ];
    const data: unknown = {
      emotion_curve: curve,
      highlights: highs,
      total_records: 8,
    };
    expect(isReportData(data)).toBe(true);
  });
});
