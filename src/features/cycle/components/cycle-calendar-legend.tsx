import { StyleSheet, View } from 'react-native';

import { homeMessages, legendItemsIn } from '../presentation/home-messages';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useCyclePhaseColors, useTheme } from '@/hooks/use-theme';
import { useMessages } from '@/i18n';

/** Explains the calendar's marks. Reads nothing and computes nothing. */
/** The swatch's own mark, in the colour the calendar draws that mark in. */
function swatchMarkerColour(
  style: string,
  phases: ReturnType<typeof useCyclePhaseColors>
): string | undefined {
  if (style === 'filled') return phases.menstrualAccent;
  if (style === 'outlined') return phases.ovulatoryAccent;
  if (style === 'soft') return phases.follicularAccent;

  // 'plain' is the predicted start, which stays muted on the calendar too.
  return undefined;
}

export function CycleCalendarLegend() {
  const phases = useCyclePhaseColors();
  const home = useMessages(homeMessages);

  return (
    <View style={styles.legend}>
      {legendItemsIn(home).map((item) => (
        <View
          key={item.marker}
          accessible
          accessibilityLabel={home.legendItemLabel(item.spokenMarker, item.label)}
          style={styles.item}>
          {/* The swatch is drawn exactly as the calendar square is, so the
              key and the thing it explains cannot drift apart. They did once:
              the grid was showing R and Y under a legend explaining P and O. */}
          <View
            style={[
              styles.swatch,
              item.style === 'filled' && { backgroundColor: phases.menstrualSoft },
              item.style === 'outlined' && {
                borderWidth: 1,
                borderColor: phases.ovulatoryAccent,
              },
              item.style === 'soft' && { backgroundColor: phases.follicularSoft },
            ]}>
            <ThemedText type="small" style={[styles.marker, { color: swatchMarkerColour(item.style, phases) }]}>
              {item.marker}
            </ThemedText>
          </View>

          <ThemedText type="small" themeColor="textSecondary" style={styles.label}>
            {item.label}
          </ThemedText>
        </View>
      ))}

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
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
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
