import type { PregnancyWeeklyContent } from '../types';
import {
  MAX_PREGNANCY_WEEK,
  MIN_PREGNANCY_WEEK,
  getPregnancyWeeklyContent,
  validatePregnancyWeeklyContent,
} from '../weekly-content';

/**
 * Stand-in text, not medical content.
 *
 * Nothing real is written for any week yet, and inventing it in a test fixture
 * would be worse than leaving it out.
 */
function content(
  week: number,
  overrides: Partial<PregnancyWeeklyContent> = {}
): PregnancyWeeklyContent {
  return {
    week,
    sizeLabel: `${week} numaralı boy`,
    sizeComparison: `${week} numaralı karşılaştırma`,
    developmentSummary: `${week}. hafta özeti`,
    developingFeatures: [`${week}. hafta özelliği`],
    ...overrides,
  };
}

describe('the week range', () => {
  it('runs from the last menstrual period to the due week', () => {
    expect(MIN_PREGNANCY_WEEK).toBe(1);
    expect(MAX_PREGNANCY_WEEK).toBe(40);
  });
});

describe('validatePregnancyWeeklyContent with usable content', () => {
  it('accepts a filled-in week', () => {
    expect(() => validatePregnancyWeeklyContent(content(12))).not.toThrow();
  });

  it('accepts the first week', () => {
    expect(() => validatePregnancyWeeklyContent(content(MIN_PREGNANCY_WEEK))).not.toThrow();
  });

  it('accepts the last week', () => {
    expect(() => validatePregnancyWeeklyContent(content(MAX_PREGNANCY_WEEK))).not.toThrow();
  });

  it('accepts several developing features', () => {
    expect(() =>
      validatePregnancyWeeklyContent(
        content(20, { developingFeatures: ['kalp', 'akciğerler', 'parmaklar'] })
      )
    ).not.toThrow();
  });
});

describe('validatePregnancyWeeklyContent with an unusable week', () => {
  it('refuses a week before the first', () => {
    expect(() => validatePregnancyWeeklyContent(content(0))).toThrow(
      /expects a week between 1 and 40, received 0/
    );
  });

  it('refuses a week past the last', () => {
    expect(() => validatePregnancyWeeklyContent(content(41))).toThrow(
      /expects a week between 1 and 40, received 41/
    );
  });

  it('refuses a negative week', () => {
    expect(() => validatePregnancyWeeklyContent(content(-3))).toThrow(/between 1 and 40/);
  });

  it('refuses a fractional week', () => {
    expect(() => validatePregnancyWeeklyContent(content(12.5))).toThrow(
      /expects a whole week number/
    );
  });

  it('refuses NaN', () => {
    expect(() => validatePregnancyWeeklyContent(content(Number.NaN))).toThrow(
      /expects a whole week number/
    );
  });

  it('refuses Infinity', () => {
    expect(() =>
      validatePregnancyWeeklyContent(content(Number.POSITIVE_INFINITY))
    ).toThrow(/expects a whole week number/);
  });
});

describe('validatePregnancyWeeklyContent with blank text', () => {
  it.each(['sizeLabel', 'sizeComparison', 'developmentSummary'] as const)(
    'refuses an empty %s',
    (field) => {
      expect(() => validatePregnancyWeeklyContent(content(12, { [field]: '' }))).toThrow(
        new RegExp(`blank ${field}`)
      );
    }
  );

  it.each(['sizeLabel', 'sizeComparison', 'developmentSummary'] as const)(
    'refuses a whitespace-only %s',
    (field) => {
      expect(() => validatePregnancyWeeklyContent(content(12, { [field]: '   ' }))).toThrow(
        new RegExp(`blank ${field}`)
      );
    }
  );

  it('names the week the blank field belongs to', () => {
    expect(() => validatePregnancyWeeklyContent(content(7, { sizeLabel: '' }))).toThrow(
      /for week 7/
    );
  });
});

describe('validatePregnancyWeeklyContent with unusable features', () => {
  it('refuses an empty list', () => {
    expect(() =>
      validatePregnancyWeeklyContent(content(12, { developingFeatures: [] }))
    ).toThrow(/lists no developing features/);
  });

  it('refuses a blank feature', () => {
    expect(() =>
      validatePregnancyWeeklyContent(content(12, { developingFeatures: ['kalp', ''] }))
    ).toThrow(/blank developingFeatures\[1\]/);
  });

  it('refuses a whitespace-only feature', () => {
    expect(() =>
      validatePregnancyWeeklyContent(content(12, { developingFeatures: ['  '] }))
    ).toThrow(/blank developingFeatures\[0\]/);
  });

  it('refuses a feature that is not text', () => {
    expect(() =>
      validatePregnancyWeeklyContent(
        content(12, { developingFeatures: ['kalp', 3 as unknown as string] })
      )
    ).toThrow(/blank developingFeatures\[1\]/);
  });

  it('refuses a list that is not a list', () => {
    expect(() =>
      validatePregnancyWeeklyContent(
        content(12, { developingFeatures: 'kalp' as unknown as string[] })
      )
    ).toThrow(/non-array developingFeatures/);
  });
});

describe('validatePregnancyWeeklyContent purity', () => {
  it('leaves the content as it found it', () => {
    const week = content(12, { developingFeatures: ['kalp', 'akciğerler'] });
    const before = JSON.stringify(week);

    validatePregnancyWeeklyContent(week);

    expect(JSON.stringify(week)).toBe(before);
  });

  it('leaves it alone even when it rejects it', () => {
    const week = content(12, { sizeLabel: '' });
    const before = JSON.stringify(week);

    expect(() => validatePregnancyWeeklyContent(week)).toThrow();

    expect(JSON.stringify(week)).toBe(before);
  });
});

describe('getPregnancyWeeklyContent', () => {
  const contents = [content(8), content(12), content(20)];

  it('finds the week asked for', () => {
    expect(getPregnancyWeeklyContent(contents, 12)).toBe(contents[1]);
  });

  it('finds the first entry in the list', () => {
    expect(getPregnancyWeeklyContent(contents, 8)).toBe(contents[0]);
  });

  it('finds the last entry in the list', () => {
    expect(getPregnancyWeeklyContent(contents, 20)).toBe(contents[2]);
  });

  it('returns null for a week nothing is written for', () => {
    expect(getPregnancyWeeklyContent(contents, 9)).toBeNull();
  });

  it('returns null rather than the nearest week', () => {
    // Week 13 is not answered with week 12's text.
    expect(getPregnancyWeeklyContent(contents, 13)).toBeNull();
  });

  it('returns null for an empty list', () => {
    expect(getPregnancyWeeklyContent([], 12)).toBeNull();
  });

  it('accepts the first and last weeks of the range', () => {
    const edges = [content(MIN_PREGNANCY_WEEK), content(MAX_PREGNANCY_WEEK)];

    expect(getPregnancyWeeklyContent(edges, MIN_PREGNANCY_WEEK)).toBe(edges[0]);
    expect(getPregnancyWeeklyContent(edges, MAX_PREGNANCY_WEEK)).toBe(edges[1]);
  });
});

describe('getPregnancyWeeklyContent with a week it refuses', () => {
  const contents = [content(12)];

  it('refuses week 0', () => {
    expect(() => getPregnancyWeeklyContent(contents, 0)).toThrow(
      /expects a week between 1 and 40, received 0/
    );
  });

  it('refuses a week past the last', () => {
    expect(() => getPregnancyWeeklyContent(contents, 41)).toThrow(/between 1 and 40/);
  });

  it('refuses a negative week', () => {
    expect(() => getPregnancyWeeklyContent(contents, -1)).toThrow(/between 1 and 40/);
  });

  it('refuses a fractional week', () => {
    expect(() => getPregnancyWeeklyContent(contents, 12.5)).toThrow(
      /expects a whole week number/
    );
  });

  it('refuses NaN', () => {
    expect(() => getPregnancyWeeklyContent(contents, Number.NaN)).toThrow(
      /expects a whole week number/
    );
  });
});

describe('getPregnancyWeeklyContent with a duplicated week', () => {
  it('refuses rather than choosing one', () => {
    const contents = [content(12), content(20), content(12)];

    expect(() => getPregnancyWeeklyContent(contents, 12)).toThrow(
      /found 2 entries for week 12/
    );
  });

  it('counts every duplicate', () => {
    const contents = [content(12), content(12), content(12)];

    expect(() => getPregnancyWeeklyContent(contents, 12)).toThrow(/found 3 entries/);
  });

  it('still answers for a week that is not duplicated', () => {
    const contents = [content(12), content(20), content(12)];

    expect(getPregnancyWeeklyContent(contents, 20)).toBe(contents[1]);
  });
});

describe('getPregnancyWeeklyContent purity', () => {
  it('leaves the list as it found it', () => {
    const contents = [content(20), content(8), content(12)];
    const before = JSON.stringify(contents);

    getPregnancyWeeklyContent(contents, 12);

    expect(JSON.stringify(contents)).toBe(before);
  });

  it('does not reorder the list to search it', () => {
    const contents = [content(20), content(8), content(12)];

    getPregnancyWeeklyContent(contents, 8);

    expect(contents.map((entry) => entry.week)).toEqual([20, 8, 12]);
  });

  it('leaves the list alone even when it rejects the week', () => {
    const contents = [content(12), content(12)];
    const before = JSON.stringify(contents);

    expect(() => getPregnancyWeeklyContent(contents, 12)).toThrow();

    expect(JSON.stringify(contents)).toBe(before);
  });

  it('hands back the entry the list holds, not a copy', () => {
    const contents = [content(12)];

    expect(getPregnancyWeeklyContent(contents, 12)).toBe(contents[0]);
  });
});
