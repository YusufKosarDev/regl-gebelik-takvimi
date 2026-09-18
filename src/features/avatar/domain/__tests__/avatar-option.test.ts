import type { AvatarOption } from '../avatar-option';
import { getAvatarOption } from '../avatar-option';

const OPTIONS: readonly AvatarOption[] = [
  { id: 'short', label: 'Kısa' },
  { id: 'long', label: 'Uzun' },
  { id: 'bun', label: 'Topuz' },
];

describe('getAvatarOption finding an option', () => {
  it.each(OPTIONS)('finds $id', (option) => {
    expect(getAvatarOption(OPTIONS, option.id)).toEqual(option);
  });

  it('hands back the option the list holds, not a copy', () => {
    expect(getAvatarOption(OPTIONS, 'long')).toBe(OPTIONS[1]);
  });

  it('carries the label with it', () => {
    expect(getAvatarOption(OPTIONS, 'bun')?.label).toBe('Topuz');
  });
});

describe('getAvatarOption with an id nothing matches', () => {
  it('returns null rather than throwing', () => {
    // A saved avatar can name an option a later build dropped; that is ordinary,
    // and the caller decides what to show instead.
    expect(getAvatarOption(OPTIONS, 'mohawk')).toBeNull();
  });

  it('returns null for an empty list', () => {
    expect(getAvatarOption([], 'short')).toBeNull();
  });

  it('returns null for an empty id', () => {
    expect(getAvatarOption(OPTIONS, '')).toBeNull();
  });

  it('matches ids exactly, not by case', () => {
    expect(getAvatarOption(OPTIONS, 'Short')).toBeNull();
  });

  it('matches ids exactly, not after trimming', () => {
    expect(getAvatarOption(OPTIONS, ' short ')).toBeNull();
  });

  it('does not match a label', () => {
    expect(getAvatarOption(OPTIONS, 'Kısa')).toBeNull();
  });
});

describe('getAvatarOption with a duplicated catalogue id', () => {
  const duplicated: readonly AvatarOption[] = [
    { id: 'short', label: 'Kısa' },
    { id: 'short', label: 'Kısacık' },
  ];

  it('refuses rather than choosing one', () => {
    expect(() => getAvatarOption(duplicated, 'short')).toThrow(
      /found 2 options with the same id/
    );
  });

  it('counts every duplicate', () => {
    const thrice = [...duplicated, { id: 'short', label: 'Kısa 3' }];

    expect(() => getAvatarOption(thrice, 'short')).toThrow(/found 3 options/);
  });

  it('still answers for an id that is not duplicated', () => {
    const mixed = [...duplicated, { id: 'long', label: 'Uzun' }];

    expect(getAvatarOption(mixed, 'long')?.label).toBe('Uzun');
  });

  it('does not notice duplicates of an id it was not asked about', () => {
    expect(getAvatarOption(duplicated, 'long')).toBeNull();
  });
});

describe('getAvatarOption with an id that is not text', () => {
  it.each([null, undefined, 1, {}, []])('refuses %p', (id) => {
    expect(() => getAvatarOption(OPTIONS, id as unknown as string)).toThrow(
      /id that is not text/
    );
  });
});

describe('getAvatarOption purity', () => {
  it('leaves the list as it found it', () => {
    const options = [...OPTIONS];
    const before = JSON.stringify(options);

    getAvatarOption(options, 'long');

    expect(JSON.stringify(options)).toBe(before);
  });

  it('does not reorder the list to search it', () => {
    const options = [
      { id: 'long', label: 'Uzun' },
      { id: 'bun', label: 'Topuz' },
      { id: 'short', label: 'Kısa' },
    ];

    getAvatarOption(options, 'short');

    expect(options.map((option) => option.id)).toEqual(['long', 'bun', 'short']);
  });

  it('leaves the list alone even when it rejects the id', () => {
    const options = [...OPTIONS];
    const before = JSON.stringify(options);

    expect(() => getAvatarOption(options, 1 as unknown as string)).toThrow();
    expect(JSON.stringify(options)).toBe(before);
  });

  it('does not change the option it returns', () => {
    const found = getAvatarOption(OPTIONS, 'short');

    expect(found).toEqual({ id: 'short', label: 'Kısa' });
    expect(Object.keys(found ?? {})).toEqual(['id', 'label']);
  });
});
