/**
 * Whether the lock should be on screen.
 *
 * Pure: state in, answer out. No `AppState`, no timer, no clock — the hook in
 * `application/use-app-lock` owns all three and asks this what they mean.
 */

/**
 * How long somebody may leave and come back without being asked again.
 *
 * Fifteen seconds, for three reasons, and the third is the one that would
 * otherwise cost a day of debugging:
 *
 *   1. Pulling down the notification shade, answering a permission dialog or
 *      glancing at a message and coming straight back should not want a PIN.
 *   2. The window opens when *you* leave, so the phone is in your hand for all
 *      of it.
 *   3. On several Android devices the biometric prompt itself sends the
 *      activity to the background. With no window at all the app re-locks the
 *      instant the fingerprint sheet opens, and unlocking becomes a loop. The
 *      window is half of that fix; `authenticationInProgress` below is the
 *      other half, because a device slow enough to exceed fifteen seconds at
 *      the prompt would still loop.
 */
export const GRACE_WINDOW_MS = 15 * 1000;

export type LockContext = {
  /** Whether a lock is set up at all. */
  readonly enabled: boolean;
  /**
   * When the app last went to the background, or `null` for a cold start.
   *
   * A cold start has no previous moment by definition, which is what makes
   * "always lock on a cold start" fall out of the same rule rather than being
   * a special case beside it.
   */
  readonly backgroundedAt: number | null;
  /**
   * Whether the OS biometric sheet is up.
   *
   * See reason 3 above. While this is true the app has not been left — it is
   * being unlocked — and the background transition that Android reports is the
   * prompt's, not the person's.
   */
  readonly authenticationInProgress: boolean;
};

/**
 * Whether returning to the foreground should ask for the PIN.
 *
 * A `backgroundedAt` in the future — a clock that moved while the app was away
 * — reads as no elapsed time and does not lock. The alternative is locking
 * somebody out because their phone crossed a timezone, and the window is a
 * courtesy rather than a defence: anybody who can move the clock is holding an
 * unlocked phone.
 */
export function shouldLockOnForeground(context: LockContext, now: number): boolean {
  if (!context.enabled) {
    return false;
  }

  if (context.authenticationInProgress) {
    return false;
  }

  if (context.backgroundedAt === null) {
    return true;
  }

  const elapsed = now - context.backgroundedAt;

  if (elapsed < 0) {
    return false;
  }

  return elapsed >= GRACE_WINDOW_MS;
}

/** Whether a cold start should open on the lock. Enabled means yes, always. */
export function shouldLockOnStart(enabled: boolean): boolean {
  return enabled;
}
