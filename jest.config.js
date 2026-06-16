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
  testMatch: ['**/__tests__/**/*.test.{ts,tsx}'],
};
