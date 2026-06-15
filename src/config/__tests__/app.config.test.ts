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

  it('extra field should contain required Supabase keys', () => {
    const config = require('../../../app.config').default;

    // Verify structure (values will be injected at build time)
    expect(config.extra).toHaveProperty('EXPO_PUBLIC_SUPABASE_URL');
    expect(config.extra).toHaveProperty('EXPO_PUBLIC_SUPABASE_ANON_KEY');
    expect(config.extra).toHaveProperty('EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY');
    expect(config.extra).toHaveProperty('ENV');
  });

  it('extra field should have correct default values', () => {
    const config = require('../../../app.config').default;

    // ENV should default to 'development' when not set
    expect(config.extra.ENV).toBe('development');
  });
});
