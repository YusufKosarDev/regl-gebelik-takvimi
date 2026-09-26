import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { useAppLock } from '@/features/app-lock/application/use-app-lock';
import { applyScreenPrivacy } from '@/features/app-lock/infrastructure/screen-privacy';
import { registerForegroundNotificationHandler } from '@/features/notifications/infrastructure/foreground-notification-handler';
import { useAutomaticSync } from '@/features/sync/application/use-automatic-sync';
import { logEvent } from '@/shared/logging';
import { useAppLockStore } from '@/store/app-lock-store';
import { useAppStore } from '@/store/app-store';

/**
 * Startup gate.
 *
 * Reads the persisted state once, holds the UI on a placeholder until it lands,
 * and then mounts exactly one route group. The decision lives here alone so no
 * screen has to repeat it.
 */
export default function RootLayout() {
  const colorScheme = useColorScheme();

  const hydrate = useAppStore((state) => state.hydrate);
  const hydrated = useAppStore((state) => state.hydrated);
  const onboardingCompleted = useAppStore((state) => state.onboardingCompleted);

  const hydrateLock = useAppLockStore((state) => state.hydrate);
  const lockHydrated = useAppLockStore((state) => state.hydrated);
  const locked = useAppLockStore((state) => state.locked);
  const appLockEnabled = useAppLockStore((state) => state.enabled);

  const [hasHydrationError, setHasHydrationError] = useState(false);

  // Mounted here rather than on a screen: an edit made anywhere should still
  // reach the account after the person navigates away from where they made it.
  useAutomaticSync();

  // Same reason: which screen happens to be open is not what decides whether
  // coming back to the app should ask for the PIN again.
  useAppLock();

  // Before anything can be rendered, and outside an effect: a reminder can fire
  // while the very first frame is still being drawn, and a handler installed
  // after it arrives is a handler that missed it. Idempotent by design, so a
  // re-render costs nothing.
  registerForegroundNotificationHandler();

  // `hydrate` is a stable store action, so this runs once per app start rather
  // than on every state change.
  useEffect(() => {
    hydrate().catch((error: unknown) => {
      logEvent('app state load failed', error);
      setHasHydrationError(true);
    });
  }, [hydrate]);

  // Its own read, and deliberately not part of the one above: a lock that
  // cannot be read must not fail the app launch. The store turns an unreadable
  // record into "no lock" and says so on the screen it belongs on.
  useEffect(() => {
    void hydrateLock();
  }, [hydrateLock]);

  /**
   * Keeps the app's own screen out of the task switcher.
   *
   * Re-applied whenever the lock is set or removed rather than only at start,
   * because below Android 13 the protection is a window flag that has to be
   * held while the lock is on and dropped when it is not.
   *
   * At the root so it covers every screen. A build without the native module
   * gets nothing and still runs.
   */
  useEffect(() => {
    void applyScreenPrivacy(appLockEnabled);
  }, [appLockEnabled]);

  // Without this the screen would spin forever when the read fails. What went
  // wrong is not shown: the thrown text is written by whatever failed, and a
  // screen is the one place a person cannot choose not to look at it.
  if (hasHydrationError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>App state could not be loaded.</Text>
      </View>
    );
  }

  if (!hydrated || !lockHydrated) {
    return (
      <View style={styles.center}>
        <ActivityIndicator testID="app-hydration-loading" />
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        {/* First, and above both others: a locked app mounts nothing else, so
            there is no screen behind the lock to draw, to leak into the task
            switcher, or to be reached by a deep link that arrived while it
            was closed. */}
        <Stack.Protected guard={onboardingCompleted && locked}>
          <Stack.Screen name="(lock)" />
        </Stack.Protected>

        <Stack.Protected guard={!onboardingCompleted}>
          <Stack.Screen name="(onboarding)" />
        </Stack.Protected>

        <Stack.Protected guard={onboardingCompleted && !locked}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
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
  errorText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});
