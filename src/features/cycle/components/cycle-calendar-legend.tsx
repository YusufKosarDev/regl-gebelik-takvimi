import { StyleSheet, View } from 'react-native';

import { homeMessages, legendItemsIn } from '../presentation/home-messages';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useCyclePhaseColors } from '@/hooks/use-theme';
import { useMessages } from '@/i18n';

/**
 * Explains the calendar's marks. Reads nothing and computes nothing.
 *
 * ## It lists all four whatever the month holds
 *
 * Paging to a month with no marks in it leaves four rows explaining marks that
 * are not on screen, which looks like something to fix. It is not.
 *
 * This is the grid's vocabulary rather than a report of what this month
 * contains. A legend that shrank to the marks present would change every time
 * somebody paged, so the one place it is most needed - an empty month, where a
 * person is asking what they are not seeing - is the one place it would have
 * nothing to say. Four fixed rows are read once; a key that moves is read
 * again every month.
 *
 * The reason a month is empty is the selected-day card's job, and it does say
 * it: `countContinuesMessage`.
 */
/**
 * The swatch's own mark, in the colour the calendar draws that mark in.
 *
 * `null` for 'plain', not `undefined`, and the caller turns that into a
 * `themeColor` rather than a `color`. The old version returned `undefined` and
 * the caller spread `{ color: undefined }` into a style array, which
 * `StyleSheet.flatten` keeps as a key - so the theme's colour was overwritten
 * with nothing and the platform default won. On a dark page that default is
 * black on near-black, and the predicted-period mark disappeared.
 *
 * `ThemedText` no longer lets an undefined colour reach the renderer, so this
 * would be safe either way now. It is still `null`: a function that can hand
 * back "no answer" in a type the compiler ignores is how the first one got
 * written.
 */
function swatchMarkerColour(
  style: string,
  phases: ReturnType<typeof useCyclePhaseColors>
): string | null {
  if (style === 'filled') return phases.menstrualAccent;
  if (style === 'outlined') return phases.ovulatoryAccent;
  if (style === 'soft') return phases.follicularAccent;

  // 'plain' is the predicted period, which stays muted on the calendar too -
  // and is drawn there with `themeColor="textSecondary"`, which is what the
  // caller gives this row so the key and the squares match.
  return null;
}

export function CycleCalendarLegend() {
  const phases = useCyclePhaseColors();
  const home = useMessages(homeMessages);

  return (
    <View style={styles.legend}>
      {legendItemsIn(home).map((item) => {
        const markColour = swatchMarkerColour(item.style, phases);

        return (
        <View
          key={item.marker}
          accessible
          accessibilityLabel={home.legendItemLabel(item.spokenMarker, item.label)}
          style={styles.item}>
          {/* The swatch is drawn exactly as the calendar square is, so the
              key and the thing it explains cannot drift apart. They did once:
              the grid was showing R and Y under a legend explaining P and O.

              A square is a letter with a band under it now, so this is too.
              The fills and the outline went with the squares' - a key showing
              a filled box for a calendar that has no filled boxes in it is
              the same drift wearing different clothes. */}
          <View style={styles.swatch}>
            {/* A themed colour when the mark has none of its own, rather than
                a `color` that might be nothing. This row is the predicted
                period, and `cycle-calendar.tsx` draws those squares with
                `themeColor="textSecondary"` for the same reason: they are a
                guess, and a phase colour would dress them as recorded fact. */}
            <ThemedText
              type="small"
              themeColor="textSecondary"
              style={[styles.marker, markColour === null ? null : { color: markColour }]}>
              {item.marker}
            </ThemedText>

            {/* 'plain' is the predicted start: a guess, and the one mark on
                the calendar with no band under it. */}
            {item.style !== 'plain' && (
              <View
                style={[styles.band, markColour === null ? null : { backgroundColor: markColour }]}
              />
            )}
          </View>

          <ThemedText type="small" themeColor="textSecondary" style={styles.label}>
            {item.label}
          </ThemedText>
        </View>
        );
      })}

      <ThemedText type="small" themeColor="textSecondary" style={styles.notice}>
        {home.calendarEstimateNotice}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  legend: {
    width: '100%',
    gap: Spacing.two,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  swatch: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    // The same shape the square has: the mark sitting above its own band,
    // with the band on the bottom edge rather than inside any padding.
    paddingBottom: 4 + Spacing.half,
  },
  band: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 4,
  },
  marker: {
    fontSize: 12,
    lineHeight: 16,
  },
  label: {
    // Lets a long line wrap instead of pushing off a narrow screen.
    flexShrink: 1,
  },
  notice: {
    marginTop: Spacing.one,
  },
});
