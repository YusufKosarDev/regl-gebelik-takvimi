import {
  CYCLE_PHASES,
  CYCLE_PHASE_METADATA,
  isCyclePhase,
  type CyclePhase,
} from '../phases';

describe('CYCLE_PHASES', () => {
  it('has exactly four phases', () => {
    expect(CYCLE_PHASES).toHaveLength(4);
  });

  it('keeps them in cycle order', () => {
    expect(CYCLE_PHASES).toEqual(['menstrual', 'follicular', 'ovulatory', 'luteal']);
  });

  it('contains no duplicates', () => {
    expect(new Set(CYCLE_PHASES).size).toBe(CYCLE_PHASES.length);
  });
});

describe('CYCLE_PHASE_METADATA', () => {
  it('has an entry for every phase and no extras', () => {
    expect(Object.keys(CYCLE_PHASE_METADATA).sort()).toEqual([...CYCLE_PHASES].sort());
  });

  it.each(CYCLE_PHASES)('entry for "%s" is self-consistent', (phase) => {
    const metadata = CYCLE_PHASE_METADATA[phase];

    expect(metadata).toBeDefined();
    expect(metadata.key).toBe(phase);
    expect(metadata.labelKey.length).toBeGreaterThan(0);
    expect(metadata.descriptionKey.length).toBeGreaterThan(0);
  });

  it.each(CYCLE_PHASES)('translation keys for "%s" are unique per field', (phase) => {
    const metadata = CYCLE_PHASE_METADATA[phase];

    expect(metadata.labelKey).not.toBe(metadata.descriptionKey);
  });

  it('uses a distinct label key for each phase', () => {
    const labelKeys = CYCLE_PHASES.map((phase) => CYCLE_PHASE_METADATA[phase].labelKey);

    expect(new Set(labelKeys).size).toBe(CYCLE_PHASES.length);
  });

  it('carries translation keys rather than user-facing copy', () => {
    expect(CYCLE_PHASE_METADATA.menstrual.labelKey).toBe('cycle.phase.menstrual.label');
    expect(CYCLE_PHASE_METADATA.menstrual.descriptionKey).toBe(
      'cycle.phase.menstrual.description'
    );
  });
});

describe('isCyclePhase', () => {
  it.each(['menstrual', 'follicular', 'ovulatory', 'luteal'])('accepts "%s"', (value) => {
    expect(isCyclePhase(value)).toBe(true);
  });

  it('rejects an unknown value', () => {
    expect(isCyclePhase('unknown')).toBe(false);
    expect(isCyclePhase('ovulation')).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(isCyclePhase('')).toBe(false);
  });

  it('rejects different capitalisation', () => {
    expect(isCyclePhase('Menstrual')).toBe(false);
    expect(isCyclePhase('LUTEAL')).toBe(false);
  });

  it('rejects surrounding whitespace', () => {
    expect(isCyclePhase(' menstrual')).toBe(false);
    expect(isCyclePhase('menstrual ')).toBe(false);
  });

  it('narrows the type when it returns true', () => {
    const value: string = 'ovulatory';

    if (isCyclePhase(value)) {
      const phase: CyclePhase = value;
      expect(CYCLE_PHASE_METADATA[phase].key).toBe('ovulatory');
    } else {
      throw new Error('expected "ovulatory" to be a cycle phase');
    }
  });
});
