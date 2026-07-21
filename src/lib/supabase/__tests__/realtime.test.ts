/**
 * Realtime 채널 접근 검증 (REQ-API-003, 인수 시나리오 C4)
 *
 * supabase-js v2 는 channel()/on('postgres_changes', ...)/subscribe() 를
 * 기본 제공한다. 본 테스트는 클라이언트에서 해당 API 가 호출 가능함을 보장한다.
 */
import { getSupabaseClient } from '../client';
import Constants from 'expo-constants';

jest.mock('expo-constants');
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
  WHEN_UNLOCKED: 'WHEN_UNLOCKED',
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
}));

// Realtime 메서드를 갖춘 mock 클라이언트로 createClient 를 대체.
// jest.mock 은 모듈 스코프에서 평가되므로 팩토리 안에서 jest.fn 을 생성한다.
jest.mock('@supabase/supabase-js', () => {
  const channelInstance = {
    on: jest.fn().mockReturnThis(),
    subscribe: jest.fn().mockReturnThis(),
  };
  return {
    createClient: jest.fn(() => ({
      from: jest.fn(),
      channel: jest.fn(() => channelInstance),
    })),
    __channelInstance: channelInstance,
  };
});

describe('Realtime 채널 접근 (REQ-API-003, 시나리오 C4)', () => {
  let channelInstance: {
    on: jest.Mock;
    subscribe: jest.Mock;
  };

  beforeEach(() => {
    (Constants as unknown as { __setMockExtra: (e: Record<string,string>) => void }).__setMockExtra({
      EXPO_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
    });
    const supabaseJs = require('@supabase/supabase-js');
    channelInstance = supabaseJs.__channelInstance;
    channelInstance.on.mockClear();
    channelInstance.subscribe.mockClear();
    supabaseJs.createClient.mockClear();
  });

  afterEach(() => {
    (Constants as unknown as { __clearMockExtra: () => void }).__clearMockExtra();
  });

  it('client.channel(name) 이 채널 객체를 반환한다', () => {
    const client = getSupabaseClient();

    const channel = client.channel('test-channel');

    const { createClient } = require('@supabase/supabase-js');
    const channelFn = createClient.mock.results[0].value.channel;
    expect(channelFn).toHaveBeenCalledWith('test-channel');
    expect(channel).toBeDefined();
    expect(typeof channel.on).toBe('function');
    expect(typeof channel.subscribe).toBe('function');
  });

  it('채널에서 postgres_changes 이벤트를 구독하고 subscribe 할 수 있다', () => {
    const client = getSupabaseClient();
    const channel = client.channel('feed-changes');

    const callback = jest.fn();
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'emotion_records' },
      callback
    );
    channel.subscribe();

    expect(channelInstance.on).toHaveBeenCalledWith(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'emotion_records' },
      callback
    );
    expect(channelInstance.subscribe).toHaveBeenCalledTimes(1);
  });
});
