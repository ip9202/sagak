/**
 * 알림 설정 화면 컴포넌트 (SPEC-ROUTINE-001 REQ-ROUT-005~007)
 *
 * 알림 시간 입력 + 활성화 토글 + 다정한 안내.
 *
 * @MX:NOTE: [AUTO] 본 컴포넌트는 화면 본체 — 라우트 등록(my.tsx→my/index.tsx 전환)은 별도 작업 영역.
 * @MX:SPEC SPEC-ROUTINE-001
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Switch,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../../../theme/theme';
import { borderWidth } from '../../../theme/tokens';
import {
  useAlarmSettings,
  useInvalidateAlarmSettings,
  updateAlarmTime,
  toggleAlarmEnabled,
  INVALID_TIME_FORMAT,
} from '../index';

export function AlarmScreen(): React.JSX.Element {
  const theme = useTheme();
  const settingsQuery = useAlarmSettings();
  const invalidate = useInvalidateAlarmSettings();
  const [timeInput, setTimeInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (settingsQuery.isLoading || !settingsQuery.data) {
    return (
      <View
        testID="alarm-loading"
        style={[styles.center, { backgroundColor: theme.colors.bg.base }]}
      >
        <ActivityIndicator color={theme.colors.brand[500]} />
      </View>
    );
  }

  const settings = settingsQuery.data;

  const handleTimeBlur = async (): Promise<void> => {
    if (!timeInput) {
      setError(null);
      return;
    }
    try {
      await updateAlarmTime(timeInput);
      await invalidate();
      setError(null);
      setTimeInput('');
    } catch {
      setError(INVALID_TIME_FORMAT);
    }
  };

  const handleToggle = async (value: boolean): Promise<void> => {
    await toggleAlarmEnabled(value);
    await invalidate();
  };

  return (
    <View
      testID="alarm-screen"
      style={[styles.container, { backgroundColor: theme.colors.bg.base }]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text.primary }]}>
          독서 알림
        </Text>
      </View>
      <View style={styles.body}>
        <View style={styles.row}>
          <Text style={[styles.label, { color: theme.colors.text.secondary }]}>
            알림 시간
          </Text>
          <TextInput
            testID="alarm-time-input"
            value={timeInput}
            placeholder={settings.alarm_time ?? 'HH:MM'}
            onChangeText={setTimeInput}
            onBlur={() => void handleTimeBlur()}
            placeholderTextColor={theme.colors.text.tertiary}
            style={[
              styles.input,
              {
                color: theme.colors.text.primary,
                borderColor: theme.colors.border.default,
                borderRadius: theme.radius.md,
              },
            ]}
          />
        </View>
        {error ? (
          <Text
            testID="alarm-time-error"
            style={{ color: theme.colors.semantic.error }}
          >
            {error}
          </Text>
        ) : null}
        <View style={styles.row}>
          <Text style={[styles.label, { color: theme.colors.text.secondary }]}>
            알림 받기
          </Text>
          <Switch
            testID="alarm-enabled-toggle"
            value={settings.alarm_enabled}
            onValueChange={(v) => void handleToggle(v)}
            trackColor={{
              false: theme.colors.bg.muted,
              true: theme.colors.brand[500],
            }}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 }, // paddingHorizontal: spacing[5], paddingTop: spacing[2], paddingBottom: spacing[1]
  title: { fontSize: 22, fontWeight: '700' }, // typography.displaySm(22/700/30)
  body: { flex: 1, padding: 20, gap: 16 }, // padding: spacing[5], gap: spacing[4]
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12, // spacing[3] - 행 간 간격
  },
  label: { fontSize: 16 }, // typography.headingSm(16/600/23)과 fontWeight 불일치로 유지
  input: { borderWidth: borderWidth.hairline, paddingHorizontal: 12, paddingVertical: 8, width: 120 }, // paddingHorizontal: spacing[3], paddingVertical: spacing[2], width: spacing 체계(4의 배수)로 표현 불가한 값 유지
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
