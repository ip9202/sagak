// Manual mock for expo-constants
// Used in tests to simulate environment variables

let mockExtra: Record<string, string> = {};

export default {
  expoConfig: {
    get extra() {
      return mockExtra;
    },
  },
  // Helper functions for tests
  __setMockExtra: (extra: Record<string, string>) => {
    mockExtra = { ...extra };
  },
  __clearMockExtra: () => {
    mockExtra = {};
  },
};
