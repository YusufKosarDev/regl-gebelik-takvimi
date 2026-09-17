import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const ESTIMATE_NOTICE = 'Takvimdeki doğurganlık ve yumurtlama bilgileri tahminidir.';

/**
 * `style` names the treatment the calendar gives the same day, so the swatch
 * here looks like the square it explains. `spokenMarker` exists because "○" read
 * aloud is either nothing or noise.
 */
type LegendItem = {
  readonly marker: string;
  readonly spokenMarker: string;
  readonly label: string;
  readonly style: 'filled' | 'outlined' | 'soft' | 'plain';
};

/**
 * Only the marks a person can actually find on the calendar.
 *
 * The peak mark is left out on purpose. The peak day is by definition the
 * estimated ovulation day, and the calendar gives that day one treatment, so a
 * filled circle never appears in a month. Explaining a symbol that is not there
 * would send people looking for it.
 */
const LEGEND_ITEMS: readonly LegendItem[] = [
  { marker: 'R', spokenMarker: 'R', label: 'Regl günü', style: 'filled' },
  { marker: 'Y', spokenMarker: 'Y', label: 'Tahmini yumurtlama günü', style: 'outlined' },
  {
    marker: '○',
    spokenMarker: 'Daire',
    label: 'Doğurganlığın yüksek olduğu tahmini gün',
    style: 'soft',
  },
  {
    marker: '≈',
    spokenMarker: 'Yaklaşık işareti',
    label: 'Sonraki regl başlangıcı tahmini',
    style: 'plain',
  },
];

/** Explains the calendar's marks. Reads nothing and computes nothing. */
export function CycleCalendarLegend() {
  const theme = useTheme();

  return (
    <View style={styles.legend}>
      {LEGEND_ITEMS.map((item) => (
        <View
          key={item.marker}
          accessible
          accessibilityLabel={`${item.spokenMarker}: ${item.label}`}
          style={styles.item}>
          <View
            style={[
              styles.swatch,
              item.style === 'filled' && { backgroundColor: theme.backgroundSelected },
              item.style === 'outlined' && { borderWidth: 1, borderColor: theme.text },
              item.style === 'soft' && { backgroundColor: theme.backgroundElement },
            ]}>
            <ThemedText type="small" style={styles.marker}>
              {item.marker}
            </ThemedText>
          </View>

          <ThemedText type="small" themeColor="textSecondary" style={styles.label}>
            {item.label}
          </ThemedText>
        </View>
      ))}

      <ThemedText type="small" themeColor="textSecondary" style={styles.notice}>
        {ESTIMATE_NOTICE}
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
