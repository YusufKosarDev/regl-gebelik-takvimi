import { Pressable, StyleSheet, View } from 'react-native';

import { LOCK_DELETE_DIGIT_LABEL, digitLabel } from '../presentation/app-lock-messages';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * The keys.
 *
 * A pad of our own rather than a `TextInput` with a numeric keyboard. Three
 * reasons: what the system keyboard offers varies by OEM and by whichever
 * keyboard app somebody installed, a keyboard can suggest and autofill, and
 * TalkBack's reading of a secure field is not something this app gets to
 * decide. Here it is.
 *
 * The pad holds no state and knows no PIN. It reports key presses; the screen
 * counts them.
 */

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

export function PinPad({
  onDigit,
  onDelete,
  disabled,
}: {
  readonly onDigit: (digit: string) => void;
  readonly onDelete: () => void;
  readonly disabled: boolean;
}) {
  const theme = useTheme();

  const key = (label: string, onPress: () => void, accessibilityLabel: string, testID: string) => (
    <Pressable
      key={testID}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.key,
        { borderColor: theme.backgroundSelected },
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}>
      <ThemedText style={styles.keyLabel}>{label}</ThemedText>
    </Pressable>
  );

  return (
    <View style={styles.pad} testID="pin-pad">
      {KEYS.map((digit) =>
        key(digit, () => onDigit(digit), digitLabel(digit), `pin-key-${digit}`)
      )}

      {/* The gap under 7 rather than a key nobody asked for. It takes the
          key's size so the row lines up, and none of its border: drawn, it
          reads as a key that does nothing. */}
      <View
        style={styles.spacer}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />

      {key('0', () => onDigit('0'), digitLabel('0'), 'pin-key-0')}

      {key('⌫', onDelete, LOCK_DELETE_DIGIT_LABEL, 'pin-key-delete')}
    </View>
  );
}

const styles = StyleSheet.create({
  pad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.three,
    maxWidth: 320,
    alignSelf: 'center',
  },
  /**
   * Sized so three fit a narrow phone with the gaps, and so the row still has
   * room at a larger font scale. The label scales; the key does not shrink.
   */
  key: {
    width: 88,
    minHeight: 64,
    borderRadius: Spacing.three,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spacer: {
    width: 88,
    minHeight: 64,
  },
  keyLabel: {
    fontSize: 24,
    lineHeight: 32,
  },
  disabled: {
    opacity: 0.3,
  },
  pressed: {
    opacity: 0.6,
  },
});
