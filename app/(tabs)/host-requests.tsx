/**
 * host 수신 요청 라우트 — host-requests
 * SPEC-CLUB-001 T-012 — HostRequestsScreen 통합
 *
 * hostId 는 HostRequestsScreen 내부에서 useSession 으로 해결한다 (본 라우트는 마운트만).
 */
import React from 'react';
import { HostRequestsScreen } from '../../src/features/club/trackA/components/HostRequestsScreen';

export default function HostRequestsRoute() {
  return <HostRequestsScreen />;
}
