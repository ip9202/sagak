/**
 * 독자 목록 동적 라우트 — readers
 * SPEC-CLUB-001 T-010 — ReadersScreen 통합
 *
 * bookId param 을 ReadersScreen 에 전달. JoinRequestSheet 진입은 ReadersScreen 의
 * onJoinRequest 콜백으로 연다 (본 라우트는 param 수신까지만 보증).
 */
import React, { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ReadersScreen } from '../../src/features/club/trackA/components/ReadersScreen';
import { JoinRequestSheet } from '../../src/features/club/trackA/components/JoinRequestSheet';
import type { ActiveReader } from '../../src/features/club/trackA/types';

export default function ReadersRoute() {
  const { bookId } = useLocalSearchParams<{ bookId: string }>();
  const [target, setTarget] = useState<ActiveReader | null>(null);

  return (
    <>
      <ReadersScreen
        bookId={bookId}
        onJoinRequest={(reader) => setTarget(reader)}
      />
      {target && (
        <JoinRequestSheet
          bookId={bookId}
          reader={target}
          onClose={() => setTarget(null)}
        />
      )}
    </>
  );
}
