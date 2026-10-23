import { StyleSheet, View } from 'react-native';

import { homeMessages } from '../presentation/home-messages';

import { Surface } from '@/components/surface';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useMessages } from '@/i18n';

/**
 * The four facts about today, at the top of the cycle view.
 *
 * Lifted out of `index.tsx` unchanged. It is handed the rows rather than
 * building them, so what a row says stays in one place - beside the wording
 * for the calendar rows, which are the same four facts about a different day.
 *
 * ## The note is spoken, and for a while it was not
 *
 * Each row is one accessibility node - `accessible` on the surface - because a
 * label and a value read as two stops is a row somebody has to assemble in
 * their head. The cost of collapsing a row is that nothing inside it is read
 * on its own, so everything the row says has to be in the one label.
 *
 * It was not. Every row was labelled with `labelledValue(label, value)`, and
 * the only row that has a note is the fertility row, whose note says the
 * estimate must not be used as a method of contraception. That sentence was
 * drawn on screen and silently dropped from what a screen reader said - so the
 * reading was offered without its caveat to exactly the people who could not
 * see the caveat.
 *
 * This file and {@link SummaryRow} both claimed otherwise in prose, which is
 * how it survived: the note "travels with the row ... so the number and the
 * warning about it cannot be separated" was true of the model and false of the
 * rendering, and no test asked. `cycle-summary.test.tsx` asks now.
 */
export function CycleSummary({
  rows,
}: {
  readonly rows: readonly { label: string; value: string; note?: string }[];
}) {
  const home = useMessages(homeMessages);

  return (
    <View style={styles.summary}>
      {rows.map((row) => (
        <Surface
          key={row.label}
          level="lined"
          accessible
          accessibilityLabel={
            row.note === undefined
              ? home.labelledValue(row.label, row.value)
              : home.labelledValueWithNote(row.label, row.value, row.note)
          }>
          <ThemedText type="small" themeColor="textSecondary">
            {row.label}
          </ThemedText>
          <ThemedText type="display">{row.value}</ThemedText>
          {row.note !== undefined && (
            <ThemedText type="small" themeColor="textSecondary" style={styles.rowNote}>
              {row.note}
            </ThemedText>
          )}
        </Surface>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  summary: {
    gap: Spacing.two,
  },
  rowNote: {
    marginTop: Spacing.one,
  },
});
