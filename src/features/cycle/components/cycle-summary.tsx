import { StyleSheet, View } from 'react-native';

import { labelledValue } from '../presentation/home-messages';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * The four facts about today, at the top of the cycle view.
 *
 * Lifted out of `index.tsx` unchanged. It is handed the rows rather than
 * building them, so what a row says stays in one place - beside the wording
 * for the calendar rows, which are the same four facts about a different day.
 *
 * The note under a row is still optional and still read as part of the same
 * accessible label, so the fertility estimate and the warning about it are one
 * thing to a screen reader, as they are to the eye.
 */
export function CycleSummary({
  rows,
}: {
  readonly rows: readonly { label: string; value: string; note?: string }[];
}) {
  const theme = useTheme();

  return (
    <View style={styles.summary}>
      {rows.map((row) => (
        <View
          key={row.label}
          accessible
          accessibilityLabel={labelledValue(row.label, row.value)}
          style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="small" themeColor="textSecondary">
            {row.label}
          </ThemedText>
          <ThemedText style={styles.rowValue}>{row.value}</ThemedText>
          {row.note !== undefined && (
            <ThemedText type="small" themeColor="textSecondary" style={styles.rowNote}>
              {row.note}
            </ThemedText>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  summary: {
    gap: Spacing.two,
  },
  row: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    gap: Spacing.half,
  },
  rowValue: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '600',
  },
  rowNote: {
    marginTop: Spacing.one,
  },
});
