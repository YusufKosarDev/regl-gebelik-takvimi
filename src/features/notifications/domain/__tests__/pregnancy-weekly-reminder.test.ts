import { PERIOD_REMINDER_TYPE } from '../period-reminder';
import {
  PREGNANCY_WEEKLY_REMINDER_CHANNEL_ID,
  PREGNANCY_WEEKLY_REMINDER_HOUR,
  PREGNANCY_WEEKLY_REMINDER_MINUTE,
  PREGNANCY_WEEKLY_REMINDER_TYPE,
  PREGNANCY_WEEKLY_REMINDER_WEEKDAY,
  isPregnancyWeeklyReminderData,
  pregnancyWeeklyReminderData,
} from '../pregnancy-weekly-reminder';

import {
  PREGNANCY_WEEKLY_REMINDER_BODY,
  PREGNANCY_WEEKLY_REMINDER_CHANNEL_NAME,
  PREGNANCY_WEEKLY_REMINDER_TITLE,
} from '@/features/notifications/presentation/reminder-messages';

describe('what a weekly pregnancy reminder says', () => {
  it('names itself plainly', () => {
    expect(PREGNANCY_WEEKLY_REMINDER_TITLE).toBe('Gebelik takibi');
  });

  it('invites rather than tells', () => {
    expect(PREGNANCY_WEEKLY_REMINDER_BODY).toBe(
      'Bu haftaki gebelik gelişim bilgilerine göz atabilirsin.'
    );
  });

  it('makes no medical claim on a lock screen', () => {
    // What a week brings belongs on a screen with its sources next to it.
    expect(PREGNANCY_WEEKLY_REMINDER_BODY).not.toMatch(
      /doktor|risk|tehlike|normal|sağlıklı|olmalı|gerekir|kesin/i
    );
    expect(PREGNANCY_WEEKLY_REMINDER_TITLE).not.toMatch(/doktor|risk|kesin/i);
  });

  it('names no week number it could get wrong', () => {
    expect(PREGNANCY_WEEKLY_REMINDER_BODY).not.toMatch(/\d/);
  });
});

describe('how a weekly pregnancy reminder is recognised', () => {
  it('carries a versioned type', () => {
    expect(PREGNANCY_WEEKLY_REMINDER_TYPE).toBe('pregnancy-weekly-reminder-v1');
    expect(pregnancyWeeklyReminderData()).toEqual({ type: 'pregnancy-weekly-reminder-v1' });
  });

  it('recognises its own payload', () => {
    expect(isPregnancyWeeklyReminderData(pregnancyWeeklyReminderData())).toBe(true);
  });

  it('recognises one with other keys alongside', () => {
    expect(
      isPregnancyWeeklyReminderData({ type: 'pregnancy-weekly-reminder-v1', extra: 1 })
    ).toBe(true);
  });

  it('is a different type from the period reminder', () => {
    expect(PREGNANCY_WEEKLY_REMINDER_TYPE).not.toBe(PERIOD_REMINDER_TYPE);
    expect(isPregnancyWeeklyReminderData({ type: PERIOD_REMINDER_TYPE })).toBe(false);
  });

  it.each([
    ['a later version of itself', { type: 'pregnancy-weekly-reminder-v2' }],
    ['something with no type', { title: 'Gebelik takibi' }],
    ['an empty payload', {}],
  ])('does not recognise %s', (_label, data) => {
    expect(isPregnancyWeeklyReminderData(data)).toBe(false);
  });

  it.each([null, undefined, 'pregnancy-weekly-reminder-v1', 7, []])(
    'does not recognise %p',
    (data) => {
      expect(isPregnancyWeeklyReminderData(data)).toBe(false);
    }
  );
});

describe('when a weekly pregnancy reminder lands', () => {
  it('is Monday morning at nine', () => {
    // Sunday is 1 in the platform's numbering, so Monday is 2.
    expect(PREGNANCY_WEEKLY_REMINDER_WEEKDAY).toBe(2);
    expect(PREGNANCY_WEEKLY_REMINDER_HOUR).toBe(9);
    expect(PREGNANCY_WEEKLY_REMINDER_MINUTE).toBe(0);
  });
});

describe('the channel these arrive on', () => {
  it('has a stable id and a Turkish name', () => {
    expect(PREGNANCY_WEEKLY_REMINDER_CHANNEL_ID).toBe('pregnancy-reminders');
    expect(PREGNANCY_WEEKLY_REMINDER_CHANNEL_NAME).toBe('Gebelik hatırlatıcıları');
  });

  it('is its own, so one can be silenced without the other', () => {
    expect(PREGNANCY_WEEKLY_REMINDER_CHANNEL_ID).not.toBe('period-reminders');
  });
});
