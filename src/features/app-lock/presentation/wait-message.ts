import { waitMinutesMessage, waitSecondsMessage } from './app-lock-messages';

/**
 * A remaining wait, as a sentence.
 *
 * Rounded **up**, so a wait with nine hundred milliseconds left says one second
 * rather than nought — a countdown that reaches zero while the pad is still
 * refusing is worse than one that is a moment pessimistic.
 *
 * Switches to minutes at sixty seconds. Nobody wants to read "1740 saniye".
 */
export function waitMessage(remainingMs: number): string {
  const seconds = Math.ceil(Math.max(0, remainingMs) / 1000);

  if (seconds < 60) {
    return waitSecondsMessage(seconds);
  }

  return waitMinutesMessage(Math.ceil(seconds / 60));
}
