// Unit + integration tests for Sentry configuration builder and initSentry
// wrapper (REQ-DEPLOY-014/015/017/018)
// SPEC-DEPLOY-001 M3
//
// @sentry/react-native SDK 가 정적 import 로 전환됨에 따라 initSentry 통합 테스트를
// 추가했다. RN 네이티브 초기화는 jest-expo/node 환경에서 실행할 수 없으므로, SDK 의
// 리프 모듈(init)만 mock 하고 buildSentryConfig -> initSentry -> Sentry.init 사슬을
// 실제 initSentry 진입점을 통해 검증한다.

// RN 네이티브 SDK 초기화는 실행 불가 — init 만 mock 한다.
// jest.mock 은 Jest 에 의해 자동으로 호이스팅되지만, 의도를 명확히 문서화하고
// reader 가 import 전에 mock 설정이 적용됨을 인지하도록 파일 최상단에 배치한다.
jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
}));

import {
  buildSentryConfig,
  initSentry,
  SENTRY_DISABLED_DSN,
  type SentryConfigInput,
} from '../sentry';

// 각 테스트마다 mock 호출 기록을 초기화하기 위해 필요한 참조.
// 동적 require 로 mock 이 적용된 모듈을 가져온다.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const SentryMock = require('@sentry/react-native') as { init: jest.Mock };
const mockedInit = SentryMock.init;

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

describe('initSentry integration — REQ-DEPLOY-014 (SDK init 호출 사슬)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('활성화 상태(production + DSN)에서 Sentry.init 을 정확히 한 번 호출한다', async () => {
    await initSentry({
      dsn: 'https://abc@example.com/1',
      env: 'production',
      release: '1.2.3',
    });

    expect(mockedInit).toHaveBeenCalledTimes(1);
    expect(mockedInit).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: 'https://abc@example.com/1',
        environment: 'production',
        release: '1.2.3',
        // SDK 옵션명은 sendDefaultPii(소문자 pii) — src/lib/sentry.ts 참조
        sendDefaultPii: false,
        tracesSampleRate: 0.2,
      })
    );
  });

  it('활성화 상태(development)에서는 tracesSampleRate 가 1.0 으로 전달된다', async () => {
    await initSentry({
      dsn: 'https://abc@example.com/1',
      env: 'development',
      release: '0.0.0-dev',
    });

    expect(mockedInit).toHaveBeenCalledTimes(1);
    expect(mockedInit).toHaveBeenCalledWith(
      expect.objectContaining({
        environment: 'development',
        tracesSampleRate: 1.0,
      })
    );
  });

  it('비활성 상태(DSN 누락 + development)에서는 Sentry.init 을 호출하지 않는다', async () => {
    await initSentry({
      dsn: undefined,
      env: 'development',
      release: '0.0.0-dev',
    });

    expect(mockedInit).not.toHaveBeenCalled();
  });

  it('production 환경에서 DSN 누락 시 buildSentryConfig 의 fail-fast 예외가 initSentry 를 통해 전파된다 (REQ-DEPLOY-018, SDK init 미호출)', async () => {
    // initSentry 는 buildSentryConfig 의 throw 를 catch 하지 않고 그대로 전파한다.
    // 예외 발생 시점이 Sentry.init 호출 이전이므로 mock 은 단 한 번도 호출되지 않는다.
    await expect(
      initSentry({ dsn: undefined, env: 'production', release: '1.0.0' })
    ).rejects.toThrow(/SENTRY_DSN/i);

    expect(mockedInit).not.toHaveBeenCalled();
  });
});
