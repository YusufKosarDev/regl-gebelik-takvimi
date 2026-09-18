import type { NotificationPreferences } from '../notification-preferences';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  validateNotificationPreferences,
  withReminder,
} from '../notification-preferences';

function preferences(
  overrides: Partial<NotificationPreferences> = {}
): NotificationPreferences {
  return { periodReminderEnabled: false, pregnancyWeeklyReminderEnabled: false, ...overrides };
}

const FIELDS = ['periodReminderEnabled', 'pregnancyWeeklyReminderEnabled'] as const;

describe('DEFAULT_NOTIFICATION_PREFERENCES', () => {
  it('has every reminder off', () => {
    // An app that starts sending notifications because it was installed has
    // decided something that was never its to decide.
    expect(DEFAULT_NOTIFICATION_PREFERENCES).toEqual({
      periodReminderEnabled: false,
      pregnancyWeeklyReminderEnabled: false,
    });
  });

  it('carries no schedule of its own', () => {
    expect(Object.keys(DEFAULT_NOTIFICATION_PREFERENCES).sort()).toEqual([...FIELDS].sort());
  });

  it('passes its own validation', () => {
    expect(() => validateNotificationPreferences(DEFAULT_NOTIFICATION_PREFERENCES)).not.toThrow();
  });
});

describe('validateNotificationPreferences with usable preferences', () => {
  it.each([
    [false, false],
    [true, false],
    [false, true],
    [true, true],
  ])('accepts %p and %p', (period, pregnancy) => {
    expect(() =>
      validateNotificationPreferences({
        periodReminderEnabled: period,
        pregnancyWeeklyReminderEnabled: pregnancy,
      })
    ).not.toThrow();
  });

  it('returns nothing', () => {
    expect(validateNotificationPreferences(preferences())).toBeUndefined();
  });
});

describe('validateNotificationPreferences with something that is not a boolean', () => {
  it.each(FIELDS)('refuses a 1 in %s', (field) => {
    // Truthy everywhere it is tested, and a boolean nowhere.
    expect(() =>
      validateNotificationPreferences(preferences({ [field]: 1 as unknown as boolean }))
    ).toThrow(new RegExp(`non-boolean ${field}`));
  });

  it.each(FIELDS)('refuses a 0 in %s', (field) => {
    expect(() =>
      validateNotificationPreferences(preferences({ [field]: 0 as unknown as boolean }))
    ).toThrow(new RegExp(`non-boolean ${field}`));
  });

  it.each(FIELDS)('refuses a missing %s', (field) => {
    const { [field]: removed, ...rest } = preferences();

    void removed;

    expect(() =>
      validateNotificationPreferences(rest as NotificationPreferences)
    ).toThrow(new RegExp(`non-boolean ${field}`));
  });

  it.each(FIELDS)('refuses a string in %s', (field) => {
    expect(() =>
      validateNotificationPreferences(preferences({ [field]: 'true' as unknown as boolean }))
    ).toThrow(new RegExp(`non-boolean ${field}`));
  });

  it('reports the first broken field rather than all of them', () => {
    expect(() =>
      validateNotificationPreferences({
        periodReminderEnabled: 1 as unknown as boolean,
        pregnancyWeeklyReminderEnabled: 1 as unknown as boolean,
      })
    ).toThrow(/periodReminderEnabled/);
  });
});

describe('validateNotificationPreferences with something that is not preferences', () => {
  it.each([null, undefined, 'on', 7, true, []])('refuses %p', (value) => {
    expect(() =>
      validateNotificationPreferences(value as unknown as NotificationPreferences)
    ).toThrow();
  });
});

describe('withReminder', () => {
  it.each(FIELDS)('turns %s on', (field) => {
    expect(withReminder(preferences(), field, true)[field]).toBe(true);
  });

  it.each(FIELDS)('turns %s off again', (field) => {
    const on = withReminder(preferences(), field, true);

    expect(withReminder(on, field, false)[field]).toBe(false);
  });

  it('leaves the other reminder alone', () => {
    const next = withReminder(preferences(), 'periodReminderEnabled', true);

    expect(next.pregnancyWeeklyReminderEnabled).toBe(false);
  });

  it('accepts setting a reminder to what it already is', () => {
    expect(withReminder(preferences(), 'periodReminderEnabled', false)).toEqual(preferences());
  });

  it('refuses a value that is not a boolean', () => {
    expect(() =>
      withReminder(preferences(), 'periodReminderEnabled', 1 as unknown as boolean)
    ).toThrow(/expects a boolean/);
  });

  it('refuses preferences the domain would', () => {
    expect(() =>
      withReminder(
        preferences({ periodReminderEnabled: 1 as unknown as boolean }),
        'pregnancyWeeklyReminderEnabled',
        true
      )
    ).toThrow(/non-boolean/);
  });

  it('does not change the preferences it was given', () => {
    const current = preferences();

    withReminder(current, 'periodReminderEnabled', true);

    expect(current.periodReminderEnabled).toBe(false);
  });

  it('hands back a different object', () => {
    const current = preferences();

    expect(withReminder(current, 'periodReminderEnabled', true)).not.toBe(current);
  });
});
