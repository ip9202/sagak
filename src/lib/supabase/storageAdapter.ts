/**
 * Supabase 세션 저장소 어댑터 (REQ-API-002)
 *
 * @supabase/supabase-js 의 auth.storage 인터페이스(getItem/setItem/removeItem)를 구현한다.
 * 우선순위: SecureStore(iOS Keychain / Android Keystore) → AsyncStorage 폴백.
 *
 * 분기 기준:
 * - setItem: SecureStore.setItemAsync 시도. 용량 초과(iOS Keychain ~2KB) 등 실패하면
 *   AsyncStorage.setItem 으로 폴백. 폴백 결과는 내부 Set 에 기록해 이후 getItem/removeItem 이
 *   올바른 저장소를 향하도록 한다.
 * - getItem: 폴백 기록이 있으면 AsyncStorage, 아니면 SecureStore 에서 읽는다.
 *   SecureStore 미스는 null(미저장)과 구분하기 위해 에러를 그대로 던진다.
 * - removeItem: 양쪽 저장소에서 모두 삭제(폴백 여부와 무관하게 안전 삭제).
 *
 * 보안: service_role 키는 본 어댑터에서 다루지 않는다(anon_key 도 auth.storage 가 내부 처리).
 */
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * SecureStore 키 접두사. 다른 앱 데이터와 충돌을 피하기 위해 네임스페이스를 둔다.
 */
const KEY_PREFIX = 'sagak.supabase.';

/**
 * SecureStore 용량 초과 등 폴백을 유발하는 에러 메시지 패턴.
 * iOS Keychain errSecMemoryError / NSMallocException 계열과 일반 capacity 메시지를 포괄.
 */
const SECURESTORE_CAPACITY_PATTERNS: readonly RegExp[] = [
  /exceed/i,
  /too large/i,
  /capacity/i,
  /memory/i,
  /quota/i,
  /size/i,
];

/**
 * 폴백된 키를 추적하는 내부 상태.
 * 모듈 싱글톤이므로 앱 수명 주기 동안 유지된다.
 */
const fallbackKeys: Set<string> = new Set();

/**
 * SecureStore 에러가 용량/사이즈 초과로 폴백 대상인지 판별한다.
 * 폴백 가능하면 true, 그 외(인증 거부 등)는 false.
 */
function isCapacityError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : '';
  if (!message) return false;
  return SECURESTORE_CAPACITY_PATTERNS.some((re) => re.test(message));
}

/**
 * 어댑터에 전달된 원본 키를 SecureStore 물리 키로 변환한다.
 */
function toSecureStoreKey(key: string): string {
  return `${KEY_PREFIX}${key}`;
}

/**
 * REQ-API-002: Supabase auth.storage 호환 어댑터.
 *
 * 인터페이스 계약 (@supabase/supabase-js 가 호출):
 * - getItem(key): Promise<string | null>
 * - setItem(key, value): Promise<void>
 * - removeItem(key): Promise<void>
 *
 * 동작 요약:
 * 1. setItem → SecureStore 우선. 실패 시 AsyncStorage 폴백.
 * 2. getItem → 폴백 기록이 있으면 AsyncStorage, 아니면 SecureStore.
 * 3. removeItem → 양쪽 모두에서 삭제(누락 방지).
 */
export const supabaseStorageAdapter = {
  /**
   * 키에 해당하는 세션 값을 읽는다.
   * SecureStore 미저장(null)은 정상 상태이므로 그대로 null 반환.
   * SecureStore 접근 자체 실패(에러 throw)는 UNKNOWN 에러로 상위에 전달.
   */
  async getItem(key: string): Promise<string | null> {
    const physicalKey = toSecureStoreKey(key);

    if (fallbackKeys.has(key)) {
      return AsyncStorage.getItem(physicalKey);
    }

    try {
      return await SecureStore.getItemAsync(physicalKey);
    } catch (error) {
      // SecureStore 접근 실패는 정상 동작이 아님 — 명확한 에러로 전달.
      throw error;
    }
  },

  /**
   * 키에 세션 값을 저장한다.
   * SecureStore 용량 초과 시 AsyncStorage 로 폴백 후 폴백 집합에 기록.
   * 그 외 SecureStore 에러는 재시도 불가로 판단해 그대로 throw.
   */
  async setItem(key: string, value: string): Promise<void> {
    const physicalKey = toSecureStoreKey(key);

    // 이미 폴백된 키는 곧바로 AsyncStorage 사용.
    if (fallbackKeys.has(key)) {
      await AsyncStorage.setItem(physicalKey, value);
      return;
    }

    try {
      await SecureStore.setItemAsync(physicalKey, value, {
        // 백그라운드 토큰 갱신 시 사용자 인증 프롬프트가 떠선 안 된다.
        keychainAccessible: SecureStore.WHEN_UNLOCKED,
      });
    } catch (error) {
      if (!isCapacityError(error)) {
        throw error;
      }
      // 용량 초과 폴백 — AsyncStorage 저장 후 추적.
      await AsyncStorage.setItem(physicalKey, value);
      fallbackKeys.add(key);
    }
  },

  /**
   * 키를 삭제한다. 폴백 여부와 무관하게 양쪽 저장소에서 안전하게 삭제한다.
   */
  async removeItem(key: string): Promise<void> {
    const physicalKey = toSecureStoreKey(key);
    const wasFallback = fallbackKeys.has(key);

    // SecureStore 삭제는 무조건 시도(폴백 전에 쓰였을 수도 있음).
    // 삭제 실패(미존재 포함)는 무시한다.
    try {
      await SecureStore.deleteItemAsync(physicalKey);
    } catch {
      // 미존재 키 삭제는 no-op 로 간주.
    }

    if (wasFallback) {
      await AsyncStorage.removeItem(physicalKey);
      fallbackKeys.delete(key);
    }
  },
};

/**
 * 테스트 전용: 폴백 추적 상태 초기화.
 * 프로덕션 코드에서는 호출하지 않는다.
 */
export function __resetFallbackKeysForTesting(): void {
  fallbackKeys.clear();
}
