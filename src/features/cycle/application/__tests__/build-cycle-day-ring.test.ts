import type { CycleProfile } from '../../domain/types';
import { buildCycleDayRing } from '../build-cycle-day-ring';

import { addDays, toISODate } from '@/utils/date';

/**
 * The cycle as a ring of days.
 *
 * The phase arithmetic itself is tested in the domain beside `getCyclePhase`.
 * What is tested here is what the ring adds: how many dots there are, which of
 * them are lit, and that the day under today's dot is the day the rest of the
 * screen is talking about.
 */

const TODAY = toISODate('2026-09-17');

function profileOf(startedDaysAgo: number | null, cycleLength = 28): CycleProfile {
  return {
    settings: { averageCycleLengthDays: cycleLength, averagePeriodLengthDays: 5 },
    periodRecords:
      startedDaysAgo === null
        ? []
        : [
            {
              id: 'period-1',
              startDate: addDays(TODAY, -startedDaysAgo),
              isOngoing: false,
            },
          ],
  };
}

describe('how many dots there are', () => {
  it('draws one for each day of the configured cycle', () => {
    expect(buildCycleDayRing(profileOf(16, 28), TODAY).dots).toHaveLength(28);
    expect(buildCycleDayRing(profileOf(16, 31), TODAY).dots).toHaveLength(31);
  });

  it('numbers them from one, in order', () => {
    const { dots } = buildCycleDayRing(profileOf(16, 28), TODAY);

    expect(dots.map((dot) => dot.day)).toEqual(Array.from({ length: 28 }, (_, i) => i + 1));
  });

  it('leaves a setting outside the allowed range to the domain', () => {
    // There was a clamp here, to 14..60, meant to stop a corrupt setting from
    // laying out a thousand absolutely positioned views on the home screen. It
    // was dead: `getCycleDay` validates the profile, so an out-of-range
    // setting never reaches the arithmetic. Keeping it would also have been
    // wrong - see the long cycle below. One rule, in the domain, not two.
    expect(() => buildCycleDayRing(profileOf(16, 4000), TODAY)).toThrow(/between 15 and 90/);
    expect(() => buildCycleDayRing(profileOf(16, 1), TODAY)).toThrow(/between 15 and 90/);
  });

  it('gives a long cycle every one of its days', () => {
    // What the clamp above would have broken, and the reason it had to go: at
    // 60 dots a 75-day cycle has no dot for day 70, so the one dot the ring
    // exists to point at would simply not be drawn.
    const { dots, cycleDay } = buildCycleDayRing(profileOf(69, 75), TODAY);

    expect(dots).toHaveLength(75);
    expect(cycleDay).toBe(70);
    expect(dots.find((dot) => dot.isToday)?.day).toBe(70);
  });
});

describe('which dots are lit', () => {
  it('lights today and everything before it', () => {
    const { dots, cycleDay } = buildCycleDayRing(profileOf(16), TODAY);

    // Started 16 days ago, and the start itself is day 1.
    expect(cycleDay).toBe(17);
    expect(dots.filter((dot) => dot.isElapsed)).toHaveLength(17);
    expect(dots.slice(17).every((dot) => !dot.isElapsed)).toBe(true);
  });

  it('marks exactly one dot as today, and it is the cycle day', () => {
    const { dots, cycleDay } = buildCycleDayRing(profileOf(16), TODAY);
    const today = dots.filter((dot) => dot.isToday);

    expect(today).toHaveLength(1);
    expect(today[0].day).toBe(cycleDay);
  });

  it('lights the first day on the day the period starts', () => {
    const { dots, cycleDay } = buildCycleDayRing(profileOf(0), TODAY);

    expect(cycleDay).toBe(1);
    expect(dots[0].isToday).toBe(true);
    expect(dots.filter((dot) => dot.isElapsed)).toHaveLength(1);
  });
});

describe('the phase each dot carries', () => {
  it('starts the ring in the period and does not stay there', () => {
    // The point of colouring every dot rather than only today's: the ring is
    // the shape of the cycle, not a progress bar.
    const { dots } = buildCycleDayRing(profileOf(16), TODAY);

    expect(dots[0].phase).toBe('menstrual');
    expect(new Set(dots.map((dot) => dot.phase)).size).toBeGreaterThan(1);
  });

  it('agrees with the cycle day the rest of the screen shows', () => {
    const ring = buildCycleDayRing(profileOf(16), TODAY);
    const today = ring.dots.find((dot) => dot.isToday);

    expect(today?.day).toBe(ring.cycleDay);
    expect(today?.phase).toBe('luteal');
  });
});

describe('before anything has been recorded', () => {
  it('still draws a full ring, with nothing lit', () => {
    // A person who has recorded nothing sees the shape of what the app is for
    // rather than a hole where it will be, and the caller does not branch.
    const { dots, cycleDay } = buildCycleDayRing(profileOf(null), TODAY);

    expect(cycleDay).toBeNull();
    expect(dots).toHaveLength(28);
    expect(dots.every((dot) => !dot.isElapsed && !dot.isToday && dot.phase === null)).toBe(true);
  });
});

describe('when the period is late', () => {
  it('fills the ring and marks no day as today', () => {
    // The ring is as long as the cycle the settings describe, so day 33 of a
    // 28-day setting has no dot to sit on. Every dot lit and none marked is
    // the honest picture - the ring is full and the cycle has run past it -
    // and the number in the middle still says 33, so nothing is hidden.
    const { dots, cycleDay } = buildCycleDayRing(profileOf(32, 28), TODAY);

    expect(cycleDay).toBe(33);
    expect(dots).toHaveLength(28);
    expect(dots.every((dot) => dot.isElapsed)).toBe(true);
    expect(dots.some((dot) => dot.isToday)).toBe(false);
  });

  it('still marks today on the last day of a cycle that is exactly on time', () => {
    // The boundary beside it: day 28 of 28 is the last dot, not past the end.
    const { dots, cycleDay } = buildCycleDayRing(profileOf(27, 28), TODAY);

    expect(cycleDay).toBe(28);
    expect(dots[27].isToday).toBe(true);
    expect(dots.every((dot) => dot.isElapsed)).toBe(true);
  });
});

describe('purity', () => {
  it('reads the profile without reordering or mutating it', () => {
    const profile = profileOf(16);
    const before = JSON.stringify(profile);

    buildCycleDayRing(profile, TODAY);

    expect(JSON.stringify(profile)).toBe(before);
  });

  it('answers the same way twice for the same day', () => {
    // Nothing here may read a clock: `today` is the only source of now.
    const profile = profileOf(16);

    expect(buildCycleDayRing(profile, TODAY)).toEqual(buildCycleDayRing(profile, TODAY));
  });
});
