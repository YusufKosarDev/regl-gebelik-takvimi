/**
 * Which reminders a person has asked for.
 *
 * Two switches and nothing else. No time of day, no day of the week and no
 * quiet hours: those are choices worth offering, but offering them before
 * anything is scheduled would be asking someone to configure a thing that does
 * not happen yet.
 *
 * Both default to off, and stay off until the person turns one on. A health app
 * that starts sending notifications because it was installed has decided
 * something on the user's behalf that was never theirs to decide.
 *
 * Nothing here knows about permissions. Whether the operating system will
 * deliver a notification is a separate question from whether the person wants
 * one, and mixing them would make "I turned it on but Android said no" look the
 * same as "I never asked for this".
 */
export type NotificationPreferences = {
  readonly periodReminderEnabled: boolean;
  readonly pregnancyWeeklyReminderEnabled: boolean;
};

/** What someone has before they have chosen anything. */
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  periodReminderEnabled: false,
  pregnancyWeeklyReminderEnabled: false,
};

const FIELDS = [
  'periodReminderEnabled',
  'pregnancyWeeklyReminderEnabled',
] as const satisfies readonly (keyof NotificationPreferences)[];

/**
 * Checks one set of preferences, throwing on the first rule it breaks.
 *
 * Booleans and only booleans: a `1` read straight out of SQLite would work
 * everywhere it is tested and then quietly make `!enabled` false for a disabled
 * reminder. The repository converts; this is what makes sure it did.
 *
 * Pure: nothing is mutated and the value is read exactly as given.
 */
export function validateNotificationPreferences(preferences: NotificationPreferences): void {
  if (
    typeof preferences !== 'object' ||
    preferences === null ||
    Array.isArray(preferences)
  ) {
    throw new Error(
      `validateNotificationPreferences received something that is not preferences: ${JSON.stringify(
        preferences
      )}.`
    );
  }

  FIELDS.forEach((field) => {
    if (typeof preferences[field] !== 'boolean') {
      throw new Error(
        `NotificationPreferences has a non-boolean ${field}: ${JSON.stringify(preferences[field])}.`
      );
    }
  });
}

/**
 * The same preferences with one reminder switched.
 *
 * Returns a new object rather than editing the one it was given: these come
 * from storage and go to a screen, and a shared object edited in place is how a
 * toggle ends up showing a state that was never saved.
 */
export function withReminder(
  preferences: NotificationPreferences,
  field: keyof NotificationPreferences,
  enabled: boolean
): NotificationPreferences {
  validateNotificationPreferences(preferences);

  if (typeof enabled !== 'boolean') {
    throw new Error(`withReminder expects a boolean, received ${JSON.stringify(enabled)}.`);
  }

  return { ...preferences, [field]: enabled };
}
