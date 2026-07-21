/**
 * expo-camera Jest mock (SPEC-BOOK-001 M3)
 *
 * jest-expo 환경에서 CameraView 를 단순 View 로 대체하고,
 * useCameraPermissions 와 barcodeScannerSettings/onBarcodeScanned 를
 * 테스트에서 제어 가능하도록 mock 한다.
 *
 * 시나리오 S6/S7(권한), S8/S9(바코드 타입 필터), S10(카메라 중지), S11(디바운스)
 * 검증을 위해 테스트 헬퍼 simulateBarcodeScan(type, data) 를 노출한다.
 */
import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';

type PermissionStatus = 'granted' | 'denied' | 'undetermined';

export interface MockPermissionResponse {
  status: PermissionStatus;
  granted: boolean;
  canAskAgain: boolean;
  expires: 'never';
}

// @MX:NOTE: [AUTO] 테스트 전역 상태 — 각 테스트의 setPermissionResponse 로 제어
let mockPermissionResponse: MockPermissionResponse | null = null;

export function setPermissionResponse(resp: MockPermissionResponse | null): void {
  mockPermissionResponse = resp;
}

// 현재 렌더링된 CameraView 의 onBarcodeScanned 핸들러 참조 (헬퍼용)
let activeScanHandler: ((result: { type: string; data: string }) => void) | null = null;

/**
 * 테스트 헬퍼: 카메라가 바코드를 인식한 것을 시뮬레이션.
 * @param type - 바코드 타입 ('ean13' | 'upc_a' | 'qr' | 'code128' 등)
 * @param data - 인식된 데이터 문자열
 */
export function simulateBarcodeScan(type: string, data: string): void {
  if (activeScanHandler) {
    activeScanHandler({ type, data });
  }
}

export function useCameraPermissions(): [
  MockPermissionResponse | null,
  () => Promise<MockPermissionResponse>,
] {
  // 컴포넌트가 권한을 조회하는 시점의 현재 상태 반환
  return [
    mockPermissionResponse,
    async () => {
      // requestPermission 시뮬레이션: granted 로 전환
      const resp: MockPermissionResponse = {
        status: 'granted',
        granted: true,
        canAskAgain: true,
        expires: 'never',
      };
      mockPermissionResponse = resp;
      return resp;
    },
  ];
}

export interface CameraViewProps {
  active?: boolean;
  barcodeScannerSettings?: { barcodeTypes: string[] };
  onBarcodeScanned?: (result: { type: string; data: string }) => void;
  facing?: 'front' | 'back';
}

export const CameraView: React.FC<CameraViewProps> = ({ onBarcodeScanned }) => {
  const handlerRef = useRef(onBarcodeScanned);
  handlerRef.current = onBarcodeScanned;

  useEffect(() => {
    activeScanHandler = (result) => handlerRef.current?.(result);
    return () => {
      if (activeScanHandler) {
        activeScanHandler = null;
      }
    };
  }, []);

  return React.createElement(View, { testID: 'camera-view' });
};

export default CameraView;
