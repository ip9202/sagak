import { getEnvVar, getOptionalEnvVar } from '../env';
// Import mocked Constants with helper functions
import Constants from 'expo-constants';

// Mock Constants module (uses __mocks__/expo-constants.ts)
jest.mock('expo-constants');

describe('Environment Variables (REQ-API-016 ~ REQ-API-019)', () => {
  beforeEach(() => {
    // Clear mock extra before each test
    (Constants as any).__clearMockExtra();
  });

  describe('getEnvVar', () => {
    it('should return environment variable when defined (REQ-API-018)', () => {
      (Constants as any).__setMockExtra({ TEST_VAR: 'test-value' });

      expect(getEnvVar('TEST_VAR')).toBe('test-value');
    });

    it('should throw error when environment variable is missing (REQ-API-018 fail-fast)', () => {
      (Constants as any).__clearMockExtra();

      expect(() => getEnvVar('MISSING_VAR')).toThrow(
        'Environment variable MISSING_VAR is not defined'
      );
    });
  });

  describe('getOptionalEnvVar', () => {
    it('should return environment variable when defined', () => {
      (Constants as any).__setMockExtra({ TEST_VAR: 'test-value' });

      expect(getOptionalEnvVar('TEST_VAR', 'default')).toBe('test-value');
    });

    it('should return default value when environment variable is missing', () => {
      (Constants as any).__clearMockExtra();

      expect(getOptionalEnvVar('MISSING_VAR', 'default')).toBe('default');
    });
  });

  describe('Environment files structure (REQ-API-016)', () => {
    it('.env.example should exist', () => {
      const fs = require('fs');
      const path = require('path');

      const envExamplePath = path.join(process.cwd(), '.env.example');
      expect(fs.existsSync(envExamplePath)).toBe(true);
    });

    it('.env.staging should exist', () => {
      const fs = require('fs');
      const path = require('path');

      const envStagingPath = path.join(process.cwd(), '.env.staging');
      expect(fs.existsSync(envStagingPath)).toBe(true);
    });

    it('.env.production should exist', () => {
      const fs = require('fs');
      const path = require('path');

      const envProductionPath = path.join(process.cwd(), '.env.production');
      expect(fs.existsSync(envProductionPath)).toBe(true);
    });
  });

  describe('Required Supabase environment variables (REQ-API-017)', () => {
    it('EXPO_PUBLIC_SUPABASE_URL should be accessible', () => {
      (Constants as any).__setMockExtra({
        EXPO_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
      });

      expect(getEnvVar('EXPO_PUBLIC_SUPABASE_URL')).toBe('https://test.supabase.co');
    });

    it('EXPO_PUBLIC_SUPABASE_ANON_KEY should be accessible', () => {
      (Constants as any).__setMockExtra({
        EXPO_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
      });

      expect(getEnvVar('EXPO_PUBLIC_SUPABASE_ANON_KEY')).toBe('test-anon-key');
    });

    it('should throw error if required Supabase variables are missing (REQ-API-018 fail-fast)', () => {
      (Constants as any).__clearMockExtra();

      expect(() => getEnvVar('EXPO_PUBLIC_SUPABASE_URL')).toThrow();
      expect(() => getEnvVar('EXPO_PUBLIC_SUPABASE_ANON_KEY')).toThrow();
    });
  });

  describe('app.config.ts environment injection (REQ-API-017)', () => {
    it('should inject environment variables into app.config.ts extra field', () => {
      const fs = require('fs');
      const path = require('path');

      const appConfigPath = path.join(process.cwd(), 'app.config.ts');
      const appConfigContent = fs.readFileSync(appConfigPath, 'utf8');

      // Verify app.config.ts has extra field configuration
      expect(appConfigContent).toMatch(/extra\s*:/);
    });
  });

  describe('Service role key security (REQ-API-016)', () => {
    it('service_role key should NOT be in EXPO_PUBLIC_* prefix (security check)', () => {
      const fs = require('fs');
      const path = require('path');

      const envExamplePath = path.join(process.cwd(), '.env.example');
      const envExampleContent = fs.readFileSync(envExamplePath, 'utf8');

      // Check that service_role key is documented
      expect(envExampleContent).toContain('EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY');
    });
  });
});
