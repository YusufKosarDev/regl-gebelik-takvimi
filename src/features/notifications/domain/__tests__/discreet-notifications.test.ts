import {
  DEFAULT_DISCREET_NOTIFICATIONS,
  validateDiscreetNotifications,
} from '../discreet-notifications';

describe('DEFAULT_DISCREET_NOTIFICATIONS', () => {
  /**
   * Off, so an upgrade changes nothing about what somebody's reminders say.
   *
   * The app lock turns it on, which is where the decision is actually made by
   * somebody. A tracker that hid from its own user by default would be deciding
   * on their behalf, which is the thing the rest of this feature refuses to do.
   */
  it('is off', () => {
    expect(DEFAULT_DISCREET_NOTIFICATIONS).toBe(false);
  });
});

describe('validateDiscreetNotifications', () => {
  it('accepts both booleans', () => {
    expect(() => validateDiscreetNotifications(true)).not.toThrow();
    expect(() => validateDiscreetNotifications(false)).not.toThrow();
  });

  /**
   * SQLite has no boolean, and a stored `1` is truthy everywhere and a boolean
   * nowhere. The cost of letting one through runs one way: a value that failed
   * to be `true` puts the full sentence back on a lock screen belonging to
   * somebody who asked for the opposite.
   */
  it.each([
    ['a stored one', 1],
    ['a stored zero', 0],
    ['the string true', 'true'],
    ['null', null],
    ['undefined', undefined],
    ['an object', {}],
  ])('refuses %s', (_name, value) => {
    expect(() => validateDiscreetNotifications(value)).toThrow(/must be a boolean/);
  });

  it('says what kind of thing it received', () => {
    expect(() => validateDiscreetNotifications(1)).toThrow(/a number/);
    expect(() => validateDiscreetNotifications({})).toThrow(/an object/);
  });

  /**
   * The kind, never the value.
   *
   * `describeValue` is what keeps every message in this app out of the business
   * of quoting whatever it was handed. Nothing that reaches here should be
   * health data, but a message that printed its argument would be a place one
   * could arrive from a future caller nobody has written yet.
   */
  it('does not repeat the value back', () => {
    expect(() => validateDiscreetNotifications('2026-09-26')).toThrow(/text/);

    try {
      validateDiscreetNotifications('2026-09-26');
      throw new Error('expected a throw');
    } catch (error) {
      expect(String(error)).not.toContain('2026-09-26');
    }
  });
});
