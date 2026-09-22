import { useRouter } from 'expo-router';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { getAppVersion } from '@/features/disclaimer/infrastructure/app-version';
import {
  ABOUT_APP_NAME,
  ABOUT_IMPORTANT_PARAGRAPHS,
  ABOUT_IMPORTANT_SECTION_TITLE,
  ABOUT_SCREEN_TITLE,
  ABOUT_VERSION_LABEL,
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

/**
 * A link out, once there is one to show.
 *
 * The privacy policy and the account-deletion request form both need a hosted
 * page, and neither exists yet. The list is empty rather than stubbed: a row
 * that says "yakında" or opens nothing is worse than no row, because somebody
 * looking for a privacy policy has a reason to be looking and deserves a
 * straight answer rather than a dead end. When the pages exist, they go in here
 * and the section appears on its own.
 */
type AboutLink = {
  readonly label: string;
  readonly url: string;
};

const ABOUT_LINKS: readonly AboutLink[] = [];

export default function AboutScreen() {
  const router = useRouter();
  const theme = useTheme();

  const version = getAppVersion();

  const openLink = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch (error) {
      // Nothing is shown: there is no link on screen today, and when there is,
      // a browser that refuses to open is the phone's problem to report.
      logEvent('about link open failed', error);
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

            {/* Nothing is rendered while there is nothing to link to. */}
            {ABOUT_LINKS.length > 0 && (
              <View style={styles.section}>
                {ABOUT_LINKS.map((link) => (
                  <Pressable
                    key={link.url}
                    accessibilityRole="link"
                    accessibilityLabel={link.label}
                    onPress={() => {
                      void openLink(link.url);
                    }}
                    style={({ pressed }) => [
                      styles.linkButton,
                      { borderColor: theme.backgroundSelected },
                      pressed && styles.pressed,
                    ]}>
                    <ThemedText type="smallBold">{link.label}</ThemedText>
                  </Pressable>
                ))}
              </View>
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
