// Jest global setup.
// @testing-library/react-native v13+ provides matchers automatically;
// the legacy 'extend-expect' subpath import was removed and breaks resolution.

// AsyncStorage mock for React Native environment
import '@react-native-async-storage/async-storage/jest/async-storage-mock';

// jest-dom matchers for web testing
import '@testing-library/jest-dom';

// react-native-safe-area-context mock — SPEC-UI-002 REQ-SCREEN-001 상단 SafeArea 처리 도입으로
// 모든 테스트 렌더가 SafeAreaProvider 컨텍스트 없이 useSafeAreaInsets 호출 가능하도록 글로벌 mock.
// insets.top/bottom/left/right = 0 (단위 테스트에서는 실제 기기 인셋 불필요).
jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const RN = require('react-native');

  const inset = { top: 0, bottom: 0, left: 0, right: 0 };

  const SafeAreaProvider = ({ children }) => children;
  const SafeAreaView = RN.View;
  const SafeAreaConsumer = ({ children }) => children(inset);
  const SafeAreaFrameContext = React.createContext({ x: 0, y: 0, width: 0, height: 0 });
  const SafeAreaInsetsContext = React.createContext(inset);

  return {
    SafeAreaProvider,
    SafeAreaView,
    SafeAreaConsumer,
    SafeAreaFrameContext,
    SafeAreaInsetsContext,
    useSafeAreaFrame: () => React.useContext(SafeAreaFrameContext),
    useSafeAreaInsets: () => inset,
    initialWindowMetrics: {
      frame: { x: 0, y: 0, width: 0, height: 0 },
      insets: inset,
    },
  };
});

// SPEC-UI-002 P0 — Inter 폰트 로드 mock. app/_layout.tsx 의 useFonts 게이트가
// 테스트에서 멈추지 않도록 항상 loaded=true 를 반환한다.
jest.mock('expo-font', () => ({
  useFonts: () => [true, null],
  isLoaded: () => true,
}));
jest.mock('@expo-google-fonts/inter', () => ({
  Inter_400Regular: 'Inter_400Regular',
  Inter_500Medium: 'Inter_500Medium',
  Inter_600SemiBold: 'Inter_600SemiBold',
  Inter_700Bold: 'Inter_700Bold',
}));

