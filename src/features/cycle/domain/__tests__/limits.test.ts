import {
  MAX_CYCLE_LENGTH_DAYS,
  MAX_PERIOD_LENGTH_DAYS,
  MIN_CYCLE_LENGTH_DAYS,
  MIN_PERIOD_LENGTH_DAYS,
  DEFAULT_CYCLE_LENGTH_DAYS,
  DEFAULT_PERIOD_LENGTH_DAYS,
} from '../limits';

// Pins the published numbers. Every screen, parser and validator now reads these,
// so a change here is a product decision, not an implementation detail.
describe('cycle limits', () => {
  it('bounds the cycle length at 15 to 90 days', () => {
    expect(MIN_CYCLE_LENGTH_DAYS).toBe(15);
    expect(MAX_CYCLE_LENGTH_DAYS).toBe(90);
  });

  it('bounds the period length at 1 to 20 days', () => {
    expect(MIN_PERIOD_LENGTH_DAYS).toBe(1);
    expect(MAX_PERIOD_LENGTH_DAYS).toBe(20);
  });
});

/**
 * What the app assumes when nobody has said.
 *
 * These moved here out of an onboarding screen that no longer exists. The flow
 * used to ask for both lengths before it asked the one question it cannot
 * guess - the date the last period started - and both answers already had a
 * default sitting in the screen that asked for them. A question whose answer
 * is pre-filled with the figure most people would give is a screen somebody
 * can quit on for nothing.
 *
 * They are domain values now because the app uses them when the onboarding did
 * not ask, and the settings screen offers them as the starting point. Two
 * copies of 28 would be two things to keep in step.
 */
describe('the default lengths', () => {
  it('are the textbook figures', () => {
    expect(DEFAULT_CYCLE_LENGTH_DAYS).toBe(28);
    expect(DEFAULT_PERIOD_LENGTH_DAYS).toBe(5);
  });

  it('sit inside the range the app will accept', () => {
    // A default outside the limits is a profile the app writes and then
    // refuses to load. Cheap to assert, and it is the kind of thing that
    // survives a retune of either end.
    expect(DEFAULT_CYCLE_LENGTH_DAYS).toBeGreaterThanOrEqual(MIN_CYCLE_LENGTH_DAYS);
    expect(DEFAULT_CYCLE_LENGTH_DAYS).toBeLessThanOrEqual(MAX_CYCLE_LENGTH_DAYS);
    expect(DEFAULT_PERIOD_LENGTH_DAYS).toBeGreaterThanOrEqual(MIN_PERIOD_LENGTH_DAYS);
    expect(DEFAULT_PERIOD_LENGTH_DAYS).toBeLessThanOrEqual(MAX_PERIOD_LENGTH_DAYS);
  });

  it('leaves a period shorter than the cycle it sits in', () => {
    expect(DEFAULT_PERIOD_LENGTH_DAYS).toBeLessThan(DEFAULT_CYCLE_LENGTH_DAYS);
  });
});
