/**
 * 모임 탭 — clubs
 * SPEC-CLUB-002 M4 — ClubsScreen 통합
 *
 * ClubsScreen 은 userId(useSession) 로 host 모임 목록을 조회하고,
 * plus 아이콘 / NewClubCTA 누름 시 생성 폼(clubs/new)으로 이동한다.
 */
import React from 'react';
import { useRouter } from 'expo-router';
import { ClubsScreen } from '../../src/features/club/trackB/components/ClubsScreen';
import { useSession } from '../../src/auth/useSession';

export default function ClubsTab() {
  const session = useSession();
  const router = useRouter();
  const userId = session?.user?.id ?? '';

  return (
    <ClubsScreen
      userId={userId}
      onCreateClub={() => router.push('/clubs/new')}
    />
  );
}
