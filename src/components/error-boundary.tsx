import type { ErrorBoundaryProps } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  ERROR_BODY,
  ERROR_RETRY_LABEL,
  ERROR_TITLE,
} from '@/shared/presentation/app-messages';

/**
 * What is drawn when a screen throws while rendering.
 *
 * expo-router looks for an `ErrorBoundary` export on a route file and wraps
 * that route's tree in it, so a screen that raises on its first frame produces
 * this instead of a blank app. `app/_layout.tsx` re-exports it, which puts it
 * above every screen including the ones a deep link reaches directly.
 *
 * ## Why it is here rather than written inline in the layout
 *
 * So that it can be rendered on its own. The root layout imports the store,
 * the database, Firebase and the notification queue; a test that wanted to
 * check what this component says would have had to stand all of that up first,
 * which is a lot of machinery to mock in order to look at three pieces of text.
 *
 * ## Why it is plain `View` and `Text`
 *
 * `ThemedView`, `ThemedText` and `useTheme()` are all under whatever just
 * failed. The one screen whose job is to survive a failure should not be the
 * screen with the most behind it. The hydration placeholder in the root layout
 * is plain for the same reason, and this matches it.
 *
 * ## Why the error is not shown
 *
 * The thrown text is written by whatever failed, in whatever words it used. In
 * this app a SQLite error quotes the statement it failed on, and those
 * statements carry period dates as bound parameters. A screen is the one place
 * a person cannot choose not to look at it.
 *
 * `retry` is expo-router's: it clears the error state and renders the route
 * again. It is offered because a failure caused by something transient - a
 * database that was busy, a read that lost a race - costs nothing to try
 * again, and the alternative is telling somebody to force-quit the app.
 */
export function ErrorBoundary({ error: _error, retry }: ErrorBoundaryProps) {
  return (
    <View style={styles.center}>
      <Text accessibilityRole="header" style={styles.title}>
        {ERROR_TITLE}
      </Text>

      <Text style={styles.body}>{ERROR_BODY}</Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={ERROR_RETRY_LABEL}
        onPress={() => {
          void retry();
        }}
        style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
      >
        <Text style={styles.retryLabel}>{ERROR_RETRY_LABEL}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  body: {
    fontSize: 14,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 8,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
  },
  retryLabel: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
