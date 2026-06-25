/**
 * StatusBar — 상단 OS 크롬(상태바/노치) 영역 처리 컴포넌트
 * SPEC-UI-002 — REQ-SCREEN-001 (3계층 레이아웃: StatusBar → Content → TabBar)
 *
 * 역할:
 *  1. 상단 상태바/노치(insets.top) 영역을 점유하고 bg.base 토큰으로 채운다
 *     (Pencil .pen StatusBar 노드: fill $bg-base / height 62px 고정 — 그러나 실기기
 *      Android Pixel 6 노치 등은 insets.top 이 우선. 최소 보장값 0.
 *      SPEC 의 62px 은 iOS 참고값이며, 런타임 insets 가 단일 출처다.)
 *  2. expo-status-bar 로 OS 상태바 텍스트/아이콘 대비(light/dark)를 테마에 맞춰 설정
 *
 * 사용:
 *  - 각 화면 최상단 (또는 (tabs)/_layout.tsx screenOptions.header) 에 렌더링
 *  - SafeAreaProvider 하위에서만 동작 (app/_layout.tsx 에서 SafeAreaProvider 래핑됨)
 *
 * 비고:
 *  - 다크모드 자동 대응 (theme.mode 기반 styleColor 전환)
 *  - 토큰 전용 스타일링 (SPEC-UI-002 FROZEN — colors.bg.base 만 사용, 하드코딩 금지)
 *
 * @MX:NOTE: [AUTO] SPEC-UI-002 REQ-SCREEN-001 — 3계층 레이아웃의 최상단 StatusBar 영역 담당.
 *           .pen 의 62px 고정 높이 대신 useSafeAreaInsets().top 을 사용해 실기기 노치/상태바
 *           영역을 정확히 반영 (Pixel 6 Android 등 inset 이 24~48px 인 기기 대응).
 *           배경은 bg.base 토큰 — 다크모드 전환 시 theme.colors.bg.base 가 자동으로 어두운 색 반환.
 * @MX:SPEC SPEC-UI-002
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { useTheme } from '../theme/theme';

export function StatusBar(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  return (
    <>
      {/*
       * @MX:NOTE: [AUTO] expo-status-bar — OS 상태바 텍스트/아이콘 가시성 제어.
       *           theme.mode 가 dark 면 글자색을 밝게(light), light 면 어둡게(dark) 설정.
       *           translucent=false 로 상태바 영역을 차지하지 않고, 아래 View 가 insets.top 으로 채움.
       *           backgroundColor 미지정 — OS 기본 배경 + 우리의 상단 View 배경이 중첩됨.
       *           iOS/Android 모두 안전한 default style 사용.
       */}
      <ExpoStatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />

      <View
        style={[
          styles.container,
          {
            height: insets.top,
            backgroundColor: theme.colors.bg.base,
          },
        ]}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
});
