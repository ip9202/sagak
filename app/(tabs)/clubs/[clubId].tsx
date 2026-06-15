/**
 * 모임 상세 중첩 동적 라우트 — clubs/[clubId]
 * SPEC-NAV-001 — REQ-NAV-011, 인수 시나리오 S2
 *
 * 본 SPEC은 clubId 파라미터 수신까지만 보증한다.
 * 실제 모임 상세 콘텐츠는 SPEC-CLUB-001에서 구현한다 (EC5: 잘못된 clubId 처리 위임).
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../../src/theme/theme';

export default function ClubDetailRoute() {
  const { clubId } = useLocalSearchParams<{ clubId: string }>();
  const theme = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg.base }]}>
      <Text style={[styles.title, { color: theme.colors.text.primary }]}>모임 상세</Text>
      <Text style={[styles.placeholder, { color: theme.colors.text.tertiary }]}>
        clubId: {clubId}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  title: { fontSize: 20, fontWeight: '700' },
  placeholder: { fontSize: 14 },
});
