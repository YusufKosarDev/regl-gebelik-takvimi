import { describeCatalogueParity } from '../../../../../jest/catalogue-parity';
import { reminderMessages } from '../reminder-messages';

/**
 * What the app says about reminders, in both languages.
 *
 * The bodies are the careful part. They are delivered to a lock screen, where
 * somebody else may be looking and where the app cannot take a sentence back.
 */

describe('parity', () => {
  describeCatalogueParity(reminderMessages);
});

describe('what a reminder claims', () => {
  it('still hedges the period reminder in English', () => {
    // The app works from an average and does not know when anybody's period
    // will start. "Starts tomorrow" would be stating something the prediction
    // cannot support, on a day somebody may be somewhere they would rather not
    // be surprised.
    expect(reminderMessages.en.periodReminderBody).toMatch(/expected/i);
    expect(reminderMessages.en.periodReminderBody).toMatch(/average/i);
    expect(reminderMessages.en.periodReminderBody).not.toMatch(/\btoday\b|\btomorrow\b|\bwill start\b/i);
  });

  it('still invites rather than claims, for the pregnancy note', () => {
    // The app does not know how this week is going for anyone.
    expect(reminderMessages.en.pregnancyWeeklyReminderBody).toMatch(/can have a look/i);
  });
});

describe('the discreet wording', () => {
  it('mentions neither periods nor pregnancy, in either language', () => {
    // Two different neutral texts would be a code: "weekly" alone would tell
    // somebody reading over a shoulder which reminder it is.
    for (const catalogue of [reminderMessages.tr, reminderMessages.en]) {
      const both = `${catalogue.discreetReminderTitle} ${catalogue.discreetReminderBody}`;

      expect(both).not.toMatch(/regl|gebelik|period|pregnan|week|hafta/i);
    }
  });

  it('claims nothing about what is waiting', () => {
    // Not "something new", which would be a claim about content the app has
    // not checked, and not a question, which invites a tap on a lock screen
    // somebody else is holding.
    expect(reminderMessages.en.discreetReminderBody).not.toMatch(/\?|new/i);
  });

  it('says out loud that the lock screen cannot be hidden', () => {
    // A promise not made is a promise not broken.
    expect(reminderMessages.en.discreetNotificationsDescription).toMatch(/lock screen/i);
    expect(reminderMessages.en.discreetNotificationsDescription).toMatch(/cannot hide/i);
  });
});

describe('the two situations that are not the same', () => {
  it('keeps "was refused" and "is off" as different sentences', () => {
    // Being asked and saying no is not the same as never having been asked.
    expect(reminderMessages.en.permissionRefusedMessage).not.toBe(
      reminderMessages.en.notificationsBlockedNotice
    );
  });

  it('says what being blocked means rather than what the setting is called', () => {
    expect(reminderMessages.en.notificationsBlockedNotice).toMatch(/cannot reach you/i);
  });
});

describe('the channel descriptions', () => {
  it.each<['periodReminderChannelDescription' | 'pregnancyWeeklyReminderChannelDescription']>([
    ['periodReminderChannelDescription'],
    ['pregnancyWeeklyReminderChannelDescription'],
  ])('%s says how often, because that is what the system screen is for', (key) => {
    // "Period reminders" alone does not tell somebody whether it is one a month
    // or one a day, and that screen is where they decide whether to keep it.
    expect(reminderMessages.en[key]).toMatch(/one|weekly|morning|day/i);
  });

  it('keeps the two channels named differently', () => {
    // Switching one off in system settings must leave the other alone, and a
    // person can only do that if they can tell them apart.
    expect(reminderMessages.en.periodReminderChannelName).not.toBe(
      reminderMessages.en.pregnancyWeeklyReminderChannelName
    );
  });
});
