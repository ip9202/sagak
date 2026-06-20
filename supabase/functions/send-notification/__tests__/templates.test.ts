/**
 * SPEC-NOTIF-001: 알림 템플릿 시스템 단위 테스트 (REQ-NOTIF-013)
 *
 * acceptance 시나리오 N30-N33 검증:
 * - N30: reading_reminder 템플릿 변수 치환
 * - N31: sticker_received 템플릿
 * - N32: completion 템플릿 (숫자 변수 포함)
 * - N33: 변수 누락 시 graceful degradation (에러 없음)
 * - 강압적 마감 톤 미포함 검증
 */
import { buildTemplate } from '../templates';
import type { NotificationType } from '../logic';

describe('SPEC-NOTIF-001 REQ-NOTIF-013: 알림 템플릿 (6종, 다정한 톤)', () => {
  describe('N30: reading_reminder 템플릿', () => {
    it('book_title/page 변수 치환', () => {
      const c = buildTemplate('reading_reminder', {
        book_title: '데미안',
        page: 42,
      });
      expect(c.title).toBe('오늘의 첫 페이지가 당신을 기다리고 있어요');
      expect(c.body).toBe('데미안의 42페이지, 살짝 펼쳐볼까요?');
    });
  });

  describe('N31: sticker_received 템플릿', () => {
    it('reactor_nickname/sticker_type 변수 치환', () => {
      const c = buildTemplate('sticker_received', {
        reactor_nickname: '책벌레',
        sticker_type: 'empathy',
      });
      expect(c.title).toBe('당신의 기록에 공감 스티커가 도착했어요');
      expect(c.body).toBe('책벌레님이 empathy 반응을 남겼어요');
    });
  });

  describe('N32: completion 템플릿 (숫자 변수)', () => {
    it('book_title/total_records 변수 치환', () => {
      const c = buildTemplate('completion', {
        book_title: '데미안',
        total_records: 15,
      });
      expect(c.title).toBe('완독을 축하해요! 당신만의 다이어리가 완성됐어요');
      expect(c.body).toBe("'데미안'과의 여정, 15개의 감정 기록이 모였어요");
    });
  });

  describe('나머지 type 템플릿', () => {
    it('join_request_received', () => {
      const c = buildTemplate('join_request_received', {
        requester_nickname: '독자',
        club_title: '데미안 독서모임',
      });
      expect(c.title).toBe('같은 책을 읽는 누군가가 함께 읽자고 했어요');
      expect(c.body).toContain('독자님이');
      expect(c.body).toContain('데미안 독서모임');
    });

    it('join_accepted', () => {
      const c = buildTemplate('join_accepted', { club_title: '모임A' });
      expect(c.body).toContain('모임A');
    });

    it('club_signal', () => {
      const c = buildTemplate('club_signal', { signal_count: 3 });
      expect(c.body).toBe('3명이 함께 읽고 있어요');
    });
  });

  describe('N33: 변수 누락 시 graceful degradation', () => {
    it('data 가 null 이어도 에러 없이 콘텐츠 반환', () => {
      expect(() => buildTemplate('reading_reminder', null)).not.toThrow();
      const c = buildTemplate('reading_reminder', null);
      expect(c.title).toBe('오늘의 첫 페이지가 당신을 기다리고 있어요');
      // 누락 변수는 빈 문자열로 치환 (에러 아님)
      expect(c.body).toBe('의 페이지, 살짝 펼쳐볼까요?');
    });

    it('data 가 빈 객체여도 에러 없음', () => {
      expect(() => buildTemplate('completion', {})).not.toThrow();
    });
  });

  describe('다정한 톤 정책 (강압적 마감 금지)', () => {
    const types: NotificationType[] = [
      'reading_reminder',
      'join_request_received',
      'join_accepted',
      'sticker_received',
      'completion',
      'club_signal',
    ];
    it.each(types)('%s 템플릿에 강압적 마감 톤 미포함', (t) => {
      const c = buildTemplate(t, null);
      const text = `${c.title} ${c.body}`;
      expect(text).not.toMatch(/지금 읽지 않으면|안 읽으면|빨리|마감|당장/i);
    });
  });
});
