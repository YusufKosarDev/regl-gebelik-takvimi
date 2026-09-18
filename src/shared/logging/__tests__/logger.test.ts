import { LOG_EVENTS } from '../log-events';
import { logEvent } from '../logger';

let warn: jest.SpyInstance;
let error: jest.SpyInstance;
let log: jest.SpyInstance;

/** Everything written during one call, whichever console method took it. */
function written(): string {
  return [warn, error, log]
    .flatMap((spy) => spy.mock.calls)
    .map((call) => call.map((part: unknown) => String(part)).join(' '))
    .join('\n');
}

beforeEach(() => {
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  error = jest.spyOn(console, 'error').mockImplementation(() => {});
  log = jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('logEvent', () => {
  it('writes the event it was given', () => {
    logEvent('widget sync failed');

    expect(written()).toBe('[app] widget sync failed');
  });

  it('writes every event in the catalogue', () => {
    for (const event of LOG_EVENTS) {
      logEvent(event);
    }

    expect(warn).toHaveBeenCalledTimes(LOG_EVENTS.length);
  });

  it('describes an error alongside it', () => {
    logEvent('notification sync failed', new TypeError('due date 2027-06-09'));

    expect(written()).toBe('[app] notification sync failed (TypeError)');
  });

  it('writes the event alone when there is nothing safe to say about the error', () => {
    logEvent('notification sync failed', '2026-09-17');

    expect(written()).toBe('[app] notification sync failed');
  });
});

describe('logEvent refuses anything that is not an event', () => {
  it.each([
    ['a date', '2026-09-17'],
    ['a sentence with data in it', 'widget sync failed for 2026-09-17'],
    ['an avatar id', 'skin-tone-5'],
    ['a snapshot', JSON.stringify({ version: 1, date: '2026-09-17', cycleDay: 1 })],
    ['an empty string', ''],
    ['a number', 7],
    ['a profile', { lastMenstrualPeriodStartDate: '2026-09-02' }],
    ['nothing', null],
  ])('writes nothing for %s', (_label, value) => {
    logEvent(value as never);

    expect(written()).toBe('');
  });

  it('writes nothing for an event with something appended to it', () => {
    logEvent('widget sync failed: 2026-09-17' as never);

    expect(written()).toBe('');
  });
});

describe('what a log line never carries', () => {
  const health = {
    lastMenstrualPeriodStartDate: '2026-09-02',
    estimatedDueDate: '2027-06-09',
    avatar: { skinToneId: 'skin-tone-5', hairStyleId: 'wavy' },
    moodLabels: ['Kramplar olabilir'],
  };

  it('does not carry an error message, even one full of dates', () => {
    logEvent('period record save failed', new Error(JSON.stringify(health)));

    expect(written()).not.toMatch(/\d{4}-\d{2}-\d{2}|skin-tone|wavy|Kramplar/);
    expect(written()).toBe('[app] period record save failed (Error)');
  });

  it('does not carry a stack', () => {
    logEvent('cycle data load failed', new Error('boom'));

    expect(written()).not.toMatch(/at |\.tsx?:/);
  });

  it('does not serialise an error that is really a profile', () => {
    logEvent('pregnancy load failed', { name: 'Error', ...health });

    expect(written()).toBe('[app] pregnancy load failed (Error)');
  });

  it('writes the same generic line in a released build', () => {
    const dev = (globalThis as { __DEV__?: boolean }).__DEV__;
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;

    try {
      logEvent('widget sync failed', new Error('2026-09-17'));

      expect(written()).toBe('[app] widget sync failed (Error)');
      expect(written()).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    } finally {
      (globalThis as { __DEV__?: boolean }).__DEV__ = dev;
    }
  });
});

describe('the catalogue itself', () => {
  it.each(LOG_EVENTS)('%s carries no data of its own', (event) => {
    expect(event).not.toMatch(/\d/);
    expect(event).toMatch(/^[a-z ]+$/);
  });

  it('lists each event once', () => {
    expect(new Set(LOG_EVENTS).size).toBe(LOG_EVENTS.length);
  });
});
