/**
 * 완독 축하 헤더 컴포넌트 (SPEC-COMPLETION-001 REQ-COMP-009/010, SPEC-COMPLETION-002 F09 정합)
 *
 * 정적 텍스트("이 책과의 여정을 완성하셨어요") + 완독 배지.
 * 애니메이션 라이브러리 미사용 (6.3 해결됨 — 정적 MVP).
 * 배지에 SPEC-UI-001 강조색(amber brown, brand-500) 적용.
 *
 * SPEC-COMPLETION-002 F09 시각 정합 (REQ-COMP2-008):
 * - hero 카드: brand-50 fill, cornerRadius 16, padding [20,16], 중앙 정렬
 * - Cover (선택): coverUrl 제공 시 72x100, cornerRadius 6. null → brand-200 플레이스홀더.
 * - Badge pill: cornerRadius 999 → radius.full 토큰 사용 (token-only FROZEN).
 * - CompletedDate (선택): completedAt 제공 시 "YYYY.MM.DD 완독" (text-brand).
 *
 * 선택 prop(coverUrl/completedAt) 은 001 테스트의 render(<CelebrationHeader/>) 호출을
 * 보존하기 위함이다. 제공되지 않으면 Cover/CompletedDate 를 생략한다.
 *
 * 에러 상태에서의 미표시 여부는 부모(화면)가 마운트 여부로 제어한다 (시나리오 12 우).
 *
 * @MX:SPEC SPEC-COMPLETION-001, SPEC-COMPLETION-002
 */
import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/theme';
import { spacing, radius, typography } from '../../theme/tokens';

export interface CelebrationHeaderProps {
  /** 책 표지 URL. null 이면 brand-200 플레이스홀더. undefined 면 Cover 영역 자체 생략 (001 호환). */
  coverUrl?: string | null;
  /** 완독일 ISO 문자열. undefined 면 완독일 텍스트 생략 (001 호환). */
  completedAt?: string | null;
}

/**
 * ISO 날짜 문자열을 "YYYY.MM.DD" 로 포맷한다. 파싱 실패 시 원본 반환.
 */
function formatCompletedDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}.${mm}.${dd}`;
}

/**
 * 완독 축하 헤더를 렌더링한다 (REQ-COMP-009/010, REQ-COMP2-008).
 */
export function CelebrationHeader({
  coverUrl,
  completedAt,
}: CelebrationHeaderProps): React.ReactElement {
  const theme = useTheme();
  // @MX:NOTE: [AUTO] SPEC-COMPLETION-002 F09 정합 — coverUrl/completedAt 선택 prop.
  //           undefined 면 해당 영역 생략 (001 렌더 호출 호환). null 은 플레이스홀더/빈값 의미.
  const showCover = coverUrl !== undefined;
  const showDate = completedAt !== undefined && completedAt !== null;
  return (
    <View
      testID="completion-celebration-card"
      style={[
        styles.card,
        { backgroundColor: theme.colors.brand[50] },
      ]}
      accessible
      accessibilityRole="header"
      accessibilityLabel="완독 완료. 이 책과의 여정을 완성하셨어요"
    >
      {showCover && (
        <View
          testID="completion-cover"
          style={[
            styles.cover,
            coverUrl ? null : { backgroundColor: theme.colors.brand[200] },
          ]}
        >
          {coverUrl ? (
            <Image
              source={{ uri: coverUrl }}
              style={styles.coverImage}
              accessibilityLabel="책 표지"
            />
          ) : null}
        </View>
      )}
      <View
        testID="completion-badge"
        style={[
          styles.badge,
          { backgroundColor: theme.colors.brand[500] },
        ]}
      >
        <Text style={[styles.badgeText, { color: theme.colors.text.inverse }]}>
          완독
        </Text>
      </View>
      <Text style={[styles.message, { color: theme.colors.text.primary }]}>
        이 책과의 여정을 완성하셨어요
      </Text>
      {showDate && (
        <Text style={[styles.completedDate, { color: theme.colors.text.brand }]}>
          {formatCompletedDate(completedAt as string)} 완독
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // @MX:NOTE: [AUTO] SPEC-COMPLETION-002 REQ-COMP2-008 — F09 hero 카드 (brand-50, radius 16, padding [20,16]).
  card: {
    borderRadius: radius.lg,
    paddingVertical: spacing[5],
    paddingHorizontal: spacing[4],
    alignItems: 'center',
    gap: spacing[2],
  },
  // @MX:NOTE: [AUTO] SPEC-COMPLETION-002 F09 — Cover 72x100, cornerRadius 6.
  cover: {
    width: 72,
    height: 100,
    borderRadius: radius.sm,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverImage: {
    width: 72,
    height: 100,
    borderRadius: radius.sm,
  },
  badge: {
    // @MX:NOTE: [AUTO] SPEC-COMPLETION-002 F09 — pill (cornerRadius 999 → radius.full 토큰, token-only).
    borderRadius: radius.full,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
  },
  // @MX:NOTE: [AUTO] badgeText(13/700) → sectionLabel(13/600) 근사. 가중치 600→700 차이는 미미,
  //           새 토큰 추가는 오버엔지니어링(guide 4). 축하 배지 강조 의미는 sectionLabel 로 충분.
  badgeText: {
    ...typography.sectionLabel,
  },
  message: {
    ...typography.headingLg,
    textAlign: 'center',
  },
  // @MX:NOTE: [AUTO] SPEC-COMPLETION-002 F09 — CompletedDate (text-brand, 13/600).
  completedDate: {
    ...typography.sectionLabel,
  },
});
