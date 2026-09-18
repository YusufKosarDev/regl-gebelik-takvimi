import {
  PERIOD_REMINDER_BODY,
  PERIOD_REMINDER_CHANNEL_ID,
  PERIOD_REMINDER_CHANNEL_NAME,
  PERIOD_REMINDER_DAYS_BEFORE,
  PERIOD_REMINDER_HOUR,
  PERIOD_REMINDER_TITLE,
  PERIOD_REMINDER_TYPE,
  isPeriodReminderData,
  periodReminderData,
  periodReminderDate,
} from '../period-reminder';

import type { ISODate } from '@/types/iso-date';

const date = (value: string) => value as ISODate;

describe('what a period reminder says', () => {
  it('names itself plainly', () => {
    expect(PERIOD_REMINDER_TITLE).toBe('Regl hatırlatıcısı');
  });

  it('says the period is approaching, according to the estimate', () => {
    expect(PERIOD_REMINDER_BODY).toBe('Tahminine göre regl dönemin yaklaşıyor.');
  });

  it('claims nothing the prediction cannot support', () => {
    // The app works from an average and does not know when anyone's period
    // starts, so it never says that it does.
    expect(PERIOD_REMINDER_BODY).toMatch(/[Tt]ahmin/);
    expect(PERIOD_REMINDER_BODY).not.toMatch(/bugün|başlayacak|başlıyor|kesin/i);
  });

  it(`says nothing about anyone's body being a certainty`, () => {
    expect(PERIOD_REMINDER_TITLE).not.toMatch(/bugün|başlayacak/i);
  });
});

describe('how a period reminder is recognised', () => {
  it('carries a versioned type', () => {
    expect(PERIOD_REMINDER_TYPE).toBe('period-reminder-v1');
    expect(periodReminderData()).toEqual({ type: 'period-reminder-v1' });
  });

  it('recognises its own payload', () => {
    expect(isPeriodReminderData(periodReminderData())).toBe(true);
    expect(isPeriodReminderData({ type: 'period-reminder-v1' })).toBe(true);
  });

  it('recognises one with other keys alongside', () => {
    expect(isPeriodReminderData({ type: 'period-reminder-v1', extra: 1 })).toBe(true);
  });

  it.each([
    ['a pregnancy reminder', { type: 'pregnancy-weekly-reminder-v1' }],
    ['a later version of itself', { type: 'period-reminder-v2' }],
    ['something with no type', { title: 'Regl hatırlatıcısı' }],
    ['an empty payload', {}],
  ])('does not recognise %s', (_label, data) => {
    expect(isPeriodReminderData(data)).toBe(false);
  });

  it.each([null, undefined, 'period-reminder-v1', 7, [], [{ type: 'period-reminder-v1' }]])(
    'does not recognise %p',
    (data) => {
      expect(isPeriodReminderData(data)).toBe(false);
    }
  );
});

describe('when a period reminder lands', () => {
  it('is a day before the estimate, at nine', () => {
    expect(PERIOD_REMINDER_DAYS_BEFORE).toBe(1);
    expect(PERIOD_REMINDER_HOUR).toBe(9);
  });

  it('takes the day before a predicted start', () => {
    expect(periodReminderDate(date('2026-10-15'))).toBe('2026-10-14');
  });

  it('steps back over the start of a month', () => {
    expect(periodReminderDate(date('2026-10-01'))).toBe('2026-09-30');
  });

  it('steps back over the start of a year', () => {
    expect(periodReminderDate(date('2027-01-01'))).toBe('2026-12-31');
  });

  it('steps back onto a leap day that exists', () => {
    expect(periodReminderDate(date('2028-03-01'))).toBe('2028-02-29');
  });

  it('steps back over a February that has no 29th', () => {
    expect(periodReminderDate(date('2026-03-01'))).toBe('2026-02-28');
  });

  it('has no day when there is no prediction', () => {
    // Without a predicted start there is nothing to be early about, and picking
    // a day anyway would be inventing a date the app does not have.
    expect(periodReminderDate(null)).toBeNull();
  });

  it('refuses a date that is not one', () => {
    expect(() => periodReminderDate(date('2026-02-30'))).toThrow();
  });

  it('gives the same answer every time', () => {
    expect(periodReminderDate(date('2026-10-15'))).toBe(periodReminderDate(date('2026-10-15')));
  });
});

describe('the channel these arrive on', () => {
  it('has a stable id and a Turkish name', () => {
    expect(PERIOD_REMINDER_CHANNEL_ID).toBe('period-reminders');
    expect(PERIOD_REMINDER_CHANNEL_NAME).toBe('Regl hatırlatıcıları');
  });
});
