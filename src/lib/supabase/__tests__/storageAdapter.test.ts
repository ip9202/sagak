/**
 * 세션 저장소 어댑터 테스트 (REQ-API-002)
 *
 * 인수 시나리오 C2(세션 영속화 설정)의 저장소 계층, 엣지 케이스 3(SecureStore 용량 초과 폴백) 커버.
 */
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  supabaseStorageAdapter,
  __resetFallbackKeysForTesting,
} from '../storageAdapter';

// SecureStore 모킹
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
  WHEN_UNLOCKED: 'WHEN_UNLOCKED',
}));

// AsyncStorage 모킹
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
}));

describe('supabaseStorageAdapter (REQ-API-002)', () => {
  const KEY = 'auth-token';
  const PHYSICAL_KEY = 'sagak.supabase.auth-token';
  const VALUE = '{"access_token":"jwt","refresh_token":"rt"}';

  beforeEach(() => {
    jest.clearAllMocks();
    __resetFallbackKeysForTesting();
  });

  describe('setItem', () => {
    it('SecureStore 에 저장한다 (정상 경로)', async () => {
      (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);

      await supabaseStorageAdapter.setItem(KEY, VALUE);

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        PHYSICAL_KEY,
        VALUE,
        { keychainAccessible: 'WHEN_UNLOCKED' }
      );
      expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    });

    it('SecureStore 용량 초과 시 AsyncStorage 로 폴백한다 (엣지 케이스 3)', async () => {
      const capacityError = new Error('Item exceeds maximum size');
      (SecureStore.setItemAsync as jest.Mock).mockRejectedValue(capacityError);
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      await supabaseStorageAdapter.setItem(KEY, VALUE);

      expect(SecureStore.setItemAsync).toHaveBeenCalledTimes(1);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(PHYSICAL_KEY, VALUE);
    });

    it('용량 외 SecureStore 에러는 폴백 없이 throw 한다', async () => {
      const authError = new Error('Authentication required');
      (SecureStore.setItemAsync as jest.Mock).mockRejectedValue(authError);

      await expect(supabaseStorageAdapter.setItem(KEY, VALUE)).rejects.toThrow(
        'Authentication required'
      );
      expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    });

    it('이미 폴백된 키는 SecureStore 를 건너뛴다', async () => {
      const capacityError = new Error('exceeds capacity');
      (SecureStore.setItemAsync as jest.Mock)
        .mockRejectedValueOnce(capacityError)
        .mockResolvedValue(undefined);
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      // 첫 쓰기 — 폴백 발생
      await supabaseStorageAdapter.setItem(KEY, VALUE);
      // 두 번째 쓰기 — 폴백 상태이므로 SecureStore 미사용
      (SecureStore.setItemAsync as jest.Mock).mockClear();
      await supabaseStorageAdapter.setItem(KEY, 'new-value');

      expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
      expect(AsyncStorage.setItem).toHaveBeenLastCalledWith(
        PHYSICAL_KEY,
        'new-value'
      );
    });
  });

  describe('getItem', () => {
    it('SecureStore 에서 값을 읽는다 (정상 경로)', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(VALUE);

      const result = await supabaseStorageAdapter.getItem(KEY);

      expect(result).toBe(VALUE);
      expect(SecureStore.getItemAsync).toHaveBeenCalledWith(PHYSICAL_KEY);
      expect(AsyncStorage.getItem).not.toHaveBeenCalled();
    });

    it('SecureStore 가 null 반환 시 null 을 그대로 반환한다 (미저장)', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

      const result = await supabaseStorageAdapter.getItem(KEY);

      expect(result).toBeNull();
    });

    it('폴백된 키는 AsyncStorage 에서 읽는다', async () => {
      const capacityError = new Error('too large');
      (SecureStore.setItemAsync as jest.Mock).mockRejectedValue(capacityError);
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('fallback-value');

      // 폴백 상태로 전환
      await supabaseStorageAdapter.setItem(KEY, VALUE);
      (SecureStore.getItemAsync as jest.Mock).mockClear();

      const result = await supabaseStorageAdapter.getItem(KEY);

      expect(SecureStore.getItemAsync).not.toHaveBeenCalled();
      expect(AsyncStorage.getItem).toHaveBeenCalledWith(PHYSICAL_KEY);
      expect(result).toBe('fallback-value');
    });
  });

  describe('removeItem', () => {
    it('SecureStore 에서 삭제한다 (정상 경로)', async () => {
      (SecureStore.deleteItemAsync as jest.Mock).mockResolvedValue(undefined);

      await supabaseStorageAdapter.removeItem(KEY);

      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(PHYSICAL_KEY);
    });

    it('SecureStore 삭제 실패(미존재 포함)는 무시한다', async () => {
      (SecureStore.deleteItemAsync as jest.Mock).mockRejectedValue(
        new Error('not found')
      );

      await expect(
        supabaseStorageAdapter.removeItem(KEY)
      ).resolves.toBeUndefined();
    });

    it('폴백된 키는 양쪽 저장소 모두에서 삭제한다', async () => {
      const capacityError = new Error('exceeds capacity');
      (SecureStore.setItemAsync as jest.Mock).mockRejectedValue(capacityError);
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
      (SecureStore.deleteItemAsync as jest.Mock).mockResolvedValue(undefined);
      (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);

      // 폴백 상태로 전환
      await supabaseStorageAdapter.setItem(KEY, VALUE);

      await supabaseStorageAdapter.removeItem(KEY);

      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(PHYSICAL_KEY);
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(PHYSICAL_KEY);
    });
  });
});
