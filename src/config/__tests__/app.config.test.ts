/**
 * app.config.ts structure verification
 * Verifies that app.config.ts exports the correct structure for environment injection
 *
 * IMPORTANT: app.config.ts is evaluated at BUILD TIME by Metro bundler.
 * This test verifies the structure, not runtime behavior.
 * Runtime access is tested in env.test.ts
 *
 * app.config.ts 는 함수 패턴 ({ config }) => ({ ...config, extra }) 을 사용하므로
 * 테스트에서는 ConfigContext 를 주입해 호출한 결과를 검증한다. app.json 의 expo
 * 를 베이스로 넘겨 빌드 시 평가 결과를 재현한다.
 */

// app.config.ts default 는 ConfigContext 를 받아 ExpoConfig 를 반환하는 함수.
function loadConfig() {
  const appConfig = require('../../../app.config').default;
  const { expo } = require('../../../app.json');
  return appConfig({ config: { ...expo } });
}

describe('app.config.ts Structure (REQ-API-017)', () => {
  it('app.config.ts should export default config with extra field', () => {
    const config = loadConfig();

    expect(config).toBeDefined();
    expect(config.extra).toBeDefined();
    expect(typeof config.extra).toBe('object');
  });

  it('extra field should contain required Supabase keys (URL + ANON_KEY) but NOT service_role (REQ-API-016 보안)', () => {
    const config = loadConfig();

    // 클라이언트 번들에 필요한 키만 extra 에 존재해야 한다.
    expect(config.extra).toHaveProperty('EXPO_PUBLIC_SUPABASE_URL');
    expect(config.extra).toHaveProperty('EXPO_PUBLIC_SUPABASE_ANON_KEY');
    expect(config.extra).toHaveProperty('ENV');

    // service_role 키는 RLS 를 우회하므로 절대 extra 에 주입되면 안 된다.
    expect(config.extra).not.toHaveProperty('EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY');
    expect(config.extra).not.toHaveProperty('SUPABASE_SERVICE_ROLE_KEY');
  });

  it('extra field should have correct default values', () => {
    const config = loadConfig();

    // ENV should default to 'development' when not set
    expect(config.extra.ENV).toBe('development');
  });
});
