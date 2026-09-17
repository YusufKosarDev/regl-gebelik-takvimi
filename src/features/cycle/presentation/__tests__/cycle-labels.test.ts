import { getCyclePhaseLabel, getFertilityLevelLabel } from '../cycle-labels';

import { CYCLE_PHASES } from '@/features/cycle/domain/phases';

describe('getCyclePhaseLabel', () => {
  it.each([
    ['menstrual', 'Regl'],
    ['follicular', 'Foliküler'],
    ['ovulatory', 'Yumurtlama'],
    ['luteal', 'Luteal'],
  ] as const)('labels %s as %s', (phase, expected) => {
    expect(getCyclePhaseLabel(phase)).toBe(expected);
  });

  it('labels an unknown phase', () => {
    expect(getCyclePhaseLabel(null)).toBe('Bilinmiyor');
  });

  it('covers every phase the domain defines', () => {
    for (const phase of CYCLE_PHASES) {
      expect(getCyclePhaseLabel(phase)).not.toBe('Bilinmiyor');
    }
  });
});

describe('getFertilityLevelLabel', () => {
  it.each([
    ['low', 'Düşük'],
    ['elevated', 'Yüksek'],
    ['peak', 'En yüksek'],
  ] as const)('labels %s as %s', (level, expected) => {
    expect(getFertilityLevelLabel(level)).toBe(expected);
  });

  it('labels an unknown level', () => {
    expect(getFertilityLevelLabel(null)).toBe('Bilinmiyor');
  });

  it('never states a probability or a chance of pregnancy', () => {
    const labels = [
      getFertilityLevelLabel('low'),
      getFertilityLevelLabel('elevated'),
      getFertilityLevelLabel('peak'),
      getFertilityLevelLabel(null),
    ];

    for (const label of labels) {
      expect(label).not.toMatch(/%|yüzde|olasılık|şans|gebe|hamile|kesin|garanti/i);
    }
  });
});
