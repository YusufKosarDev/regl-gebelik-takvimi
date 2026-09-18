import type { CycleDailySupport } from '../daily-support';
import { getCycleDailySupport, validateCycleDailySupport } from '../daily-support';
import type { CyclePhase } from '../phases';
import { CYCLE_PHASES } from '../phases';

/**
 * Stand-in text, not a mood mapping.
 *
 * Nothing real is written for any phase yet. Inventing it in a test fixture
 * would be worse than leaving it out, and what someone might notice in a phase
 * is not something to make up to fill a table.
 */
function support(
  phase: CyclePhase,
  overrides: Partial<CycleDailySupport> = {}
): CycleDailySupport {
  return {
    phase,
    moodLabels: [`${phase} birinci ifade`, `${phase} ikinci ifade`],
    supportMessage: `${phase} için örnek destek metni`,
    ...overrides,
  };
}

describe('validateCycleDailySupport with usable content', () => {
  it.each(CYCLE_PHASES)('accepts the %s phase', (phase) => {
    expect(() => validateCycleDailySupport(support(phase))).not.toThrow();
  });

  it('accepts a single mood', () => {
    expect(() =>
      validateCycleDailySupport(support('luteal', { moodLabels: ['yorgunluk'] }))
    ).not.toThrow();
  });

  it('accepts several moods', () => {
    expect(() =>
      validateCycleDailySupport(
        support('luteal', { moodLabels: ['yorgunluk', 'gerginlik', 'iştah değişimi'] })
      )
    ).not.toThrow();
  });
});

describe('validateCycleDailySupport with an unusable phase', () => {
  it('refuses a phase that is not one', () => {
    expect(() =>
      validateCycleDailySupport(support('gebelik' as CyclePhase))
    ).toThrow(/invalid phase: "gebelik"/);
  });

  it('refuses an empty phase', () => {
    expect(() => validateCycleDailySupport(support('' as CyclePhase))).toThrow(/invalid phase/);
  });

  it('refuses a phase with the wrong casing', () => {
    expect(() => validateCycleDailySupport(support('Luteal' as CyclePhase))).toThrow(
      /invalid phase/
    );
  });

  it('refuses a phase that is not text', () => {
    expect(() =>
      validateCycleDailySupport(support(3 as unknown as CyclePhase))
    ).toThrow(/invalid phase/);
  });
});

describe('validateCycleDailySupport with unusable moods', () => {
  it('refuses an empty list', () => {
    expect(() => validateCycleDailySupport(support('luteal', { moodLabels: [] }))).toThrow(
      /lists no moods/
    );
  });

  it('refuses a list that is not a list', () => {
    expect(() =>
      validateCycleDailySupport(
        support('luteal', { moodLabels: 'yorgunluk' as unknown as string[] })
      )
    ).toThrow(/non-array moodLabels/);
  });

  it('refuses a blank mood', () => {
    expect(() =>
      validateCycleDailySupport(support('luteal', { moodLabels: ['yorgunluk', ''] }))
    ).toThrow(/blank moodLabels\[1\]/);
  });

  it('refuses a whitespace-only mood', () => {
    expect(() =>
      validateCycleDailySupport(support('luteal', { moodLabels: ['   '] }))
    ).toThrow(/blank moodLabels\[0\]/);
  });

  it('refuses a mood that is not text', () => {
    expect(() =>
      validateCycleDailySupport(
        support('luteal', { moodLabels: ['yorgunluk', 7 as unknown as string] })
      )
    ).toThrow(/blank moodLabels\[1\]/);
  });

  it('refuses the same mood twice', () => {
    expect(() =>
      validateCycleDailySupport(
        support('luteal', { moodLabels: ['yorgunluk', 'yorgunluk'] })
      )
    ).toThrow(/lists "yorgunluk" more than once/);
  });

  it('refuses a repeat that differs only by surrounding whitespace', () => {
    expect(() =>
      validateCycleDailySupport(
        support('luteal', { moodLabels: ['yorgunluk', '  yorgunluk  '] })
      )
    ).toThrow(/more than once/);
  });

  it('refuses a repeat that is not adjacent', () => {
    expect(() =>
      validateCycleDailySupport(
        support('luteal', { moodLabels: ['yorgunluk', 'gerginlik', 'yorgunluk'] })
      )
    ).toThrow(/more than once/);
  });

  it('names the phase the bad mood belongs to', () => {
    expect(() =>
      validateCycleDailySupport(support('menstrual', { moodLabels: [''] }))
    ).toThrow(/for the menstrual phase/);
  });
});

describe('validateCycleDailySupport with an unusable message', () => {
  it('refuses an empty message', () => {
    expect(() =>
      validateCycleDailySupport(support('luteal', { supportMessage: '' }))
    ).toThrow(/blank supportMessage/);
  });

  it('refuses a whitespace-only message', () => {
    expect(() =>
      validateCycleDailySupport(support('luteal', { supportMessage: '   ' }))
    ).toThrow(/blank supportMessage/);
  });

  it('refuses a message that is not text', () => {
    expect(() =>
      validateCycleDailySupport(
        support('luteal', { supportMessage: 12 as unknown as string })
      )
    ).toThrow(/blank supportMessage/);
  });
});

describe('validateCycleDailySupport purity', () => {
  it('leaves the content as it found it', () => {
    const entry = support('luteal', { moodLabels: ['yorgunluk', 'gerginlik'] });
    const before = JSON.stringify(entry);

    validateCycleDailySupport(entry);

    expect(JSON.stringify(entry)).toBe(before);
  });

  it('does not reorder the moods to find duplicates', () => {
    const entry = support('luteal', { moodLabels: ['c', 'a', 'b'] });

    validateCycleDailySupport(entry);

    expect(entry.moodLabels).toEqual(['c', 'a', 'b']);
  });

  it('does not trim the stored moods as a side effect', () => {
    const entry = support('luteal', { moodLabels: ['  yorgunluk  '] });

    validateCycleDailySupport(entry);

    expect(entry.moodLabels?.[0]).toBe('  yorgunluk  ');
  });

  it('leaves it alone even when it rejects it', () => {
    const entry = support('luteal', { supportMessage: '' });
    const before = JSON.stringify(entry);

    expect(() => validateCycleDailySupport(entry)).toThrow();

    expect(JSON.stringify(entry)).toBe(before);
  });
});

describe('getCycleDailySupport', () => {
  const contents = [support('menstrual'), support('ovulatory'), support('luteal')];

  it.each(['menstrual', 'ovulatory', 'luteal'] as const)('finds the %s phase', (phase) => {
    expect(getCycleDailySupport(contents, phase)?.phase).toBe(phase);
  });

  it('hands back the entry the list holds, not a copy', () => {
    expect(getCycleDailySupport(contents, 'ovulatory')).toBe(contents[1]);
  });

  it('returns null for a phase nothing is written for', () => {
    expect(getCycleDailySupport(contents, 'follicular')).toBeNull();
  });

  it('returns null rather than a neighbouring phase', () => {
    // What someone might notice while menstruating is not what they might
    // notice in the follicular phase.
    expect(getCycleDailySupport([support('menstrual')], 'follicular')).toBeNull();
  });

  it('returns null for an empty list', () => {
    expect(getCycleDailySupport([], 'luteal')).toBeNull();
  });

  it('answers for every phase once they are all written', () => {
    const all = CYCLE_PHASES.map((phase) => support(phase));

    for (const phase of CYCLE_PHASES) {
      expect(getCycleDailySupport(all, phase)?.phase).toBe(phase);
    }
  });
});

describe('getCycleDailySupport with a phase it refuses', () => {
  const contents = [support('luteal')];

  it('refuses a phase that is not one', () => {
    expect(() => getCycleDailySupport(contents, 'gebelik' as CyclePhase)).toThrow(
      /invalid phase: "gebelik"/
    );
  });

  it('refuses an empty phase', () => {
    expect(() => getCycleDailySupport(contents, '' as CyclePhase)).toThrow(/invalid phase/);
  });

  it('refuses a phase with the wrong casing', () => {
    expect(() => getCycleDailySupport(contents, 'Luteal' as CyclePhase)).toThrow(
      /invalid phase/
    );
  });
});

describe('getCycleDailySupport with a duplicated phase', () => {
  it('refuses rather than choosing one', () => {
    const contents = [support('luteal'), support('menstrual'), support('luteal')];

    expect(() => getCycleDailySupport(contents, 'luteal')).toThrow(
      /found 2 entries for the luteal phase/
    );
  });

  it('counts every duplicate', () => {
    const contents = [support('luteal'), support('luteal'), support('luteal')];

    expect(() => getCycleDailySupport(contents, 'luteal')).toThrow(/found 3 entries/);
  });

  it('still answers for a phase that is not duplicated', () => {
    const contents = [support('luteal'), support('menstrual'), support('luteal')];

    expect(getCycleDailySupport(contents, 'menstrual')).toBe(contents[1]);
  });
});

describe('getCycleDailySupport purity', () => {
  it('leaves the list as it found it', () => {
    const contents = [support('luteal'), support('menstrual'), support('ovulatory')];
    const before = JSON.stringify(contents);

    getCycleDailySupport(contents, 'menstrual');

    expect(JSON.stringify(contents)).toBe(before);
  });

  it('does not reorder the list to search it', () => {
    const contents = [support('luteal'), support('menstrual'), support('ovulatory')];

    getCycleDailySupport(contents, 'ovulatory');

    expect(contents.map((entry) => entry.phase)).toEqual([
      'luteal',
      'menstrual',
      'ovulatory',
    ]);
  });

  it('leaves the list alone even when it rejects the phase', () => {
    const contents = [support('luteal'), support('luteal')];
    const before = JSON.stringify(contents);

    expect(() => getCycleDailySupport(contents, 'luteal')).toThrow();

    expect(JSON.stringify(contents)).toBe(before);
  });

  it('does not validate the entries it searches', () => {
    // The lookup answers about phases; whether an entry is well-formed is
    // validation's question, asked separately.
    const contents = [support('luteal', { moodLabels: [] })];

    expect(getCycleDailySupport(contents, 'luteal')).toBe(contents[0]);
  });
});

describe('validateCycleDailySupport with no moods', () => {
  /** A phase written without moods, as one with thin evidence would be. */
  function withoutMoods(phase: CyclePhase): CycleDailySupport {
    const { moodLabels, ...rest } = support(phase);

    void moodLabels;

    return rest;
  }

  it.each(CYCLE_PHASES)('accepts the %s phase without any', (phase) => {
    expect(() => validateCycleDailySupport(withoutMoods(phase))).not.toThrow();
  });

  it('accepts an explicitly undefined list', () => {
    expect(() =>
      validateCycleDailySupport(support('luteal', { moodLabels: undefined }))
    ).not.toThrow();
  });

  it('still requires the support message', () => {
    expect(() =>
      validateCycleDailySupport({ ...withoutMoods('luteal'), supportMessage: '' })
    ).toThrow(/blank supportMessage/);
  });

  it('still requires a real phase', () => {
    expect(() =>
      validateCycleDailySupport({ ...withoutMoods('luteal'), phase: 'gebelik' as CyclePhase })
    ).toThrow(/invalid phase/);
  });

  it('leaves the content as it found it', () => {
    const entry = withoutMoods('luteal');
    const before = JSON.stringify(entry);

    validateCycleDailySupport(entry);

    expect(JSON.stringify(entry)).toBe(before);
    expect('moodLabels' in entry).toBe(false);
  });

  it('does not give the phase a list it did not have', () => {
    const entry = withoutMoods('luteal');

    validateCycleDailySupport(entry);

    expect(entry.moodLabels).toBeUndefined();
  });

  it('still refuses an empty list, which is not the same as none', () => {
    // No moods says nothing; an empty list promises moods and shows none.
    expect(() => validateCycleDailySupport(support('luteal', { moodLabels: [] }))).toThrow(
      /lists no moods/
    );
  });
});

describe('getCycleDailySupport with phases written either way', () => {
  function withoutMoods(phase: CyclePhase): CycleDailySupport {
    const { moodLabels, ...rest } = support(phase);

    void moodLabels;

    return rest;
  }

  it('finds a phase that names no moods', () => {
    const contents = [withoutMoods('menstrual'), support('luteal')];

    expect(getCycleDailySupport(contents, 'menstrual')).toBe(contents[0]);
    expect(getCycleDailySupport(contents, 'menstrual')?.moodLabels).toBeUndefined();
  });

  it('finds a phase that does', () => {
    const contents = [withoutMoods('menstrual'), support('luteal')];

    expect(getCycleDailySupport(contents, 'luteal')).toBe(contents[1]);
    expect(getCycleDailySupport(contents, 'luteal')?.moodLabels).toHaveLength(2);
  });

  it('still returns null for an unwritten phase', () => {
    expect(getCycleDailySupport([withoutMoods('menstrual')], 'ovulatory')).toBeNull();
  });

  it('still refuses a duplicated phase', () => {
    const contents = [withoutMoods('luteal'), support('luteal')];

    expect(() => getCycleDailySupport(contents, 'luteal')).toThrow(
      /found 2 entries for the luteal phase/
    );
  });

  it('leaves a mixed list as it found it', () => {
    const contents = [withoutMoods('menstrual'), support('luteal')];
    const before = JSON.stringify(contents);

    getCycleDailySupport(contents, 'luteal');

    expect(JSON.stringify(contents)).toBe(before);
  });
});
