import { describeValue } from '../describe-value';

describe('describeValue', () => {
  it.each([
    ['2026-09-17', 'text'],
    ['', 'text'],
    ['skin-tone-5', 'text'],
    [7, 'a number'],
    [true, 'a boolean'],
    [null, 'null'],
    [undefined, 'undefined'],
  ])('describes %p as %s', (value, expected) => {
    expect(describeValue(value)).toBe(expected);
  });

  it('describes an array without its contents', () => {
    expect(describeValue(['yorgunluk', 'kramp'])).toBe('an array');
  });

  it('describes an object without its fields', () => {
    expect(describeValue({ lastMenstrualPeriodStartDate: '2026-09-02' })).toBe('an object');
  });
});

describe('what describeValue never gives away', () => {
  const secrets: readonly unknown[] = [
    '2026-09-17',
    { startDate: '2026-09-02', endDate: '2026-09-07', isOngoing: false },
    { skinToneId: 'skin-tone-5', hairStyleId: 'wavy', outfitId: 'shirt' },
    ['Kramplar olabilir', 'Harekete geçmek kolaylaşabilir'],
    'Bu günlerde hafif bir yürüyüş bazı kişilere iyi gelebilir.',
    JSON.stringify({ version: 1, date: '2026-09-17', cycleDay: 1 }),
  ];

  it.each(secrets.map((value, index) => [index, value]))(
    'says nothing of case %i that was in it',
    (_index, value) => {
      const described = describeValue(value);

      expect(described).not.toMatch(/\d{4}-\d{2}-\d{2}/);
      expect(described).not.toMatch(/skin-tone|wavy|shirt|Kramplar|yürüyüş|cycleDay/);
    }
  );

  it('says nothing about how long the text was', () => {
    expect(describeValue('a')).toBe(describeValue('a'.repeat(500)));
  });
});
