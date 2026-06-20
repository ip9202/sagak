/**
 * SPEC-NOTIF-001: Expo Push API 호출 로직 단위 테스트 (REQ-NOTIF-012)
 *
 * sendExpoPush 의 응답 분기를 fetch 글로벌 모킹으로 검증:
 * - 정상 발송(ticket.status === 'ok')
 * - Expo 응답 data 배열 형태
 * - HTTP 에러 (res.ok=false)
 * - Expo 에러 (DeviceNotRegistered 등)
 * - 네트워크 예외 (fetch throw → INSERT 유지용 {ok,error})
 */
import { sendExpoPush } from '../expo-push';

const fetchMock = jest.fn();
global.fetch = fetchMock as unknown as typeof fetch;

const INPUT = {
  token: 'ExponentPushToken[abc]',
  notificationId: 'nid-1',
  type: 'sticker_received',
  refId: null,
  title: '제목',
  body: '본문',
};

function okJson(json: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => json,
  } as unknown as Response;
}

beforeEach(() => {
  fetchMock.mockReset();
});

describe('SPEC-NOTIF-001 REQ-NOTIF-012: sendExpoPush', () => {
  it('정상 발송 — 단일 ticket status ok → {ok:true} (N27)', async () => {
    fetchMock.mockResolvedValue(okJson({ data: { status: 'ok', id: 't-1' } }));
    const r = await sendExpoPush(INPUT);
    expect(r).toEqual({ ok: true });
    // 페이로드 구조 (REQ-NOTIF-012)
    const call = fetchMock.mock.calls[0];
    expect(call[0]).toBe('https://exp.host/api/v2/push/send');
    const body = JSON.parse(call[1].body);
    expect(body).toMatchObject({
      to: INPUT.token,
      title: INPUT.title,
      body: INPUT.body,
      sound: 'default',
      _displayInForeground: false,
    });
    expect(body.data).toEqual({
      notification_id: 'nid-1',
      type: 'sticker_received',
      ref_id: null,
    });
  });

  it('Expo 응답 data 배열 형태 — 첫 ticket status ok', async () => {
    fetchMock.mockResolvedValue(
      okJson({ data: [{ status: 'ok', id: 't-1' }] }),
    );
    const r = await sendExpoPush(INPUT);
    expect(r).toEqual({ ok: true });
  });

  it('HTTP 에러 (res.ok=false) → {ok:false, error:http}', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 } as Response);
    const r = await sendExpoPush(INPUT);
    expect(r.ok).toBe(false);
    expect(r.error).toBe('expo_http_500');
  });

  it('Expo 에러 (DeviceNotRegistered) → message 전달 (N29)', async () => {
    fetchMock.mockResolvedValue(
      okJson({
        data: { status: 'error', message: 'DeviceNotRegistered' },
      }),
    );
    const r = await sendExpoPush(INPUT);
    expect(r.ok).toBe(false);
    expect(r.error).toBe('DeviceNotRegistered');
  });

  it('네트워크 예외 (fetch throw) → throw 아닌 {ok:false} (INSERT 유지)', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));
    const r = await sendExpoPush(INPUT);
    expect(r.ok).toBe(false);
    expect(r.error).toBe('network down');
  });

  it('알 수 없는 Expo 응답 → expo_unknown_error', async () => {
    fetchMock.mockResolvedValue(okJson({ data: {} }));
    const r = await sendExpoPush(INPUT);
    expect(r.ok).toBe(false);
    expect(r.error).toBe('expo_unknown_error');
  });
});
