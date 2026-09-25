import { Pressable, StyleSheet, View } from 'react-native';

import type { DailyEntry } from '../domain/catalogues';
import { hasAnything } from '../domain/catalogues';
import { summariseDailyEntry } from '../domain/summarise-daily-entry';
import {
  DAILY_CARD_ADD_LABEL,
  DAILY_CARD_EDIT_LABEL,
  DAILY_CARD_EMPTY_HINT,
  DAILY_CARD_EMPTY_TITLE,
  DAILY_CARD_FILLED_TITLE,
  DAILY_SUMMARY_SEPARATOR,
  symptomCountLabel,
} from '../presentation/daily-log-messages';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

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

  const filled = hasAnything(entry);
  const summary = summariseDailyEntry(entry, symptomCountLabel);

  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
      <View style={styles.text}>
        <ThemedText accessibilityRole="header" type="smallBold">
          {filled ? DAILY_CARD_FILLED_TITLE : DAILY_CARD_EMPTY_TITLE}
        </ThemedText>

        <ThemedText type="small" themeColor="textSecondary">
          {filled ? summary.join(DAILY_SUMMARY_SEPARATOR) : DAILY_CARD_EMPTY_HINT}
        </ThemedText>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={filled ? DAILY_CARD_EDIT_LABEL : DAILY_CARD_ADD_LABEL}
        onPress={onOpen}
        style={({ pressed }) => [
          styles.action,
          { backgroundColor: theme.primary },
          pressed && styles.pressed,
        ]}>
        <ThemedText type="smallBold" themeColor="onPrimary">
          {filled ? DAILY_CARD_EDIT_LABEL : DAILY_CARD_ADD_LABEL}
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.four,
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
