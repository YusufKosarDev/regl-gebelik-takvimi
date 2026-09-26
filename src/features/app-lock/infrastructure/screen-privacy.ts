import ScreenPrivacy from '../../../../modules/screen-privacy/src/ScreenPrivacyModule';

import { logEvent } from '@/shared/logging';

/**
 * The app's side of keeping its own screen out of the task switcher.
 *
 * Quiet by contract, unlike the widget bridge. A build without the native
 * module — Expo Go, or a web bundle — should still run the app; it just does
 * not get a blank thumbnail. Refusing to start over it would be worse than the
 * thing it protects against.
 *
 * Nothing here reports what is on the screen. What crosses this line is one
 * boolean.
 */

/** Whether this build can reach the native module at all. */
export function isScreenPrivacyAvailable(): boolean {
  return ScreenPrivacy !== null && ScreenPrivacy !== undefined;
}

/**
 * Applies the right protection for this Android version and lock state.
 *
 * Called once on start and again whenever the lock is set or removed. Safe to
 * call repeatedly.
 */
export async function applyScreenPrivacy(lockEnabled: boolean): Promise<void> {
  if (ScreenPrivacy === null || ScreenPrivacy === undefined) {
    return;
  }

  try {
    await ScreenPrivacy.apply(lockEnabled);
  } catch (error: unknown) {
    // A cold start can arrive here before there is a current activity, which is
    // a state rather than a fault. The next call gets it.
    logEvent('app lock screen privacy failed', error);
  }
}

/**
 * Whether turning the lock on will also stop screenshots working.
 *
 * True below Android 13. The setup screen asks so it only promises what will
 * actually happen, rather than showing a note that is wrong on most phones.
 */
export function blocksScreenshots(): boolean {
  if (ScreenPrivacy === null || ScreenPrivacy === undefined) {
    return false;
  }

  try {
    return ScreenPrivacy.blocksScreenshots();
  } catch {
    return false;
  }
}
