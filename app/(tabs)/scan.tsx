/**
 * 바코드 스캔 화면 라우트 — scan (href:null, 탭바 미표시)
 * SPEC-BOOK-001 M4-5
 *
 * Pencil F07-Scan (node acwCA) 기반 전체화면. BarcodeScanner 렌더링.
 * - onIsbnDetected(isbn) → router.replace('/search', { initialQuery: isbn, initialTarget: 'isbn' })
 *   (REQ-BOOK-008: ISBN 감지 후 검색 화면으로 전환, 백스택 대체)
 * - onManualEntry → router.back() (검색 화면으로 복귀, 수동 입력 유도)
 * - onClose → router.back()
 */
import React from 'react';
import { useRouter } from 'expo-router';
import { BarcodeScanner } from '../../src/features/book/BarcodeScanner';

export default function ScanRoute() {
  const router = useRouter();

  return (
    <BarcodeScanner
      onIsbnDetected={(isbn) => {
        // REQ-BOOK-008: ISBN 감지 → 검색 화면으로 replace (백스택에서 스캔 제거)
        router.replace({
          pathname: '/search',
          params: { initialQuery: isbn, initialTarget: 'isbn' },
        });
      }}
      onManualEntry={() => {
        // S7: 수동 입력 폴백 — 검색 화면으로 복귀
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/search');
        }
      }}
      onClose={() => {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/search');
        }
      }}
    />
  );
}
