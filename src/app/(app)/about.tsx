import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import {
  SUPPORT_EMAIL,
  legalPageUrl,
  supportMailtoUrl,
} from '@/features/disclaimer/domain/legal-links';
import { getAppVersion } from '@/features/disclaimer/infrastructure/app-version';
import {
  ABOUT_APP_NAME,
  ABOUT_IMPORTANT_PARAGRAPHS,
  ABOUT_DELETION_LABEL,
  ABOUT_IMPORTANT_SECTION_TITLE,
  ABOUT_KVKK_LABEL,
  ABOUT_LINKS_SECTION_TITLE,
  ABOUT_PRIVACY_LABEL,
  ABOUT_SCREEN_TITLE,
  ABOUT_SUPPORT_SECTION_TITLE,
  ABOUT_VERSION_LABEL,
  aboutSupportLabel,
  linkOpenFailedMessage,
  mailOpenFailedMessage,
} from '@/features/disclaimer/presentation/disclaimer-messages';
import { useTheme } from '@/hooks/use-theme';
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
const ABOUT_LINKS: readonly AboutLink[] = [
  { label: ABOUT_PRIVACY_LABEL, url: legalPageUrl('privacy') },
  { label: ABOUT_KVKK_LABEL, url: legalPageUrl('kvkk') },
  { label: ABOUT_DELETION_LABEL, url: legalPageUrl('deletion') },
];

export default function AboutScreen() {
  const router = useRouter();
  const theme = useTheme();

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
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Geri"
              onPress={() => router.back()}
              style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
              <ThemedText type="small" themeColor="textSecondary">
                Geri
              </ThemedText>
            </Pressable>

            <View style={styles.header}>
              <ThemedText accessibilityRole="header" type="subtitle">
                {ABOUT_SCREEN_TITLE}
              </ThemedText>
            </View>

            <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="smallBold">{ABOUT_APP_NAME}</ThemedText>

              <ThemedText
                accessibilityLabel={`${ABOUT_VERSION_LABEL}: ${version}`}
                type="small"
                themeColor="textSecondary">
                {`${ABOUT_VERSION_LABEL} ${version}`}
              </ThemedText>
            </View>

            <View style={styles.section}>
              <ThemedText accessibilityRole="header" type="smallBold">
                {ABOUT_IMPORTANT_SECTION_TITLE}
              </ThemedText>

              {ABOUT_IMPORTANT_PARAGRAPHS.map((paragraph) => (
                <ThemedText key={paragraph} type="small" themeColor="textSecondary">
                  {paragraph}
                </ThemedText>
              ))}
            </View>

            <View style={styles.section}>
              <ThemedText accessibilityRole="header" type="smallBold">
                {ABOUT_LINKS_SECTION_TITLE}
              </ThemedText>

              {ABOUT_LINKS.map((link) => (
                <Pressable
                  key={link.url}
                  accessibilityRole="link"
                  accessibilityLabel={link.label}
                  onPress={() => {
                    void openLink(link.url, linkOpenFailedMessage);
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
                {ABOUT_SUPPORT_SECTION_TITLE}
              </ThemedText>

              <Pressable
                accessibilityRole="link"
                accessibilityLabel={aboutSupportLabel(SUPPORT_EMAIL)}
                onPress={() => {
                  void openLink(supportMailtoUrl(), mailOpenFailedMessage);
                }}
                style={({ pressed }) => [
                  styles.linkButton,
                  { borderColor: theme.primary },
                  pressed && styles.pressed,
                ]}>
                <ThemedText type="smallBold" themeColor="primary">
                  {aboutSupportLabel(SUPPORT_EMAIL)}
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
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.two,
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
