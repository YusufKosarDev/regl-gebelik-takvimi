import { describeCatalogueParity } from '../../../../../jest/catalogue-parity';
import type { CycleCalendarDay } from '../../application/build-cycle-calendar-month';
import {
  cycleLabels,
  getCalendarDayAccessibilityLabelIn,
  getCyclePhaseLabelIn,
  getFertilityLevelLabelIn,
} from '../cycle-labels';

import { toISODate } from '@/utils/date';

/**
 * The phase and fertility words, in both languages.
 *
 * Its own file rather than a block inside `cycle-labels.test.ts`, which asserts
 * the Turkish and predates the second language. That file is left exactly as it
 * was; this one is about the pair.
 */

describe('parity', () => {
  describeCatalogueParity(cycleLabels);
});

describe('the four phases and three fertility levels', () => {
  it.each<['menstrual' | 'follicular' | 'ovulatory' | 'luteal']>([
    ['menstrual'],
    ['follicular'],
    ['ovulatory'],
    ['luteal'],
  ])('names %s in both languages', (phase) => {
    expect(getCyclePhaseLabelIn(cycleLabels.tr, phase).trim()).not.toBe('');
    expect(getCyclePhaseLabelIn(cycleLabels.en, phase).trim()).not.toBe('');
  });

  it('answers a null phase rather than throwing', () => {
    expect(getCyclePhaseLabelIn(cycleLabels.en, null)).toBe(cycleLabels.en.unknownLabel);
    expect(getFertilityLevelLabelIn(cycleLabels.en, null)).toBe(cycleLabels.en.unknownLabel);
  });

  it('keeps fertility ordinal, with no number in it', () => {
    // No percentage and no chance of conceiving: the estimate does not support
    // that kind of claim, and the English must not quietly introduce one.
    for (const level of ['low', 'elevated', 'peak'] as const) {
      expect(getFertilityLevelLabelIn(cycleLabels.en, level)).not.toMatch(/\d/);
      expect(getFertilityLevelLabelIn(cycleLabels.tr, level)).not.toMatch(/\d/);
    }
  });

  it('gives the three levels three different words', () => {
    for (const labels of [cycleLabels.tr, cycleLabels.en]) {
      const words = (['low', 'elevated', 'peak'] as const).map((level) =>
        getFertilityLevelLabelIn(labels, level)
      );

      expect(new Set(words).size).toBe(3);
    }
  });
});

describe('a calendar day, as a screen reader reads it', () => {
  const day = (overrides: Partial<CycleCalendarDay> = {}): CycleCalendarDay =>
    ({
      date: toISODate('2026-09-17'),
      phase: null,
      fertilityLevel: null,
      isPredictedPeriodStart: false,
      ...overrides,
    }) as CycleCalendarDay;

  it('reads the date first, in the language it was given', () => {
    expect(getCalendarDayAccessibilityLabelIn(cycleLabels.en, 'en', day())).toBe(
      '17 September 2026'
    );
    expect(getCalendarDayAccessibilityLabelIn(cycleLabels.tr, 'tr', day())).toBe(
      '17 Eylül 2026'
    );
  });

  it('adds only the phases somebody is looking for', () => {
    // Naming every day's phase would turn a month into thirty near-identical
    // sentences to listen through.
    expect(
      getCalendarDayAccessibilityLabelIn(cycleLabels.en, 'en', day({ phase: 'follicular' }))
    ).toBe('17 September 2026');
    expect(
      getCalendarDayAccessibilityLabelIn(cycleLabels.en, 'en', day({ phase: 'menstrual' }))
    ).toContain('Period');
  });

  it('writes the lower-case fertility form out rather than lower-casing a label', () => {
    // toLocaleLowerCase is a trap across these two languages: Turkish's dotted
    // and dotless I make locale-sensitive casing wrong in a way that is hard to
    // see. Both halves spell the sentence form themselves.
    expect(
      getCalendarDayAccessibilityLabelIn(cycleLabels.en, 'en', day({ fertilityLevel: 'peak' }))
    ).toContain('fertility highest');
    expect(
      getCalendarDayAccessibilityLabelIn(cycleLabels.tr, 'tr', day({ fertilityLevel: 'peak' }))
    ).toContain('doğurganlık en yüksek');
  });

  it('puts today and selected last, after what the domain says', () => {
    const label = getCalendarDayAccessibilityLabelIn(
      cycleLabels.en,
      'en',
      day({ phase: 'menstrual' }),
      { isToday: true, isSelected: true }
    );

    expect(label).toBe('17 September 2026, Period, today, selected');
  });
});
