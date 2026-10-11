import { arcDayAt, arcPoints } from '../arc-day-at';

/**
 * The only part of the draggable arc that can be got wrong in an interesting
 * way.
 *
 * `GestureDetector` cannot render under Jest and a drag cannot be performed in
 * jsdom, so the component around this is checked on an emulator. What is
 * checked here is the arithmetic: that a finger at a given place picks the day
 * a person would expect it to.
 */

const WIDTH = 400;
const DAYS = 28;

/** The x at the given fraction across the usable track, which is inset. */
function alongTrack(fraction: number, usableFraction = 0.86): number {
  const usable = WIDTH * usableFraction;

  return (WIDTH - usable) / 2 + usable * fraction;
}

describe('a finger on the arc', () => {
  it('picks the first day at the left end of the track', () => {
    expect(arcDayAt({ x: alongTrack(0), width: WIDTH, dayCount: DAYS })).toBe(0);
  });

  it('picks the last day at the right end', () => {
    expect(arcDayAt({ x: alongTrack(1), width: WIDTH, dayCount: DAYS })).toBe(DAYS - 1);
  });

  it('picks the middle day in the middle', () => {
    // 27 gaps, so halfway is 13.5 and rounds to 14.
    expect(arcDayAt({ x: alongTrack(0.5), width: WIDTH, dayCount: DAYS })).toBe(14);
  });

  it('moves one day at a time across the track', () => {
    const seen = new Set<number>();

    for (let step = 0; step <= 100; step += 1) {
      const day = arcDayAt({ x: alongTrack(step / 100), width: WIDTH, dayCount: DAYS });

      if (day !== null) {
        seen.add(day);
      }
    }

    // Every day is reachable, and none beyond the last.
    expect(seen.size).toBe(DAYS);
    expect(Math.min(...seen)).toBe(0);
    expect(Math.max(...seen)).toBe(DAYS - 1);
  });
});

describe('a finger past the ends', () => {
  /**
   * Dragging off the arc holds rather than wrapping.
   *
   * The ends of the track are day one and the last day, which are the two
   * somebody is most likely to be reaching for - and a thumb overshooting the
   * end of a scrubber is the normal way to reach them, not a mistake.
   */
  it('holds at the first day when dragged left of the track', () => {
    expect(arcDayAt({ x: -500, width: WIDTH, dayCount: DAYS })).toBe(0);
    expect(arcDayAt({ x: 0, width: WIDTH, dayCount: DAYS })).toBe(0);
  });

  it('holds at the last day when dragged right of it', () => {
    expect(arcDayAt({ x: WIDTH * 10, width: WIDTH, dayCount: DAYS })).toBe(DAYS - 1);
    expect(arcDayAt({ x: WIDTH, width: WIDTH, dayCount: DAYS })).toBe(DAYS - 1);
  });
});

describe('an arc with nothing to show', () => {
  it('answers null when there are no days', () => {
    // The caller keeps whatever day it was showing. A cycle with no records
    // draws no arc at all, but the function is not entitled to assume that.
    expect(arcDayAt({ x: 200, width: WIDTH, dayCount: 0 })).toBeNull();
  });

  it('answers the only day when there is one', () => {
    expect(arcDayAt({ x: 0, width: WIDTH, dayCount: 1 })).toBe(0);
    expect(arcDayAt({ x: WIDTH, width: WIDTH, dayCount: 1 })).toBe(0);
  });

  it('survives a zero width without dividing by it', () => {
    expect(arcDayAt({ x: 0, width: 0, dayCount: DAYS })).toBe(0);
  });
});

describe('cycles of different lengths', () => {
  it.each([21, 28, 35, 60])('spans a %i-day cycle end to end', (dayCount) => {
    expect(arcDayAt({ x: alongTrack(0), width: WIDTH, dayCount })).toBe(0);
    expect(arcDayAt({ x: alongTrack(1), width: WIDTH, dayCount })).toBe(dayCount - 1);
  });
});

describe('where the dots are drawn', () => {
  const SAG = 34;

  it('keeps every dot inside the box, horizontally and vertically', () => {
    // The first version put the end dots 310 points either side of a 393-point
    // screen and 166 points down a 72-point box, and `overflow: 'hidden'` threw
    // the rest away. Nothing can fall outside a parabola sized by the box.
    const points = arcPoints({ width: WIDTH, dayCount: DAYS, sag: SAG });

    for (const point of points) {
      expect([point.left, point.left >= 0 && point.left <= WIDTH]).toEqual([
        point.left,
        true,
      ]);
      expect([point.top, point.top >= 0 && point.top <= SAG]).toEqual([point.top, true]);
    }
  });

  it('puts the middle of the cycle at the top of the arc and its ends at the bottom', () => {
    // Which is where the sun is at midday and at night. The field draws the
    // cycle as one day; the arc draws the same day as a path across the sky.
    const points = arcPoints({ width: WIDTH, dayCount: DAYS, sag: SAG });
    const middle = points[Math.floor((DAYS - 1) / 2)];

    expect(middle.top).toBeLessThan(points[0].top);
    expect(middle.top).toBeLessThan(points[DAYS - 1].top);
    expect(points[0].top).toBeCloseTo(points[DAYS - 1].top, 5);
    expect(points[0].top).toBeCloseTo(SAG, 5);
  });

  /**
   * The assertion this module exists for.
   *
   * Drawing and hit-testing used to be two different mappings - dots placed
   * around a circle, days read off a linear ratio - so the dot under a finger
   * was not the day that got chosen. Nothing would have caught that except
   * doing it on a phone, and on a phone it looked like the arc being slightly
   * wrong rather than two formulas disagreeing.
   */
  it('chooses the day whose dot is under the finger', () => {
    const points = arcPoints({ width: WIDTH, dayCount: DAYS, sag: SAG });

    points.forEach((point, index) => {
      expect([index, arcDayAt({ x: point.left, width: WIDTH, dayCount: DAYS })]).toEqual([
        index,
        index,
      ]);
    });
  });

  it('draws one day in the middle rather than at an end', () => {
    const [only] = arcPoints({ width: WIDTH, dayCount: 1, sag: SAG });

    expect(only.left).toBeCloseTo(WIDTH / 2, 5);
    expect(only.top).toBeCloseTo(0, 5);
  });

  it('draws nothing for an empty cycle', () => {
    expect(arcPoints({ width: WIDTH, dayCount: 0, sag: SAG })).toEqual([]);
  });
});
