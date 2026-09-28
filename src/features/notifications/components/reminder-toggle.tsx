import { StyleSheet, Switch, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * One reminder, as a labelled switch.
 *
 * A real `Switch` rather than a button: it is a two-state setting, and it should
 * look and read like one. The label is the accessibility label as well, so a
 * screen reader announces the setting and its state together.
 */
export function ReminderToggle({
  label,
  value,
  busy,
  disabled,
  onChange,
}: {
  label: string;
  value: boolean;
  busy: boolean;
  disabled: boolean;
  onChange: (next: boolean) => void;
}) {
  const theme = useTheme();

  return (
    <View style={[styles.reminderRow, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText style={styles.reminderLabel}>{label}</ThemedText>

      <Switch
        trackColor={{ false: theme.backgroundSelected, true: theme.switchTrackOn }}
        thumbColor={value ? theme.switchThumbOn : undefined}
        accessibilityLabel={label}
        accessibilityState={{ checked: value, disabled }}
        value={value}
        disabled={disabled}
        onValueChange={onChange}
        testID={busy ? 'reminder-busy' : undefined}
      />
    </View>
  );
}

/**
 * One whole-number setting, in days.
 *
 * The bounds are passed in rather than read here, because the period length's
 * maximum depends on the cycle length as well as on the domain's own limit.
 */

const styles = StyleSheet.create({
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    minHeight: 56,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  reminderLabel: {
    flexShrink: 1,
  },
});
