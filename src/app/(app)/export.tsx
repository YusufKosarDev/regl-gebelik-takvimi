import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import type { ExportFile } from '@/features/export/application/build-export-files';
import { buildExportFiles } from '@/features/export/application/build-export-files';
import { shareTextFile } from '@/features/export/infrastructure/share-file';
import { exportMessages } from '@/features/export/presentation/export-messages';
import { useTheme } from '@/hooks/use-theme';
import { useLanguage, useMessages } from '@/i18n';
import { logEvent } from '@/shared/logging';
import { openAppDatabase } from '@/storage/db';
import type { ISODate } from '@/types/iso-date';
import { getTodayLocalISODate } from '@/utils/today';

/**
 * Taking the records off the phone.
 *
 * ## Why two buttons
 *
 * The system share sheet takes one file at a time, so "both formats" is two
 * actions rather than one. The note under the buttons says so, because somebody
 * who pressed once and got a summary would reasonably assume that was all of
 * it.
 *
 * ## Why the files are built on press and not on load
 *
 * Building them means reading the whole database and walking every month
 * between the first record and today. Doing that on arrival would make the
 * screen slow to open for a feature most visits will not use, and the result
 * would be stale by the time anybody pressed anything.
 *
 * ## What it says about where the file goes
 *
 * Plainly, at the top: once a file is shared it leaves the app's control. This
 * app's whole argument is that the records stay on the phone, and this is the
 * one screen that hands them to something else. Saying nothing would be the
 * dishonest option.
 */
export default function ExportScreen() {
  const theme = useTheme();
  const strings = useMessages(exportMessages);
  const language = useLanguage();

  const [isBusy, setIsBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [today] = useState<ISODate>(() => getTodayLocalISODate());

  // One lock for the screen rather than one per button: both read the same
  // database and both end in a share sheet, so a second press while the first
  // is still working has nothing useful to do.
  const shareInFlight = useRef(false);

  const share = useCallback(
    async (pick: (files: { summary: ExportFile; csv: ExportFile }) => ExportFile) => {
      if (shareInFlight.current) {
        return;
      }

      shareInFlight.current = true;
      setIsBusy(true);
      setNotice(null);

      try {
        const db = await openAppDatabase();
        const files = await buildExportFiles(db, { today, language, messages: strings });

        if (files.isEmpty) {
          setNotice(strings.emptyMessage);

          return;
        }

        const outcome = await shareTextFile(pick(files));

        if (outcome === 'unavailable') {
          setNotice(strings.sharingUnavailableMessage);
        }
      } catch (error: unknown) {
        logEvent('data export failed', error);
        setNotice(strings.shareFailedMessage);
      } finally {
        shareInFlight.current = false;
        setIsBusy(false);
      }
    },
    [today, language, strings]
  );

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            <BackButton />

            <View style={styles.header}>
              <ThemedText accessibilityRole="header" type="subtitle">
                {strings.exportTitle}
              </ThemedText>

              <ThemedText type="small" themeColor="textSecondary">
                {strings.exportDescription}
              </ThemedText>
            </View>

            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={strings.summaryButtonLabel}
                accessibilityState={{ disabled: isBusy }}
                disabled={isBusy}
                onPress={() => {
                  void share((files) => files.summary);
                }}
                style={({ pressed }) => [
                  styles.primaryButton,
                  { backgroundColor: theme.primary },
                  isBusy && styles.disabled,
                  pressed && !isBusy && styles.pressed,
                ]}>
                <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
                  {isBusy ? strings.preparingMessage : strings.summaryButtonText}
                </ThemedText>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={strings.csvButtonLabel}
                accessibilityState={{ disabled: isBusy }}
                disabled={isBusy}
                onPress={() => {
                  void share((files) => files.csv);
                }}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  { borderColor: theme.backgroundSelected },
                  isBusy && styles.disabled,
                  pressed && !isBusy && styles.pressed,
                ]}>
                <ThemedText type="smallBold">{strings.csvButtonText}</ThemedText>
              </Pressable>

              <ThemedText type="small" themeColor="textSecondary">
                {strings.twoFilesNote}
              </ThemedText>
            </View>

            {isBusy && (
              <ActivityIndicator testID="export-preparing" color={theme.text} />
            )}

            {notice !== null && (
              <ThemedText accessibilityRole="alert" type="small" themeColor="textSecondary">
                {notice}
              </ThemedText>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.four,
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    gap: Spacing.four,
  },
  header: {
    gap: Spacing.two,
  },
  actions: {
    gap: Spacing.three,
  },
  primaryButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.three,
  },
  secondaryButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.three,
    borderWidth: 1,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.6,
  },
});
