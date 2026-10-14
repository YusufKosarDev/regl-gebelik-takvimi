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

/**
 * The weekly reminder's own description, and the line it must not cross.
 *
 * ## What this guards
 *
 * The switch can be on with no pregnancy tracked, and nothing arrives. The
 * obvious fix was a line under the row saying so - and `loadPregnancyProfile()`
 * returning `null` covers two situations the app cannot tell apart: somebody
 * who has never tracked a pregnancy, and somebody whose pregnancy has ended.
 * To the second, a line about not tracking a pregnancy is the app remarking on
 * one to the person who recorded its ending.
 *
 * So the rule is: this string says what the reminder *does*, and never what the
 * person's situation *is*. These assertions hold that rule, because the next
 * person to look at the row will see the same gap and reach for the same line -
 * the per-switch mechanism is already there, built for a silenced channel.
 */
describe('the weekly pregnancy description', () => {
  it('says when the reminder arrives', () => {
    // "Açıkken" and "while" are doing the work: they describe the condition
    // the reminder needs rather than reporting whether it is met.
    expect(reminderMessages.tr.pregnancyWeeklyReminderDescription).toMatch(/açıkken/i);
    expect(reminderMessages.en.pregnancyWeeklyReminderDescription).toMatch(/while/i);
  });

  it('names the day, so the row answers the question somebody has', () => {
    expect(reminderMessages.tr.pregnancyWeeklyReminderDescription).toMatch(/pazartesi/i);
    expect(reminderMessages.en.pregnancyWeeklyReminderDescription).toMatch(/monday/i);
  });

  it.each([
    ['tr', reminderMessages.tr.pregnancyWeeklyReminderDescription],
    ['en', reminderMessages.en.pregnancyWeeklyReminderDescription],
  ])('remarks on no situation of the reader in %s', (_language, description) => {
    // Any of these would turn a standing description into a statement about
    // the reader - which is the thing this row must not do, because one of the
    // two people reading it has just recorded the end of a pregnancy.
    expect(description).not.toMatch(/\b(değil|etmiyorsun|yok)\b|takip etmediğin/i);
    expect(description).not.toMatch(/\b(not|isn.t|aren.t)\b|no pregnancy|you do not/i);
  });
});
