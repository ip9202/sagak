/**
 * 마이 탭 placeholder 셸
 * SPEC-NAV-001 — REQ-NAV-002 (T6)
 * 실제 콘텐츠는 마이페이지 도메인 SPEC에서 구현.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../src/theme/theme';

export default function MyTab() {
  const theme = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg.base }]}>
      <Text style={[styles.placeholder, { color: theme.colors.text.tertiary }]}>
        마이 화면
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  placeholder: { fontSize: 16 },
});
