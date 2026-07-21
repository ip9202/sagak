/**
 * 완독 다이어리 리스트 라우트 — completion/index
 * SPEC-COMPLETION-002 REQ-COMP2-001 — CompletionDiaryListScreen 을 라우트에 연결.
 *
 * completion/ 디렉토리에 index.tsx(리스트) 와 [bookId].tsx(상세, SPEC-COMPLETION-001) 가
 * 공존한다. Expo Router 가 /completion → 리스트, /completion/{bookId} → 상세 로 분기.
 *
 * 인증 가드는 CompletionDiaryListScreen 이 react-query 를 통해 RLS 를 신뢰하므로
 * 라우트 단에서는 별도 세션 검사를 하지 않는다 (RLS 가 미인증 시 빈 데이터 반환 → 빈 상태).
 * 세션 가드가 필요한 경우 useSession useEffect 패턴을 추가할 수 있다 (현재는 최소 래퍼).
 *
 * @MX:SPEC SPEC-COMPLETION-002
 */
import React from 'react';
import { CompletionDiaryListScreen } from '../../../src/features/completion/list/CompletionDiaryListScreen';

export default function CompletionListRoute(): React.ReactElement {
  return <CompletionDiaryListScreen />;
}
