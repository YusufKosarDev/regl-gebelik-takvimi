import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import type { CycleCalendarDay } from '../application/build-cycle-calendar-month';
import type { CycleCalendarGrid } from '../presentation/build-cycle-calendar-grid';
import { cycleLabels } from '../presentation/cycle-labels';
import { homeMessages, selectedDayRowsIn } from '../presentation/home-messages';
import { CycleCalendar } from './cycle-calendar';
import { CycleCalendarLegend } from './cycle-calendar-legend';

import { Surface } from '@/components/surface';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { DailyEntry } from '@/features/daily-log/domain/catalogues';
import { hasAnything } from '@/features/daily-log/domain/catalogues';
import { dailyLogMessages } from '@/features/daily-log/presentation/daily-log-messages';
import { useTheme } from '@/hooks/use-theme';
import { useLanguage, useMessages } from '@/i18n';
import type { ISODate } from '@/types/iso-date';
import { daysBetween } from '@/utils/date';
import { formatDisplayDate } from '@/utils/format-date';
import { SkyStrip } from './sky-strip';
import type { SkyField } from '@/constants/sky';

/**
 * The month grid, the day picked in it, and what is recorded on that day.
 *
 * Lifted out of `index.tsx` unchanged: the same elements in the same order,
 * with the same text and the same handlers. The three parts travelled together
 * because they are one thing to use - tapping a square is what fills the card
 * underneath it.
 *
 * Which month is on screen, which day is picked and what is recorded on it are
 * all the screen’s to know; this component is told and draws. Working any of
 * them out again in here would be a second opinion that could disagree with the
 * one the rest of the screen is drawn from.
 */
export function CycleCalendarSection({
  today,
  monthHeading,
  canGoBack,
  canGoForward,
  setMonthOffset,
  calendarGrid,
  selectedDay,
  setPickedDate,
  pickedEntry,
  headerField,
  headerBleedTop,
}: {
  readonly today: ISODate;
  readonly monthHeading: string;
  readonly canGoBack: boolean;
  readonly canGoForward: boolean;
  readonly setMonthOffset: (update: (current: number) => number) => void;
  readonly calendarGrid: CycleCalendarGrid;
  readonly selectedDay: CycleCalendarDay | null;
  readonly setPickedDate: (date: ISODate) => void;
  readonly pickedEntry: DailyEntry | null;
  /** Today's sky, for the strip behind the header. */
  readonly headerField: SkyField;
  /** Top inset for the strip to reach back through, so the sky starts at the screen edge. */
  readonly headerBleedTop?: number;
}) {
  const router = useRouter();
  const theme = useTheme();
  const home = useMessages(homeMessages);
  const labels = useMessages(cycleLabels);
  const dailyLog = useMessages(dailyLogMessages);
  const language = useLanguage();

  return (
    <View style={styles.calendarSection}>
      {/* The strip of sky.

          The grid underneath it cannot be on a field: every phase accent
          measures under 3:1 against every sky, worst 1.19:1, so the colour
          that says which phase a day is in has to stay on the page where it
          was measured. The header is the one part of this screen carrying no
          data - a month's name and two arrows - which makes it the one part
          that can say what phase today is in at no cost.

          It bleeds past the content's padding on both sides, because a band
          with a margin either side is a card, and a card is what this screen
          just stopped having. */}
      <SkyStrip field={headerField} bleedTop={headerBleedTop} testID="calendar-field-strip">
        <ThemedText accessibilityRole="header" type="small">
          {home.calendarSectionTitle}
        </ThemedText>

        <View style={styles.monthBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={home.calendarPreviousMonthLabel}
          // Only at the edge of the range the calendar can show. Disabled and
          // silent about why is the gap; a hint on a working arrow would be
          // read out on every pass, and on Android cannot be turned off.
          accessibilityHint={canGoBack ? undefined : home.calendarMonthLimitHint}
          accessibilityState={{ disabled: !canGoBack }}
          disabled={!canGoBack}
          onPress={() => setMonthOffset((current) => current - 1)}
          style={({ pressed }) => [
            styles.monthButton,
            !canGoBack && styles.monthButtonDisabled,
            pressed && canGoBack && styles.pressed,
          ]}>
          <Icon name="chevron-left" />
        </Pressable>

        {/* The month arrows replace forty-two squares with the focus still on
            the arrow, so this heading says which month is now on screen. The
            grid itself is not a live region - announcing forty-two squares
            would read the month out. */}
        <ThemedText
          accessibilityLabel={home.calendarMonthLabel(monthHeading)}
          accessibilityLiveRegion="polite"
          style={styles.monthHeading}>
          {monthHeading}
        </ThemedText>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={home.calendarNextMonthLabel}
          accessibilityHint={canGoForward ? undefined : home.calendarMonthLimitHint}
          accessibilityState={{ disabled: !canGoForward }}
          disabled={!canGoForward}
          onPress={() => setMonthOffset((current) => current + 1)}
          style={({ pressed }) => [
            styles.monthButton,
            !canGoForward && styles.monthButtonDisabled,
            pressed && canGoForward && styles.pressed,
          ]}>
          <Icon name="chevron-right" />
        </Pressable>
        </View>
      </SkyStrip>

      <CycleCalendar
        grid={calendarGrid}
        today={today}
        selectedDate={selectedDay?.date ?? null}
        onSelectDay={(day) => setPickedDate(day.date)}
      />

      <View style={styles.selectedSection}>
        <ThemedText accessibilityRole="header" type="small" themeColor="textSecondary">
          {home.selectedDayTitle}
        </ThemedText>

        {selectedDay === null ? (
          <ThemedText themeColor="textSecondary">{home.selectedDayEmptyMessage}</ThemedText>
        ) : (
          // `lined` rather than `filled`. A fill is what makes a block read as
          // an object you can act on, and `Surface` spends it only where there
          // is an action inside - reading what a day holds is not one. The
          // "add to this day" button below carries its own outline and is the
          // thing on this screen worth looking like a control.
          //
          // It also stopped the panel competing with the grid. The month was
          // the one thing on this screen drawn in no colour at all, sitting
          // above the one block that had some.
          // Tapping a square rewrites this whole card with the focus still on
          // the square, so the card says what it now holds. `polite`, so it
          // waits for the gap rather than cutting off the square's own
          // announcement of the day that was just selected.
          <Surface level="lined" testID="selected-day-card" accessibilityLiveRegion="polite">
            <ThemedText accessibilityRole="header" style={styles.selectedDate}>
              {formatDisplayDate(selectedDay.date, language)}
            </ThemedText>
            {/* A row with no caveat is one line, and its visible text already
                reads "label: value", so it needs no separate accessibility
                label.

                A row with one is two lines and a single spoken stop. Drawing
                the caveat is not the same as saying it: on the home screen
                this week the same sentence was on screen and silently absent
                from what a screen reader announced, because the row collapsed
                into one node whose label left the note out. `SummaryRow` has
                the rule - the number and the warning about it cannot be
                separated - and a caveat announced as its own stop is one
                somebody can swipe past without hearing. */}
            {selectedDayRowsIn(home, labels, selectedDay).map((row) =>
              row.note === undefined ? (
                <ThemedText key={row.label} type="small">
                  {home.labelledValue(row.label, row.value)}
                </ThemedText>
              ) : (
                <View
                  key={row.label}
                  accessible
                  accessibilityLabel={home.labelledValueWithNote(
                    row.label,
                    row.value,
                    row.note
                  )}>
                  <ThemedText type="small">
                    {home.labelledValue(row.label, row.value)}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.rowNote}>
                    {row.note}
                  </ThemedText>
                </View>
              )
            )}

            {/* Past the predicted period the cycle day is still a real count
                from a real record, and the phase and fertility estimates are
                not offered at all - `selectedDayRowsIn` returns the one row.
                This says why, under it, rather than leaving two rows of
                "Bilinmiyor" to be read as a failure. */}
            {selectedDay.isBeyondHorizon && (
              <ThemedText type="small" themeColor="textSecondary">
                {home.countContinuesMessage}
              </ThemedText>
            )}

            {/* The third of the three places `without-prediction.ts` names.
                The start says it is the start; the days after it say they are
                days of the same predicted period, so selecting 11 November is
                not told the period begins that day as well. */}
            {selectedDay.isPredictedPeriodStart && (
              <ThemedText type="small" themeColor="textSecondary">
                {home.predictedPeriodStartNote}
              </ThemedText>
            )}

            {!selectedDay.isPredictedPeriodStart && selectedDay.isPredictedPeriodDay && (
              <ThemedText type="small" themeColor="textSecondary">
                {home.predictedPeriodDayNote}
              </ThemedText>
            )}

            {/* The way in for any day up to today. The label says which it
                is, so nobody has to guess whether there is already something
                there. Days that have not happened yet get no way in: a
                record dated tomorrow would be counted by the history and
                missed by the export, which ends at today. */}
            {daysBetween(selectedDay.date, today) >= 0 && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                pickedEntry?.date === selectedDay.date && hasAnything(pickedEntry)
                  ? dailyLog.calendarDayEditLabel
                  : dailyLog.calendarDayAddLabel
              }
              onPress={() => {
                router.push({
                  pathname: '/daily-entry',
                  params: { date: selectedDay.date },
                });
              }}
              style={({ pressed }) => [
                styles.dayEntryLink,
                { borderColor: theme.primary },
                pressed && styles.pressed,
              ]}>
              <ThemedText type="smallBold" themeColor="primary">
                {pickedEntry?.date === selectedDay.date && hasAnything(pickedEntry)
                  ? dailyLog.calendarDayEditLabel
                  : dailyLog.calendarDayAddLabel}
              </ThemedText>
            </Pressable>
            )}
          </Surface>
        )}
      </View>

      <CycleCalendarLegend />
    </View>
  );
}

const styles = StyleSheet.create({
  calendarSection: {
    gap: Spacing.two,
  },
  // The same offset `CycleSummary` gives its note, so the caveat sits under
  // the number it belongs to on both screens rather than reading as the next
  // row down.
  rowNote: {
    marginTop: Spacing.one,
  },
  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  monthButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.two,
  },
  monthButtonDisabled: {
    opacity: 0.3,
  },
  monthButtonLabel: {
    fontSize: 24,
    lineHeight: 28,
  },
  monthHeading: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'center',
  },
  selectedSection: {
    gap: Spacing.two,
  },
  selectedDate: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '600',
  },
  dayEntryLink: {
    minHeight: 48,
    borderRadius: Spacing.three,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.four,
    marginTop: Spacing.two,
  },
  pressed: {
    opacity: 0.6,
  },
});
