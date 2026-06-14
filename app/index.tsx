/**
 * Home Screen - Demo link to _dev screen
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme/theme';

export default function IndexScreen() {
  const router = useRouter();
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg.base }]}>
      <Text style={[styles.title, { color: theme.colors.text.primary }]}>
        사각 (Sagak)
      </Text>
      <Text style={[styles.subtitle, { color: theme.colors.text.secondary }]}>
        프론트엔드 파운데이션 데모
      </Text>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: theme.colors.brand[500] }]}
        onPress={() => router.push('/_dev')}
      >
        <Text style={[styles.buttonText, { color: theme.colors.text.inverse }]}>
          컴포넌트 데모 보기
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 16,
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 24,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
