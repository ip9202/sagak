/**
 * 모임 생성 폼 라우트 — clubs/new
 * SPEC-CLUB-002 M4 — ClubCreateScreen 통합
 *
 * bookId 는 쿼리 파라미터로 수신한다. 책 선택 플로우(별도 SPEC)를 통해
 * search/library 에서 선택 후 /clubs/new?bookId=<UUID> 로 진입한다.
 * bookId 가 없으면 책 검색(search)으로 유도한다.
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ClubCreateScreen } from '../../../src/features/club/trackB/components/ClubCreateScreen';
import { useSession } from '../../../src/auth/useSession';
import { useTheme } from '../../../src/theme/theme';

export default function ClubCreateRoute() {
  const router = useRouter();
  const theme = useTheme();
  const session = useSession();
  const { bookId } = useLocalSearchParams<{ bookId: string }>();
  const userId = session?.user?.id ?? '';

  if (!bookId || bookId.length === 0) {
    return (
      <View
        style={[
          styles.gate,
          { backgroundColor: theme.colors.bg.base },
        ]}
      >
        <Text
          style={[
            styles.gateTitle,
            { color: theme.colors.text.primary },
          ]}
        >
          어떤 책으로 모임을 만들까요?
        </Text>
        <Text
          style={[
            styles.gateHint,
            { color: theme.colors.text.secondary },
          ]}
        >
          책을 먼저 선택해주세요.
        </Text>
        <Pressable
          testID="club-new-search"
          onPress={() => router.push('/search')}
          accessibilityRole="button"
          accessibilityLabel="책 검색하기"
          style={[
            styles.gateButton,
            {
              backgroundColor: theme.colors.brand[500],
              borderRadius: theme.radius.md,
            },
          ]}
        >
          <Text
            style={[
              styles.gateButtonText,
              { color: theme.colors.text.inverse },
            ]}
          >
            책 검색하기
          </Text>
        </Pressable>
      </View>
    );
  }

  return <ClubCreateScreen userId={userId} bookId={bookId} />;
}

const styles = StyleSheet.create({
  gate: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 24 },
  gateTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  gateHint: { fontSize: 14, textAlign: 'center' },
  gateButton: { paddingVertical: 12, paddingHorizontal: 24 },
  gateButtonText: { fontSize: 15, fontWeight: '700' },
});
