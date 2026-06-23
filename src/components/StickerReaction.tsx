/**
 * StickerReaction Component - pages_11 §9.4
 * 3 sticker types with toggle behavior
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../theme/theme';
import { StickerType } from '../types';

/**
 * @MX:NOTE
 * StickerReaction component - 3 sticker types with toggle
 * Types: empathy (공감해요), touching (찡해요), comforted (위로받았어요)
 * Selected state: scale(1.15) + brand-200 background
 * Toggle behavior: re-click deselects
 * Disabled when not authenticated
 * Supports dark mode
 */
export const StickerReaction: React.FC<{
  selectedType?: StickerType | null;
  onTypeSelect: (type: StickerType | null) => void;
  isAuthenticated?: boolean;
  testID?: string;
}> = ({
  selectedType = null,
  onTypeSelect,
  isAuthenticated = true,
  testID = 'sticker-reaction',
}) => {
  const theme = useTheme();

  const handlePress = (type: StickerType) => {
    if (!isAuthenticated) return;

    // Toggle: if same type selected, deselect (pages_11 엣지 케이스)
    if (selectedType === type) {
      onTypeSelect(null);
    } else {
      onTypeSelect(type);
    }
  };

  const stickers: { type: StickerType; emoji: string; label: string }[] = [
    { type: 'empathy', emoji: '🤗', label: '공감해요' },
    { type: 'touching', emoji: '😢', label: '찡해요' },
    { type: 'comforted', emoji: '🫂', label: '위로받았어요' },
  ];

  return (
    <View testID={testID} style={styles.container}>
      {stickers.map((sticker) => {
        const isSelected = selectedType === sticker.type;
        const isDisabled = !isAuthenticated;

        return (
          <TouchableOpacity
            key={sticker.type}
            testID={`sticker-${sticker.type}`}
            style={[
              styles.stickerButton,
              {
                backgroundColor: isSelected ? theme.colors.brand[200] : 'transparent',
                opacity: isDisabled ? 0.5 : 1,
                transform: [{ scale: isSelected ? 1.15 : 1 }],
              },
            ]}
            onPress={() => handlePress(sticker.type)}
            disabled={isDisabled}
            accessible={true}
            accessibilityLabel={sticker.label}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected, disabled: isDisabled }}
          >
            <Text style={styles.emoji}>{sticker.emoji}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 24, // spacing[6] - 스티커 간 간격
    justifyContent: 'center',
    paddingVertical: 8, // spacing[2] - 상하 패딩
  },
  stickerButton: {
    width: 56, // spacing 체계(4의 배수)로 표현 불가한 값 유지
    height: 56, // spacing 체계(4의 배수)로 표현 불가한 값 유지
    borderRadius: 28, // circle: width/2
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 28, // iconSizes.xl(32)과 불일치, 토큰화 유지
  },
});
