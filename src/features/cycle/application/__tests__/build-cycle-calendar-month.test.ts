import { buildCycleCalendarMonth } from '../build-cycle-calendar-month';

import { getCycleDay } from '@/features/cycle/domain/cycle-day';
import { getCyclePhase } from '@/features/cycle/domain/cycle-phase';
import { getEstimatedFertilityLevel } from '@/features/cycle/domain/fertility-level';
import { predictNextPeriodStart } from '@/features/cycle/domain/predictions';
import type { CycleProfile } from '@/features/cycle/domain/types';
import type { ISODate } from '@/types/iso-date';
import { daysBetween, toISODate } from '@/utils/date';

// Counts calls while keeping the real behaviour, so every other test in this
// file still runs against the genuine prediction.
jest.mock('@/features/cycle/domain/predictions', () => {
  const actual = jest.requireActual<typeof import('@/features/cycle/domain/predictions')>(
    '@/features/cycle/domain/predictions'
  );

  // Spread the real module and spy on the one function: the month also builds
  // its horizon predicate from here, and a mock listing only what it needed
  // when it was written is a mock that breaks the next time it needs one more.
  return { ...actual, predictNextPeriodStart: jest.fn(actual.predictNextPeriodStart) };
});

const predictNextPeriodStartMock = predictNextPeriodStart as unknown as jest.Mock;

/** Cycle 28, period 5 -> ovulation on day 14, fertile window days 9-15. */
function profile(startDates: string[] = ['2026-09-01']): CycleProfile {
  return {
    settings: { averageCycleLengthDays: 28, averagePeriodLengthDays: 5 },
    periodRecords: startDates.map((startDate, index) => ({
      id: `record-${index}`,
      startDate: startDate as ISODate,
      isOngoing: false,
    })),
  };
}

describe('buildCycleCalendarMonth input validation', () => {
  it('accepts a valid year and month', () => {
    expect(() => buildCycleCalendarMonth(profile(), 2026, 9)).not.toThrow();
  });

  it('rejects month 0', () => {
    expect(() => buildCycleCalendarMonth(profile(), 2026, 0)).toThrow(/month between 1 and 12/);
  });

  it('rejects month 13', () => {
    expect(() => buildCycleCalendarMonth(profile(), 2026, 13)).toThrow(/month between 1 and 12/);
  });

  it('rejects a decimal month', () => {
    expect(() => buildCycleCalendarMonth(profile(), 2026, 9.5)).toThrow(/month between 1 and 12/);
  });

  it('rejects a negative year', () => {
    expect(() => buildCycleCalendarMonth(profile(), -1, 9)).toThrow(/year between 0 and 9999/);
  });

  it('rejects a year above 9999', () => {
    expect(() => buildCycleCalendarMonth(profile(), 10000, 9)).toThrow(/year between 0 and 9999/);
  });

  it('rejects a decimal year', () => {
    expect(() => buildCycleCalendarMonth(profile(), 2026.5, 9)).toThrow(/year between 0 and 9999/);
  });

  it('rejects an invalid profile', () => {
    const invalid: CycleProfile = {
      settings: { averageCycleLengthDays: 14, averagePeriodLengthDays: 5 },
      periodRecords: [],
    };

    expect(() => buildCycleCalendarMonth(invalid, 2026, 9)).toThrow(
      /averageCycleLengthDays must be between 15 and 90/
    );
  });

  it('echoes the month it was asked for', () => {
    const month = buildCycleCalendarMonth(profile(), 2026, 9);

    expect(month.year).toBe(2026);
    expect(month.month).toBe(9);
  });
});

describe('buildCycleCalendarMonth month length', () => {
  it.each<[number, number, number]>([
    [2026, 1, 31],
    [2026, 4, 30],
    [2026, 2, 28],
    [2024, 2, 29],
  ])('gives %i-%i exactly %i days', (year, monthNumber, expected) => {
    expect(buildCycleCalendarMonth(profile(), year, monthNumber).days).toHaveLength(expected);
  });

  it('covers every month of a leap year without a gap', () => {
    let total = 0;

    for (let monthNumber = 1; monthNumber <= 12; monthNumber += 1) {
      total += buildCycleCalendarMonth(profile(), 2024, monthNumber).days.length;
    }

    expect(total).toBe(366);
  });
});

describe('buildCycleCalendarMonth date order', () => {
  it('starts on the first of the month', () => {
    const { days } = buildCycleCalendarMonth(profile(), 2026, 9);

    expect(days[0].date).toBe('2026-09-01');
  });

  it('ends on the last real day of the month', () => {
    expect(buildCycleCalendarMonth(profile(), 2026, 9).days.at(-1)?.date).toBe('2026-09-30');
    expect(buildCycleCalendarMonth(profile(), 2026, 2).days.at(-1)?.date).toBe('2026-02-28');
    expect(buildCycleCalendarMonth(profile(), 2024, 2).days.at(-1)?.date).toBe('2024-02-29');
  });

  it('advances exactly one day at a time', () => {
    const { days } = buildCycleCalendarMonth(profile(), 2026, 9);

    for (let index = 1; index < days.length; index += 1) {
      expect(daysBetween(days[index - 1].date, days[index].date)).toBe(1);
    }
  });

  it('never reaches into the next month', () => {
    const { days } = buildCycleCalendarMonth(profile(), 2026, 9);

    for (const day of days) {
      expect(day.date.startsWith('2026-09-')).toBe(true);
    }
  });

  it('never reaches into the previous month', () => {
    const { days } = buildCycleCalendarMonth(profile(), 2026, 10);

    expect(days[0].date).toBe('2026-10-01');
    expect(days).toHaveLength(31);
  });

  it('holds only real calendar dates', () => {
    const { days } = buildCycleCalendarMonth(profile(), 2024, 2);

    for (const day of days) {
      expect(() => toISODate(day.date)).not.toThrow();
    }
  });
});

describe('buildCycleCalendarMonth domain mapping', () => {
  const subject = profile();
  const { days } = buildCycleCalendarMonth(subject, 2026, 9);

  function dayOn(date: string) {
    const found = days.find((day) => day.date === date);
    if (found === undefined) {
      throw new Error(`September 2026 has no ${date}`);
    }
    return found;
  }

  // The domain functions themselves are the oracle: no formula is restated here,
  // so these stay true if a rule is ever revised.
  it.each([
    ['2026-09-01', 'cycle day 1'],
    ['2026-09-05', 'cycle day 5'],
    ['2026-09-06', 'cycle day 6'],
    ['2026-09-14', 'cycle day 14'],
    ['2026-09-15', 'cycle day 15'],
    ['2026-09-17', 'cycle day 17'],
    ['2026-09-28', 'cycle day 28'],
    ['2026-09-29', 'cycle day 29'],
    ['2026-09-30', 'cycle day 30'],
  ])('matches the domain on %s (%s)', (date) => {
    const calendarDay = dayOn(date);
    const iso = date as ISODate;

    expect(calendarDay.cycleDay).toBe(getCycleDay(subject, iso));
    expect(calendarDay.phase).toBe(getCyclePhase(subject, iso));
    expect(calendarDay.fertilityLevel).toBe(getEstimatedFertilityLevel(subject, iso));
  });

  it('matches the domain on every day of the month', () => {
    for (const day of days) {
      expect(day.cycleDay).toBe(getCycleDay(subject, day.date));
      expect(day.phase).toBe(getCyclePhase(subject, day.date));
      expect(day.fertilityLevel).toBe(getEstimatedFertilityLevel(subject, day.date));
    }
  });
});

describe('buildCycleCalendarMonth predicted period start', () => {
  it('flags the predicted day and no other', () => {
    const subject = profile();
    const predicted = predictNextPeriodStart(subject);
    const { days } = buildCycleCalendarMonth(subject, 2026, 9);

    expect(predicted).toBe('2026-09-29');

    for (const day of days) {
      expect(day.isPredictedPeriodStart).toBe(day.date === predicted);
    }

    expect(days.filter((day) => day.isPredictedPeriodStart)).toHaveLength(1);
  });

  it('flags nothing when the prediction falls in another month', () => {
    const subject = profile();
    const { days } = buildCycleCalendarMonth(subject, 2026, 10);

    expect(days.some((day) => day.isPredictedPeriodStart)).toBe(false);
  });

  it('flags nothing when there is no period on record to predict from', () => {
    const subject = profile([]);

    expect(predictNextPeriodStart(subject)).toBeNull();

    const { days } = buildCycleCalendarMonth(subject, 2026, 9);

    expect(days.some((day) => day.isPredictedPeriodStart)).toBe(false);
  });

  it('asks the domain for the prediction once per month, not once per day', () => {
    predictNextPeriodStartMock.mockClear();

    const month = buildCycleCalendarMonth(profile(), 2026, 1);

    expect(month.days).toHaveLength(31);
    expect(predictNextPeriodStartMock).toHaveBeenCalledTimes(1);
  });
});

describe('buildCycleCalendarMonth before the first record', () => {
  it('leaves days before the first recorded period unknown', () => {
    const subject = profile(['2026-09-10']);
    const { days } = buildCycleCalendarMonth(subject, 2026, 9);

    for (const day of days.slice(0, 9)) {
      expect(day.cycleDay).toBeNull();
      expect(day.phase).toBeNull();
      expect(day.fertilityLevel).toBeNull();
    }
  });

  it('starts counting on the recorded day itself', () => {
    const subject = profile(['2026-09-10']);
    const { days } = buildCycleCalendarMonth(subject, 2026, 9);

    expect(days[8].date).toBe('2026-09-09');
    expect(days[8].cycleDay).toBeNull();
    expect(days[9].date).toBe('2026-09-10');
    expect(days[9].cycleDay).toBe(1);
  });

  it('leaves a whole earlier month unknown', () => {
    const subject = profile(['2026-09-10']);
    const { days } = buildCycleCalendarMonth(subject, 2026, 8);

    expect(days).toHaveLength(31);
    expect(days.every((day) => day.cycleDay === null && day.phase === null)).toBe(true);
  });
});

/**
 * A cycle that has not arrived when it was expected.
 *
 * These two held the old behaviour and called it correct: the count keeps
 * climbing past the expected length and every day of it resolves to luteal,
 * because `cycle-phase.ts` gives the luteal window no upper bound.
 *
 * The first is still right and is kept: 1 October is day 31 of a cycle that is
 * three days late, which is a fact counted from a record and inside the
 * predicted period.
 *
 * The second asserted that 31 October was day 61 and luteal. It is four weeks
 * past the end of the predicted period, and that is where the app now stops
 * rather than carrying one September cycle forward. The honest loss is a
 * person only a few days late, who used to be told their cycle day; the honest
 * gain is that nobody is told they are on day 81 in January.
 */
describe('buildCycleCalendarMonth with a delayed cycle', () => {
  it('keeps counting past the expected cycle length instead of resetting', () => {
    const subject = profile(['2026-09-01']);
    const { days } = buildCycleCalendarMonth(subject, 2026, 10);

    // 1 October is day 31 of a 28 day cycle: late, not a new cycle - and
    // inside the predicted period, which runs 29 September to 3 October.
    expect(days[0].cycleDay).toBe(31);
    expect(days[0].cycleDay).toBe(getCycleDay(subject, days[0].date));
    expect(days[0].phase).toBe('luteal');
    expect(days[0].isBeyondHorizon).toBe(false);
  });

  it('keeps counting once the predicted period has passed, and stops inferring', () => {
    const subject = profile(['2026-09-01']);
    const { days } = buildCycleCalendarMonth(subject, 2026, 10);

    // 4 October is the first day after the predicted period ends.
    const first = days.find((day) => day.date === '2026-10-04');
    const last = days.at(-1);

    expect(first?.isBeyondHorizon).toBe(true);
    // The count survives: 4 October is day 34 of a cycle that started on
    // 1 September, which is arithmetic from a record rather than a guess.
    expect(first?.cycleDay).toBe(34);
    expect(first?.phase).toBeNull();
    expect(first?.fertilityLevel).toBeNull();

    // And it does not come back later in the month.
    expect(last?.date).toBe('2026-10-31');
    expect(last?.isBeyondHorizon).toBe(true);
    expect(last?.phase).toBeNull();
  });
});

describe('buildCycleCalendarMonth purity', () => {
  it('does not mutate the profile', () => {
    const subject = profile(['2026-09-20', '2026-09-01']);
    const snapshot = JSON.parse(JSON.stringify(subject));

    buildCycleCalendarMonth(subject, 2026, 9);

    expect(subject).toEqual(snapshot);
  });

  it('does not reorder the period records', () => {
    const subject = profile(['2026-09-20', '2026-09-01']);

    buildCycleCalendarMonth(subject, 2026, 9);

    expect(subject.periodRecords.map((record) => record.startDate)).toEqual([
      '2026-09-20',
      '2026-09-01',
    ]);
  });

  it('returns the same answer when called twice', () => {
    const subject = profile();

    expect(buildCycleCalendarMonth(subject, 2026, 9)).toEqual(
      buildCycleCalendarMonth(subject, 2026, 9)
    );
  });
});
