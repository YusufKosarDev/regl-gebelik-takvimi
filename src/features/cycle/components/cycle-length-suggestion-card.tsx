import { Pressable, StyleSheet, View } from 'react-native';

import type { CycleLengthSuggestion } from '../domain/cycle-length-suggestion';
import { homeMessages } from '../presentation/home-messages';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useSky, useTheme } from '@/hooks/use-theme';

import { useOnSky } from './on-sky';
import { useMessages } from '@/i18n';

/**
 * The records and the setting disagreeing, put to the person.
 *
 * ## Why it asks instead of acting
 *
 * The number it is about is one the person typed in during onboarding. The app
 * has arithmetic that disagrees with it, which is a good reason to raise the
 * subject and not a good reason to overwrite their answer. Everything else in
 * this app that finds two versions of something asks the same way - the sync
 * conflict screen is the same shape - and a setting that silently drifted would
 * be the one place that did not.
 *
 * Both numbers are shown, always. "Update to 31 days" on its own asks somebody
 * to agree to a change without telling them what is changing.
 *
 * ## Why it owns nothing
 *
 * No state, like every other component here. Whether it is dismissed and
 * whether the write succeeded are facts about the screen's session, and the
 * screen is the only thing that knows if the write landed.
 */
export function CycleLengthSuggestionCard({
  suggestion,
  isBusy,
  hasFailed,
  onAccept,
  onDismiss,
}: {
  readonly suggestion: CycleLengthSuggestion;
  readonly isBusy: boolean;
  readonly hasFailed: boolean;
  readonly onAccept: () => void;
  readonly onDismiss: () => void;
}) {
  const theme = useTheme();
  const sky = useSky();
  const onSky = useOnSky();

  // Outlined rather than filled. The screen already has one solid object -
  // the period action - and a second says the two carry the same weight,
  // which they do not. The alpha on `inkLine` is measured: an outline is the
  // only thing telling this apart from a sentence, so it is information and
  // has to clear 3:1.
  const accept = onSky
    ? { borderWidth: 1, borderColor: sky.inkLine }
    : { backgroundColor: theme.primary };
  const home = useMessages(homeMessages);

  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText accessibilityRole="header" type="smallBold">
        {home.cycleLengthSuggestionTitle}
      </ThemedText>

      <ThemedText type="small" themeColor="textSecondary">
        {home.cycleLengthSuggestionBody(
          suggestion.observedMedianDays,
          suggestion.settingDays,
          suggestion.observationCount
        )}
      </ThemedText>

      {hasFailed ? (
        <ThemedText accessibilityRole="alert" type="small" themeColor="textSecondary">
          {home.cycleLengthSuggestionFailed}
        </ThemedText>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={home.cycleLengthSuggestionDismissLabel}
          accessibilityState={{ disabled: isBusy }}
          disabled={isBusy}
          onPress={onDismiss}
          style={({ pressed }) => [
            styles.dismiss,
            isBusy && styles.disabled,
            pressed && !isBusy && styles.pressed,
          ]}>
          <ThemedText type="small">
            {home.cycleLengthSuggestionDismissText}
          </ThemedText>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={home.cycleLengthSuggestionAcceptLabel(suggestion.observedMedianDays)}
          accessibilityState={{ disabled: isBusy }}
          disabled={isBusy}
          onPress={onAccept}
          style={({ pressed }) => [
            styles.accept,
            accept,
            isBusy && styles.disabled,
            pressed && !isBusy && styles.pressed,
          ]}>
          <ThemedText type="smallBold" style={onSky ? undefined : { color: theme.onPrimary }}>
            {home.cycleLengthSuggestionAcceptText(suggestion.observedMedianDays)}
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.two,
  },
  dismiss: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },
  accept: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.three,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.6,
  },
});
