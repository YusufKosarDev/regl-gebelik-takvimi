import { Pressable, StyleSheet, View } from 'react-native';

import type { CycleCalendarDay } from '../application/build-cycle-calendar-month';
import type { CalendarGridCell, CycleCalendarGrid } from '../presentation/build-cycle-calendar-grid';
import type { HomeMessages } from '../presentation/home-messages';
import { homeMessages } from '../presentation/home-messages';
import {
  cycleLabels,
  getCalendarDayAccessibilityLabelIn,
} from '../presentation/cycle-labels';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useFontScale } from '@/hooks/use-font-scale';
import { useCyclePhaseColors, useTheme } from '@/hooks/use-theme';
import { useLanguage, useMessages } from '@/i18n';
import type { ISODate } from '@/types/iso-date';
import { getDayOfMonth } from '@/utils/date';

/** 100 / 7, wide enough that seven columns still fit on one row. */
const COLUMN_WIDTH = '14.2857%';

type CycleCalendarProps = {
  readonly grid: CycleCalendarGrid;
  /**
   * Optional, so the component still renders any month on its own. Left out,
   * nothing is marked as today.
   */
  readonly today?: ISODate;
  readonly selectedDate?: ISODate | null;
  /**
   * Left out, the days are not pressable at all rather than pressable and
   * inert, so a screen reader never offers an action that does nothing.
   */
  readonly onSelectDay?: (day: CycleCalendarDay) => void;
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
 *
 * ## Why two of them come from the catalogue
 *
 * The two shapes are language-neutral and stay here. The two letters are not:
 * they are initials, and an initial only works in the language it was taken
 * from. `R` is Regl and `Y` is Yumurtlama, so an English phone used to show a
 * grid full of R and Y underneath a legend that explained P and O - the
 * explanation and the thing it explained disagreed, which is worse than having
 * no legend.
 *
 * The letters now come from the same catalogue entries the legend is drawn
 * from, so the two cannot drift apart again.
 */
const NEUTRAL_MARKERS: Readonly<Record<Exclude<DayState, 'menstrual' | 'ovulatory'>, string>> = {
  peak: '●',
  elevated: '○',
  default: '',
};

/**
 * What colour a day's own mark is drawn in.
 *
 * `default` never reaches here - it has no mark to draw - but the map is total
 * so a state added later gets a colour rather than `undefined`, which React
 * Native renders as the inherited one and would be invisible in review.
 */
function markerColour(
  state: DayState,
  phases: ReturnType<typeof useCyclePhaseColors>
): string {
  if (state === 'menstrual') return phases.menstrualAccent;
  if (state === 'ovulatory' || state === 'peak') return phases.ovulatoryAccent;

  return phases.follicularAccent;
}

/**
 * The band along the foot of a square, and the colour it is drawn in.
 *
 * ## Why a band and not a fill
 *
 * A fill belongs to one square. Five period days filled are five boxes in a
 * row, and a person reading a calendar is looking for a *period* - one thing
 * with a start and an end - not for five things that happen to be adjacent.
 * A band runs to both edges of its square, so a run of them meets across the
 * boundaries and reads as the single stretch it is. It breaks at the end of a
 * week because the row does, which is the one place a calendar is allowed to
 * cut a range in half.
 *
 * This is the part of Cycles' grid worth taking and it is taken whole. What is
 * not taken is doing it in colour alone: the letter under the number stays,
 * because the colour here is data and `theme-contrast.test.ts` holds a rule
 * about never needing hue to read it.
 *
 * ## It is the same colour as the letter above it
 *
 * Deliberately. Two marks on one square saying one thing should not be two
 * colours saying it, and the accents are already held at 3:1 against the page
 * by their own test - which is the floor a band needs, being a graphic rather
 * than a word.
 */
function bandColour(
  state: DayState,
  phases: ReturnType<typeof useCyclePhaseColors>
): string | undefined {
  if (state === 'default') return undefined;

  return markerColour(state, phases);
}

function markerFor(state: DayState, messages: HomeMessages): string {
  if (state === 'menstrual') return messages.legendPeriodMarker;
  if (state === 'ovulatory') return messages.legendOvulationMarker;

  return NEUTRAL_MARKERS[state];
}

/** Deliberately not a solid mark: this day is predicted, not recorded. */
const PREDICTED_MARKER = '≈';

/**
 * What one square needs to hold its three lines at the default font setting.
 *
 * The day number, the marker row and the "today" label, plus the gaps between
 * them. A square is `aspectRatio: 1` on a seventh of the screen, which on a
 * normal phone comes out close to this number - so at the default setting this
 * changes nothing.
 *
 * It matters when the system font setting is turned up. The three lines scale
 * and the square does not, because its height comes from the screen's width, so
 * at the largest Android setting roughly 68dp of text was being asked to fit in
 * about 50dp of cell. Multiplying this by the font scale lets the square grow
 * instead, which is the only answer that keeps the calendar readable rather than
 * merely un-clipped - capping the text would have left the person who turned the
 * setting up unable to read the one screen they open most.
 */
const CELL_CONTENT_HEIGHT = 48;

/**
 * The band's own share of the square, kept out of the three lines above it.
 *
 * `CELL_CONTENT_HEIGHT` is the room the number, the marker and the "today"
 * label need. The band is drawn inside the square rather than under it, so
 * without this it takes that room instead of being given its own - on the
 * device the label was clipped on today's square, which is the one square with
 * all three lines and a ring around them.
 */
const CELL_BAND_ALLOWANCE = 6;

/**
 * The marker row's line, and the "today" label's, reserved in every square.
 *
 * One idea twice: a line only some squares have, kept open in all of them so
 * the day numbers above it sit level across a row. The marker row has always
 * done this; the label did not, and today's square carried one line more than
 * its neighbours - measured on a device at 1.5, the 13 sat 24 points above the
 * 14 beside it.
 *
 * Both are multiplied by the font scale where they are used. A fixed
 * reservation is the same defect wearing the other hat: at Android's largest
 * setting a real marker is twice this tall, so a square without one came out
 * short and its number sat 32 points low - which is what the reservation
 * existed to prevent.
 */
const MARKER_LINE_HEIGHT = 12;
const TODAY_LINE_HEIGHT = 11;

/**
 * How thick the band along the foot of a square is.
 *
 * Thick enough to read as a band rather than as a rule - a hairline between
 * two squares is a divider, which is the opposite of what this says - and thin
 * enough that the square above it keeps its three lines of text at the default
 * font setting.
 */
const BAND_HEIGHT = 4;

/**
 * Renders a prepared month grid. Nothing is computed here.
 *
 * Which day falls in which column, how many rows there are and what the domain
 * thinks of each day are all settled before this component runs. It reads
 * `grid.cells` and lays them out, so the picture can never disagree with the
 * model behind it. The column headers come from the catalogue rather than the
 * grid: seven words drawn above a layout are not part of one.
 */
export function CycleCalendar({ grid, today, selectedDate, onSelectDay }: CycleCalendarProps) {
  const home = useMessages(homeMessages);

  return (
    <View style={styles.calendar}>
      <View style={styles.row}>
        {home.weekdayLabels.map((label) => (
          <View key={label} style={styles.weekdayCell}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
              {label}
            </ThemedText>
          </View>
        ))}
      </View>

      <View style={styles.row}>
        {grid.cells.map((cell, index) => (
          <GridCell
            key={cellKey(cell, index)}
            cell={cell}
            index={index}
            today={today}
            selectedDate={selectedDate}
            onSelectDay={onSelectDay}
          />
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
  selectedDate,
  onSelectDay,
}: {
  cell: CalendarGridCell;
  index: number;
  today?: ISODate;
  selectedDate?: ISODate | null;
  onSelectDay?: (day: CycleCalendarDay) => void;
}) {
  const fontScale = useFontScale();

  if (cell.kind === 'empty') {
    // Holds the column open and nothing else: no number, and no accessible node
    // for a screen reader to stop on. Padding is never today, never selected and
    // never pressable.
    return (
      <View
        testID={`calendar-empty-${index}`}
        style={[styles.dayCell, { minHeight: CELL_CONTENT_HEIGHT * fontScale + CELL_BAND_ALLOWANCE }]}
      />
    );
  }

  return (
    <DayCell
      day={cell.day}
      isToday={today === cell.day.date}
      isSelected={selectedDate === cell.day.date}
      onSelectDay={onSelectDay}
    />
  );
}

function DayCell({
  day,
  isToday,
  isSelected,
  onSelectDay,
}: {
  day: CycleCalendarDay;
  isToday: boolean;
  isSelected: boolean;
  onSelectDay?: (day: CycleCalendarDay) => void;
}) {
  const theme = useTheme();
  const home = useMessages(homeMessages);
  const phases = useCyclePhaseColors();
  const fontScale = useFontScale();
  const language = useLanguage();
  const labels = useMessages(cycleLabels);
  const state = resolveDayState(day);
  const marker = markerFor(state, home);

  const label = getCalendarDayAccessibilityLabelIn(labels, language, day, { isToday, isSelected });

  const box = (
    <View
      testID={isToday ? `calendar-today-${day.date}` : undefined}
      style={[
        styles.dayBox,
        // Both rings live here now rather than on the cell around it. The band
        // runs to the cell's own edges so that a run of days meets, and a ring
        // drawn out there would be a box cutting across every band it touches.
        // Round the number is also where the app this follows structurally
        // puts its one circled day.
        isToday && { borderWidth: 1, borderColor: theme.textSecondary },
        isSelected && { borderWidth: 2, borderColor: theme.text },
      ]}>
      <ThemedText
        type="small"
        style={[
          styles.dayNumber,
          (state === 'menstrual' || state === 'ovulatory') && styles.emphasised,
          isSelected && styles.selectedNumber,
        ]}>
        {getDayOfMonth(day.date)}
      </ThemedText>

      <View style={[styles.markerRow, { minHeight: MARKER_LINE_HEIGHT * fontScale }]}>
        {marker !== '' && (
          <ThemedText type="small" style={[styles.marker, { color: markerColour(state, phases) }]}>
            {marker}
          </ThemedText>
        )}

        {/* Every day of the predicted period, not only its first. The calendar
            used to mark the start and stop, which drew a period one day long -
            and the days after it were not unmarked for want of a prediction
            but because `getCycleDay` never rolls over at a predicted start, so
            they came out as day 30 and later of the recorded October cycle and
            resolved to luteal. `build-cycle-calendar-month.ts` has the whole
            of that note.

            The muted colour is kept for all of them, for the reason it was
            kept for the start: these are the marks on the calendar that are a
            guess, and a phase colour would dress them as recorded fact. The
            glyph is what distinguishes them, not the colour - a band in a
            paler shade would have made the difference colour-only. */}
        {day.isPredictedPeriodDay && (
          <ThemedText type="small" themeColor="textSecondary" style={styles.marker}>
            {PREDICTED_MARKER}
          </ThemedText>
        )}
      </View>

      {/* Kept open in every square, not only today's. It is the line that
          decides where the number above it sits: a square without it centred
          two lines where its neighbour centred three, and on a device at 1.5
          that put the 13 twenty-four points above the 14 beside it. */}
      <View style={{ minHeight: TODAY_LINE_HEIGHT * fontScale }}>
        {isToday ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.todayLabel}>
            {home.calendarTodayLabel}
          </ThemedText>
        ) : null}
      </View>
    </View>
  );

  const band = bandColour(state, phases);

  const outerStyle = [styles.dayCell, { minHeight: CELL_CONTENT_HEIGHT * fontScale + CELL_BAND_ALLOWANCE }];

  // The band is a sibling of the box rather than a child of it, because it is
  // laid on the cell's own edges and the box is inside the cell's padding.
  //
  // Not hidden from assistive technology, and that is a decision rather than
  // an omission: the cell around it already carries the whole day as one
  // spoken label, so nothing inside it is a stop of its own - the letters and
  // the day number are not hidden either. Marking it hidden would also take it
  // out of reach of the tests that hold its colour, which is a high price for
  // an attribute that changes nothing on a device.
  const contents = (
    <>
      {box}

      {band !== undefined && (
        <View testID={`calendar-band-${day.date}`} style={[styles.band, { backgroundColor: band }]} />
      )}
    </>
  );

  if (onSelectDay === undefined) {
    return (
      <View
        accessible
        accessibilityLabel={label}
        testID={`calendar-day-${day.date}`}
        style={outerStyle}>
        {contents}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: isSelected }}
      testID={`calendar-day-${day.date}`}
      onPress={() => onSelectDay(day)}
      style={({ pressed }) => [...outerStyle, pressed && styles.pressed]}>
      {contents}
    </Pressable>
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
    // No `aspectRatio: 1` any more, and that is the fix rather than a tidy-up.
    //
    // A square's height is derived from its width, which makes it a definite
    // size: content taller than it does not grow it, it spills out of it. The
    // ring is the box inside this cell, so a cell that cannot grow is a ring
    // that cannot contain its own date - measured on a device, at 1.3 the day
    // number was already flush with the cell's top edge, and at 2.0 it was
    // drawn above the ring entirely with the second line of "Today" below the
    // period band.
    //
    // The height is now the floor below, and whatever the text needs above it.
    // On a phone the two are the same number at the default setting: the floor
    // was chosen to match a seventh of the screen, which is what the note
    // beside it says, so nothing moves there.
    //
    // It also lets a row's cells agree. With no definite height they are
    // `stretch` in the cross axis, so every cell in a line takes the line's
    // height and the reserved lines above decide where the numbers sit.
    padding: Spacing.half,
    // The band sits here, and the box above it must not run into it. No
    // horizontal padding to match: the band is meant to reach both edges so a
    // run of days meets across the squares.
    paddingBottom: CELL_BAND_ALLOWANCE,
  },
  band: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: BAND_HEIGHT,
  },
  dayBox: {
    // `flexGrow` with an `auto` basis, not `flex: 1`.
    //
    // `flex: 1` is `flexBasis: 0`: this box never asks for the height its own
    // text needs, it takes what is left over. With the cell's height no longer
    // fixed that would collapse it to the floor and leave the text spilling
    // out exactly as before. `sky-hero.tsx` carries the same three lines for
    // the same reason, found the same way.
    //
    // Growing into spare room is still wanted: it is what keeps the ring the
    // size of the square at the default setting rather than shrink-wrapped
    // around three short lines.
    flexGrow: 1,
    flexShrink: 0,
    flexBasis: 'auto',
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
  selectedNumber: {
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  pressed: {
    opacity: 0.6,
  },
});
