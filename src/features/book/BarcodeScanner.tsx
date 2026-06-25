/**
 * BarcodeScanner 컴포넌트 (SPEC-BOOK-001 M3, REQ-BOOK-006~009, S6~S12)
 *
 * 책 뒷면의 ISBN 바코드를 카메라로 인식해 상위(M4) 에 ISBN 을 전달한다.
 * 단일 책임: ISBN 감지 + onIsbnDetected 콜백만 담당. searchBooks 호출은 상위가 수행.
 *
 * 디자인 기준: Pencil F07-Scan (node acwCA). token-only 스타일링 (SPEC-UI-002 FROZEN).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/theme';
import { isValidIsbn } from './isbn';
import { shouldSuppressDuplicate } from './debounce';

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
 * REQ-BOOK-009 / S11: 동일 ISBN 중복 인식 방지 디바운스 윈도우(ms) 는
 * src/features/book/debounce.ts (DUPLICATE_DEBOUNCE_MS=2000) 로 추출.
 * 단위 테스트가 디바운스 계약을 직접 검증 (REQ-BOOK-009 실질 검증).
 */

/**
 * REQ-BOOK-007 / S9: ISBN 바코드로 허용하는 타입 (EAN-13, UPC-A)
 * QR/Code128 등은 ISBN 인코딩에 사용되지 않으므로 무시한다.
 *
 * iOS expo-camera 가 네이티브 AVMetadataObjectType('org.gs1.EAN-13') 을
 * 그대로 노출할 수 있어 Android('ean13') 와 통일하기 위해 정규화 매칭을 사용한다.
 * 실기기 검증: iPhone 12 Pro (SPEC-BOOK-001 QA 항목).
 */
function isIsbnBarcodeType(type: string): boolean {
  const t = type.toLowerCase();
  // EAN-13: 'ean13' (Android) / 'org.gs1.ean-13' (iOS) 모두 수용
  if (t === 'ean13' || t.includes('ean-13')) return true;
  // UPC-A: 'upc_a' (Android) / 'org.gs1.upc-a' (iOS)
  if (t === 'upc_a' || t.includes('upc-a')) return true;
  return false;
}

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
  // @MX:NOTE: [AUTO] SPEC-UI-002 REQ-SCREEN-001 — 상단 상태바/노치 영역 처리.
  //           카메라 전체화면이므로 StatusBar 컴포넌트(bg.base 불투명 View)를 쓰면 카메라가 가려진다.
  //           대신 insets.top 크기의 투명 spacer + ExpoStatusBar style="light"(어두운 카메라 배경 대비) 사용.
  const insets = useSafeAreaInsets();
  const [scanning, setScanning] = useState(true);
  const lastIsbnRef = useRef<string | null>(null);
  const lastScannedAtRef = useRef<number>(0);

  // REQ-BOOK-006 / S6: 카메라 권한 조회 + 최초 요청 트리거
  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    // @MX:NOTE: [AUTO] permission === null(미확정) 시 최초 1회 권한 요청
    if (permission === null) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  // @MX:NOTE: [AUTO] 권한 파생 상태 — null(로딩) / granted / denied(or undetermined)
  const permissionGranted = permission?.granted === true;
  const permissionLoading = permission === null;

  const handleBarcodeScanned = useCallback(
    (result: { type: string; data: string }) => {
      // 카메라가 이미 중지된 상태면 무시 (S10 이후 추가 스캔 방지)
      if (!scanning) return;

      const { type, data } = result;

      // REQ-BOOK-007 / S9: ISBN 바코드 타입만 허용 (정규화 매칭, QR/Code128 무시)
      if (!isIsbnBarcodeType(type)) return;

      // REQ-BOOK-007: 데이터가 유효한 ISBN 인지 검증
      if (!isValidIsbn(data)) return;

      // REQ-BOOK-009 / S11: 2초 내 동일 ISBN 중복 인식 무시 (순수 함수에 위임)
      // @MX:NOTE: [AUTO] shouldSuppressDuplicate 는 src/features/book/debounce.ts 의 순수 함수.
      //           setScanning(false)(S10) 이 컴포넌트 테스트에서 디바운스 분기 도달을 막기 때문에,
      //           디바운스 계약 자체는 debounce.test.ts 단위 테스트가 검증한다.
      const now = Date.now();
      if (
        shouldSuppressDuplicate(
          lastIsbnRef.current,
          data,
          lastScannedAtRef.current,
          now
        )
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
      {/* @MX:NOTE: [AUTO] SPEC-UI-002 REQ-SCREEN-001 — 카메라 전체화면용 상단 SafeArea 처리.
                  어두운 카메라 배경(text.primary)에 맞춰 상태바 텍스트는 밝게(light).
                  insets.top 크기의 투명 spacer 가 헤더를 상태바/노치 아래로 밀어낸다. */}
      <ExpoStatusBar style="light" />
      <View style={{ height: insets.top }} pointerEvents="none" />

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
        {/* REQ-BOOK-006 / S6: 권한 허용 + 스캔 중일 때만 카메라 렌더링 */}
        {permissionGranted && scanning && (
          <CameraView
            style={styles.camera}
            active={true}
            barcodeScannerSettings={{
              barcodeTypes: ['ean13', 'upc_a'],
            }}
            onBarcodeScanned={handleBarcodeScanned}
          />
        )}

        {/* S6: 권한 로딩 상태 — 카메라 미렌더, 로딩 안내 */}
        {permissionLoading && (
          <View testID="permission-loading" style={styles.permissionState}>
            <ActivityIndicator size="large" color={themeColors.text.inverse} />
            <Text
              style={[styles.permissionText, { color: themeColors.text.inverse }]}
            >
              카메라 권한을 확인하는 중...
            </Text>
          </View>
        )}

        {/* S7: 권한 거부/미결정 — 카메라 미렌더, 수동 입력 폴백 강조 */}
        {!permissionLoading && !permissionGranted && (
          <View testID="permission-denied" style={styles.permissionState}>
            <Text
              style={[
                styles.permissionDeniedTitle,
                { color: themeColors.text.inverse },
              ]}
            >
              카메라 권한이 필요합니다
            </Text>
            <Text
              style={[
                styles.permissionDeniedHint,
                { color: themeColors.text.inverse },
              ]}
            >
              권한을 허용하거나 ISBN을 직접 입력할 수 있어요.
            </Text>
          </View>
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

        {permissionGranted && (
          <Text
            style={[
              styles.hint,
              { color: themeColors.text.inverse },
            ]}
          >
            ISBN 바코드를 가이드 안에 맞춰주세요
          </Text>
        )}

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
    paddingHorizontal: 20, // spacing[5] - 헤더 좌우 패딩
    // @MX:NOTE: [AUTO] paddingTop 제거 — 상단 SafeArea spacer(insets.top) 가 노치/상태바를
    //           밀어내므로 헤더 상단 패딩은 불필요(이중 여백으로 X 버튼이 과도하게 아래로 내려가는 현상 방지).
  },
  title: {
    fontSize: 22, // typography.displaySm(22/700/30)
    fontWeight: '700',
  },
  closeIcon: {
    fontSize: 24, // iconSizes.xl(32)과 불일치, 유지
    lineHeight: 24,
  },
  viewfinder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20, // spacing[5] - 뷰파인더 좌우 패딩
    paddingBottom: 40, // spacing[8] - 뷰파인더 하단 패딩
    gap: 16, // spacing[4] - 자식 간 간격
  },
  camera: {
    ...StyleSheet.absoluteFill,
  },
  // Pencil F07-Scan eG0uf: 280x170, cornerRadius $radius-lg(16), stroke $brand-300, strokeWidth 3
  scanGuide: {
    position: 'absolute',
    width: 280, // spacing 체계(4의 배수)로 표현 불가한 값 유지
    height: 170, // spacing 체계(4의 배수)로 표현 불가한 값 유지
    borderRadius: 16, // radius.lg - 스캔 가이드 모서리
    borderWidth: 3, // borderWidth.hairline(1)과 불일치, 유지
  },
  hint: {
    fontSize: 14, // typography.bodyMd(14/400/22)
    textAlign: 'center',
    marginTop: 200, // spacing 체계(4의 배수)로 표현 불가한 값 유지
  },
  manualEntryButton: {
    borderWidth: 1, // borderWidth.hairline
    borderRadius: 10, // radius.md - 버튼 모서리
    paddingHorizontal: 16, // spacing[4] - 버튼 좌우 패딩
    paddingVertical: 10, // spacing 체계(4의 배수)로 표현 불가한 값 유지
  },
  manualEntryText: {
    fontSize: 14, // typography.bodyMd(14/400/22), fontWeight 불일치(500 vs 400)로 유지
    fontWeight: '500',
  },
  // @MX:NOTE: [AUTO] 권한 게이트 UI — 로딩/거부 상태 중앙 정렬 컨테이너
  permissionState: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12, // spacing[3] - 권한 상태 간 간격
    marginBottom: 24, // spacing[6] - 하단 마진
  },
  permissionText: {
    fontSize: 14, // typography.bodyMd(14/400/22)
    textAlign: 'center',
  },
  permissionDeniedTitle: {
    fontSize: 18, // typography.headingMd(18/600/26)과 lineHeight 불일치, 유지
    fontWeight: '700',
    textAlign: 'center',
  },
  permissionDeniedHint: {
    fontSize: 13, // typography.bodySm(13/400/20)
    textAlign: 'center',
    opacity: 0.85,
  },
});
