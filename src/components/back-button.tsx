import { useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { BACK_LABEL } from '@/shared/presentation/app-messages';

/**
 * The way back, on the eleven screens that have one.
 *
 * It was written out once per screen, and the copies had drifted into three
 * different boxes around identical markup:
 *
 *   - seven screens had `minHeight: 44` with a right-hand pad;
 *   - two had the same height and no pad;
 *   - three had **no minimum height at all**, just vertical padding, which put
 *     them under the 44dp touch target on the one control every screen has.
 *
 * That third group is why this is a component rather than a shared style. A
 * style object still has to be reached for, and three screens had not reached
 * for it; a component cannot be half-adopted.
 *
 * The box is the seven-screen one, because it was both the majority and the
 * one that was already right.
 *
 * It calls `useRouter()` itself rather than taking `onPress`. Every one of the
 * eleven did exactly `router.back()`, and a prop would be an invitation to
 * make the twelfth do something else - at which point it is not the back
 * button any more and should say so with its own name.
 */
export function BackButton() {
  const router = useRouter();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={BACK_LABEL}
      onPress={() => router.back()}
      style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
    >
      <ThemedText type="small" themeColor="textSecondary">
        {BACK_LABEL}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backButton: {
    minHeight: 44,
    justifyContent: 'center',
    alignSelf: 'flex-start',
    paddingRight: Spacing.three,
  },
  pressed: {
    opacity: 0.7,
  },
});
