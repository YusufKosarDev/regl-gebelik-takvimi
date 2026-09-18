import type { AvatarConfig } from '../avatar-config';
import { validateAvatarConfig } from '../avatar-config';

/**
 * Stand-in ids, not a catalogue.
 *
 * No hair style, colour or outfit is invented here either: these are shaped like
 * ids and mean nothing, which is exactly what the model treats them as.
 */
function config(overrides: Partial<AvatarConfig> = {}): AvatarConfig {
  return {
    skinToneId: 'skin-1',
    hairStyleId: 'hair-1',
    hairColorId: 'hair-color-1',
    outfitId: 'outfit-1',
    ...overrides,
  };
}

const REQUIRED_FIELDS = ['skinToneId', 'hairStyleId', 'hairColorId', 'outfitId'] as const;

describe('validateAvatarConfig with a usable avatar', () => {
  it('accepts one without an accessory', () => {
    expect(() => validateAvatarConfig(config())).not.toThrow();
  });

  it('accepts one with an accessory', () => {
    expect(() => validateAvatarConfig(config({ accessoryId: 'accessory-1' }))).not.toThrow();
  });

  it('accepts an explicitly absent accessory', () => {
    expect(() => validateAvatarConfig(config({ accessoryId: undefined }))).not.toThrow();
  });

  it('accepts ids in any shape, since there is no catalogue to match', () => {
    expect(() =>
      validateAvatarConfig({
        skinToneId: '3',
        hairStyleId: 'kısa-dalgalı',
        hairColorId: '#2B1B12',
        outfitId: 'outfit/winter/02',
        accessoryId: 'a',
      })
    ).not.toThrow();
  });

  it('accepts an id that only has whitespace around it', () => {
    expect(() => validateAvatarConfig(config({ outfitId: ' outfit-1 ' }))).not.toThrow();
  });

  it('returns nothing', () => {
    expect(validateAvatarConfig(config())).toBeUndefined();
  });
});

describe('validateAvatarConfig with a blank required id', () => {
  it.each(REQUIRED_FIELDS)('refuses an empty %s', (field) => {
    expect(() => validateAvatarConfig(config({ [field]: '' }))).toThrow(
      new RegExp(`blank ${field}`)
    );
  });

  it.each(REQUIRED_FIELDS)('refuses a whitespace-only %s', (field) => {
    expect(() => validateAvatarConfig(config({ [field]: '   ' }))).toThrow(
      new RegExp(`blank ${field}`)
    );
  });

  it.each(REQUIRED_FIELDS)('refuses a %s made of tabs and newlines', (field) => {
    expect(() => validateAvatarConfig(config({ [field]: '\t\n ' }))).toThrow(
      new RegExp(`blank ${field}`)
    );
  });

  it.each(REQUIRED_FIELDS)('refuses a missing %s', (field) => {
    const { [field]: removed, ...rest } = config();

    void removed;

    expect(() => validateAvatarConfig(rest as AvatarConfig)).toThrow(
      new RegExp(`${field} that is not text`)
    );
  });

  it('names the field it refused', () => {
    expect(() => validateAvatarConfig(config({ hairColorId: '' }))).toThrow(
      'AvatarConfig has a blank hairColorId: "".'
    );
  });

  it('reports the first broken field rather than all of them', () => {
    expect(() => validateAvatarConfig(config({ skinToneId: '', outfitId: '' }))).toThrow(
      /blank skinToneId/
    );
  });
});

describe('validateAvatarConfig with an unusable accessory', () => {
  it('refuses an empty accessoryId, which is not the same as none', () => {
    expect(() => validateAvatarConfig(config({ accessoryId: '' }))).toThrow(
      /blank accessoryId/
    );
  });

  it('refuses a whitespace-only accessoryId', () => {
    expect(() => validateAvatarConfig(config({ accessoryId: '  ' }))).toThrow(
      /blank accessoryId/
    );
  });

  it('refuses an accessoryId that is not text', () => {
    expect(() =>
      validateAvatarConfig(config({ accessoryId: 7 as unknown as string }))
    ).toThrow(/accessoryId that is not text/);
  });

  it('refuses a null accessoryId rather than reading it as none', () => {
    expect(() =>
      validateAvatarConfig(config({ accessoryId: null as unknown as string }))
    ).toThrow(/accessoryId that is not text/);
  });

  it('checks the required fields before the accessory', () => {
    expect(() =>
      validateAvatarConfig(config({ skinToneId: '', accessoryId: '' }))
    ).toThrow(/blank skinToneId/);
  });
});

describe('validateAvatarConfig with the wrong runtime types', () => {
  it.each(REQUIRED_FIELDS)('refuses a numeric %s', (field) => {
    expect(() => validateAvatarConfig(config({ [field]: 1 as unknown as string }))).toThrow(
      new RegExp(`${field} that is not text`)
    );
  });

  it.each(REQUIRED_FIELDS)('refuses a null %s', (field) => {
    expect(() => validateAvatarConfig(config({ [field]: null as unknown as string }))).toThrow(
      new RegExp(`${field} that is not text`)
    );
  });

  it('refuses an id that is an object', () => {
    expect(() =>
      validateAvatarConfig(config({ outfitId: { id: 'outfit-1' } as unknown as string }))
    ).toThrow(/outfitId that is not text/);
  });

  it('refuses an id that is an array of one', () => {
    expect(() =>
      validateAvatarConfig(config({ outfitId: ['outfit-1'] as unknown as string }))
    ).toThrow(/outfitId that is not text/);
  });

  it.each([null, undefined, 'skin-1', 7, true])('refuses %p in place of an avatar', (value) => {
    expect(() => validateAvatarConfig(value as unknown as AvatarConfig)).toThrow(
      /is not an avatar|that is not text/
    );
  });

  it('refuses an array in place of an avatar', () => {
    expect(() => validateAvatarConfig([] as unknown as AvatarConfig)).toThrow(/is not an avatar/);
  });
});

describe('validateAvatarConfig purity', () => {
  it('leaves the avatar as it found it', () => {
    const avatar = config({ accessoryId: 'accessory-1' });
    const before = JSON.stringify(avatar);

    validateAvatarConfig(avatar);

    expect(JSON.stringify(avatar)).toBe(before);
  });

  it('does not trim the stored ids as a side effect', () => {
    const avatar = config({ outfitId: ' outfit-1 ', accessoryId: ' accessory-1 ' });

    validateAvatarConfig(avatar);

    expect(avatar.outfitId).toBe(' outfit-1 ');
    expect(avatar.accessoryId).toBe(' accessory-1 ');
  });

  it('does not give an avatar the accessory it did not have', () => {
    const avatar = config();

    validateAvatarConfig(avatar);

    expect('accessoryId' in avatar).toBe(false);
    expect(avatar.accessoryId).toBeUndefined();
  });

  it('adds no field of its own', () => {
    const avatar = config();

    validateAvatarConfig(avatar);

    expect(Object.keys(avatar).sort()).toEqual([...REQUIRED_FIELDS].sort());
  });

  it('leaves it alone even when it rejects it', () => {
    const avatar = config({ hairStyleId: '  ' });
    const before = JSON.stringify(avatar);

    expect(() => validateAvatarConfig(avatar)).toThrow();
    expect(JSON.stringify(avatar)).toBe(before);
  });

  it('can be called twice with the same result', () => {
    const avatar = config({ accessoryId: 'accessory-1' });

    validateAvatarConfig(avatar);

    expect(() => validateAvatarConfig(avatar)).not.toThrow();
  });
});

describe('validateAvatarConfig scope', () => {
  it('ships no catalogue to validate against', () => {
    const module = jest.requireActual('../avatar-config');

    expect(Object.keys(module)).toEqual(['validateAvatarConfig']);
  });

  it('accepts an id no catalogue would recognise', () => {
    // Deliberate: the ids are opaque here, so an unknown one is a lookup's
    // problem later rather than this module's.
    expect(() => validateAvatarConfig(config({ hairStyleId: 'henüz-yok' }))).not.toThrow();
  });
});
