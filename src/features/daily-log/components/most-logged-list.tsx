import { StyleSheet, View } from 'react-native';

import type { LoggedCount } from '../domain/most-logged';
import { dailyLogCatalogueLabels, labelFor } from '../presentation/daily-log-catalogues';
import { dailyLogHistoryMessages } from '../presentation/daily-log-history-messages';
import { dailyLogMessages } from '../presentation/daily-log-messages';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useMessages } from '@/i18n';

/**
 * What gets written down most, as the first thing on the screen.
 *
 * ## Why this is above the distribution and not below it
 *
 * Cycles opens its insights with rows of counts rather than with a chart, and
 * that order is the part worth taking. Somebody opening this screen arrived
 * with a question; a chart hands them the working and asks them to do the
 * answering. The distribution across phases is the more interesting fact and
 * it stays - underneath, where somebody who wants it will look.
 *
 * ## It counts days, and says days
 *
 * The number is how many days hold the thing. It is not how often the thing
 * happened, which this app has no way of knowing, and the wording is the only
 * thing standing between a count and a claim - so it says "11 gün" rather than
 * "11 kez" and the row reads as a record of what was written down.
 *
 * `mostLogged` is counted over every day, including the ones the cycle cannot
 * place. The reasoning is in that file; the short version is that using the
 * correlation's own count here would have shown zero to anybody who had not
 * recorded a period yet.
 *
 * ## Three named groups, not one run of rows
 *
 * This took symptoms and moods and concatenated them, so "Kramp" and "İyi"
 * sat in one column with nothing saying that the first is something that
 * happened to somebody and the second is how they felt about the day. The two
 * arrived as separate arguments and were merged on the way to the screen.
 *
 * They are named now, and named with the editor's own words - the same
 * `flowSectionTitle`, `symptomsSectionTitle` and `moodSectionTitle` that head
 * the three sections somebody filled in. A count and the thing it counts
 * should not need two vocabularies.
 *
 * Naming them is also what lets flow in. It was left out entirely, and as a
 * fourth unlabelled row "Orta - 11 gün" would have read as a symptom called
 * Orta. Under its own heading it is what it is: how many days were recorded at
 * that flow.
 *
 * Each group also looks its ids up in its own catalogue. The merged version
 * tried the symptoms first and fell through to the moods, which is a lookup
 * that only works while no two catalogues share an id.
 *
 * ## Empty says so
 *
 * The same rule `PhaseCorrelationSummary` keeps: a blank block reads as the
 * screen having failed rather than as there being nothing to show. It is the
 * whole block that is empty or not - a group with no rows is simply absent,
 * because a heading over nothing says less than no heading at all.
 *
 * Stateless. The counts arrive computed and the only work here is turning ids
 * into words - and dropping the ones this language has no word for, which can
 * only be a retired entry that a stored day still names.
 */
export function MostLoggedList({
  flows,
  symptoms,
  moods,
}: {
  readonly flows: readonly LoggedCount[];
  readonly symptoms: readonly LoggedCount[];
  readonly moods: readonly LoggedCount[];
}) {
  const history = useMessages(dailyLogHistoryMessages);
  const strings = useMessages(dailyLogMessages);
  const labels = useMessages(dailyLogCatalogueLabels);

  const named = (
    counts: readonly LoggedCount[],
    lookup: Readonly<Record<string, string>>
  ): { id: string; label: string; count: number }[] =>
    counts.flatMap((row) => {
      const label = labelFor(lookup, row.id);

      return label === null ? [] : [{ id: row.id, label, count: row.count }];
    });

  const groups = [
    { key: 'flow', title: strings.flowSectionTitle, rows: named(flows, labels.flows) },
    { key: 'symptom', title: strings.symptomsSectionTitle, rows: named(symptoms, labels.symptoms) },
    { key: 'mood', title: strings.moodSectionTitle, rows: named(moods, labels.moods) },
  ].filter((group) => group.rows.length > 0);

  return (
    <View style={styles.list}>
      <ThemedText accessibilityRole="header" type="smallBold">
        {history.mostLoggedTitle}
      </ThemedText>

      {groups.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          {history.mostLoggedEmpty}
        </ThemedText>
      ) : (
        groups.map((group) => (
          <View key={group.key} style={styles.group}>
            <ThemedText accessibilityRole="header" type="small" themeColor="textSecondary">
              {group.title}
            </ThemedText>

            {group.rows.map((row) => (
              // One spoken stop for the pair. A label and a number announced
              // separately is a row somebody has to put back together.
              <View
                key={row.id}
                accessible
                accessibilityLabel={history.mostLoggedRowLabel(row.label, row.count)}
                style={styles.row}>
                <ThemedText type="small">{row.label}</ThemedText>

                <ThemedText type="small" themeColor="textSecondary">
                  {history.mostLoggedDays(row.count)}
                </ThemedText>
              </View>
            ))}
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.two,
  },
  group: {
    gap: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    // The count to the far edge, the word at the near one, which is what makes
    // a handful of rows scan as a column rather than as sentences.
    justifyContent: 'space-between',
    gap: Spacing.three,
    minHeight: 32,
  },
});
