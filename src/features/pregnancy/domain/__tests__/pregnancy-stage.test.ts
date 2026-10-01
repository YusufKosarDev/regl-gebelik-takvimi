import { stageFromWeek } from '../pregnancy-stage';
import { MAX_PREGNANCY_WEEK, MIN_PREGNANCY_WEEK } from '../weekly-content';

/**
 * How far a tracked pregnancy has got.
 *
 * Three answers and one boundary, which is the whole module. The tests that
 * matter are the ones pinning where the boundary is and that nothing beyond it
 * is called finished.
 */

describe('nothing tracked', () => {
  it('is not started', () => {
    expect(stageFromWeek(null)).toBe('not-started');
  });
});

describe('inside the weeks there is content for', () => {
  it('is following in the first week', () => {
    expect(stageFromWeek({ week: MIN_PREGNANCY_WEEK, day: 1 })).toBe('following');
  });

  it('is still following in the last week', () => {
    // 40 is a week the app has something to say about, so it is not past it.
    expect(stageFromWeek({ week: MAX_PREGNANCY_WEEK, day: 7 })).toBe('following');
  });
});

describe('past the last week there is content for', () => {
  it('is past due the week after', () => {
    expect(stageFromWeek({ week: MAX_PREGNANCY_WEEK + 1, day: 1 })).toBe('past-due');
  });

  it('stays past due however long it goes on', () => {
    // The week count is uncapped, so somebody who left a pregnancy tracked for
    // a year reaches week 90. There is no further stage to reach: the app knows
    // exactly as little at week 90 as it did at week 41.
    expect(stageFromWeek({ week: 90, day: 3 })).toBe('past-due');
  });

  it('never says finished or completed', () => {
    // Stated as a test because it is a decision about words rather than
    // arithmetic, and the next person reading the three values would otherwise
    // have no reason not to rename one.
    const stages = [
      stageFromWeek(null),
      stageFromWeek({ week: 20, day: 1 }),
      stageFromWeek({ week: 44, day: 1 }),
    ];

    for (const stage of stages) {
      expect(stage).not.toBe('finished');
      expect(stage).not.toBe('completed');
    }
  });
});
