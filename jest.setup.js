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

// SPEC-UI-002 — lucide-react-native mock. ESM(.mjs) 배포이고 react-native-svg(네이티브) 에
// 의존하므로 Jest/jsdom 환경에서 렌더링 불가. 모든 아이콘을 동일한 Text mock 컴포넌트로 반환한다.
// Proxy 로 임의 이름의 named export 를 모두 커버한다 (Home/Bell/Search/Plus/BookOpen/User/Users/CircleCheck/TriangleAlert/Info/LucideIcon 등).
// 개별 테스트의 @expo/vector-icons Feather mock 은 이관 후 소스에서 사용되지 않아 dead-code 가 됐지만
// 기존 테스트 안정성을 위해 그대로 둔다 (Feather 의존 화면이 0개이므로 영향 없음).
jest.mock('lucide-react-native', () => {
  const React = require('react');
  const { Text } = require('react-native');
  const MockIcon = (props) =>
    React.createElement(Text, { testID: 'lucide-icon' }, props.name || '');
  // Proxy: 모든 named import 를 MockIcon 으로 응답.
  // type LucideIcon 등 타입 전용 import 는 런타임에 undefined 여도 tsc 가 처리하므로 무방.
  return new Proxy(
    {},
    {
      get: (_target, prop) => {
        if (prop === '__esModule') return true;
        return MockIcon;
      },
    },
  );
});

// expo-status-bar mock — SPEC-UI-002 REQ-SCREEN-001.
// src/components/StatusBar.tsx 와 BarcodeScanner.tsx 가 expo-status-bar 의 StatusBar 컴포넌트를
// 렌더링하는데, 실제 구현은 RN 내부 타이머(clearImmediate/setImmediate)를 사용해 jsdom 환경에서
// ReferenceError: clearImmediate is not defined 를 발생시킨다.
// PR #70 ((tabs)/_layout) 은 expo-router mock 으로 실제 트리 마운트가 일어나지 않아 우회됐으나,
// 비탭 화면(auth/emotion/completion/scan) 테스트는 실제 StatusBar 를 마운트하므로 글로벌 noop mock 이 필요하다.
// StatusBar 컴포넌트 자체(useSafeAreaInsets 기반 View)는 별도 검증 대상이 아님 — OS 상태바 제어는
// 런타임 전용 기능이므로 테스트에서는 null 로 렌더링한다.
jest.mock('expo-status-bar', () => ({
  StatusBar: () => null,
}));

