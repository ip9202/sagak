/**
 * build-time 환경변수 검증 (validateEnv) 단위 테스트
 * SPEC-DEPLOY-001 M1 — 환경변수 파운데이션
 * REQ-DEPLOY-003 / AC-DEPLOY-018: production 빌드 시 누락된 필수 키를 전부 나열하며 fail-fast.
 *
 * 기존 env.test.ts 는 런타임 접근자(getEnvVar)를 검증한다.
 * 이 파일은 app.config.ts 빌드 시점에 호출되는 validateEnv(env, envName) 을 검증한다.
 */
import { validateEnv, MissingEnvError, REQUIRED_PROD } from '../env';

describe('validateEnv (SPEC-DEPLOY-001 M1, REQ-DEPLOY-003)', () => {
  describe('production 환경 검증 (fail-fast)', () => {
    it('RED-1: ENV=development 에서는 필수 키가 누락되어도 예외를 던지지 않는다 (dev tolerance)', () => {
      const env = {}; // 모든 키 누락

      expect(() => validateEnv(env, 'development')).not.toThrow();
    });

    it('RED-2: ENV=production 에서 모든 필수 키가 존재하면 예외를 던지지 않는다', () => {
      const env = {
        EXPO_PUBLIC_SUPABASE_URL: 'https://prod.supabase.co',
        EXPO_PUBLIC_SUPABASE_ANON_KEY: 'prod-anon-key',
      };

      expect(() => validateEnv(env, 'production')).not.toThrow();
    });

    it('RED-3: ENV=production 에서 여러 필수 키가 누락되면 누락된 키 전체를 메시지에 나열한다 (AC-DEPLOY-018)', () => {
      const env = {}; // 전부 누락

      try {
        validateEnv(env, 'production');
        fail('예외가 던져져야 합니다');
      } catch (e) {
        expect(e).toBeInstanceOf(MissingEnvError);
        const msg = (e as Error).message;
        // REQUIRED_PROD 의 모든 키가 메시지에 포함되어야 한다.
        for (const key of REQUIRED_PROD) {
          expect(msg).toContain(key);
        }
      }
    });
  });
});
