import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import type { PregnancyDashboard } from '../application/get-pregnancy-dashboard';
import type { PregnancyWeeklyContent } from '../domain/types';
import { MAX_PREGNANCY_WEEK, MIN_PREGNANCY_WEEK } from '../domain/weekly-content';
import {
  dueDateSourceLabel,
  pregnancyProgressLabel,
  weeklyHighlight,
} from '../presentation/pregnancy-labels';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { SOURCE_ERROR_MESSAGE } from '@/features/cycle/presentation/home-messages';
import { CONTENT_DISCLAIMER_FOOTER } from '@/features/disclaimer/presentation/disclaimer-messages';
import { useTheme } from '@/hooks/use-theme';
import { formatDisplayDate } from '@/utils/format-date';

/**
 * The pregnancy half of the home screen.
 *
 * Lifted out of `index.tsx` unchanged. What it renders, in what order, with
 * what text and on what press is exactly what the screen rendered inline; the
 * only thing that moved is where the lines live.
 *
 * Everything it needs is passed in rather than read again here. The week being
 * shown, the content for it and the stepper all belong to the screen, which
 * owns the state behind them - a second opinion computed in here could differ
 * from the one the rest of the screen is drawn from.
 */
export function PregnancySection({
  pregnancy,
  shownWeek,
  shownContent,
  currentWeek,
  stepWeek,
  openSource,
  hasSourceError,
  setPreviewWeek,
  setHasSourceError,
}: {
  readonly pregnancy: PregnancyDashboard;
  readonly shownWeek: number | null;
  readonly shownContent: PregnancyWeeklyContent | null;
  readonly currentWeek: number | null;
  readonly stepWeek: (delta: number) => void;
  readonly openSource: (url: string) => Promise<void>;
  readonly hasSourceError: boolean;
  readonly setPreviewWeek: (week: number | null) => void;
  readonly setHasSourceError: (hasError: boolean) => void;
}) {
  const router = useRouter();
  const theme = useTheme();

  return (
    <View style={styles.pregnancySection}>
      <ThemedText accessibilityRole="header" type="smallBold">
        Gebelik takibi
      </ThemedText>

      <View
        accessible
        accessibilityLabel={`Gebelik haftası: ${pregnancyProgressLabel(pregnancy)}`}
        style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
        <ThemedText type="small" themeColor="textSecondary">
          Gebelik haftası
        </ThemedText>
        <ThemedText style={styles.rowValue}>
          {pregnancyProgressLabel(pregnancy)}
        </ThemedText>
      </View>

      <View
        accessible
        accessibilityLabel={
          `Tahmini doğum tarihi: ${formatDisplayDate(pregnancy.estimatedDueDate)}, ` +
          dueDateSourceLabel(pregnancy.dueDateSource)
        }
        style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
        <ThemedText type="small" themeColor="textSecondary">
          Tahmini doğum tarihi
        </ThemedText>
        <ThemedText style={styles.rowValue}>
          {formatDisplayDate(pregnancy.estimatedDueDate)}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.rowNote}>
          {dueDateSourceLabel(pregnancy.dueDateSource)}
        </ThemedText>
      </View>

      {/* Absent before the pregnancy starts and past week 40, where
          there is nothing written to show. */}
      {shownContent !== null && shownWeek !== null && (
        <>
          <View style={styles.weekBar}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Önceki hafta"
              accessibilityState={{ disabled: shownWeek <= MIN_PREGNANCY_WEEK }}
              disabled={shownWeek <= MIN_PREGNANCY_WEEK}
              onPress={() => stepWeek(-1)}
              style={({ pressed }) => [
                styles.weekButton,
                shownWeek <= MIN_PREGNANCY_WEEK && styles.disabled,
                pressed && shownWeek > MIN_PREGNANCY_WEEK && styles.pressed,
              ]}>
              <ThemedText style={styles.weekButtonLabel}>‹</ThemedText>
            </Pressable>

            <ThemedText
              accessibilityLabel={`Gösterilen hafta: ${shownWeek}. hafta`}
              type="smallBold"
              style={styles.selectedWeek}>
              {shownWeek}. hafta
            </ThemedText>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Sonraki hafta"
              accessibilityState={{ disabled: shownWeek >= MAX_PREGNANCY_WEEK }}
              disabled={shownWeek >= MAX_PREGNANCY_WEEK}
              onPress={() => stepWeek(1)}
              style={({ pressed }) => [
                styles.weekButton,
                shownWeek >= MAX_PREGNANCY_WEEK && styles.disabled,
                pressed && shownWeek < MAX_PREGNANCY_WEEK && styles.pressed,
              ]}>
              <ThemedText style={styles.weekButtonLabel}>›</ThemedText>
            </Pressable>
          </View>

          {/* Only worth offering once the reading has wandered off the
              week the pregnancy is actually in. */}
          {shownWeek !== currentWeek && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Bugünkü haftaya dön"
              onPress={() => {
                setPreviewWeek(null);
                setHasSourceError(false);
              }}
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.pressed,
              ]}>
              <ThemedText type="small" themeColor="textSecondary">
                Bugünkü haftaya dön
              </ThemedText>
            </Pressable>
          )}

          <View
            accessible
            accessibilityLabel={`Bu hafta: ${weeklyHighlight(shownContent)}`}
            style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="small" themeColor="textSecondary">
              Bu hafta
            </ThemedText>

            {/* Only the weeks that have a size show one. */}
            {shownContent.size !== undefined && (
              <ThemedText style={styles.rowValue}>
                {shownContent.size.label} —{' '}
                {shownContent.size.comparison}
              </ThemedText>
            )}

            <ThemedText type="small" style={styles.weeklySummary}>
              {shownContent.developmentSummary}
            </ThemedText>
          </View>

          <View
            accessible
            accessibilityLabel={`Bu hafta gelişenler: ${shownContent.developingFeatures.join(', ')}`}
            style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="small" themeColor="textSecondary">
              Bu hafta gelişenler
            </ThemedText>

            {shownContent.developingFeatures.map((feature) => (
              <ThemedText key={feature} type="small" style={styles.weeklyFeature}>
                • {feature}
              </ThemedText>
            ))}
          </View>

          {/* The domain requires at least one source, but the section
              is still conditional: an empty heading would be worse
              than no heading. */}
          {shownContent.sources.length > 0 && (
            <View style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="small" themeColor="textSecondary">
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

              {shownContent.sources.map((source) => (
                <Pressable
                  key={source.url}
                  accessibilityRole="link"
                  accessibilityLabel={`${source.name} kaynağını aç`}
                  onPress={() => openSource(source.url)}
                  style={({ pressed }) => [
                    styles.sourceLink,
                    pressed && styles.pressed,
                  ]}>
                  <ThemedText type="small">{source.name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {source.url}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          )}

          <ThemedText type="small" themeColor="textSecondary" style={styles.rowNote}>
            {CONTENT_DISCLAIMER_FOOTER}
          </ThemedText>
        </>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Gebelik ayarlarını düzenle"
        onPress={() => router.push('/(app)/pregnancy-settings')}
        style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
        <ThemedText type="small" themeColor="textSecondary">
          Gebelik ayarları
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  pregnancySection: {
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
  weekBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  weekButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.two,
  },
  weekButtonLabel: {
    fontSize: 24,
    lineHeight: 28,
  },
  selectedWeek: {
    flexShrink: 1,
    fontSize: 18,
    lineHeight: 26,
    textAlign: 'center',
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
  secondaryButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.6,
  },
});
