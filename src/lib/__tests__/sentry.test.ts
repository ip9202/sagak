// Unit tests for Sentry configuration builder (REQ-DEPLOY-014/015/017/018)
// SPEC-DEPLOY-001 M3
//
// NOTE: @sentry/react-native SDK is not installed at authoring time.
// We test the pure configuration builder (buildSentryConfig) which the
// real initSentry() wrapper will consume once the SDK is added. This keeps
// TDD discipline without forcing a runtime dependency mid-session.
import {
  buildSentryConfig,
  SENTRY_DISABLED_DSN,
  type SentryConfigInput,
} from '../sentry';

describe('Sentry configuration (SPEC-DEPLOY-001 M3)', () => {
  describe('buildSentryConfig — REQ-DEPLOY-014 (init) + REQ-DEPLOY-015 (env separation)', () => {
    it('production 환경은 production environment 태그로 설정한다 (REQ-DEPLOY-015)', () => {
      const input: SentryConfigInput = {
        dsn: 'https://abc@example.com/1',
        env: 'production',
        release: '1.0.0',
      };

      const config = buildSentryConfig(input);

      expect(config.environment).toBe('production');
      expect(config.enabled).toBe(true);
      expect(config.dsn).toBe('https://abc@example.com/1');
    });

    it('development 환경은 development environment 태그로 분리한다 (REQ-DEPLOY-015)', () => {
      const config = buildSentryConfig({
        dsn: 'https://abc@example.com/1',
        env: 'development',
        release: '1.0.0',
      });

      expect(config.environment).toBe('development');
    });

    it('staging 환경은 staging environment 태그로 분리한다 (REQ-DEPLOY-015)', () => {
      const config = buildSentryConfig({
        dsn: 'https://abc@example.com/1',
        env: 'staging',
        release: '1.0.0',
      });

      expect(config.environment).toBe('staging');
    });

    it('release 문자열을 Sentry release 필드에 매핑한다 (릴리즈 트래킹 준비)', () => {
      const config = buildSentryConfig({
        dsn: 'https://abc@example.com/1',
        env: 'production',
        release: '1.2.3',
      });

      expect(config.release).toBe('1.2.3');
    });

    it('알 수 없는 환경 값은 development로 폴백한다 (안전 기본값)', () => {
      const config = buildSentryConfig({
        dsn: 'https://abc@example.com/1',
        env: 'unknown-env' as SentryConfigInput['env'],
        release: '1.0.0',
      });

      expect(config.environment).toBe('development');
    });
  });

  describe('buildSentryConfig — REQ-DEPLOY-018 (fail-fast on missing DSN in production)', () => {
    it('production 환경에서 DSN이 빈 문자열이면 에러를 던진다 (fail-fast)', () => {
      expect(() =>
        buildSentryConfig({ dsn: '', env: 'production', release: '1.0.0' })
      ).toThrow(/SENTRY_DSN/i);
    });

    it('production 환경에서 DSN이 undefined면 에러를 던진다 (fail-fast)', () => {
      expect(() =>
        buildSentryConfig({
          dsn: undefined,
          env: 'production',
          release: '1.0.0',
        })
      ).toThrow(/SENTRY_DSN/i);
    });

    it('development 환경에서 DSN이 누락되면 비활성화 상태로 폴백한다 (dev tolerance)', () => {
      const config = buildSentryConfig({
        dsn: '',
        env: 'development',
        release: '1.0.0',
      });

      // dev tolerance: 크래시 리포팅 비활성화, 빌드/실행은 계속
      expect(config.enabled).toBe(false);
      expect(config.dsn).toBe(SENTRY_DISABLED_DSN);
    });

    it('staging 환경에서 DSN이 누락되면 비활성화 상태로 폴백한다 (dev tolerance)', () => {
      const config = buildSentryConfig({
        dsn: undefined,
        env: 'staging',
        release: '1.0.0',
      });

      expect(config.enabled).toBe(false);
    });
  });

  describe('buildSentryConfig — REQ-DEPLOY-017 (소스맵은 빌드 시점에만, 번들 미포함은 빌드 설정 담당)', () => {
    it('production 환경은 sendDefaultPII=false 로 PII 누출을 방지한다', () => {
      const config = buildSentryConfig({
        dsn: 'https://abc@example.com/1',
        env: 'production',
        release: '1.0.0',
      });

      // @MX:NOTE: [AUTO] PII 보호 — 프로덕션에서 사용자 개인정보 자동 전송 금지
      expect(config.sendDefaultPII).toBe(false);
    });

    it('프로덕션 환경에서는 tracesSampleRate가 0보다 크다 (성능 모니터링 활성)', () => {
      const config = buildSentryConfig({
        dsn: 'https://abc@example.com/1',
        env: 'production',
        release: '1.0.0',
      });

      expect(config.tracesSampleRate).toBeGreaterThan(0);
    });

    it('development 환경에서는 tracesSampleRate가 1.0 (전수 샘플링)', () => {
      const config = buildSentryConfig({
        dsn: 'https://abc@example.com/1',
        env: 'development',
        release: '1.0.0',
      });

      expect(config.tracesSampleRate).toBe(1.0);
    });
  });
});
