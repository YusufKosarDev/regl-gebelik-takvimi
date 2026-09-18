import { describeAvatar } from '../avatar-labels';
import { resolveAvatarVisuals } from '../avatar-visuals';

import {
  AVATAR_ACCESSORIES,
  AVATAR_HAIR_COLORS,
  AVATAR_HAIR_STYLES,
  AVATAR_OUTFITS,
  AVATAR_SKIN_TONES,
} from '@/features/avatar/data/avatar-catalog';
import type { AvatarConfig } from '@/features/avatar/domain/avatar-config';

function config(overrides: Partial<AvatarConfig> = {}): AvatarConfig {
  return {
    skinToneId: 'skin-tone-3',
    hairStyleId: 'bun',
    hairColorId: 'red',
    outfitId: 'dress',
    ...overrides,
  };
}

const HEX = /^#[0-9A-F]{6}$/i;

describe('resolveAvatarVisuals covering the catalogue', () => {
  it.each(AVATAR_SKIN_TONES)('gives $id its own palette', (tone) => {
    const { skin } = resolveAvatarVisuals(config({ skinToneId: tone.id }));

    expect(skin.base).toMatch(HEX);
    expect(skin.shade).toMatch(HEX);
    expect(skin.feature).toMatch(HEX);
  });

  it('gives the six skin tones six different faces', () => {
    const faces = AVATAR_SKIN_TONES.map(
      (tone) => resolveAvatarVisuals(config({ skinToneId: tone.id })).skin.base
    );

    expect(new Set(faces).size).toBe(AVATAR_SKIN_TONES.length);
  });

  it('gives the six hair colours six different colours', () => {
    const colours = AVATAR_HAIR_COLORS.map(
      (colour) => resolveAvatarVisuals(config({ hairColorId: colour.id })).hair.base
    );

    expect(new Set(colours).size).toBe(AVATAR_HAIR_COLORS.length);
  });

  it('gives the six hair styles six different silhouettes', () => {
    const shapes = AVATAR_HAIR_STYLES.map((style) =>
      JSON.stringify(resolveAvatarVisuals(config({ hairStyleId: style.id })).hairShape)
    );

    expect(new Set(shapes).size).toBe(AVATAR_HAIR_STYLES.length);
  });

  it('gives the four outfits four different garments', () => {
    const outfits = AVATAR_OUTFITS.map((outfit) => {
      const visuals = resolveAvatarVisuals(config({ outfitId: outfit.id }));

      return JSON.stringify([visuals.outfit, visuals.outfitShape]);
    });

    expect(new Set(outfits).size).toBe(AVATAR_OUTFITS.length);
  });

  it.each(AVATAR_ACCESSORIES)('draws $id as something it can draw', (accessory) => {
    expect(resolveAvatarVisuals(config({ accessoryId: accessory.id })).accessory).toBe(
      accessory.id
    );
  });

  it('keeps the skin tone shade darker than the face', () => {
    // A flat ear against a flat face reads as no ear at all.
    AVATAR_SKIN_TONES.forEach((tone) => {
      const { skin } = resolveAvatarVisuals(config({ skinToneId: tone.id }));

      expect(skin.shade).not.toBe(skin.base);
      expect(skin.feature).not.toBe(skin.base);
    });
  });
});

describe('resolveAvatarVisuals with an id it does not have', () => {
  it('falls back rather than throwing', () => {
    expect(() =>
      resolveAvatarVisuals({
        skinToneId: 'skin-tone-99',
        hairStyleId: 'mohawk',
        hairColorId: 'teal',
        outfitId: 'spacesuit',
        accessoryId: 'monocle',
      })
    ).not.toThrow();
  });

  it('gives every part something to draw', () => {
    const visuals = resolveAvatarVisuals({
      skinToneId: 'a',
      hairStyleId: 'b',
      hairColorId: 'c',
      outfitId: 'd',
    });

    expect(visuals.skin.base).toMatch(HEX);
    expect(visuals.hair.base).toMatch(HEX);
    expect(visuals.outfit.base).toMatch(HEX);
    expect(typeof visuals.hairShape.length).toBe('number');
    expect(visuals.outfitShape.neckline).toBeTruthy();
  });

  it('does not fall back onto a real option', () => {
    const neutral = resolveAvatarVisuals(config({ skinToneId: 'skin-tone-99' })).skin.base;
    const real = AVATAR_SKIN_TONES.map(
      (tone) => resolveAvatarVisuals(config({ skinToneId: tone.id })).skin.base
    );

    expect(real).not.toContain(neutral);
  });

  it('draws no accessory for one it does not know', () => {
    expect(resolveAvatarVisuals(config({ accessoryId: 'monocle' })).accessory).toBeNull();
  });

  it('draws no accessory when none was chosen', () => {
    expect(resolveAvatarVisuals(config()).accessory).toBeNull();
  });

  it('keeps the parts it does know', () => {
    const visuals = resolveAvatarVisuals(config({ outfitId: 'spacesuit' }));

    expect(visuals.skin.base).toBe(resolveAvatarVisuals(config()).skin.base);
    expect(visuals.hair.base).toBe(resolveAvatarVisuals(config()).hair.base);
  });
});

describe('resolveAvatarVisuals purity', () => {
  it('gives the same answer every time', () => {
    expect(JSON.stringify(resolveAvatarVisuals(config()))).toBe(
      JSON.stringify(resolveAvatarVisuals(config()))
    );
  });

  it('does not mutate the config', () => {
    const avatar = config({ accessoryId: 'glasses' });
    const before = JSON.stringify(avatar);

    resolveAvatarVisuals(avatar);

    expect(JSON.stringify(avatar)).toBe(before);
  });
});

describe('describeAvatar', () => {
  it('reads the choices out in Turkish', () => {
    expect(describeAvatar(config({ accessoryId: 'earrings' }))).toBe(
      'Avatar: 3. ton ten, Topuz Kızıl saç, Elbise, aksesuar Küpe'
    );
  });

  it('says the accessory is none when it is', () => {
    expect(describeAvatar(config())).toBe(
      'Avatar: 3. ton ten, Topuz Kızıl saç, Elbise, aksesuar Yok'
    );
  });

  it('contains no catalogue id', () => {
    const spoken = describeAvatar(config({ accessoryId: 'hair-clip' }));

    for (const option of [
      ...AVATAR_SKIN_TONES,
      ...AVATAR_HAIR_STYLES,
      ...AVATAR_HAIR_COLORS,
      ...AVATAR_OUTFITS,
      ...AVATAR_ACCESSORIES,
    ]) {
      expect(spoken).not.toContain(option.id);
    }
  });

  it('leaves out a choice it has no word for', () => {
    expect(describeAvatar(config({ outfitId: 'spacesuit' }))).toBe(
      'Avatar: 3. ton ten, Topuz Kızıl saç, aksesuar Yok'
    );
  });

  it('does not call an accessory it cannot name "Yok"', () => {
    expect(describeAvatar(config({ accessoryId: 'monocle' }))).toBe(
      'Avatar: 3. ton ten, Topuz Kızıl saç, Elbise'
    );
  });

  it('still names the hair when only its colour is known', () => {
    expect(describeAvatar(config({ hairStyleId: 'mohawk' }))).toContain('Kızıl saç');
  });

  it('still names the hair when only its style is known', () => {
    expect(describeAvatar(config({ hairColorId: 'teal' }))).toContain('Topuz saç');
  });

  it('says no more than the word when it knows nothing', () => {
    expect(
      describeAvatar({
        skinToneId: 'a',
        hairStyleId: 'b',
        hairColorId: 'c',
        outfitId: 'd',
        accessoryId: 'e',
      })
    ).toBe('Avatar');
  });

  it('never shows an error word', () => {
    expect(describeAvatar(config({ outfitId: 'spacesuit' }))).not.toContain('Bilinmiyor');
  });
});
