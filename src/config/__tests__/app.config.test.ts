/**
 * app.config.ts structure verification
 * Verifies that app.config.ts exports the correct structure for environment injection
 *
 * IMPORTANT: app.config.ts is evaluated at BUILD TIME by Metro bundler.
 * This test verifies the structure, not runtime behavior.
 * Runtime access is tested in env.test.ts
 */
describe('app.config.ts Structure (REQ-API-017)', () => {
  it('app.config.ts should export default config with extra field', () => {
    // Verify file exists and can be imported
    const config = require('../../../app.config').default;

    expect(config).toBeDefined();
    expect(config.extra).toBeDefined();
    expect(typeof config.extra).toBe('object');
  });

  it('extra field should contain required Supabase keys (URL + ANON_KEY) but NOT service_role (REQ-API-016 보안)', () => {
    const config = require('../../../app.config').default;

    // 클라이언트 번들에 필요한 키만 extra 에 존재해야 한다.
    expect(config.extra).toHaveProperty('EXPO_PUBLIC_SUPABASE_URL');
    expect(config.extra).toHaveProperty('EXPO_PUBLIC_SUPABASE_ANON_KEY');
    expect(config.extra).toHaveProperty('ENV');

    // service_role 키는 RLS 를 우회하므로 절대 extra 에 주입되면 안 된다.
    expect(config.extra).not.toHaveProperty('EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY');
    expect(config.extra).not.toHaveProperty('SUPABASE_SERVICE_ROLE_KEY');
  });

  it('extra field should have correct default values', () => {
    const config = require('../../../app.config').default;

    // ENV should default to 'development' when not set
    expect(config.extra.ENV).toBe('development');
  });
});
