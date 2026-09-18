import type {
  PregnancyContentSize,
  PregnancyContentSource,
  PregnancyWeeklyContent,
} from '../types';
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
    size: {
      label: `${week} numaralı boy`,
      comparison: `${week} numaralı karşılaştırma`,
    },
    developmentSummary: `${week}. hafta özeti`,
    developingFeatures: [`${week}. hafta özelliği`],
    sources: [{ name: `${week}. hafta kaynağı`, url: `https://example.test/hafta-${week}` }],
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
  it('refuses an empty developmentSummary', () => {
    expect(() =>
      validatePregnancyWeeklyContent(content(12, { developmentSummary: '' }))
    ).toThrow(/blank developmentSummary/);
  });

  it('refuses a whitespace-only developmentSummary', () => {
    expect(() =>
      validatePregnancyWeeklyContent(content(12, { developmentSummary: '   ' }))
    ).toThrow(/blank developmentSummary/);
  });

  it('names the week the blank field belongs to', () => {
    expect(() =>
      validatePregnancyWeeklyContent(content(7, { developmentSummary: '' }))
    ).toThrow(/for week 7/);
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
    const week = content(12, { developmentSummary: '' });
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

describe('validatePregnancyWeeklyContent with usable sources', () => {
  it('accepts one source', () => {
    expect(() =>
      validatePregnancyWeeklyContent(
        content(12, { sources: [{ name: 'NHS', url: 'https://www.nhs.uk/pregnancy/' }] })
      )
    ).not.toThrow();
  });

  it('accepts several sources', () => {
    expect(() =>
      validatePregnancyWeeklyContent(
        content(12, {
          sources: [
            { name: 'NHS', url: 'https://www.nhs.uk/pregnancy/' },
            { name: 'ACOG', url: 'https://www.acog.org/womens-health' },
            { name: 'WHO', url: 'http://www.who.int/health-topics/maternal-health' },
          ],
        })
      )
    ).not.toThrow();
  });

  it('accepts plain http as well as https', () => {
    expect(() =>
      validatePregnancyWeeklyContent(
        content(12, { sources: [{ name: 'Kaynak', url: 'http://example.test/a' }] })
      )
    ).not.toThrow();
  });

  it('accepts two sources that differ only by path', () => {
    expect(() =>
      validatePregnancyWeeklyContent(
        content(12, {
          sources: [
            { name: 'Kaynak', url: 'https://example.test/a' },
            { name: 'Kaynak', url: 'https://example.test/b' },
          ],
        })
      )
    ).not.toThrow();
  });

  it('accepts the same name twice when the pages differ', () => {
    // One publisher can be the source of two different pages.
    expect(() =>
      validatePregnancyWeeklyContent(
        content(12, {
          sources: [
            { name: 'NHS', url: 'https://www.nhs.uk/pregnancy/week-12' },
            { name: 'NHS', url: 'https://www.nhs.uk/pregnancy/scans' },
          ],
        })
      )
    ).not.toThrow();
  });
});

describe('validatePregnancyWeeklyContent with missing sources', () => {
  it('refuses an empty list', () => {
    expect(() => validatePregnancyWeeklyContent(content(12, { sources: [] }))).toThrow(
      /cites no sources/
    );
  });

  it('names the week that cites nothing', () => {
    expect(() => validatePregnancyWeeklyContent(content(7, { sources: [] }))).toThrow(
      /for week 7 cites no sources/
    );
  });

  it('refuses a list that is not a list', () => {
    expect(() =>
      validatePregnancyWeeklyContent(
        content(12, {
          sources: 'https://example.test/a' as unknown as PregnancyContentSource[],
        })
      )
    ).toThrow(/non-array sources/);
  });
});

describe('validatePregnancyWeeklyContent with a blank source field', () => {
  it('refuses an empty name', () => {
    expect(() =>
      validatePregnancyWeeklyContent(
        content(12, { sources: [{ name: '', url: 'https://example.test/a' }] })
      )
    ).toThrow(/blank sources\[0\]\.name/);
  });

  it('refuses a whitespace-only name', () => {
    expect(() =>
      validatePregnancyWeeklyContent(
        content(12, { sources: [{ name: '   ', url: 'https://example.test/a' }] })
      )
    ).toThrow(/blank sources\[0\]\.name/);
  });

  it('refuses an empty url', () => {
    expect(() =>
      validatePregnancyWeeklyContent(content(12, { sources: [{ name: 'NHS', url: '' }] }))
    ).toThrow(/blank sources\[0\]\.url/);
  });

  it('refuses a whitespace-only url', () => {
    expect(() =>
      validatePregnancyWeeklyContent(content(12, { sources: [{ name: 'NHS', url: '  ' }] }))
    ).toThrow(/blank sources\[0\]\.url/);
  });

  it('points at the source that is wrong', () => {
    expect(() =>
      validatePregnancyWeeklyContent(
        content(12, {
          sources: [
            { name: 'NHS', url: 'https://example.test/a' },
            { name: '', url: 'https://example.test/b' },
          ],
        })
      )
    ).toThrow(/blank sources\[1\]\.name/);
  });

  it('refuses a name that is not text', () => {
    expect(() =>
      validatePregnancyWeeklyContent(
        content(12, {
          sources: [{ name: 3 as unknown as string, url: 'https://example.test/a' }],
        })
      )
    ).toThrow(/blank sources\[0\]\.name/);
  });
});

describe('validatePregnancyWeeklyContent with a url it cannot follow', () => {
  it.each([
    ['no scheme', 'www.nhs.uk/pregnancy/'],
    ['a bare domain', 'example.test'],
    ['ftp', 'ftp://example.test/a'],
    ['a file path', 'file:///etc/hosts'],
    ['a javascript url', 'javascript:alert(1)'],
    ['a scheme with nothing after it', 'https://'],
    ['a scheme missing its slashes', 'https:example.test'],
    ['a relative path', '/pregnancy/week-12'],
  ])('refuses %s', (_label, url) => {
    expect(() =>
      validatePregnancyWeeklyContent(content(12, { sources: [{ name: 'Kaynak', url }] }))
    ).toThrow(/not an http or https address/);
  });

  it('names the offending url', () => {
    expect(() =>
      validatePregnancyWeeklyContent(
        content(12, { sources: [{ name: 'Kaynak', url: 'ftp://example.test/a' }] })
      )
    ).toThrow(/"ftp:\/\/example\.test\/a"/);
  });

  it('points at the source that is wrong', () => {
    expect(() =>
      validatePregnancyWeeklyContent(
        content(12, {
          sources: [
            { name: 'Kaynak', url: 'https://example.test/a' },
            { name: 'Kaynak', url: 'example.test' },
          ],
        })
      )
    ).toThrow(/sources\[1\]\.url/);
  });
});

describe('validatePregnancyWeeklyContent with a repeated source', () => {
  it('refuses the same url twice', () => {
    expect(() =>
      validatePregnancyWeeklyContent(
        content(12, {
          sources: [
            { name: 'NHS', url: 'https://example.test/a' },
            { name: 'NHS', url: 'https://example.test/a' },
          ],
        })
      )
    ).toThrow(/cites "https:\/\/example\.test\/a" more than once/);
  });

  it('refuses it under a different name too', () => {
    // One page credited twice is still one source, whatever it is called.
    expect(() =>
      validatePregnancyWeeklyContent(
        content(12, {
          sources: [
            { name: 'NHS', url: 'https://example.test/a' },
            { name: 'Başka kurum', url: 'https://example.test/a' },
          ],
        })
      )
    ).toThrow(/more than once/);
  });

  it('refuses a repeat that differs only by surrounding whitespace', () => {
    expect(() =>
      validatePregnancyWeeklyContent(
        content(12, {
          sources: [
            { name: 'NHS', url: 'https://example.test/a' },
            { name: 'NHS', url: '  https://example.test/a  ' },
          ],
        })
      )
    ).toThrow(/more than once/);
  });

  it('refuses a repeat that is not adjacent', () => {
    expect(() =>
      validatePregnancyWeeklyContent(
        content(12, {
          sources: [
            { name: 'A', url: 'https://example.test/a' },
            { name: 'B', url: 'https://example.test/b' },
            { name: 'C', url: 'https://example.test/a' },
          ],
        })
      )
    ).toThrow(/more than once/);
  });
});

describe('source validation purity', () => {
  it('leaves the sources as it found them', () => {
    const week = content(12, {
      sources: [
        { name: 'NHS', url: 'https://example.test/a' },
        { name: 'ACOG', url: 'https://example.test/b' },
      ],
    });
    const before = JSON.stringify(week);

    validatePregnancyWeeklyContent(week);

    expect(JSON.stringify(week)).toBe(before);
  });

  it('does not reorder them to find duplicates', () => {
    const week = content(12, {
      sources: [
        { name: 'C', url: 'https://example.test/c' },
        { name: 'A', url: 'https://example.test/a' },
        { name: 'B', url: 'https://example.test/b' },
      ],
    });

    validatePregnancyWeeklyContent(week);

    expect(week.sources.map((source) => source.name)).toEqual(['C', 'A', 'B']);
  });

  it('leaves them alone even when it rejects them', () => {
    const week = content(12, {
      sources: [
        { name: 'NHS', url: 'https://example.test/a' },
        { name: 'NHS', url: 'https://example.test/a' },
      ],
    });
    const before = JSON.stringify(week);

    expect(() => validatePregnancyWeeklyContent(week)).toThrow();

    expect(JSON.stringify(week)).toBe(before);
  });

  it('does not trim the stored url as a side effect', () => {
    const week = content(12, {
      sources: [{ name: 'NHS', url: '  https://example.test/a  ' }],
    });

    validatePregnancyWeeklyContent(week);

    expect(week.sources[0].url).toBe('  https://example.test/a  ');
  });
});

describe('the lookup is unchanged by provenance', () => {
  it('still finds a week without looking at its sources', () => {
    const contents = [content(8), content(12)];

    expect(getPregnancyWeeklyContent(contents, 12)).toBe(contents[1]);
  });

  it('still returns null for an unwritten week', () => {
    expect(getPregnancyWeeklyContent([content(8)], 9)).toBeNull();
  });

  it('does not validate the entries it searches', () => {
    // The lookup answers about weeks; whether an entry is well-formed is
    // validation's question, asked separately.
    const contents = [content(12, { sources: [] })];

    expect(getPregnancyWeeklyContent(contents, 12)).toBe(contents[0]);
  });
});

describe('validatePregnancyWeeklyContent with no size', () => {
  /** A week written without a size, as the earliest weeks will be. */
  function sizeless(week: number): PregnancyWeeklyContent {
    const { size, ...rest } = content(week);

    void size;

    return rest;
  }

  it('accepts a week that has none', () => {
    expect(() => validatePregnancyWeeklyContent(sizeless(1))).not.toThrow();
  });

  it('accepts it in any week of the range', () => {
    for (const week of [MIN_PREGNANCY_WEEK, 2, 3, 20, MAX_PREGNANCY_WEEK]) {
      expect(() => validatePregnancyWeeklyContent(sizeless(week))).not.toThrow();
    }
  });

  it('accepts an explicitly undefined size', () => {
    expect(() =>
      validatePregnancyWeeklyContent(content(1, { size: undefined }))
    ).not.toThrow();
  });

  it('still requires everything else', () => {
    expect(() =>
      validatePregnancyWeeklyContent({ ...sizeless(1), developmentSummary: '' })
    ).toThrow(/blank developmentSummary/);

    expect(() =>
      validatePregnancyWeeklyContent({ ...sizeless(1), developingFeatures: [] })
    ).toThrow(/lists no developing features/);

    expect(() => validatePregnancyWeeklyContent({ ...sizeless(1), sources: [] })).toThrow(
      /cites no sources/
    );
  });
});

describe('validatePregnancyWeeklyContent with a size', () => {
  it('accepts a filled-in one', () => {
    expect(() =>
      validatePregnancyWeeklyContent(
        content(12, { size: { label: '5,4 cm', comparison: 'bir erik' } })
      )
    ).not.toThrow();
  });

  it('refuses an empty label', () => {
    expect(() =>
      validatePregnancyWeeklyContent(
        content(12, { size: { label: '', comparison: 'bir erik' } })
      )
    ).toThrow(/blank size\.label/);
  });

  it('refuses a whitespace-only label', () => {
    expect(() =>
      validatePregnancyWeeklyContent(
        content(12, { size: { label: '   ', comparison: 'bir erik' } })
      )
    ).toThrow(/blank size\.label/);
  });

  it('refuses an empty comparison', () => {
    expect(() =>
      validatePregnancyWeeklyContent(content(12, { size: { label: '5,4 cm', comparison: '' } }))
    ).toThrow(/blank size\.comparison/);
  });

  it('refuses a whitespace-only comparison', () => {
    expect(() =>
      validatePregnancyWeeklyContent(
        content(12, { size: { label: '5,4 cm', comparison: '  ' } })
      )
    ).toThrow(/blank size\.comparison/);
  });

  it('refuses both being blank, naming the label first', () => {
    expect(() =>
      validatePregnancyWeeklyContent(content(12, { size: { label: '', comparison: '' } }))
    ).toThrow(/blank size\.label/);
  });

  it('refuses a label that is not text', () => {
    expect(() =>
      validatePregnancyWeeklyContent(
        content(12, {
          size: { label: 5 as unknown as string, comparison: 'bir erik' },
        })
      )
    ).toThrow(/blank size\.label/);
  });

  it('refuses a size that is not an object', () => {
    expect(() =>
      validatePregnancyWeeklyContent(
        content(12, { size: '5,4 cm' as unknown as PregnancyContentSize })
      )
    ).toThrow(/size that is not an object/);
  });

  it('refuses a null size', () => {
    expect(() =>
      validatePregnancyWeeklyContent(
        content(12, { size: null as unknown as PregnancyContentSize })
      )
    ).toThrow(/size that is not an object/);
  });

  it('names the week the blank size belongs to', () => {
    expect(() =>
      validatePregnancyWeeklyContent(content(7, { size: { label: '', comparison: 'bir erik' } }))
    ).toThrow(/for week 7/);
  });
});

describe('size validation purity', () => {
  it('leaves a week with a size as it found it', () => {
    const week = content(12, { size: { label: '5,4 cm', comparison: 'bir erik' } });
    const before = JSON.stringify(week);

    validatePregnancyWeeklyContent(week);

    expect(JSON.stringify(week)).toBe(before);
  });

  it('leaves a week without one alone', () => {
    const { size, ...week } = content(1);
    void size;
    const before = JSON.stringify(week);

    validatePregnancyWeeklyContent(week);

    expect(JSON.stringify(week)).toBe(before);
    expect('size' in week).toBe(false);
  });

  it('does not add a size to a week that has none', () => {
    const { size, ...week } = content(1);
    void size;

    validatePregnancyWeeklyContent(week);

    expect((week as PregnancyWeeklyContent).size).toBeUndefined();
  });

  it('leaves the week alone even when it rejects the size', () => {
    const week = content(12, { size: { label: '', comparison: 'bir erik' } });
    const before = JSON.stringify(week);

    expect(() => validatePregnancyWeeklyContent(week)).toThrow();

    expect(JSON.stringify(week)).toBe(before);
  });
});

describe('the lookup is unchanged by the optional size', () => {
  it('finds a week that has no size', () => {
    const { size, ...sizeless } = content(1);
    void size;
    const contents = [sizeless, content(12)];

    expect(getPregnancyWeeklyContent(contents, 1)).toBe(contents[0]);
    expect(getPregnancyWeeklyContent(contents, 1)?.size).toBeUndefined();
  });

  it('finds a week that has one', () => {
    const contents = [content(8), content(12)];

    expect(getPregnancyWeeklyContent(contents, 12)).toBe(contents[1]);
    expect(getPregnancyWeeklyContent(contents, 12)?.size).toEqual({
      label: '12 numaralı boy',
      comparison: '12 numaralı karşılaştırma',
    });
  });

  it('still returns null for an unwritten week whatever the others hold', () => {
    const { size, ...sizeless } = content(1);
    void size;

    expect(getPregnancyWeeklyContent([sizeless], 9)).toBeNull();
  });

  it('still refuses a duplicated week', () => {
    const { size, ...sizeless } = content(12);
    void size;

    expect(() => getPregnancyWeeklyContent([sizeless, content(12)], 12)).toThrow(
      /found 2 entries for week 12/
    );
  });
});
