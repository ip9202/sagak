/**
 * BarcodeScanner 컴포넌트 (SPEC-BOOK-001 M3, REQ-BOOK-006~009, S6~S12)
 *
 * 책 뒷면의 ISBN 바코드를 카메라로 인식해 상위(M4) 에 ISBN 을 전달한다.
 * 단일 책임: ISBN 감지 + onIsbnDetected 콜백만 담당. searchBooks 호출은 상위가 수행.
 *
 * 디자인 기준: Pencil F07-Scan (node acwCA). token-only 스타일링 (SPEC-UI-002 FROZEN).
 */
import React, { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView } from 'expo-camera';
import { useTheme } from '../../theme/theme';
import { isValidIsbn } from './isbn';

export interface BarcodeScannerProps {
  /** ISBN 인식 시 호출 (REQ-BOOK-008: 상위가 target='isbn' 검색으로 전환) */
  onIsbnDetected: (isbn: string) => void;
  /** 수동 ISBN 입력 폴백 (S7: 권한 거부 시) */
  onManualEntry?: () => void;
  /** 닫기 버튼 */
  onClose?: () => void;
  testID?: string;
}

/**
 * REQ-BOOK-009 / S11: 동일 ISBN 중복 인식 방지 디바운스 윈도우 (ms)
 * @MX:NOTE: [AUTO] 2초 — 사용자가 같은 바코드를 연속 스캔해도 API 중복 호출 방지
 */
const DUPLICATE_DEBOUNCE_MS = 2000;

/**
 * REQ-BOOK-007 / S9: ISBN 바코드로 허용하는 타입 (EAN-13, UPC-A)
 * QR/Code128 등은 ISBN 인코딩에 사용되지 않으므로 무시한다.
 */
const ISBN_BARCODE_TYPES = new Set(['ean13', 'upc_a']);

/**
 * @MX:ANCHOR: [AUTO] BarcodeScanner — 카메라 권한·바코드 인식·디바운스 통합 진입점
 * @MX:REASON: BookSearchScreen(M4) 등 상위 화면이 직접 마운트하며, 권한·타입검증·디바운스 규칙을 위반하면 ISBN 자동 전환 플로우가 고장난다.
 */
export const BarcodeScanner: React.FC<BarcodeScannerProps> = ({
  onIsbnDetected,
  onManualEntry,
  onClose,
  testID = 'barcode-scanner',
}) => {
  const theme = useTheme();
  const [scanning, setScanning] = useState(true);
  const lastIsbnRef = useRef<string | null>(null);
  const lastScannedAtRef = useRef<number>(0);

  const handleBarcodeScanned = useCallback(
    (result: { type: string; data: string }) => {
      // 카메라가 이미 중지된 상태면 무시 (S10 이후 추가 스캔 방지)
      if (!scanning) return;

      const { type, data } = result;

      // REQ-BOOK-007 / S9: ISBN 바코드 타입만 허용 (QR/Code128 무시)
      if (!ISBN_BARCODE_TYPES.has(type)) return;

      // REQ-BOOK-007: 데이터가 유효한 ISBN 인지 검증
      if (!isValidIsbn(data)) return;

      // REQ-BOOK-009 / S11: 2초 내 동일 ISBN 중복 인식 무시
      const now = Date.now();
      if (
        lastIsbnRef.current === data &&
        now - lastScannedAtRef.current < DUPLICATE_DEBOUNCE_MS
      ) {
        return;
      }

      lastIsbnRef.current = data;
      lastScannedAtRef.current = now;

      // REQ-BOOK-008 / S10: ISBN 인식 후 카메라 중지 + 콜백
      setScanning(false);
      onIsbnDetected(data);
    },
    [scanning, onIsbnDetected]
  );

  const themeColors = theme.colors;

  return (
    <View
      testID={testID}
      style={[styles.container, { backgroundColor: themeColors.text.primary }]}
    >
      {/* Header (Pencil F07-Scan: KNyfR) */}
      <View style={styles.header}>
        <Text
          style={[
            styles.title,
            { color: themeColors.text.inverse },
          ]}
        >
          바코드 스캔
        </Text>
        <Pressable
          testID="close-button"
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="바코드 스캔 닫기"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          {/* @MX:NOTE: [AUTO] X 아이콘 — @expo/vector-icons 의 X (또는 텍스트 fallback) */}
          <Text style={[styles.closeIcon, { color: themeColors.text.inverse }]}>
            ✕
          </Text>
        </Pressable>
      </View>

      {/* Viewfinder (Pencil F07-Scan: I3rvo) */}
      <View style={styles.viewfinder}>
        {scanning && (
          <CameraView
            style={styles.camera}
            active={true}
            barcodeScannerSettings={{
              barcodeTypes: ['ean13', 'upc_a'],
            }}
            onBarcodeScanned={handleBarcodeScanned}
          />
        )}

        {/* ScanGuide (Pencil F07-Scan: eG0uf — 280x170, cornerRadius 16, stroke brand-300, strokeWidth 3) */}
        <View
          pointerEvents="none"
          style={[
            styles.scanGuide,
            {
              borderColor: themeColors.brand[300],
            },
          ]}
        />

        <Text
          style={[
            styles.hint,
            { color: themeColors.text.inverse },
          ]}
        >
          ISBN 바코드를 가이드 안에 맞춰주세요
        </Text>

        <Pressable
          testID="manual-entry-button"
          onPress={onManualEntry}
          style={[
            styles.manualEntryButton,
            { borderColor: themeColors.brand[300] },
          ]}
          accessibilityRole="button"
          accessibilityLabel="ISBN 직접 입력하기"
        >
          <Text
            style={[
              styles.manualEntryText,
              { color: themeColors.text.inverse },
            ]}
          >
            ISBN 직접 입력하기
          </Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  closeIcon: {
    fontSize: 24,
    lineHeight: 24,
  },
  viewfinder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 16,
  },
  camera: {
    ...StyleSheet.absoluteFill,
  },
  // Pencil F07-Scan eG0uf: 280x170, cornerRadius $radius-lg(16), stroke $brand-300, strokeWidth 3
  scanGuide: {
    position: 'absolute',
    width: 280,
    height: 170,
    borderRadius: 16,
    borderWidth: 3,
  },
  hint: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 200,
  },
  manualEntryButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  manualEntryText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
