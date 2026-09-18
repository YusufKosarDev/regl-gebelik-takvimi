import {
  getPregnancyWeeklyContent,
  validatePregnancyWeeklyContent,
} from '../../domain/weekly-content';
import { PREGNANCY_WEEKLY_CONTENT } from '../pregnancy-weekly-content';

describe('PREGNANCY_WEEKLY_CONTENT', () => {
  it('covers weeks 1 to 20 and nothing else yet', () => {
    expect(PREGNANCY_WEEKLY_CONTENT).toHaveLength(20);
    expect(PREGNANCY_WEEKLY_CONTENT.map((entry) => entry.week)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
    ]);
  });

  it('leaves no gap in the weeks it covers', () => {
    for (let week = 1; week <= 20; week += 1) {
      expect(getPregnancyWeeklyContent(PREGNANCY_WEEKLY_CONTENT, week)).not.toBeNull();
    }
  });

  it('holds each week once', () => {
    const weeks = PREGNANCY_WEEKLY_CONTENT.map((entry) => entry.week);

    expect(new Set(weeks).size).toBe(weeks.length);
  });

  it('passes the domain rules', () => {
    for (const entry of PREGNANCY_WEEKLY_CONTENT) {
      expect(() => validatePregnancyWeeklyContent(entry)).not.toThrow();
    }
  });
});

describe('PREGNANCY_WEEKLY_CONTENT sizes', () => {
  /** There is nothing to measure before the embryo exists. */
  const WEEKS_WITHOUT_A_SIZE = [1, 2, 3];

  /** Exactly what the NHS week-by-week guide states for each week. */
  const EXPECTED_SIZES: Record<number, { label: string; comparison: string }> = {
    4: { label: 'yaklaşık 2 mm', comparison: 'haşhaş tohumu' },
    5: { label: 'yaklaşık 2 mm', comparison: 'susam tohumu' },
    6: { label: 'yaklaşık 6 mm', comparison: 'bezelye tanesi' },
    7: { label: 'yaklaşık 10 mm', comparison: 'üzüm tanesi' },
    8: { label: 'yaklaşık 16 mm', comparison: 'ahududu' },
    9: { label: 'yaklaşık 22 mm', comparison: 'çilek' },
    10: { label: 'yaklaşık 30 mm', comparison: 'küçük kayısı' },
    11: { label: 'yaklaşık 41 mm', comparison: 'incir' },
    12: { label: 'yaklaşık 5,4 cm', comparison: 'erik' },
    13: { label: 'yaklaşık 7,4 cm', comparison: 'şeftali' },
    14: { label: 'yaklaşık 8,5 cm', comparison: 'kivi' },
    15: { label: 'yaklaşık 10,1 cm', comparison: 'elma' },
    16: { label: 'yaklaşık 11,6 cm', comparison: 'avokado' },
    17: { label: 'yaklaşık 12 cm', comparison: 'nar' },
    18: { label: 'yaklaşık 14,2 cm', comparison: 'dolmalık biber' },
    19: { label: 'yaklaşık 15,3 cm', comparison: 'beefsteak domates' },
    20: { label: 'yaklaşık 25,6 cm', comparison: 'muz' },
  };

  it.each(WEEKS_WITHOUT_A_SIZE)('states no size for week %i', (week) => {
    const entry = getPregnancyWeeklyContent(PREGNANCY_WEEKLY_CONTENT, week);

    expect(entry?.size).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(entry, 'size')).toBe(false);
  });

  it.each(Object.keys(EXPECTED_SIZES).map(Number))('states the size for week %i', (week) => {
    const entry = getPregnancyWeeklyContent(PREGNANCY_WEEKLY_CONTENT, week);

    expect(entry?.size).toEqual(EXPECTED_SIZES[week]);
  });

  it('gives every week from 4 on a size', () => {
    for (const entry of PREGNANCY_WEEKLY_CONTENT.filter((week) => week.week >= 4)) {
      expect(entry.size).toBeDefined();
    }
  });
});

describe('PREGNANCY_WEEKLY_CONTENT provenance', () => {
  it('cites a source for every week', () => {
    for (const entry of PREGNANCY_WEEKLY_CONTENT) {
      expect(entry.sources.length).toBeGreaterThan(0);
    }
  });

  it('cites Cleveland Clinic for every week', () => {
    for (const entry of PREGNANCY_WEEKLY_CONTENT) {
      const cleveland = entry.sources.filter((source) =>
        /Cleveland Clinic/.test(source.name)
      );

      expect(cleveland).toHaveLength(1);
      expect(cleveland[0].url).toBe(
        'https://my.clevelandclinic.org/health/articles/7247-fetal-development-stages-of-growth'
      );
    }
  });

  it('cites the NHS page for the week itself from week 4 on', () => {
    for (const entry of PREGNANCY_WEEKLY_CONTENT.filter((week) => week.week >= 4)) {
      const nhs = entry.sources.filter((source) => /^NHS/.test(source.name));

      expect(nhs).toHaveLength(1);
      const range = entry.week <= 12 ? '1-to-12' : '13-to-27';

      expect(nhs[0].url).toBe(
        `https://www.nhs.uk/pregnancy/week-by-week/${range}/${entry.week}-weeks/`
      );
      expect(nhs[0].name).toContain(`at ${entry.week} weeks pregnant`);
    }
  });

  it('links the trimester range the NHS guide actually uses', () => {
    // The guide splits at week 12, so weeks 13 and up live under a different path.
    const nhsUrlFor = (week: number) =>
      getPregnancyWeeklyContent(PREGNANCY_WEEKLY_CONTENT, week)?.sources.find((source) =>
        /^NHS/.test(source.name)
      )?.url;

    expect(nhsUrlFor(12)).toContain('/1-to-12/');
    expect(nhsUrlFor(13)).toContain('/13-to-27/');
    expect(nhsUrlFor(20)).toContain('/13-to-27/');
  });

  it('cites both sources on every week from 4 on', () => {
    for (const entry of PREGNANCY_WEEKLY_CONTENT.filter((week) => week.week >= 4)) {
      expect(entry.sources).toHaveLength(2);
    }
  });

  it('gives every source a followable address', () => {
    for (const entry of PREGNANCY_WEEKLY_CONTENT) {
      for (const source of entry.sources) {
        expect(source.url).toMatch(/^https:\/\/.+/);
      }
    }
  });
});

describe('PREGNANCY_WEEKLY_CONTENT text', () => {
  it('says how gestational age is counted in week 1', () => {
    const week = getPregnancyWeeklyContent(PREGNANCY_WEEKLY_CONTENT, 1);

    expect(week?.developmentSummary).toMatch(/son regl döneminin ilk gününden/i);
  });

  it('places ovulation in week 2', () => {
    const week = getPregnancyWeeklyContent(PREGNANCY_WEEKLY_CONTENT, 2);

    expect(week?.developmentSummary).toMatch(/ovulasyon/i);
  });

  it('places fertilization and the zygote in week 3', () => {
    const week = getPregnancyWeeklyContent(PREGNANCY_WEEKLY_CONTENT, 3);

    expect(week?.developmentSummary).toMatch(/döllenme/i);
    expect(week?.developmentSummary).toMatch(/zigot/i);
  });

  it('names the heart in week 5, where the NHS puts its first beat', () => {
    const week = getPregnancyWeeklyContent(PREGNANCY_WEEKLY_CONTENT, 5);

    expect(week?.developingFeatures.join(' ')).toMatch(/kalp/i);
  });

  it('names the limb buds in week 6', () => {
    const week = getPregnancyWeeklyContent(PREGNANCY_WEEKLY_CONTENT, 6);

    expect(week?.developingFeatures.join(' ')).toMatch(/tomurcu/i);
  });

  it('says the embryo becomes a foetus in week 8', () => {
    const week = getPregnancyWeeklyContent(PREGNANCY_WEEKLY_CONTENT, 8);

    expect(week?.developmentSummary).toMatch(/fetüs/i);
  });

  it('names lanugo in week 15, where the NHS puts it', () => {
    const week = getPregnancyWeeklyContent(PREGNANCY_WEEKLY_CONTENT, 15);

    expect(week?.developingFeatures.join(' ')).toMatch(/lanugo/i);
  });

  it('names vernix in week 20', () => {
    const week = getPregnancyWeeklyContent(PREGNANCY_WEEKLY_CONTENT, 20);

    expect(week?.developingFeatures.join(' ')).toMatch(/vernix/i);
  });

  it('says the heartbeat can be heard on a scan in week 12', () => {
    const week = getPregnancyWeeklyContent(PREGNANCY_WEEKLY_CONTENT, 12);

    expect(week?.developmentSummary).toMatch(/ultrason/i);
  });

  it('gives every week from 4 on a summary and features of its own', () => {
    const summaries = PREGNANCY_WEEKLY_CONTENT.filter((week) => week.week >= 4).map(
      (week) => week.developmentSummary
    );

    // No week is a copy of another: each was written from its own page.
    expect(new Set(summaries).size).toBe(summaries.length);
  });

  it('lists something developing for every week', () => {
    for (const entry of PREGNANCY_WEEKLY_CONTENT) {
      expect(entry.developingFeatures.length).toBeGreaterThan(0);

      for (const feature of entry.developingFeatures) {
        expect(feature.trim()).not.toBe('');
      }
    }
  });
});

describe('looking up the weeks that are written', () => {
  it.each([1, 2, 3])('finds week %i', (week) => {
    const found = getPregnancyWeeklyContent(PREGNANCY_WEEKLY_CONTENT, week);

    expect(found).not.toBeNull();
    expect(found?.week).toBe(week);
  });

  it.each([4, 5, 6, 7, 8, 9, 10])('finds week %i', (week) => {
    const found = getPregnancyWeeklyContent(PREGNANCY_WEEKLY_CONTENT, week);

    expect(found).not.toBeNull();
    expect(found?.week).toBe(week);
  });

  it.each([11, 12, 13, 14, 15, 16, 17, 18, 19, 20])('finds week %i', (week) => {
    const found = getPregnancyWeeklyContent(PREGNANCY_WEEKLY_CONTENT, week);

    expect(found).not.toBeNull();
    expect(found?.week).toBe(week);
  });

  it('returns null for week 21, which is not written yet', () => {
    expect(getPregnancyWeeklyContent(PREGNANCY_WEEKLY_CONTENT, 21)).toBeNull();
  });

  it('returns null for every week beyond the twentieth', () => {
    for (let week = 21; week <= 40; week += 1) {
      expect(getPregnancyWeeklyContent(PREGNANCY_WEEKLY_CONTENT, week)).toBeNull();
    }
  });

  it('hands back the entry the list holds', () => {
    expect(getPregnancyWeeklyContent(PREGNANCY_WEEKLY_CONTENT, 2)).toBe(
      PREGNANCY_WEEKLY_CONTENT[1]
    );
  });
});

describe('PREGNANCY_WEEKLY_CONTENT stays as written', () => {
  it('is unchanged by being validated and searched', () => {
    const before = JSON.stringify(PREGNANCY_WEEKLY_CONTENT);

    for (const entry of PREGNANCY_WEEKLY_CONTENT) {
      validatePregnancyWeeklyContent(entry);
    }

    getPregnancyWeeklyContent(PREGNANCY_WEEKLY_CONTENT, 1);
    getPregnancyWeeklyContent(PREGNANCY_WEEKLY_CONTENT, 4);

    expect(JSON.stringify(PREGNANCY_WEEKLY_CONTENT)).toBe(before);
  });

  it('keeps its order', () => {
    getPregnancyWeeklyContent(PREGNANCY_WEEKLY_CONTENT, 3);
    getPregnancyWeeklyContent(PREGNANCY_WEEKLY_CONTENT, 20);

    expect(PREGNANCY_WEEKLY_CONTENT.map((entry) => entry.week)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
    ]);
  });
});
