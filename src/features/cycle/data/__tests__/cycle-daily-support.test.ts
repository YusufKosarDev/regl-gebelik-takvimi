import type { CycleDailySupport } from '../../domain/daily-support';
import { getCycleDailySupport, validateCycleDailySupport } from '../../domain/daily-support';
import { CYCLE_PHASES } from '../../domain/phases';
import { CYCLE_DAILY_SUPPORT } from '../cycle-daily-support';

describe('CYCLE_DAILY_SUPPORT coverage', () => {
  it('writes every phase', () => {
    expect(CYCLE_DAILY_SUPPORT.map((support) => support.phase)).toEqual([...CYCLE_PHASES]);
  });

  it('writes each phase exactly once', () => {
    const phases = CYCLE_DAILY_SUPPORT.map((support) => support.phase);

    expect(new Set(phases).size).toBe(phases.length);
  });

  it('writes nothing beyond the four phases', () => {
    expect(CYCLE_DAILY_SUPPORT).toHaveLength(CYCLE_PHASES.length);
  });
});

describe('CYCLE_DAILY_SUPPORT validity', () => {
  it.each(CYCLE_DAILY_SUPPORT)('the $phase phase passes validation', (support) => {
    expect(() => validateCycleDailySupport(support)).not.toThrow();
  });

  it.each(CYCLE_DAILY_SUPPORT)('the $phase phase has a support message', (support) => {
    expect(support.supportMessage.trim()).not.toBe('');
  });
});

describe('CYCLE_DAILY_SUPPORT sources', () => {
  it.each(CYCLE_DAILY_SUPPORT)('the $phase phase cites at least one', (support) => {
    expect(support.sources.length).toBeGreaterThanOrEqual(1);
  });

  it.each(CYCLE_DAILY_SUPPORT)('the $phase phase cites only followable links', (support) => {
    support.sources.forEach((source) => {
      expect(source.name.trim()).not.toBe('');
      expect(source.url).toMatch(/^https?:\/\/.+/);
    });
  });

  it.each(CYCLE_DAILY_SUPPORT)('the $phase phase cites no page twice', (support) => {
    const urls = support.sources.map((source) => source.url);

    expect(new Set(urls).size).toBe(urls.length);
  });

  it('cites only the three pages this content was written from', () => {
    const urls = new Set(
      CYCLE_DAILY_SUPPORT.flatMap((support) => support.sources.map((source) => source.url))
    );

    expect([...urls].sort()).toEqual([
      'https://womenshealth.gov/getting-active/physical-activity-menstrual-cycle',
      'https://womenshealth.gov/menstrual-cycle/your-menstrual-cycle-and-your-health',
      'https://www.nhs.uk/conditions/pre-menstrual-syndrome/',
    ]);
  });

  it('only cites the NHS page on PMS for the luteal phase', () => {
    // It is a page about the weeks before a period; citing it elsewhere would be
    // borrowing authority it does not lend.
    CYCLE_DAILY_SUPPORT.forEach((support) => {
      const citesPms = support.sources.some((source) => source.url.includes('pre-menstrual'));

      expect(citesPms).toBe(support.phase === 'luteal');
    });
  });
});

describe('CYCLE_DAILY_SUPPORT moods', () => {
  it('leaves the ovulatory phase without any', () => {
    // Neither source isolates ovulation's effect on mood, so the phase says
    // nothing rather than repeating the "energetic and cheerful" folk claim.
    const ovulatory = getCycleDailySupport(CYCLE_DAILY_SUPPORT, 'ovulatory');

    expect(ovulatory).not.toBeNull();
    expect(ovulatory?.moodLabels).toBeUndefined();
  });

  it('still gives the ovulatory phase something to say', () => {
    expect(getCycleDailySupport(CYCLE_DAILY_SUPPORT, 'ovulatory')?.supportMessage).toBeTruthy();
  });

  it.each(['menstrual', 'follicular', 'luteal'] as const)(
    'writes moods for the %s phase, where the sources support some',
    (phase) => {
      expect(getCycleDailySupport(CYCLE_DAILY_SUPPORT, phase)?.moodLabels?.length).toBeGreaterThan(
        0
      );
    }
  );

  it('hedges every mood it does write', () => {
    // "olabilir", "artabilir", "zorlaşabilir" — a possibility, never a reading of
    // how the person holding the phone actually feels.
    CYCLE_DAILY_SUPPORT.forEach((support) => {
      (support.moodLabels ?? []).forEach((label) => {
        expect(label).toMatch(/abilir|ebilir/);
      });
    });
  });

  it('never claims the ovulatory phase is energetic or cheerful', () => {
    const ovulatory = getCycleDailySupport(CYCLE_DAILY_SUPPORT, 'ovulatory');
    const text = [ovulatory?.supportMessage ?? '', ...(ovulatory?.moodLabels ?? [])].join(' ');

    expect(text.toLocaleLowerCase('tr-TR')).not.toMatch(/enerjik|neşeli|mutlu/);
  });

  it('presents the luteal phase as varying rather than certain', () => {
    const luteal = getCycleDailySupport(CYCLE_DAILY_SUPPORT, 'luteal');

    expect(luteal?.supportMessage).toMatch(/herkeste aynı değildir/);
  });
});

describe('getCycleDailySupport over CYCLE_DAILY_SUPPORT', () => {
  it.each(CYCLE_PHASES)('answers for the %s phase', (phase) => {
    const found = getCycleDailySupport(CYCLE_DAILY_SUPPORT, phase);

    expect(found).not.toBeNull();
    expect(found?.phase).toBe(phase);
  });

  it('hands back the entry the list holds, not a copy', () => {
    expect(getCycleDailySupport(CYCLE_DAILY_SUPPORT, 'menstrual')).toBe(CYCLE_DAILY_SUPPORT[0]);
  });

  it('refuses a phase that is not one', () => {
    expect(() =>
      getCycleDailySupport(CYCLE_DAILY_SUPPORT, 'gebelik' as (typeof CYCLE_PHASES)[number])
    ).toThrow(/invalid phase/);
  });
});

describe('CYCLE_DAILY_SUPPORT purity', () => {
  it('is not changed by looking a phase up', () => {
    const before = JSON.stringify(CYCLE_DAILY_SUPPORT);

    CYCLE_PHASES.forEach((phase) => getCycleDailySupport(CYCLE_DAILY_SUPPORT, phase));

    expect(JSON.stringify(CYCLE_DAILY_SUPPORT)).toBe(before);
  });

  it('is not changed by validating it', () => {
    const before = JSON.stringify(CYCLE_DAILY_SUPPORT);

    CYCLE_DAILY_SUPPORT.forEach((support: CycleDailySupport) =>
      validateCycleDailySupport(support)
    );

    expect(JSON.stringify(CYCLE_DAILY_SUPPORT)).toBe(before);
  });

  it('keeps the ovulatory phase without a moodLabels key at all', () => {
    const ovulatory = CYCLE_DAILY_SUPPORT.find((support) => support.phase === 'ovulatory');

    validateCycleDailySupport(ovulatory as CycleDailySupport);

    expect(ovulatory !== undefined && 'moodLabels' in ovulatory).toBe(false);
  });
});
