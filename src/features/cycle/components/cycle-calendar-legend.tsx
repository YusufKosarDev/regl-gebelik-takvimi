import { StyleSheet, View } from 'react-native';

import {
  CALENDAR_ESTIMATE_NOTICE,
  LEGEND_ITEMS,
  legendItemLabel,
} from '../presentation/home-messages';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Explains the calendar's marks. Reads nothing and computes nothing. */
export function CycleCalendarLegend() {
  const theme = useTheme();

  return (
    <View style={styles.legend}>
      {LEGEND_ITEMS.map((item) => (
        <View
          key={item.marker}
          accessible
          accessibilityLabel={legendItemLabel(item)}
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
        {CALENDAR_ESTIMATE_NOTICE}
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
