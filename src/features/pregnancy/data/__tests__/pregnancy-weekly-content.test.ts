import {
  getPregnancyWeeklyContent,
  validatePregnancyWeeklyContent,
} from '../../domain/weekly-content';
import { PREGNANCY_WEEKLY_CONTENT } from '../pregnancy-weekly-content';

describe('PREGNANCY_WEEKLY_CONTENT', () => {
  it('covers weeks 1 to 3 and nothing else yet', () => {
    expect(PREGNANCY_WEEKLY_CONTENT).toHaveLength(3);
    expect(PREGNANCY_WEEKLY_CONTENT.map((entry) => entry.week)).toEqual([1, 2, 3]);
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
  it('states no size for any of the first three weeks', () => {
    for (const entry of PREGNANCY_WEEKLY_CONTENT) {
      expect(entry.size).toBeUndefined();
    }
  });

  it('leaves the key off rather than storing an empty one', () => {
    for (const entry of PREGNANCY_WEEKLY_CONTENT) {
      expect(Object.prototype.hasOwnProperty.call(entry, 'size')).toBe(false);
    }
  });
});

describe('PREGNANCY_WEEKLY_CONTENT provenance', () => {
  it('cites a source for every week', () => {
    for (const entry of PREGNANCY_WEEKLY_CONTENT) {
      expect(entry.sources.length).toBeGreaterThan(0);
    }
  });

  it('names Cleveland Clinic and links to the page it came from', () => {
    for (const entry of PREGNANCY_WEEKLY_CONTENT) {
      for (const source of entry.sources) {
        expect(source.name).toMatch(/Cleveland Clinic/);
        expect(source.url).toBe(
          'https://my.clevelandclinic.org/health/articles/7247-fetal-development-stages-of-growth'
        );
      }
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

  it('lists something developing for every week', () => {
    for (const entry of PREGNANCY_WEEKLY_CONTENT) {
      expect(entry.developingFeatures.length).toBeGreaterThan(0);

      for (const feature of entry.developingFeatures) {
        expect(feature.trim()).not.toBe('');
      }
    }
  });
});

describe('looking up the first three weeks', () => {
  it.each([1, 2, 3])('finds week %i', (week) => {
    const found = getPregnancyWeeklyContent(PREGNANCY_WEEKLY_CONTENT, week);

    expect(found).not.toBeNull();
    expect(found?.week).toBe(week);
  });

  it('returns null for week 4, which is not written yet', () => {
    expect(getPregnancyWeeklyContent(PREGNANCY_WEEKLY_CONTENT, 4)).toBeNull();
  });

  it('returns null for every week beyond the third', () => {
    for (let week = 4; week <= 40; week += 1) {
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

    expect(PREGNANCY_WEEKLY_CONTENT.map((entry) => entry.week)).toEqual([1, 2, 3]);
  });
});
