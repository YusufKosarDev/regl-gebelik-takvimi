import type { AppLockMessages } from './app-lock-messages';
import { appLockMessages } from './app-lock-messages';

/**
 * A remaining wait, as a sentence.
 *
 * Rounded **up**, so a wait with nine hundred milliseconds left says one second
 * rather than nought — a countdown that reaches zero while the pad is still
 * refusing is worse than one that is a moment pessimistic.
 *
 * Switches to minutes at sixty seconds. Nobody wants to read "1740 saniye", and
 * nobody wants to read "1740 seconds" either.
 *
 * Takes the catalogue half rather than reading one: it is a plain function, and
 * the screen showing the wait already knows which language it is in.
 */
export function waitMessageIn(messages: AppLockMessages, remainingMs: number): string {
  const seconds = Math.ceil(Math.max(0, remainingMs) / 1000);

  if (seconds < 60) {
    return messages.waitSecondsMessage(seconds);
  }

  return messages.waitMinutesMessage(Math.ceil(seconds / 60));
}

/** The Turkish behaviour under the original name, for the assertions that call it. */
export function waitMessage(remainingMs: number): string {
  return waitMessageIn(appLockMessages.tr, remainingMs);
}
