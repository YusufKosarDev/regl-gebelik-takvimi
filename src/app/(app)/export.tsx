import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { dailyLogCatalogueLabels } from '@/features/daily-log/presentation/daily-log-catalogues';
import type { ExportFiles } from '@/features/export/application/build-export-files';
import { buildExportFiles } from '@/features/export/application/build-export-files';
import type { ShareOutcome } from '@/features/export/infrastructure/share-file';
import { shareTextFile } from '@/features/export/infrastructure/share-file';
import { sharePdfFile } from '@/features/export/infrastructure/share-pdf-file';
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
 * ## Why three buttons
 *
 * The system share sheet takes one file at a time, so "all the formats" is
 * three actions rather than one. The note under the buttons says so, because
 * somebody who pressed once and got a summary would reasonably assume that was
 * all of it.
 *
 * The `.txt` stays beside the PDF rather than being replaced by it. It is the
 * one of the three that depends on no renderer - `printToFileAsync` hands the
 * HTML to the platform's WebView - so it is what is left when the printing
 * fails, and a screen whose whole job is getting the records out should not
 * have a single point of failure.
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
  // The printable document is the only one of the three that names a symptom,
  // and it needs the word rather than the stored id.
  const labels = useMessages(dailyLogCatalogueLabels);
  const language = useLanguage();

  /**
   * Which export is running, rather than whether one is.
   *
   * `isBusy` alone was a screen-wide boolean and the busy text was written
   * onto the summary button, so pressing "Ham veriyi (CSV) paylaş" made the
   * *other* button say "Hazırlanıyor…" while the CSV button looked idle.
   * Found on a device.
   *
   * The lock below stays screen-wide for the reason written there - both
   * reads hit the same database and both end in a share sheet. This is only
   * about which label says so.
   */
  const [busyFile, setBusyFile] = useState<'summary' | 'csv' | 'pdf' | null>(null);
  const isBusy = busyFile !== null;
  const [notice, setNotice] = useState<string | null>(null);
  const [today] = useState<ISODate>(() => getTodayLocalISODate());

  // One lock for the screen rather than one per button: both read the same
  // database and both end in a share sheet, so a second press while the first
  // is still working has nothing useful to do.
  const shareInFlight = useRef(false);

  /**
   * One flow for all three, with the sending passed in.
   *
   * The PDF does not go out the same way the other two do - it is printed on
   * the device and then moved into the folder the wipe empties, which is
   * `share-pdf-file.ts`'s whole job - so the caller hands over the sending
   * rather than just picking a file out of the set.
   */
  const share = useCallback(
    async (
      which: 'summary' | 'csv' | 'pdf',
      send: (files: ExportFiles) => Promise<ShareOutcome>
    ) => {
      if (shareInFlight.current) {
        return;
      }

      shareInFlight.current = true;
      setBusyFile(which);
      setNotice(null);

      try {
        const db = await openAppDatabase();
        const files = await buildExportFiles(db, {
          today,
          language,
          messages: strings,
          labels,
        });

        if (files.isEmpty) {
          setNotice(strings.emptyMessage);

          return;
        }

        const outcome = await send(files);

        if (outcome === 'unavailable') {
          setNotice(strings.sharingUnavailableMessage);
        }
      } catch (error: unknown) {
        logEvent('data export failed', error);
        setNotice(strings.shareFailedMessage);
      } finally {
        shareInFlight.current = false;
        setBusyFile(null);
      }
    },
    [today, language, strings, labels]
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
                  void share('summary', (files) => shareTextFile(files.summary));
                }}
                style={({ pressed }) => [
                  styles.primaryButton,
                  { backgroundColor: theme.primary },
                  isBusy && styles.disabled,
                  pressed && !isBusy && styles.pressed,
                ]}>
                <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
                  {busyFile === 'summary' ? strings.preparingMessage : strings.summaryButtonText}
                </ThemedText>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={strings.csvButtonLabel}
                accessibilityState={{ disabled: isBusy }}
                disabled={isBusy}
                onPress={() => {
                  void share('csv', (files) => shareTextFile(files.csv));
                }}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  { borderColor: theme.backgroundSelected },
                  isBusy && styles.disabled,
                  pressed && !isBusy && styles.pressed,
                ]}>
                <ThemedText type="smallBold">
                  {busyFile === 'csv' ? strings.preparingMessage : strings.csvButtonText}
                </ThemedText>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={strings.pdfButtonLabel}
                accessibilityState={{ disabled: isBusy }}
                disabled={isBusy}
                onPress={() => {
                  void share('pdf', (files) => sharePdfFile(files.pdf));
                }}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  { borderColor: theme.backgroundSelected },
                  isBusy && styles.disabled,
                  pressed && !isBusy && styles.pressed,
                ]}>
                <ThemedText type="smallBold">
                  {busyFile === 'pdf' ? strings.preparingMessage : strings.pdfButtonText}
                </ThemedText>
              </Pressable>

              <ThemedText type="small" themeColor="textSecondary">
                {strings.threeFilesNote}
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
