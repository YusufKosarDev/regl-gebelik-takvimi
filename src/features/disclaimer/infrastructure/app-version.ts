import Constants from 'expo-constants';

import { ABOUT_VERSION_UNKNOWN } from '../presentation/disclaimer-messages';

/**
 * The version this build was made from.
 *
 * `expo-constants` reads it out of the embedded config, which is written from
 * `app.json` at build time — so it is the same number that goes to Play, not a
 * second copy someone has to remember to bump.
 *
 * Both steps can come back empty: `expoConfig` is null in a few hosting
 * situations, and `version` is optional in the config schema. A missing version
 * is a screen that says so, never a crash and never a blank where a number
 * should be — somebody reading this screen is often about to report a problem,
 * and "Bilinmiyor" is at least an answer.
 */
export function getAppVersion(): string {
  const version = Constants.expoConfig?.version;

  if (typeof version !== 'string' || version.trim() === '') {
    return ABOUT_VERSION_UNKNOWN;
  }

  return version;
}
