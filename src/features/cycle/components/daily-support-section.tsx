import { Pressable, StyleSheet, View } from 'react-native';

import type { CycleDailySupport } from '../domain/daily-support';
import { homeMessages } from '../presentation/home-messages';

import { Surface } from '@/components/surface';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { disclaimerMessages } from '@/features/disclaimer/presentation/disclaimer-messages';
import { useMessages } from '@/i18n';

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
  const home = useMessages(homeMessages);
  const disclaimer = useMessages(disclaimerMessages);

  return (
    <View style={styles.supportSection}>
      {/* Absent where the sources do not support any, which is the
          ovulatory phase today. The heading goes with the list, so
          neither appears without the other. */}
      {dailySupport.moodLabels !== undefined && (
        <Surface level="lined">
          <ThemedText accessibilityRole="header" type="small" themeColor="textSecondary">
            {home.supportMoodTitle}
          </ThemedText>

          {dailySupport.moodLabels.map((mood) => (
            <ThemedText key={mood} type="small" style={styles.weeklyFeature}>
              • {mood}
            </ThemedText>
          ))}
        </Surface>
      )}

      <Surface level="filled">
        <ThemedText accessibilityRole="header" type="small" themeColor="textSecondary">
          {home.supportMessageTitle}
        </ThemedText>

        <ThemedText style={styles.weeklySummary}>
          {dailySupport.supportMessage}
        </ThemedText>

        <ThemedText type="small" themeColor="textSecondary" style={styles.rowNote}>
          {home.supportDisclaimer}
        </ThemedText>
      </Surface>

      {/* The domain requires at least one source, but the section is
          still conditional: an empty heading would be worse than no
          heading. */}
      {dailySupport.sources.length > 0 && (
        <Surface level="lined">
          <ThemedText accessibilityRole="header" type="small" themeColor="textSecondary">
            {home.supportSourcesTitle}
          </ThemedText>

          {hasSourceError && (
            <ThemedText
              accessibilityRole="alert"
              type="small"
              themeColor="textSecondary"
              style={styles.weeklyFeature}>
              {home.sourceErrorMessage}
            </ThemedText>
          )}

          {dailySupport.sources.map((source) => (
            <Pressable
              key={source.url}
              accessibilityRole="link"
              accessibilityLabel={home.openSourceLabel(source.name)}
              onPress={() => openSource(source.url)}
              style={({ pressed }) => [styles.sourceLink, pressed && styles.pressed]}>
              <ThemedText type="small">{source.name}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {source.url}
              </ThemedText>
            </Pressable>
          ))}
        </Surface>
      )}

      {/* Closes the section rather than sitting inside one card: it
          is about all of it — the mood words, the message and the
          sources — not about the message alone. */}
      <ThemedText type="small" themeColor="textSecondary" style={styles.rowNote}>
        {disclaimer.contentDisclaimerFooter}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  supportSection: {
    gap: Spacing.two,
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
