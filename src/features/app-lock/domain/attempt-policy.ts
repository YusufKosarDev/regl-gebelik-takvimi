/**
 * What a wrong PIN costs.
 *
 * Pure: a function of how many tries have failed and what the clock says. No
 * storage and no timer — the caller persists the count and the moment, because
 * a wait that a process kill resets is not a wait.
 *
 * ## The rule this file exists to keep
 *
 * **Nothing here deletes anything, and nothing here can be made to.** There is
 * no attempt count that wipes the database, no duress PIN, no "too many tries
 * and your records are gone". This app's promise is that it does not lose
 * somebody's record of themselves, and a lockout that erased it would hand an
 * abuser a way to destroy it by typing wrong six times. The waits escalate, cap,
 * and stop. A test asserts that no delete function is reachable from here.
 *
 * ## What the waits are actually for
 *
 * Somebody standing there guessing. They are not a defence against an attacker
 * with the device: the waits are `Date.now()` arithmetic, so moving the device
 * clock skips them — and anybody who can move the clock is holding an unlocked
 * phone and could read the database file instead. A speed bump, described as
 * one.
 */

/** Tries that cost nothing. */
export const FREE_ATTEMPTS = 5;

/**
 * What each further failure costs, in milliseconds.
 *
 * The last entry is the cap and repeats forever: half an hour is long enough to
 * make guessing pointless and short enough that it is not a lockout. There is
 * no step beyond it, because a permanent one would be a door with no key on
 * either side — and recovery by account password stays open at every step.
 */
export const WAIT_SCHEDULE_MS = [
  30 * 1000,
  60 * 1000,
  5 * 60 * 1000,
  15 * 60 * 1000,
  30 * 60 * 1000,
] as const;

/** How the counters are carried between attempts. The caller stores this. */
export type AttemptState = {
  readonly failedAttempts: number;
  /** Epoch ms the wait ends, or `null` when nothing is being waited out. */
  readonly lockedUntil: number | null;
};

/** Where a fresh start begins, and where a success returns to. */
export const NO_FAILED_ATTEMPTS: AttemptState = {
  failedAttempts: 0,
  lockedUntil: null,
} as const;

/**
 * The wait after this many failures, in milliseconds.
 *
 * `0` while the failures are still free. Past the end of the schedule it stays
 * at the last entry rather than growing.
 */
export function waitAfterFailures(failedAttempts: number): number {
  if (!Number.isFinite(failedAttempts) || failedAttempts <= FREE_ATTEMPTS) {
    return 0;
  }

  const step = Math.floor(failedAttempts) - FREE_ATTEMPTS - 1;

  return WAIT_SCHEDULE_MS[Math.min(step, WAIT_SCHEDULE_MS.length - 1)];
}

/**
 * The state after one more wrong PIN.
 *
 * `now` is passed in rather than read, so the schedule can be tested without
 * waiting half an hour for the last step.
 */
export function afterWrongPin(state: AttemptState, now: number): AttemptState {
  const failedAttempts = state.failedAttempts + 1;
  const wait = waitAfterFailures(failedAttempts);

  return {
    failedAttempts,
    lockedUntil: wait === 0 ? null : now + wait,
  };
}

/** Where a correct PIN — or a successful recovery — puts the counters back to. */
export function afterSuccess(): AttemptState {
  return NO_FAILED_ATTEMPTS;
}

/**
 * How long is left to wait, in milliseconds. `0` means try now.
 *
 * A `lockedUntil` in the past is simply over. A `lockedUntil` far in the future
 * because the clock moved backwards is not clamped or repaired here: this
 * returns what the stored state says, and the screen shows it. Repairing it
 * would mean guessing which of the two clocks was lying.
 */
export function remainingWaitMs(state: AttemptState, now: number): number {
  if (state.lockedUntil === null) {
    return 0;
  }

  return Math.max(0, state.lockedUntil - now);
}

/** Whether a PIN may be tried at all right now. */
export function mayAttempt(state: AttemptState, now: number): boolean {
  return remainingWaitMs(state, now) === 0;
}

/**
 * Tries left before the next wait, or `null` once the waits have started.
 *
 * Shown to a person who is getting it wrong, and only near the end: telling
 * somebody they have five tries left before they have used any is noise, and
 * telling them after the waits begin is answering a question the wait already
 * answered.
 */
export function attemptsBeforeWait(state: AttemptState): number | null {
  const left = FREE_ATTEMPTS - state.failedAttempts;

  return left > 0 ? left : null;
}
