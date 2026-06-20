/**
 * SPEC-NOTIF-001: 알림 템플릿 시스템 (6종 type, 다정한 톤) — REQ-NOTIF-013
 *
 * 각 type 별로 title/body 를 생성한다. data 변수를 치환하며,
 * 변수 누락 시 graceful degradation (빈 문자열 치환, 에러 발생 금지 — acceptance N33).
 *
 * 톤 정책 (product.md 시나리오 1, pages_03 5.1.2):
 * - 다정한 권유 / 따봉 / 축하 톤만 허용
 * - 강압적 마감 톤 ("지금 읽지 않으면...") 금지
 *
 * 순수 로직 모듈 — Deno 글로벌 미사용, jest 단위 테스트 대상.
 *
 * @MX:SPEC SPEC-NOTIF-001
 */
import type { NotificationType } from './logic';

/** 템플릿이 생성하는 알림 콘텐츠 */
export interface NotificationContent {
  title: string;
  body: string;
}

type TemplateFn = (data: Record<string, unknown> | null) => NotificationContent;

/**
 * data 에서 키 값을 문자열로 추출한다.
 * - 누락/undefined/null → 빈 문자열 (graceful degradation, acceptance N33)
 * - 숫자/불린 → String() 변환 (page, total_records, signal_count 등)
 */
function val(data: Record<string, unknown> | null, key: string): string {
  const v = data?.[key];
  if (v === undefined || v === null) return '';
  return String(v);
}

/**
 * SPEC-NOTIF-001 REQ-NOTIF-013 템플릿 매핑 (6종).
 * @MX:ANCHOR: [AUTO] 6종 알림 문구 단일 진실 — product.md 시나리오 1 톤 준수
 * @MX:REASON: 다정한 톤은 제품 정체성(따뜻한 독서 격려)이므로 강압적 마감 톤으로 훼손 불가.
 */
const TEMPLATES: Record<NotificationType, TemplateFn> = {
  reading_reminder: (d) => ({
    title: '오늘의 첫 페이지가 당신을 기다리고 있어요',
    body: `${val(d, 'book_title')}의 ${val(d, 'page')}페이지, 살짝 펼쳐볼까요?`,
  }),
  join_request_received: (d) => ({
    title: '같은 책을 읽는 누군가가 함께 읽자고 했어요',
    body: `${val(d, 'requester_nickname')}님이 '${val(d, 'club_title')}' 모임에서 함께 읽자고 제안했어요`,
  }),
  join_accepted: (d) => ({
    title: '모임에 합류했어요! 이제 함께 읽어요',
    body: `'${val(d, 'club_title')}' 모임의 일원이 되었어요`,
  }),
  sticker_received: (d) => ({
    title: '당신의 기록에 공감 스티커가 도착했어요',
    body: `${val(d, 'reactor_nickname')}님이 ${val(d, 'sticker_type')} 반응을 남겼어요`,
  }),
  completion: (d) => ({
    title: '완독을 축하해요! 당신만의 다이어리가 완성됐어요',
    body: `'${val(d, 'book_title')}'과의 여정, ${val(d, 'total_records')}개의 감정 기록이 모였어요`,
  }),
  club_signal: (d) => ({
    title: '지금 같이 읽는 독자가 있어요',
    body: `${val(d, 'signal_count')}명이 함께 읽고 있어요`,
  }),
};

/**
 * type 에 해당하는 템플릿을 적용해 title/body 를 생성한다.
 * 변수 누락 시에도 에러 없이 빈 문자열로 치환된 콘텐츠를 반환한다 (acceptance N33).
 */
export function buildTemplate(
  type: NotificationType,
  data: Record<string, unknown> | null,
): NotificationContent {
  return TEMPLATES[type](data ?? null);
}
