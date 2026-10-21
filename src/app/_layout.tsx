import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { ICON_FONT } from '@/components/icon';
import { FONT_ASSETS } from '@/constants/fonts';
import { useAppLock } from '@/features/app-lock/application/use-app-lock';
import { applyScreenPrivacy } from '@/features/app-lock/infrastructure/screen-privacy';
import { registerForegroundNotificationHandler } from '@/features/notifications/infrastructure/foreground-notification-handler';
import { useAutomaticSync } from '@/features/sync/application/use-automatic-sync';
import { useMessages } from '@/i18n';
import { logEvent } from '@/shared/logging';
import { appMessages } from '@/shared/presentation/app-messages';
import { useAppLockStore } from '@/store/app-lock-store';
import { useAppStore } from '@/store/app-store';

/**
 * The screen a failed render produces.
 *
 * expo-router reads this export off the route file, so it has to be named here
 * even though it is written in its own module - see that file for why it is not
 * inline. Re-exported from the *root* layout so that it stands above every
 * screen, including the ones a deep link opens directly.
 */
export { ErrorBoundary } from '@/components/error-boundary';

/**
 * Holds the splash up until the app has something to show.
 *
 * `expo-splash-screen` was configured in `app.json` and never asked to wait, so
 * it hid itself on the first frame — and the first frame is the spinner below,
 * because the fonts and two AsyncStorage reads have not landed yet. Every cold
 * start went splash, flash of spinner, app.
 *
 * ## Why this is at module scope and not in an effect
 *
 * The splash hides on the first render. An effect runs after it, which is too
 * late to prevent anything. This is the shape Expo's own guide uses.
 *
 * The rejection is swallowed deliberately: a splash that could not be held is
 * the flicker this removes, and refusing to start the app over it would be
 * strictly worse than the thing being fixed.
 */
void SplashScreen.preventAutoHideAsync().catch(() => undefined);

/**
 * Lets the splash go, whatever happened.
 *
 * Called when the app can draw and also when it cannot — a hydration error puts
 * a message on screen, and leaving the splash over it would be an app that
 * looks like it hung instead of one that is explaining itself.
 */
function hideSplash(): void {
  void SplashScreen.hideAsync().catch(() => undefined);
}

/**
 * Startup gate.
 *
 * Reads the persisted state once, holds the UI on a placeholder until it lands,
 * and then mounts exactly one route group. The decision lives here alone so no
 * screen has to repeat it.
 */
export default function RootLayout() {
  const colorScheme = useColorScheme();

  // Resolved from the device's own language when the store has nothing to
  // say, which is exactly the case the hydration error below is for.
  const common = useMessages(appMessages);

  /**
   * The app's two typefaces, loaded at runtime.
   *
   * `useFonts` rather than the `expo-font` config plugin: the plugin embeds the
   * files during a native build and would have made a new typeface require a
   * prebuild and a rebuild. This loads them over the bundle, so the whole of
   * this work stays in JavaScript.
   *
   * The second element of the tuple is the load error, deliberately ignored.
   * `useFonts` reports loaded on failure too, and a missing typeface is not a
   * reason to hold somebody out of their own records - React Native falls back
   * to the system font and the app reads exactly as it did before.
   */
  const [fontsLoaded] = useFonts({ ...FONT_ASSETS, ...ICON_FONT });

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

  /**
   * Hands the screen over once there is something on it.
   *
   * Both conditions, because both end the placeholder: everything hydrated, or
   * the read failed and the message below is what the person gets instead.
   * Holding the splash over either would read as a hang.
   *
   * The spinner stays as what shows if this somehow does not fire — a visible
   * placeholder is a better failure than a splash that never lifts.
   */
  const ready = (hydrated && lockHydrated && fontsLoaded) || hasHydrationError;

  useEffect(() => {
    if (ready) {
      hideSplash();
    }
  }, [ready]);

  // Without this the screen would spin forever when the read fails. What went
  // wrong is not shown: the thrown text is written by whatever failed, and a
  // screen is the one place a person cannot choose not to look at it.
  if (hasHydrationError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{common.hydrationErrorMessage}</Text>
      </View>
    );
  }

  if (!hydrated || !lockHydrated || !fontsLoaded) {
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
