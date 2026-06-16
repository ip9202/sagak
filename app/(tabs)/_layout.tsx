/**
 * (tabs) 그룹 레이아웃 — 4탭 Tabs 네비게이터 + 인증/온보딩 가드
 * SPEC-NAV-001 — REQ-NAV-001, REQ-NAV-003, REQ-NAV-022, REQ-NAV-023, REQ-NAV-013
 * 인수 시나리오: T1~T6, G4, G6, EC3, EC7, S3/S4 (스택 전환)
 *
 * 진입 분기 (단일 진실 원천 useSession):
 * - null (loading)      → ActivityIndicator (EC7: 리다이렉트 루프 방지, 아무 그룹도 렌더링하지 않음)
 * - !isAuthenticated     → router.replace('/(auth)/login')  (G4)
 * - authenticated & !isOnboarded → router.replace('/(auth)/onboarding') (G6, EC3)
 * - 그 외                → Tabs 렌더링
 *
 * 탭 구성 (REQ-NAV-001):
 * 홈(home) → 서재(book-open) → 모임(users) → 마이(user)
 * 모든 스타일 값은 useTheme() 토큰에서 임포트 (REQ-NAV-003, 하드코딩 금지).
 */

import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../src/theme/theme';
import { useSession } from '../../src/auth/useSession';

// @MX:ANCHOR: [AUTO] (tabs) 그룹 진입 게이트 — 미인증/온보딩미완 사용자의 보호 라우트 접근 차단
// @MX:REASON: fan_in >= 3 (홈/서재/모임/마이 모든 탭이 이 게이트 통과). useSession 단일 진실 원천 기반으로 동작하며, 양쪽 가드(tabs/auth)가 동일 상태를 받아 EC7 리다이렉트 루프를 방지한다.
export default function TabsLayout() {
  const s = useSession();
  const router = useRouter();
  const theme = useTheme();

  // EC7: loading 시 아무 리다이렉트도 하지 않고 인디케이터만 표시 → 리다이렉트 루프 방지
  if (s === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.bg.base }}>
        <ActivityIndicator size="large" color={theme.colors.brand[500]} />
      </View>
    );
  }

  // G4: 미인증 사용자의 (tabs) 접근 차단 → login
  if (!s.isAuthenticated) {
    // @MX:WARN: [AUTO] replace 사용 필수 — push 사용 시 백스택에 보호 화면이 남아 인증 후 다시 노출됨
    // @MX:REASON: 사용자가 로그인한 뒤 백버튼으로 보호된 콘텐츠에 접근하는 시나리오를 차단하기 위해 replace 사용.
    router.replace('/(auth)/login');
    return null;
  }

  // G6/EC3: 인증됐으나 온보딩 미완료 → onboarding
  if (!s.isOnboarded) {
    router.replace('/(auth)/onboarding');
    return null;
  }

  // REQ-NAV-003: 모든 스타일 값은 useTheme() 토큰 (하드코딩 금지)
  // @MX:NOTE: [AUTO] 탭바 토큰 스타일링 — bg-surface/border-default/brand-500/text-tertiary 모두 theme 토큰
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.brand[500],
        tabBarInactiveTintColor: theme.colors.text.tertiary,
        tabBarStyle: {
          backgroundColor: theme.colors.bg.surface,
          borderTopColor: theme.colors.border.default,
          borderTopWidth: 0.5,
          height: 56,
        },
        tabBarLabelStyle: {
          fontSize: theme.typography.label.fontSize,
          fontWeight: theme.typography.label.fontWeight,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '홈',
          tabBarIcon: ({ color }) => <Feather name="home" size={24} color={color} />,
          tabBarAccessibilityLabel: '홈 탭',
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: '서재',
          tabBarIcon: ({ color }) => <Feather name="book-open" size={24} color={color} />,
          tabBarAccessibilityLabel: '서재 탭',
        }}
      />
      <Tabs.Screen
        name="clubs"
        options={{
          title: '모임',
          tabBarIcon: ({ color }) => <Feather name="users" size={24} color={color} />,
          tabBarAccessibilityLabel: '모임 탭',
        }}
      />
      <Tabs.Screen
        name="my"
        options={{
          title: '마이',
          tabBarIcon: ({ color }) => <Feather name="user" size={24} color={color} />,
          tabBarAccessibilityLabel: '마이 탭',
        }}
      />
      {/* 동적 라우트 — 탭바에 표시되지 않음 (href:null). S3/S4 스택 진입/복귀용.
          REQ-NAV-013: 기본 전환은 React Navigation 슬라이드(기본값).
          모달형 presentation은 별도 Stack 그룹 도입 시 지원 예정 (Tabs.Screen은
          presentation 옵션을 타입 수준에서 지원하지 않으므로 현재는 href:null만 적용). */}
      <Tabs.Screen
        name="[bookId]"
        options={{ href: null, headerShown: false }}
      />
      {/* SPEC-BOOK-001 M4: 검색·스캔 화면 — 탭바 미표시 (href:null), 스택 진입용 */}
      <Tabs.Screen
        name="search"
        options={{ href: null, headerShown: false }}
      />
      <Tabs.Screen
        name="scan"
        options={{ href: null, headerShown: false }}
      />
      <Tabs.Screen
        name="clubs/[clubId]"
        options={{ href: null, headerShown: false }}
      />
    </Tabs>
  );
}
