import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import type { CycleCalendarDay } from '../application/build-cycle-calendar-month';
import type { CycleCalendarGrid } from '../presentation/build-cycle-calendar-grid';
import {
  CALENDAR_NEXT_MONTH_LABEL,
  CALENDAR_PREVIOUS_MONTH_LABEL,
  CALENDAR_SECTION_TITLE,
  PREDICTED_PERIOD_START_NOTE,
  SELECTED_DAY_EMPTY_MESSAGE,
  SELECTED_DAY_TITLE,
  labelledValue,
  calendarMonthLabel,
  selectedDayRows,
} from '../presentation/home-messages';
import { CycleCalendar } from './cycle-calendar';
import { CycleCalendarLegend } from './cycle-calendar-legend';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { DailyEntry } from '@/features/daily-log/domain/catalogues';
import { hasAnything } from '@/features/daily-log/domain/catalogues';
import {
  CALENDAR_DAY_ADD_LABEL,
  CALENDAR_DAY_EDIT_LABEL,
} from '@/features/daily-log/presentation/daily-log-messages';
import { useTheme } from '@/hooks/use-theme';
import type { ISODate } from '@/types/iso-date';
import { formatDisplayDate } from '@/utils/format-date';

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
}) {
  const router = useRouter();
  const theme = useTheme();

  return (
    <View style={styles.calendarSection}>
      <ThemedText
        accessibilityRole="header"
        type="small"
        themeColor="textSecondary">
        {CALENDAR_SECTION_TITLE}
      </ThemedText>

      <View style={styles.monthBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={CALENDAR_PREVIOUS_MONTH_LABEL}
          accessibilityState={{ disabled: !canGoBack }}
          disabled={!canGoBack}
          onPress={() => setMonthOffset((current) => current - 1)}
          style={({ pressed }) => [
            styles.monthButton,
            !canGoBack && styles.monthButtonDisabled,
            pressed && canGoBack && styles.pressed,
          ]}>
          <ThemedText style={styles.monthButtonLabel}>‹</ThemedText>
        </Pressable>

        <ThemedText
          accessibilityLabel={calendarMonthLabel(monthHeading)}
          style={styles.monthHeading}>
          {monthHeading}
        </ThemedText>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={CALENDAR_NEXT_MONTH_LABEL}
          accessibilityState={{ disabled: !canGoForward }}
          disabled={!canGoForward}
          onPress={() => setMonthOffset((current) => current + 1)}
          style={({ pressed }) => [
            styles.monthButton,
            !canGoForward && styles.monthButtonDisabled,
            pressed && canGoForward && styles.pressed,
          ]}>
          <ThemedText style={styles.monthButtonLabel}>›</ThemedText>
        </Pressable>
      </View>

      <CycleCalendar
        grid={calendarGrid}
        today={today}
        selectedDate={selectedDay?.date ?? null}
        onSelectDay={(day) => setPickedDate(day.date)}
      />

      <View style={styles.selectedSection}>
        <ThemedText accessibilityRole="header" type="small" themeColor="textSecondary">
          {SELECTED_DAY_TITLE}
        </ThemedText>

        {selectedDay === null ? (
          <ThemedText themeColor="textSecondary">{SELECTED_DAY_EMPTY_MESSAGE}</ThemedText>
        ) : (
          <View style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText accessibilityRole="header" style={styles.selectedDate}>
              {formatDisplayDate(selectedDay.date)}
            </ThemedText>

            {/* The visible text already reads "label: value", so it
                needs no separate accessibility label. */}
            {selectedDayRows(selectedDay).map((row) => (
              <ThemedText key={row.label} type="small">
                {labelledValue(row.label, row.value)}
              </ThemedText>
            ))}

            {selectedDay.isPredictedPeriodStart && (
              <ThemedText type="small" themeColor="textSecondary">
                {PREDICTED_PERIOD_START_NOTE}
              </ThemedText>
            )}

            {/* The way in for any day that is not today. The label
                says which it is, so nobody has to guess whether
                there is already something there. */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                pickedEntry?.date === selectedDay.date && hasAnything(pickedEntry)
                  ? CALENDAR_DAY_EDIT_LABEL
                  : CALENDAR_DAY_ADD_LABEL
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
                  ? CALENDAR_DAY_EDIT_LABEL
                  : CALENDAR_DAY_ADD_LABEL}
              </ThemedText>
            </Pressable>
          </View>
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
  row: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    gap: Spacing.half,
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
