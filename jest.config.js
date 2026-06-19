module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native|expo|@expo|react-navigation))',
  ],
  // @MX:NOTE: [AUTO] expo-camera 를 테스트 전용 mock 으로 매핑 (실제 네이티브 카메라 불가)
  moduleNameMapper: {
    '^expo-camera$': '<rootDir>/src/features/book/__tests__/__mocks__/expo-camera.tsx',
  },
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
  // @MX:NOTE: [AUTO] AC-DEPLOY-009 PR 품질 게이트용 글로벌 커버리지 하한선 (80%). 2026-06-19 측정 기준.
  // @MX:REASON: 측정된 베이스라인(Stmts 92.15% / Branches 84.38% / Funcs 96.16% / Lines 93.68%)이 모두 80% 초과하여 안전 적용.
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 80,
      functions: 80,
      lines: 80,
    },
  },
  testMatch: ['**/__tests__/**/*.test.{ts,tsx}'],
};
