import {
  FREE_ATTEMPTS,
  NO_FAILED_ATTEMPTS,
  WAIT_SCHEDULE_MS,
  afterSuccess,
  afterWrongPin,
  attemptsBeforeWait,
  mayAttempt,
  remainingWaitMs,
  waitAfterFailures,
} from '../attempt-policy';

/**
 * What a wrong PIN costs.
 *
 * The clock is an argument everywhere, so the last step of the schedule is
 * tested without waiting half an hour for it.
 */

const NOW = 1_800_000_000_000;

describe('the free attempts', () => {
  it('costs nothing for the first five', () => {
    let state = NO_FAILED_ATTEMPTS;

    for (let attempt = 1; attempt <= FREE_ATTEMPTS; attempt++) {
      state = afterWrongPin(state, NOW);

      expect(state.failedAttempts).toBe(attempt);
      expect(state.lockedUntil).toBeNull();
      expect(mayAttempt(state, NOW)).toBe(true);
    }
  });

  it('counts down what is left, and stops counting once the waits begin', () => {
    let state = NO_FAILED_ATTEMPTS;

    expect(attemptsBeforeWait(state)).toBe(5);

    state = afterWrongPin(state, NOW);
    expect(attemptsBeforeWait(state)).toBe(4);

    for (let i = 0; i < 4; i++) {
      state = afterWrongPin(state, NOW);
    }

    expect(state.failedAttempts).toBe(5);
    expect(attemptsBeforeWait(state)).toBeNull();
  });
});

describe('the escalating waits', () => {
  it.each([
    [6, 30 * 1000],
    [7, 60 * 1000],
    [8, 5 * 60 * 1000],
    [9, 15 * 60 * 1000],
    [10, 30 * 60 * 1000],
  ])('makes failure %i wait %i ms', (failures, expected) => {
    expect(waitAfterFailures(failures)).toBe(expected);
  });

  it('caps rather than growing, however many times somebody tries', () => {
    const cap = WAIT_SCHEDULE_MS[WAIT_SCHEDULE_MS.length - 1];

    expect(waitAfterFailures(10)).toBe(cap);
    expect(waitAfterFailures(11)).toBe(cap);
    expect(waitAfterFailures(50)).toBe(cap);
    expect(waitAfterFailures(1_000_000)).toBe(cap);
  });

  it('never returns a wait that is not a finite number of milliseconds', () => {
    for (let failures = 0; failures <= 40; failures++) {
      const wait = waitAfterFailures(failures);

      expect(Number.isFinite(wait)).toBe(true);
      expect(wait).toBeGreaterThanOrEqual(0);
    }
  });

  it('sets the moment the wait ends from the clock it was given', () => {
    let state = NO_FAILED_ATTEMPTS;

    for (let i = 0; i < FREE_ATTEMPTS; i++) {
      state = afterWrongPin(state, NOW);
    }

    const sixth = afterWrongPin(state, NOW);

    expect(sixth.lockedUntil).toBe(NOW + 30 * 1000);
    expect(mayAttempt(sixth, NOW)).toBe(false);
    expect(remainingWaitMs(sixth, NOW)).toBe(30 * 1000);
  });
});

describe('waiting it out', () => {
  const waiting = { failedAttempts: 6, lockedUntil: NOW + 30_000 } as const;

  it('counts down', () => {
    expect(remainingWaitMs(waiting, NOW)).toBe(30_000);
    expect(remainingWaitMs(waiting, NOW + 10_000)).toBe(20_000);
    expect(remainingWaitMs(waiting, NOW + 29_999)).toBe(1);
  });

  it('is over at the moment it says, not a tick later', () => {
    expect(mayAttempt(waiting, NOW + 29_999)).toBe(false);
    expect(mayAttempt(waiting, NOW + 30_000)).toBe(true);
  });

  it('is over rather than negative once the moment has passed', () => {
    expect(remainingWaitMs(waiting, NOW + 60_000)).toBe(0);
    expect(mayAttempt(waiting, NOW + 60_000)).toBe(true);
  });

  // The stored moment is reported as it stands. Repairing it would mean
  // guessing which of two clocks was lying, and the screen can say what it says.
  it('reports a wait left over from a clock that moved backwards', () => {
    expect(remainingWaitMs(waiting, NOW - 60_000)).toBe(90_000);
  });
});

describe('getting it right', () => {
  it('puts the counters back where they started', () => {
    expect(afterSuccess()).toEqual(NO_FAILED_ATTEMPTS);
    expect(afterSuccess().failedAttempts).toBe(0);
    expect(afterSuccess().lockedUntil).toBeNull();
  });
});

/**
 * The rule this whole file exists to keep.
 *
 * A lockout that destroyed data would hand somebody a way to erase another
 * person's records by typing wrong six times. This is written as a test rather
 * than a comment so it fails if anyone ever reaches for it.
 */
describe('nothing here destroys anything', () => {
  it('never reports a permanent lockout, however many failures', () => {
    let state = NO_FAILED_ATTEMPTS;

    for (let i = 0; i < 200; i++) {
      state = afterWrongPin(state, NOW);
    }

    const cap = WAIT_SCHEDULE_MS[WAIT_SCHEDULE_MS.length - 1];

    expect(remainingWaitMs(state, NOW)).toBe(cap);
    expect(mayAttempt(state, NOW + cap)).toBe(true);
  });

  it('exports nothing that deletes, wipes, clears or resets data', () => {
    const module = jest.requireActual<Record<string, unknown>>('../attempt-policy');

    for (const name of Object.keys(module)) {
      expect(name).not.toMatch(/delete|wipe|clear|erase|destroy|purge|remove/i);
    }
  });

  it('returns only counters, never an instruction to act on data', () => {
    const state = afterWrongPin(NO_FAILED_ATTEMPTS, NOW);

    expect(Object.keys(state).sort()).toEqual(['failedAttempts', 'lockedUntil']);
  });
});
