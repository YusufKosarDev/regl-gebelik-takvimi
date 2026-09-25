import { Pressable, StyleSheet, View } from 'react-native';

import type { CycleDailySupport } from '../domain/daily-support';
import { SOURCE_ERROR_MESSAGE, SUPPORT_DISCLAIMER } from '../presentation/home-messages';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { CONTENT_DISCLAIMER_FOOTER } from '@/features/disclaimer/presentation/disclaimer-messages';
import { useTheme } from '@/hooks/use-theme';

/**
 * What today's phase has to offer: the mood words, the message and the
 * sources behind both.
 *
 * Lifted out of `index.tsx` unchanged - the same cards in the same order with
 * the same text, and the same three conditions inside deciding which of them
 * appear. The condition on the section as a whole stayed on the screen, beside
 * the comment that explains it.
 *
 * Opening a source is still the screen’s job, because whether the attempt
 * failed is state the screen holds and shows here.
 */
export function DailySupportSection({
  dailySupport,
  openSource,
  hasSourceError,
}: {
  readonly dailySupport: CycleDailySupport;
  readonly openSource: (url: string) => Promise<void>;
  readonly hasSourceError: boolean;
}) {
  const theme = useTheme();

  return (
    <View style={styles.supportSection}>
      {/* Absent where the sources do not support any, which is the
          ovulatory phase today. The heading goes with the list, so
          neither appears without the other. */}
      {dailySupport.moodLabels !== undefined && (
        <View style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText accessibilityRole="header" type="small" themeColor="textSecondary">
            Olası ruh hali
          </ThemedText>

          {dailySupport.moodLabels.map((mood) => (
            <ThemedText key={mood} type="small" style={styles.weeklyFeature}>
              • {mood}
            </ThemedText>
          ))}
        </View>
      )}

      <View style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
        <ThemedText accessibilityRole="header" type="small" themeColor="textSecondary">
          Bugünün mesajı
        </ThemedText>

        <ThemedText style={styles.weeklySummary}>
          {dailySupport.supportMessage}
        </ThemedText>

        <ThemedText type="small" themeColor="textSecondary" style={styles.rowNote}>
          {SUPPORT_DISCLAIMER}
        </ThemedText>
      </View>

      {/* The domain requires at least one source, but the section is
          still conditional: an empty heading would be worse than no
          heading. */}
      {dailySupport.sources.length > 0 && (
        <View style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText accessibilityRole="header" type="small" themeColor="textSecondary">
            Kaynaklar
          </ThemedText>

          {hasSourceError && (
            <ThemedText
              accessibilityRole="alert"
              type="small"
              themeColor="textSecondary"
              style={styles.weeklyFeature}>
              {SOURCE_ERROR_MESSAGE}
            </ThemedText>
          )}

          {dailySupport.sources.map((source) => (
            <Pressable
              key={source.url}
              accessibilityRole="link"
              accessibilityLabel={`${source.name} kaynağını aç`}
              onPress={() => openSource(source.url)}
              style={({ pressed }) => [styles.sourceLink, pressed && styles.pressed]}>
              <ThemedText type="small">{source.name}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {source.url}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      )}

      {/* Closes the section rather than sitting inside one card: it
          is about all of it — the mood words, the message and the
          sources — not about the message alone. */}
      <ThemedText type="small" themeColor="textSecondary" style={styles.rowNote}>
        {CONTENT_DISCLAIMER_FOOTER}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  supportSection: {
    gap: Spacing.two,
  },
  row: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    gap: Spacing.half,
  },
  rowNote: {
    marginTop: Spacing.one,
  },
  weeklySummary: {
    marginTop: Spacing.one,
    lineHeight: 22,
  },
  weeklyFeature: {
    marginTop: Spacing.half,
    lineHeight: 22,
  },
  sourceLink: {
    minHeight: 44,
    justifyContent: 'center',
    marginTop: Spacing.one,
  },
  pressed: {
    opacity: 0.6,
  },
});
