// Jest global setup.
// @testing-library/react-native v13+ provides matchers automatically;
// the legacy 'extend-expect' subpath import was removed and breaks resolution.

// AsyncStorage mock for React Native environment
import '@react-native-async-storage/async-storage/jest/async-storage-mock';

// jest-dom matchers for web testing
import '@testing-library/jest-dom';
