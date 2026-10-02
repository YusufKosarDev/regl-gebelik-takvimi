import { Pressable, StyleSheet, View } from 'react-native';

import type { DailyEntry } from '../domain/catalogues';
import { hasAnything } from '../domain/catalogues';
import { summariseDailyEntry } from '../domain/summarise-daily-entry';
import { dailyLogCatalogueLabels } from '../presentation/daily-log-catalogues';
import { dailyLogHistoryMessages } from '../presentation/daily-log-history-messages';
import { dailyLogMessages } from '../presentation/daily-log-messages';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { CycleCalendarGrid } from '@/features/cycle/presentation/build-cycle-calendar-grid';
import { homeMessages } from '@/features/cycle/presentation/home-messages';
import { useFontScale } from '@/hooks/use-font-scale';
import { useTheme } from '@/hooks/use-theme';
import { useLanguage, useMessages } from '@/i18n';
import type { ISODate } from '@/types/iso-date';
import { getDayOfMonth } from '@/utils/date';
import { formatDisplayDate } from '@/utils/format-date';

/**
 * A month with a dot on every day that has something written on it.
 *
 * ## Why this is not `CycleCalendar` with another prop
 *
 * The two draw the same seven-column layout and answer different questions.
 * `CycleCalendar` is about the cycle: it fills and outlines days by phase and
 * fertility, and carries a legend explaining those letters. This is about the
 * log, and a day here is interesting because something was written on it -
 * adding that to the other one would mean a square trying to say two things at
 * once, and a legend explaining both.
 *
 * What is shared is the part worth sharing: `buildCycleCalendarGridForMonth`
 * lays both of them out, so the two calendars can never disagree about which
 * column a date belongs in or how many rows a month needs.
 *
 * Stateless, like every component here. Which month is on screen and which day
 * is picked belong to the screen.
 */
export function EntryMonthGrid({
  grid,
  entriesByDate,
  onSelectDay,
}: {
  readonly grid: CycleCalendarGrid;
  readonly entriesByDate: ReadonlyMap<ISODate, DailyEntry>;
  readonly onSelectDay: (date: ISODate) => void;
}) {
  const theme = useTheme();
  const home = useMessages(homeMessages);
  const history = useMessages(dailyLogHistoryMessages);
  const strings = useMessages(dailyLogMessages);
  const labels = useMessages(dailyLogCatalogueLabels);
  const language = useLanguage();
  const fontScale = useFontScale();

  return (
    <View style={styles.month}>
      <View style={styles.weekdayRow}>
        {home.weekdayLabels.map((weekday, index) => (
          <ThemedText
            key={`weekday-${index}`}
            type="small"
            themeColor="textSecondary"
            style={styles.weekday}>
            {weekday}
          </ThemedText>
        ))}
      </View>

      <View style={styles.grid}>
        {grid.cells.map((cell, index) => {
          if (cell.kind === 'empty') {
            return (
              <View
                key={`empty-${index}`}
                testID={`log-empty-${index}`}
                style={[styles.cell, { minHeight: CELL_CONTENT_HEIGHT * fontScale }]}
              />
            );
          }

          const { date } = cell.day;
          const entry = entriesByDate.get(date);
          const isMarked = entry !== undefined && hasAnything(entry);

          const readableDate = formatDisplayDate(date, language);
          const summary =
            entry === undefined
              ? ''
              : summariseDailyEntry(
                  entry,
                  strings.symptomCountLabel,
                  labels.flows,
                  labels.moods
                ).join(strings.summarySeparator);

          return (
            <Pressable
              key={date}
              testID={`log-day-${date}`}
              accessibilityRole="button"
              accessibilityLabel={
                isMarked
                  ? history.markedDayLabel(readableDate, summary)
                  : history.unmarkedDayLabel(readableDate)
              }
              onPress={() => onSelectDay(date)}
              style={({ pressed }) => [
                styles.cell,
                { minHeight: CELL_CONTENT_HEIGHT * fontScale },
                pressed && styles.pressed,
              ]}>
              <View
                style={[
                  styles.dayBox,
                  isMarked && { backgroundColor: theme.backgroundSelected },
                ]}>
                <ThemedText type="small" style={styles.dayNumber}>
                  {getDayOfMonth(date)}
                </ThemedText>

                {/* Reserved whether or not the day is marked, so every square
                    is the same height and the grid does not jump as months
                    change. */}
                <ThemedText
                  type="small"
                  themeColor={isMarked ? 'primary' : 'textSecondary'}
                  style={styles.marker}>
                  {isMarked ? history.markedDayMarker : ' '}
                </ThemedText>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Seven columns, matching the cycle calendar so the two line up. */
const COLUMN_WIDTH = '14.2857%';

/** What a square needs for its number and its dot at the default font setting. */
const CELL_CONTENT_HEIGHT = 44;

const styles = StyleSheet.create({
  month: {
    gap: Spacing.two,
  },
  weekdayRow: {
    flexDirection: 'row',
  },
  weekday: {
    width: COLUMN_WIDTH,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: COLUMN_WIDTH,
    aspectRatio: 1,
    padding: Spacing.half,
  },
  dayBox: {
    flex: 1,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumber: {
    textAlign: 'center',
  },
  marker: {
    lineHeight: 14,
  },
  pressed: {
    opacity: 0.6,
  },
});
