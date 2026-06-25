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
import React, { useCallback, useState } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import { BarcodeScanner } from '../../src/features/book/BarcodeScanner';

export default function ScanRoute() {
  const router = useRouter();

  // @MX:NOTE: [AUTO] issue #66 — (tabs) 그룹 내 /scan 재진입 시 BarcodeScanner 인스턴스가
  //   재사용되어 첫 스캔 종료 시의 scanning=false state 가 유지 → CameraView 미렌더(하얀 화면).
  //   useFocusEffect 로 매 진입마다 key 를 증가시켜 강제 재마운트 → useState(true) 초기값으로
  //   scanning 이 리셋되어 CameraView 가 정상 렌더된다.
  const [scanKey, setScanKey] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setScanKey((k) => k + 1);
    }, [])
  );

  return (
    <BarcodeScanner
      key={scanKey}
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
