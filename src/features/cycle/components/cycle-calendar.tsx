import { StyleSheet, View } from 'react-native';

import type { CycleCalendarDay } from '../application/build-cycle-calendar-month';
import type { CalendarGridCell, CycleCalendarGrid } from '../presentation/build-cycle-calendar-grid';
import { getCalendarDayAccessibilityLabel } from '../presentation/cycle-labels';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { ISODate } from '@/types/iso-date';
import { getDayOfMonth } from '@/utils/date';

/** 100 / 7, wide enough that seven columns still fit on one row. */
const COLUMN_WIDTH = '14.2857%';

const TODAY_LABEL = 'Bugün';

type CycleCalendarProps = {
  readonly grid: CycleCalendarGrid;
  /**
   * Optional, so the component still renders any month on its own. Left out,
   * nothing is marked as today.
   */
  readonly today?: ISODate;
};

/**
 * What makes one square look different from the rest.
 *
 * The order is fixed so a day that qualifies twice — an ovulation day is also
 * the peak day — gets exactly one treatment instead of two stacked on top of
 * each other.
 */
type DayState = 'menstrual' | 'ovulatory' | 'peak' | 'elevated' | 'default';

function resolveDayState(day: CycleCalendarDay): DayState {
  if (day.phase === 'menstrual') return 'menstrual';
  if (day.phase === 'ovulatory') return 'ovulatory';
  if (day.fertilityLevel === 'peak') return 'peak';
  if (day.fertilityLevel === 'elevated') return 'elevated';
  return 'default';
}

/**
 * A short glyph under the number.
 *
 * Every state that has a fill or a border also carries one of these, so the
 * calendar never asks a person to tell days apart by colour alone.
 */
const STATE_MARKERS: Readonly<Record<DayState, string>> = {
  menstrual: 'R',
  ovulatory: 'Y',
  peak: '●',
  elevated: '○',
  default: '',
};

/** Deliberately not a solid mark: this day is predicted, not recorded. */
const PREDICTED_MARKER = '≈';

/**
 * Renders a prepared month grid. Nothing is computed here.
 *
 * Which day falls in which column, how many rows there are and what the domain
 * thinks of each day are all settled before this component runs. It reads
 * `grid.weekdayLabels` and `grid.cells` and lays them out, so the picture can
 * never disagree with the model behind it.
 */
export function CycleCalendar({ grid, today }: CycleCalendarProps) {
  return (
    <View style={styles.calendar}>
      <View style={styles.row}>
        {grid.weekdayLabels.map((label) => (
          <View key={label} style={styles.weekdayCell}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
              {label}
            </ThemedText>
          </View>
        ))}
      </View>

      <View style={styles.row}>
        {grid.cells.map((cell, index) => (
          <GridCell key={cellKey(cell, index)} cell={cell} index={index} today={today} />
        ))}
      </View>
    </View>
  );
}

function cellKey(cell: CalendarGridCell, index: number): string {
  return cell.kind === 'day' ? cell.day.date : `empty-${index}`;
}

function GridCell({
  cell,
  index,
  today,
}: {
  cell: CalendarGridCell;
  index: number;
  today?: ISODate;
}) {
  if (cell.kind === 'empty') {
    // Holds the column open and nothing else: no number, and no accessible node
    // for a screen reader to stop on. Padding is never today.
    return <View testID={`calendar-empty-${index}`} style={styles.dayCell} />;
  }

  return <DayCell day={cell.day} isToday={today === cell.day.date} />;
}

function DayCell({ day, isToday }: { day: CycleCalendarDay; isToday: boolean }) {
  const theme = useTheme();
  const state = resolveDayState(day);
  const marker = STATE_MARKERS[state];

  return (
    // The ring sits on the outer cell so it never competes with the fill or
    // border the day's cycle state already uses on the box inside.
    <View
      testID={isToday ? `calendar-today-${day.date}` : undefined}
      style={[styles.dayCell, isToday && { borderWidth: 1, borderColor: theme.textSecondary }]}>
      <View
        accessible
        accessibilityLabel={getCalendarDayAccessibilityLabel(day, { isToday })}
        testID={`calendar-day-${day.date}`}
        style={[
          styles.dayBox,
          state === 'menstrual' && { backgroundColor: theme.backgroundSelected },
          state === 'ovulatory' && { borderWidth: 1, borderColor: theme.text },
          state === 'peak' && { borderWidth: 1, borderColor: theme.textSecondary },
          state === 'elevated' && { backgroundColor: theme.backgroundElement },
        ]}>
        <ThemedText
          type="small"
          style={[styles.dayNumber, (state === 'menstrual' || state === 'ovulatory') && styles.emphasised]}>
          {getDayOfMonth(day.date)}
        </ThemedText>

        <View style={styles.markerRow}>
          {marker !== '' && (
            <ThemedText type="small" themeColor="textSecondary" style={styles.marker}>
              {marker}
            </ThemedText>
          )}

          {day.isPredictedPeriodStart && (
            <ThemedText type="small" themeColor="textSecondary" style={styles.marker}>
              {PREDICTED_MARKER}
            </ThemedText>
          )}
        </View>

        {isToday && (
          <ThemedText type="small" themeColor="textSecondary" style={styles.todayLabel}>
            {TODAY_LABEL}
          </ThemedText>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  calendar: {
    width: '100%',
    gap: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  weekdayCell: {
    width: COLUMN_WIDTH,
    paddingVertical: Spacing.one,
  },
  centered: {
    textAlign: 'center',
  },
  dayCell: {
    width: COLUMN_WIDTH,
    aspectRatio: 1,
    padding: Spacing.half,
    // Reserved so the today ring does not shrink that one cell's contents.
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: Spacing.two + Spacing.half,
  },
  dayBox: {
    flex: 1,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.half,
  },
  dayNumber: {
    fontSize: 15,
    lineHeight: 18,
  },
  emphasised: {
    fontWeight: '700',
  },
  markerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.half,
    // Keeps every square the same height whether or not it has a marker.
    minHeight: 12,
  },
  marker: {
    fontSize: 10,
    lineHeight: 12,
  },
  todayLabel: {
    fontSize: 9,
    lineHeight: 11,
  },
});
