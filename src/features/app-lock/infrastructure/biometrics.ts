import * as LocalAuthentication from 'expo-local-authentication';

import { logEvent } from '@/shared/logging';

/**
 * The fingerprint or face prompt.
 *
 * ## What this returns is an assertion, not a key
 *
 * `authenticateAsync` answers "the OS was satisfied". It does not release a
 * secret, and nothing here learns the PIN. That is the right shape for a lock
 * over a screen, and it means the biometric path trusts a boolean that arrives
 * over the bridge — forgeable on a rooted device, where the attacker could read
 * the unencrypted database instead and skip all of this.
 *
 * The alternative — keeping the PIN in SecureStore behind
 * `requireAuthentication: true` — was rejected. Expo's own documentation warns
 * that such a value becomes unreadable when biometric settings change, so
 * adding a fingerprint would lock somebody out of their own app. A data-access
 * footgun for a benefit this does not need.
 */

/** Whether this device could use biometrics for the lock at all. */
export async function canUseBiometrics(): Promise<boolean> {
  try {
    const [hasHardware, isEnrolled] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]);

    return hasHardware && isEnrolled;
  } catch (error: unknown) {
    logEvent('app lock biometrics failed', error);

    return false;
  }
}

/** How a prompt ended. `failed` covers every reason it did not succeed. */
export type BiometricOutcome = 'success' | 'failed' | 'unavailable';

/**
 * Asks for a fingerprint or a face.
 *
 * `biometricsSecurityLevel: 'strong'` restricts this to Android Class 3.
 * Class 2 includes face unlocks that a photograph defeats, which is not the bar
 * for a record of somebody's body.
 *
 * `disableDeviceFallback` is left at its default. Our own PIN is behind this
 * prompt already and is the better fallback; suppressing the system one would
 * change nothing except making the sheet less familiar.
 *
 * Never throws, and never reports *why* it failed. A cancel, a mismatch and a
 * platform lockout are all the same answer to this app: ask for the PIN.
 */
export async function promptForBiometrics(promptMessage: string, cancelLabel: string): Promise<BiometricOutcome> {
  try {
    if (!(await canUseBiometrics())) {
      return 'unavailable';
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel,
      biometricsSecurityLevel: 'strong',
    });

    return result.success ? 'success' : 'failed';
  } catch (error: unknown) {
    logEvent('app lock biometrics failed', error);

    return 'failed';
  }
}
