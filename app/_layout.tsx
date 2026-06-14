/**
 * App Layout - ThemeProvider wrapper
 * Wraps entire app with ThemeProvider for theme support
 */

import React from 'react';
import { Stack } from 'expo-router';
import { ThemeProvider } from '../src/theme/theme';

export default function RootLayout() {
  return (
    <ThemeProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="_dev" options={{ presentation: 'modal' }} />
      </Stack>
    </ThemeProvider>
  );
}
