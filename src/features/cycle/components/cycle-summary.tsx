import { StyleSheet, View } from 'react-native';

import { homeMessages } from '../presentation/home-messages';

import { Surface } from '@/components/surface';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useMessages } from '@/i18n';

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
  const home = useMessages(homeMessages);

  return (
    <View style={styles.summary}>
      {rows.map((row) => (
        <Surface
          key={row.label}
          level="lined"
          accessible
          accessibilityLabel={home.labelledValue(row.label, row.value)}>
          <ThemedText type="small" themeColor="textSecondary">
            {row.label}
          </ThemedText>
          <ThemedText type="display">{row.value}</ThemedText>
          {row.note !== undefined && (
            <ThemedText type="small" themeColor="textSecondary" style={styles.rowNote}>
              {row.note}
            </ThemedText>
          )}
        </Surface>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  summary: {
    gap: Spacing.two,
  },
  rowNote: {
    marginTop: Spacing.one,
  },
});
