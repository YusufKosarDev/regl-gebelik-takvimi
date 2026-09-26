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

/**
 * How a prompt ended.
 *
 * `cancelled` is separated from `failed` because the two mean opposite things
 * to the person in front of the screen. A failure is the sensor not recognising
 * them, which is worth a line of explanation. A cancel is them tapping "PIN'i
 * kullan" — a decision, not a problem — and telling somebody "Tanınamadı" after
 * they chose the PIN is the app misreporting what just happened.
 *
 * Nothing above this needs to know *why* it failed beyond that. A mismatch, a
 * platform lockout and a sensor that is busy all get the same answer: the pad
 * is already on the screen behind the sheet.
 */
export type BiometricOutcome = 'success' | 'cancelled' | 'failed' | 'unavailable';

/**
 * The reasons expo-local-authentication gives for a prompt somebody dismissed.
 *
 * `user_cancel` is the negative button, which with the system fallback off is
 * "PIN'i kullan". `user_fallback` is the same button on the platforms that
 * report it that way. `system_cancel` and `app_cancel` are the prompt being
 * taken away — a call arriving, the app being backgrounded — which is also not
 * somebody failing to be recognised.
 */
const CANCELLED_REASONS: readonly string[] = [
  'user_cancel',
  'user_fallback',
  'system_cancel',
  'app_cancel',
];

/**
 * Asks for a fingerprint or a face.
 *
 * `biometricsSecurityLevel: 'strong'` restricts this to Android Class 3.
 * Class 2 includes face unlocks that a photograph defeats, which is not the bar
 * for a record of somebody's body.
 *
 * ## `disableDeviceFallback: true`, and it is not optional
 *
 * Left at its default, Android offers "Use PIN" on the sheet and accepts the
 * **device** passcode — and `authenticateAsync` then returns success. Measured
 * on a device: an app lock set to one PIN opened to a completely different
 * device passcode.
 *
 * That silently undoes the thing this feature is most for. The threat here is
 * not a stranger; it is somebody who lives with you and has watched you unlock
 * your phone. An app lock that accepts the phone's own passcode is no lock at
 * all against them, which is why the setup screen suggests choosing a different
 * PIN in the first place.
 *
 * So the system fallback is off and ours is the only one. Our PIN is on the
 * screen behind this sheet already.
 *
 * Never throws. What it does with the reason is narrow on purpose: it tells a
 * dismissal apart from a rejection, and nothing finer. A mismatch, a platform
 * lockout and a busy sensor are all the same answer to this app — ask for the
 * PIN — and an app that reported each of them separately would be narrating
 * somebody's failed fingerprints back at them.
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
      // See above: without this the device passcode opens the app.
      disableDeviceFallback: true,
    });

    if (result.success) {
      return 'success';
    }

    return CANCELLED_REASONS.includes(result.error) ? 'cancelled' : 'failed';
  } catch (error: unknown) {
    logEvent('app lock biometrics failed', error);

    return 'failed';
  }
}
