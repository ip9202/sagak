/**
 * 모임 생성 폼 라우트 — clubs/new
 * SPEC-CLUB-002 M4 — ClubCreateScreen 통합
 * SPEC-CLUB-004 M1 — 게이트를 통합 북선택 허브(BookSelectionHub)로 재설계
 *
 * bookId 가 쿼리 파라미터로 주어지면 모임 생성 폼(ClubCreateScreen)을 렌더링한다.
 * bookId 가 없으면 통합 허브를 렌더링한다 — 서재(reading/shelved) 선택 + 외부 검색.
 * 허브에서 책을 선택하면 router.replace 로 동일 라우트의 bookId 파라미터를 갱신하여
 * 폼으로 진입한다 ( REQ-CLUB4-011 핸드오프 계약 — bookId 라우트 파라미터 전달 ).
 *
 * 회귀 (SPEC-CLUB-002): bookId 가 주어진 상태에서 ClubCreateScreen 내부 동작은 변경 없음.
 *
 * @MX:NOTE: [AUTO] 라우트 레벨 허브/폼 분기 — 허브는 onSelectBook 으로 bookId 를 전달하고 라우트가 router.replace 로 URL 파라미터를 갱신.
 * @MX:SPEC SPEC-CLUB-004
 */
import React from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ClubCreateScreen } from '../../../src/features/club/trackB/components/ClubCreateScreen';
import { BookSelectionHub } from '../../../src/features/club/trackB/components/BookSelectionHub';
import { useSession } from '../../../src/auth/useSession';

export default function ClubCreateRoute() {
  const router = useRouter();
  const session = useSession();
  const { bookId } = useLocalSearchParams<{ bookId: string }>();
  const userId = session?.user?.id ?? '';

  // bookId 가 주어지면 모임 생성 폼 렌더링 (SPEC-CLUB-002 기존 동작 유지, REQ-CLUB4-030).
  if (bookId && bookId.length > 0) {
    return <ClubCreateScreen userId={userId} bookId={bookId} />;
  }

  // bookId 가 없으면 통합 북선택 허브 렌더링 (REQ-CLUB4-001).
  // 허브의 onSelectBook 을 router.replace 로 연결 — bookId 를 라우트 파라미터로 전달(REQ-CLUB4-011).
  return (
    <BookSelectionHub
      userId={userId}
      onSelectBook={(selectedBookId) =>
        router.replace({
          pathname: '/clubs/new',
          params: { bookId: selectedBookId },
        })
      }
    />
  );
}
