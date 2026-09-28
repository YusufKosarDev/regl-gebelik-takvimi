import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useMessages } from '@/i18n';
import { appMessages } from '@/shared/presentation/app-messages';

/**
 * Where a link that matches nothing lands.
 *
 * This app registers the `reglgebeliktakvimi://` scheme, so anything on the
 * phone can hand it a path — including one from an older build, a typo, or a
 * screen that has since been renamed. Without this file expo-router falls back
 * to its own development screen, which is written for whoever is building the
 * app rather than for whoever is holding it.
 *
 * It says the records are fine before it says anything else, for the same
 * reason the error boundary does: somebody who followed a link into a health
 * app and landed somewhere unexpected is not wondering about routing.
 *
 * The way out is `replace` rather than `back`. A deep link that arrived while
 * the app was closed has nothing behind it, and a back button that does
 * nothing is worse than no back button.
 */
export default function NotFoundScreen() {
  const router = useRouter();
  const theme = useTheme();
  const strings = useMessages(appMessages);

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <ThemedText type="title" accessibilityRole="header">
            {strings.notFoundTitle}
          </ThemedText>

          <ThemedText themeColor="textSecondary">{strings.notFoundBody}</ThemedText>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={strings.notFoundHomeLabel}
            onPress={() => router.replace('/')}
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: theme.primary },
              pressed && styles.pressed,
            ]}
          >
            <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
              {strings.notFoundHomeLabel}
            </ThemedText>
          </Pressable>
        </View>
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
  content: {
    flex: 1,
    justifyContent: 'center',
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  button: {
    marginTop: Spacing.two,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    borderRadius: 12,
  },
  pressed: {
    opacity: 0.7,
  },
});
