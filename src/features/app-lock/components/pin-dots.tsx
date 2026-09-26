import { StyleSheet, View } from 'react-native';

import { PIN_LENGTH } from '../domain/pin';
import { enteredDigitsLabel } from '../presentation/app-lock-messages';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * How much of the PIN is in, without showing any of it.
 *
 * Six dots, filled from the left. Nothing here ever receives a digit — the
 * screen passes a count, so there is no value in this component that could be
 * read off the screen, announced or logged.
 *
 * What a screen reader hears is the count and only the count. The length is
 * fixed and public; the digits are not.
 */
export function PinDots({ entered }: { readonly entered: number }) {
  const theme = useTheme();

  return (
    <View
      accessible
      accessibilityLabel={enteredDigitsLabel(entered)}
      accessibilityLiveRegion="polite"
      testID="pin-dots"
      style={styles.row}>
      {Array.from({ length: PIN_LENGTH }, (_, index) => (
        <View
          key={index}
          style={[
            styles.dot,
            { borderColor: theme.text },
            index < entered && { backgroundColor: theme.text },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
});
