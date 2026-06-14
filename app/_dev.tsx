/**
 * Dev Screen - Component demo with light/dark toggle
 * Displays all component variants for visual verification (C1)
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme, useManualMode } from '../src/theme/theme';
import { Button } from '../src/components/Button';
import { Card } from '../src/components/Card';
import { ProgressBar } from '../src/components/ProgressBar';
import { BookCard } from '../src/components/BookCard';
import { EmotionRecordCard } from '../src/components/EmotionRecordCard';
import { StickerReaction } from '../src/components/StickerReaction';

export default function DevScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { setManualMode } = useManualMode();
  const [isDark, setIsDark] = useState(theme.mode === 'dark');

  const toggleDarkMode = (value: boolean) => {
    setIsDark(value);
    // Set manual mode: 'dark' when enabled, null when disabled (follows system)
    setManualMode(value ? 'dark' : null);
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.bg.base }]}
      contentContainerStyle={styles.content}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[styles.backText, { color: theme.colors.text.brand }]}>← 뒤로</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.colors.text.primary }]}>
          컴포넌트 데모
        </Text>
        <View style={styles.toggle}>
          <Text style={[styles.toggleLabel, { color: theme.colors.text.secondary }]}>
            {isDark ? '🌙' : '☀️'}
          </Text>
          <Switch value={isDark} onValueChange={toggleDarkMode} />
        </View>
      </View>

      {/* Button Variants */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text.primary }]}>
          Button Variants
        </Text>
        <Button variant="primary" onPress={() => {}} style={styles.button}>
          Primary
        </Button>
        <Button variant="secondary" onPress={() => {}} style={styles.button}>
          Secondary
        </Button>
        <Button variant="ghost" onPress={() => {}} style={styles.button}>
          Ghost
        </Button>
        <Button variant="destructive" onPress={() => {}} style={styles.button}>
          Destructive
        </Button>
        <Button variant="disabled" onPress={() => {}} style={styles.button}>
          Disabled
        </Button>
        <Button variant="primary" onPress={() => {}} loading style={styles.button}>
          Loading
        </Button>
      </View>

      {/* Card + ProgressBar */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text.primary }]}>
          Card + ProgressBar
        </Text>
        <Card>
          <Text style={[styles.cardText, { color: theme.colors.text.primary }]}>
            카드 내용
          </Text>
        </Card>
        <ProgressBar current={120} total={320} style={styles.progress} />
      </View>

      {/* BookCard */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text.primary }]}>
          BookCard
        </Text>
        <BookCard
          title="데모 책 제목"
          author="작가 이름"
          currentPage={120}
          totalPages={320}
        />
      </View>

      {/* EmotionRecordCard */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text.primary }]}>
          EmotionRecordCard
        </Text>
        <EmotionRecordCard
          nickname="사용자"
          page={120}
          daysAgo={3}
          content="오늘 이 문장에서 멈췄다. 괜찮지 않아도 괜찮아."
          bookTitle="데모 책 제목"
          stickers={[
            { type: 'empathy', count: 5 },
            { type: 'touching', count: 3 },
          ]}
          isSpoiler={false}
        />
        <EmotionRecordCard
          nickname="사용자"
          page={400}
          daysAgo={1}
          content="스포일러 내용입니다"
          bookTitle="데모 책 제목"
          isSpoiler={true}
        />
      </View>

      {/* StickerReaction */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text.primary }]}>
          StickerReaction
        </Text>
        <StickerReaction
          selectedType={null}
          onTypeSelect={() => {}}
          isAuthenticated={true}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    gap: 32,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backText: {
    fontSize: 16,
    fontWeight: '500',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toggleLabel: {
    fontSize: 20,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  button: {
    alignSelf: 'flex-start',
  },
  progress: {
    marginTop: 8,
  },
  cardText: {
    fontSize: 14,
  },
});
