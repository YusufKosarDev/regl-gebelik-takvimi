import { Pressable, StyleSheet, View } from 'react-native';

import type { DailyEntry } from '../domain/catalogues';
import { hasAnything } from '../domain/catalogues';
import { summariseDailyEntry } from '../domain/summarise-daily-entry';
import { dailyLogCatalogueLabels } from '../presentation/daily-log-catalogues';
import { dailyLogMessages } from '../presentation/daily-log-messages';

import { useMessages } from '@/i18n';

import { Surface } from '@/components/surface';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useOnSky } from '@/features/cycle/components/on-sky';
import { useSky, useTheme } from '@/hooks/use-theme';

/**
 * Today, on the home screen.
 *
 * Its own file rather than another hundred lines inside `index.tsx`, which is
 * already long enough that finding anything in it is a search.
 *
 * Two states and no more. Before anything is recorded it asks; afterwards it
 * says what is there and offers to change it. Three lines at most either way,
 * because it sits above the calendar and every line it takes is one the rest of
 * the screen does not get.
 *
 * It says nothing about what the day means. The summary names the flow, counts
 * the symptoms and names the mood, in that order, and stops.
 */
export function DailyEntryCard({
  entry,
  onOpen,
}: {
  readonly entry: DailyEntry;
  readonly onOpen: () => void;
}) {
  const theme = useTheme();
  const sky = useSky();
  const onSky = useOnSky();

  // Outlined rather than filled. The screen already has one solid object -
  // the period action - and a second says the two carry the same weight,
  // which they do not. The alpha on `inkLine` is measured: an outline is the
  // only thing telling this apart from a sentence, so it is information and
  // has to clear 3:1.
  const action = onSky
    ? { borderWidth: 1, borderColor: sky.inkLine }
    : { backgroundColor: theme.primary };
  const strings = useMessages(dailyLogMessages);
  const labels = useMessages(dailyLogCatalogueLabels);

  const filled = hasAnything(entry);
  const summary = summariseDailyEntry(
    entry,
    strings.symptomCountLabel,
    labels.flows,
    labels.moods
  );

  return (
    // A block with an action inside it, which is what `filled` is for. It
    // used to paint `backgroundElement` itself, and on the sky that is a grey
    // hole in the light scheme and a near-black one in the dark - the card
    // ended up further from the field than anything else on the screen.
    //
    // Going through `Surface` is also what makes the glass reach it: a block
    // that paints its own background is a block the field cannot get into.
    <Surface level="filled" style={styles.card}>
      <View style={styles.text}>
        <ThemedText accessibilityRole="header" type="smallBold">
          {filled ? strings.cardFilledTitle : strings.cardEmptyTitle}
        </ThemedText>

        <ThemedText type="small" themeColor="textSecondary">
          {filled ? summary.join(strings.summarySeparator) : strings.cardEmptyHint}
        </ThemedText>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={filled ? strings.cardEditLabel : strings.cardAddLabel}
        onPress={onOpen}
        style={({ pressed }) => [
          styles.action,
          action,
          pressed && styles.pressed,
        ]}>
        <ThemedText type="smallBold" style={onSky ? undefined : { color: theme.onPrimary }}>
          {filled ? strings.cardEditLabel : strings.cardAddLabel}
        </ThemedText>
      </Pressable>
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: {
    // The radius and the padding come from `Surface`; only the rhythm inside
    // is this card's own.
    gap: Spacing.three,
  },
  text: {
    gap: Spacing.half,
  },
  action: {
    // The same minimum every other button in this app uses, so it stays a
    // comfortable target at any text size.
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
