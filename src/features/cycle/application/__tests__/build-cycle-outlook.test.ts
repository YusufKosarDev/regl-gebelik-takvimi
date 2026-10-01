import type { CycleProfile, PeriodRecord } from '../../domain/types';
import { buildCycleOutlook } from '../build-cycle-outlook';

import type { ISODate } from '@/types/iso-date';
import { addDays, toISODate } from '@/utils/date';

/**
 * The one place the recorded cycles are read into a shape a screen can use.
 *
 * The parts are tested in the domain beside themselves. What is tested here is
 * the assembly: that the range only appears when a range is the honest thing to
 * show, and that the pieces agree with each other.
 */

function profileOf(
  settingDays: number,
  gaps: readonly number[]
): { profile: CycleProfile; lastStart: ISODate } {
  const records: PeriodRecord[] = [];
  let start = toISODate('2026-01-01');

  records.push({ id: `period-${start}`, startDate: start, isOngoing: false });

  for (const gap of gaps) {
    start = addDays(start, gap);
    records.push({ id: `period-${start}`, startDate: start, isOngoing: false });
  }

  return {
    profile: {
      settings: { averageCycleLengthDays: settingDays, averagePeriodLengthDays: 5 },
      periodRecords: records,
    },
    lastStart: start,
  };
}

function outlookOf(settingDays: number, gaps: readonly number[], daysSince = 5) {
  const { profile, lastStart } = profileOf(settingDays, gaps);

  return buildCycleOutlook(profile, addDays(lastStart, daysSince));
}

describe('the range appears only when a range is the honest answer', () => {
  it('has no range when the cycles agree', () => {
    const outlook = outlookOf(28, [28, 29, 30]);

    expect(outlook.predictionConfidence).toBe('single');
    expect(outlook.nextPeriodRange).toBeNull();
  });

  it('has a range when the cycles vary', () => {
    const outlook = outlookOf(28, [24, 30, 36]);

    expect(outlook.predictionConfidence).toBe('ranged');
    expect(outlook.nextPeriodRange).not.toBeNull();
  });

  it('has no range when the records are too old, even though they vary', () => {
    // Stale outranks ranged. A range built on a record from nine months ago is
    // not more honest than a date from nine months ago; it is the same claim
    // made wider.
    const outlook = outlookOf(28, [24, 30, 36], 280);

    expect(outlook.predictionConfidence).toBe('stale');
    expect(outlook.nextPeriodRange).toBeNull();
  });

  it('has no range with nothing recorded', () => {
    const empty: CycleProfile = {
      settings: { averageCycleLengthDays: 28, averagePeriodLengthDays: 5 },
      periodRecords: [],
    };

    const outlook = buildCycleOutlook(empty, toISODate('2026-05-01'));

    expect(outlook.predictionConfidence).toBe('none');
    expect(outlook.nextPeriodRange).toBeNull();
    expect(outlook.cycleLengthSuggestion).toBeNull();
  });
});

describe('the suggestion', () => {
  it('appears when the records disagree with the setting', () => {
    const outlook = outlookOf(28, [31, 31, 31]);

    expect(outlook.cycleLengthSuggestion).toEqual({
      observedMedianDays: 31,
      settingDays: 28,
      differenceDays: 3,
      observationCount: 3,
    });
  });

  it('is offered even when the records are too old to predict from', () => {
    // Deliberate. Staleness is about whether the next date can be guessed; the
    // observed length is still the best thing known about this person's cycles,
    // and the moment they record a period again it becomes the right setting.
    const outlook = outlookOf(28, [31, 31, 31], 280);

    expect(outlook.predictionConfidence).toBe('stale');
    expect(outlook.cycleLengthSuggestion).not.toBeNull();
  });
});

describe('the pieces agree with each other', () => {
  it('reports one set of observations that everything else is read from', () => {
    const outlook = outlookOf(28, [24, 30, 36]);

    expect(outlook.observations.lengths).toEqual([24, 30, 36]);
    expect(outlook.regularity).toBe('irregular');
    expect(outlook.cycleLengthSuggestion?.observationCount).toBe(
      outlook.observations.lengths.length
    );
  });

  it('keeps the stored setting inside the range it shows', () => {
    // The property that makes it safe to show the range beside a calendar that
    // marks the single predicted day.
    const outlook = outlookOf(20, [30, 33, 38]);
    const range = outlook.nextPeriodRange;

    expect(range).not.toBeNull();
    expect(range!.earliest <= range!.expected).toBe(true);
    expect(range!.expected <= range!.latest).toBe(true);
  });
});
