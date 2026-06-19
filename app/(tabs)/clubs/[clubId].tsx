/**
 * 모임 상세 동적 라우트 — clubs/[clubId]
 * SPEC-CLUB-002 M4 — ClubDetailScreen 통합
 *
 * clubId param 을 ClubDetailScreen 에 전달. host 진도 동기화, 상태 전환,
 * 탈퇴 액션은 ClubDetailScreen 내부 훅이 담당한다.
 */
import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ClubDetailScreen } from '../../../src/features/club/trackB/components/ClubDetailScreen';
import { useSession } from '../../../src/auth/useSession';

export default function ClubDetailRoute() {
  const { clubId } = useLocalSearchParams<{ clubId: string }>();
  const session = useSession();
  const userId = session?.user?.id ?? '';

  return <ClubDetailScreen clubId={clubId} userId={userId} />;
}
