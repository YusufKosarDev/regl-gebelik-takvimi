import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useMessages } from '@/i18n';

import { settingsMessages } from '../presentation/settings-messages';

/**
 * One whole-number setting, in days.
 *
 * The bounds are passed in rather than read here, because the period length's
 * maximum depends on the cycle length as well as on the domain's own limit.
 */
export function LengthStepper({
  label,
  note,
  value,
  min,
  max,
  decreaseLabel,
  increaseLabel,
  onChange,
  disabled,
}: {
  label: string;
  note: string;
  value: number;
  min: number;
  max: number;
  decreaseLabel: string;
  increaseLabel: string;
  onChange: (delta: number) => void;
  disabled: boolean;
}) {
  const theme = useTheme();
  const cycleSettings = useMessages(settingsMessages);

  const canDecrease = !disabled && value > min;
  const canIncrease = !disabled && value < max;

  return (
    <View style={styles.field}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>

      <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
        {note}
      </ThemedText>

      <View style={styles.stepper}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={decreaseLabel}
          accessibilityState={{ disabled: !canDecrease }}
          disabled={!canDecrease}
          onPress={() => onChange(-1)}
          style={({ pressed }) => [
            styles.stepButton,
            { borderColor: theme.backgroundSelected },
            !canDecrease && styles.stepButtonDisabled,
            pressed && canDecrease && styles.pressed,
          ]}>
          <ThemedText style={styles.stepButtonLabel}>−</ThemedText>
        </Pressable>

        <View
          accessible
          accessibilityLabel={cycleSettings.lengthValueLabel(label, value)}
          accessibilityValue={{ min, max, now: value }}
          style={styles.valueBlock}>
          <ThemedText style={styles.value}>{value}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {cycleSettings.daysUnit(value)}
          </ThemedText>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={increaseLabel}
          accessibilityState={{ disabled: !canIncrease }}
          disabled={!canIncrease}
          onPress={() => onChange(1)}
          style={({ pressed }) => [
            styles.stepButton,
            { borderColor: theme.backgroundSelected },
            !canIncrease && styles.stepButtonDisabled,
            pressed && canIncrease && styles.pressed,
          ]}>
          <ThemedText style={styles.stepButtonLabel}>+</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: Spacing.half,
  },
  note: {
    marginTop: Spacing.half,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.three,
  },
  stepButton: {
    minWidth: 56,
    minHeight: 56,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepButtonDisabled: {
    opacity: 0.35,
  },
  stepButtonLabel: {
    fontSize: 26,
    lineHeight: 30,
  },
  valueBlock: {
    alignItems: 'center',
    gap: Spacing.half,
  },
  value: {
    fontSize: 56,
    lineHeight: 62,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.85,
  },
});
