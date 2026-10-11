import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useOnSky } from '@/features/cycle/components/on-sky';
import { useSky, useTheme } from '@/hooks/use-theme';

/**
 * What a screen says when it has nothing to show, and what to do about it.
 *
 * ## Ours
 *
 * Nothing here is taken. The app this follows structurally shows empty states
 * in its store screenshots the way every app does - an illustration, a line
 * and a button - and that is a shape, not a reason. What follows is about this
 * app.
 *
 * ## What was wrong with the nine we had
 *
 * Nine screens had one, and every one of them was a sentence. They are all
 * true and most of them are fine: an export screen with no records has nothing
 * for a button to do, and inventing one would be worse than the sentence.
 *
 * The home screen's was not fine. Somebody with no cycle recorded met "döngü
 * bilgisi bulunamadı" on a screen that offered no way to record one - a
 * statement of the problem standing where the answer should be. That is the
 * state the onboarding's skip lands in, which is why the skip waited for this.
 *
 * ## No illustration
 *
 * A drawing here would be the only illustration in the app outside the avatar,
 * and it would be doing what the sentence already does. The same argument
 * `icon.tsx` makes about its closed set of two.
 *
 * ## It is made of whatever is behind it
 *
 * The home screen's empty state sits on the waking sky, so the words take the
 * field's ink and the action is filled with it. Off a field both come from the
 * page palette. A page colour on a field measures 1.97:1 on the light skies,
 * which is the mistake `constants/sky.ts` exists to describe.
 */
export function EmptyState({
  message,
  actionLabel,
  onAction,
}: {
  readonly message: string;
  /** Left out, the state is a sentence - which is right where there is
   * genuinely nothing to do, and a decision rather than the default. */
  readonly actionLabel?: string;
  readonly onAction?: () => void;
}) {
  const theme = useTheme();
  const sky = useSky();
  const onSky = useOnSky();

  const hasAction = actionLabel !== undefined && onAction !== undefined;

  return (
    <View style={styles.empty}>
      <ThemedText
        type="subtitle"
        style={[styles.message, { color: onSky ? sky.ink : theme.text }]}>
        {message}
      </ThemedText>

      {hasAction && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          onPress={onAction}
          style={({ pressed }) => [
            styles.action,
            { backgroundColor: onSky ? sky.ink : theme.primary },
            pressed && styles.pressed,
          ]}>
          <ThemedText type="smallBold" style={{ color: onSky ? sky.onInk : theme.onPrimary }}>
            {actionLabel}
          </ThemedText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    alignItems: 'center',
    gap: Spacing.four,
    paddingHorizontal: Spacing.four,
  },
  message: {
    textAlign: 'center',
  },
  action: {
    minHeight: 48,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  pressed: {
    opacity: 0.6,
  },
});
