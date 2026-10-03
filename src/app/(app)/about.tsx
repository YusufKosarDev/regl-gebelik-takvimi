import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import {
  SUPPORT_EMAIL,
  legalPageUrl,
  supportMailtoUrl,
} from '@/features/disclaimer/domain/legal-links';
import { getAppVersion } from '@/features/disclaimer/infrastructure/app-version';
import type { DisclaimerMessages } from '@/features/disclaimer/presentation/disclaimer-messages';
import { disclaimerMessages } from '@/features/disclaimer/presentation/disclaimer-messages';
import { useTheme } from '@/hooks/use-theme';
import { useLanguage, useMessages } from '@/i18n';
import type { Language } from '@/i18n/language';
import { logEvent } from '@/shared/logging';

/**
 * What this app is, what it is not, and which build you are looking at.
 *
 * Reachable rather than unavoidable: the same facts are shown once during
 * onboarding, where they cannot be missed, and live here afterwards for
 * whenever somebody wants to check — which is usually the moment a prediction
 * did not match what happened.
 */

/** One row that leaves the app. */
type AboutLink = {
  readonly label: string;
  readonly url: string;
};

/**
 * The public pages, built from one base address.
 *
 * Derived rather than written out, so moving the site to another host is one
 * edit in `legal-links` and cannot leave a single row pointing at the old one.
 */
function aboutLinks(strings: DisclaimerMessages, language: Language): readonly AboutLink[] {
  return [
    { label: strings.aboutPrivacyLabel, url: legalPageUrl('privacy', language) },
    { label: strings.aboutKvkkLabel, url: legalPageUrl('kvkk', language) },
    { label: strings.aboutDeletionLabel, url: legalPageUrl('deletion', language) },
  ];
}

export default function AboutScreen() {
  const theme = useTheme();
  const disclaimer = useMessages(disclaimerMessages);
  const language = useLanguage();
  const links = aboutLinks(disclaimer, language);

  const version = getAppVersion();

  /**
   * What is shown when the phone will not open something.
   *
   * Held as one message rather than one per row: only one can have just failed,
   * and a screen carrying three stale failures would be worse than one.
   */
  const [openFailure, setOpenFailure] = useState<string | null>(null);

  /**
   * Opens a page, or says where it was.
   *
   * `openURL` rejects when there is no browser, when the phone blocks the
   * scheme, and on some devices for reasons it does not explain. None of those
   * are worth a silent failure: somebody who pressed "Gizlilik politikası" has
   * a reason to want it, so the address goes on screen to be typed or copied.
   */
  const openLink = async (url: string, onFailure: (target: string) => string) => {
    setOpenFailure(null);

    try {
      await Linking.openURL(url);
    } catch (error) {
      logEvent('about link open failed', error);

      setOpenFailure(onFailure(url === supportMailtoUrl() ? SUPPORT_EMAIL : url));
    }
  };

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
                {disclaimer.aboutScreenTitle}
              </ThemedText>
            </View>

            <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="smallBold">{disclaimer.aboutAppName}</ThemedText>

              <ThemedText
                accessibilityLabel={disclaimer.aboutVersionLabel(version)}
                type="small"
                themeColor="textSecondary">
                {disclaimer.aboutVersionText(version)}
              </ThemedText>
            </View>

            <View style={styles.section}>
              <ThemedText accessibilityRole="header" type="smallBold">
                {disclaimer.aboutImportantSectionTitle}
              </ThemedText>

              {disclaimer.aboutImportantParagraphs.map((paragraph) => (
                <ThemedText key={paragraph} type="small" themeColor="textSecondary">
                  {paragraph}
                </ThemedText>
              ))}
            </View>

            <View style={styles.section}>
              <ThemedText accessibilityRole="header" type="smallBold">
                {disclaimer.aboutTransferSectionTitle}
              </ThemedText>

              <ThemedText type="small" themeColor="textSecondary">
                {disclaimer.aboutTransferParagraph}
              </ThemedText>
            </View>

            <View style={styles.section}>
              <ThemedText accessibilityRole="header" type="smallBold">
                {disclaimer.aboutLinksSectionTitle}
              </ThemedText>

              {links.map((link) => (
                <Pressable
                  key={link.url}
                  accessibilityRole="link"
                  accessibilityLabel={link.label}
                  onPress={() => {
                    void openLink(link.url, disclaimer.linkOpenFailedMessage);
                  }}
                  style={({ pressed }) => [
                    styles.linkButton,
                    { borderColor: theme.primary },
                    pressed && styles.pressed,
                  ]}>
                  <ThemedText type="smallBold" themeColor="primary">
                    {link.label}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            <View style={styles.section}>
              <ThemedText accessibilityRole="header" type="smallBold">
                {disclaimer.aboutSupportSectionTitle}
              </ThemedText>

              <Pressable
                accessibilityRole="link"
                accessibilityLabel={disclaimer.aboutSupportLabel(SUPPORT_EMAIL)}
                onPress={() => {
                  void openLink(supportMailtoUrl(), disclaimer.mailOpenFailedMessage);
                }}
                style={({ pressed }) => [
                  styles.linkButton,
                  { borderColor: theme.primary },
                  pressed && styles.pressed,
                ]}>
                <ThemedText type="smallBold" themeColor="primary">
                  {disclaimer.aboutSupportLabel(SUPPORT_EMAIL)}
                </ThemedText>
              </Pressable>
            </View>

            {/* Below every row, because any of them can be the one that failed. */}
            {openFailure !== null && (
              <ThemedText accessibilityRole="alert" type="small" themeColor="textSecondary">
                {openFailure}
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
    flexGrow: 1,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.six,
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
  card: {
    gap: Spacing.half,
    borderRadius: Spacing.three,
    padding: Spacing.four,
  },
  section: {
    gap: Spacing.three,
  },
  linkButton: {
    minHeight: 52,
    borderRadius: Spacing.three,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  pressed: {
    opacity: 0.6,
  },
});
