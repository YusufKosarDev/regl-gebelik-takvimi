import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { ISODate } from '@/types/iso-date';
import { addDays, getDayOfMonth, getISOWeekday } from '@/utils/date';

/**
 * The week the day being logged sits in, as seven things to tap.
 *
 * ## Why it is here at all
 *
 * The day was decided somewhere else and arrived as a parameter, so logging
 * yesterday meant going back to the calendar, finding yesterday and coming in
 * again. Logging is a thing people do a day or two late - that is most of what
 * this screen is for - and Cycles answers it by putting the week along the top
 * of the log itself. This is that, and it is the second thing taken from that
 * app after the calendar's bands.
 *
 * A week rather than a month: seven fits across a phone at a readable size
 * without scrolling, and the month is a tap away on its own tab for anything
 * older.
 *
 * ## Monday first
 *
 * Same as the calendar grid, from the same seven words. They are handed in
 * rather than looked up here, because the calendar already owns them and a
 * second copy in this feature is how the grid ends up saying "Pzt" while the
 * strip says "Pt".
 *
 * ## What it does not do
 *
 * It does not tint period days, which the app it is taken from does. The data
 * for that is the cycle profile, which this screen does not read and would
 * have to start reading; the strip is navigation either way, and a strip that
 * is also a tiny calendar is a second place for the calendar to be wrong.
 */
export function WeekStrip({
  date,
  onSelect,
  weekdayLabels,
  dayLabelFor,
  disabled = false,
}: {
  /** The day being edited. The week drawn is the one containing it. */
  readonly date: ISODate;
  readonly onSelect: (date: ISODate) => void;
  /** Monday first, from the catalogue the calendar grid is drawn from. */
  readonly weekdayLabels: readonly string[];
  /** The whole date, spoken. "8" is not a date. */
  readonly dayLabelFor: (date: ISODate) => string;
  readonly disabled?: boolean;
}) {
  const theme = useTheme();

  // `getISOWeekday` is 1 on Monday, so this is how far back the Monday is.
  const monday = addDays(date, -(getISOWeekday(date) - 1));

  return (
    <View style={styles.strip}>
      {weekdayLabels.map((label, index) => {
        const day = addDays(monday, index);
        const isSelected = day === date;

        return (
          <Pressable
            key={day}
            accessibilityRole="button"
            accessibilityLabel={dayLabelFor(day)}
            accessibilityState={{ selected: isSelected, disabled }}
            disabled={disabled}
            onPress={() => onSelect(day)}
            style={({ pressed }) => [
              styles.day,
              isSelected && { backgroundColor: theme.primary },
              disabled && styles.disabled,
              pressed && !disabled && styles.pressed,
            ]}>
            {/* The weekday word stays in the secondary colour whether or not
                the day is selected: it is the same word on all seven and says
                nothing about which one is being edited. */}
            <ThemedText
              type="small"
              themeColor={isSelected ? 'onPrimary' : 'textSecondary'}
              style={styles.weekday}>
              {label}
            </ThemedText>

            <ThemedText
              type={isSelected ? 'smallBold' : 'small'}
              themeColor={isSelected ? 'onPrimary' : 'text'}>
              {getDayOfMonth(day)}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
  day: {
    flex: 1,
    // The seven are the first thing touched on this screen and the narrowest
    // controls on it, so the target is the floor rather than the look.
    minHeight: 56,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.half,
    paddingVertical: Spacing.two,
  },
  weekday: {
    fontSize: 11,
    lineHeight: 14,
  },
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.6,
  },
});
