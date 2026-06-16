module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native|expo|@expo|react-navigation))',
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleFileExtensions: ['ts', 'tsx', 'js'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    'supabase/functions/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.{ts,tsx}',
    '!supabase/functions/**/__tests__/**',
    '!supabase/functions/**/index.ts',
  ],
  testMatch: ['**/__tests__/**/*.test.{ts,tsx}'],
};
