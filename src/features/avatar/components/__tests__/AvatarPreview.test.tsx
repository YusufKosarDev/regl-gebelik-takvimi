import { render } from '@testing-library/react-native';

import { AvatarPreview } from '../AvatarPreview';

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

/** Every catalogue id, so nothing drawn can be a raw id by coincidence. */
const EVERY_ID = [
  ...AVATAR_SKIN_TONES,
  ...AVATAR_HAIR_STYLES,
  ...AVATAR_HAIR_COLORS,
  ...AVATAR_OUTFITS,
  ...AVATAR_ACCESSORIES,
].map((option) => option.id);

/**
 * Draws each avatar in turn and returns the trees.
 *
 * One mount, re-rendered, rather than one render per config: concurrent renders
 * share a root here and leave it empty for everything after them.
 */
async function drawEach(
  configs: readonly AvatarConfig[],
  size?: 'small' | 'large'
): Promise<unknown[]> {
  const screen = await render(<AvatarPreview config={configs[0]} size={size} />);
  const trees: unknown[] = [screen.toJSON()];

  for (const next of configs.slice(1)) {
    await screen.rerender(<AvatarPreview config={next} size={size} />);
    trees.push(screen.toJSON());
  }

  return trees;
}

/** Every node in a rendered tree, flattened. */
function nodes(tree: unknown): Record<string, unknown>[] {
  if (tree === null || typeof tree !== 'object') {
    return [];
  }

  if (Array.isArray(tree)) {
    return tree.flatMap(nodes);
  }

  const node = tree as { children?: unknown };

  return [tree as Record<string, unknown>, ...nodes(node.children)];
}

const asText = (tree: unknown) => JSON.stringify(tree);

describe('AvatarPreview draws deterministically', () => {
  it('draws the same config the same way', async () => {
    const [first, second] = await drawEach([config(), config()]);

    expect(asText(second)).toBe(asText(first));
  });

  it('comes back to the same drawing after a detour', async () => {
    const [first, , back] = await drawEach([config(), config({ outfitId: 'shirt' }), config()]);

    expect(asText(back)).toBe(asText(first));
  });

  it('draws a whole figure rather than one box', async () => {
    const [tree] = await drawEach([config()]);

    // Head, ears, neck, hair front and back, outfit, eyes and mouth.
    expect(nodes(tree).length).toBeGreaterThan(8);
  });
});

describe('AvatarPreview draws the hair styles apart', () => {
  it('gives each of the six its own silhouette', async () => {
    const trees = await drawEach(
      AVATAR_HAIR_STYLES.map((style) => config({ hairStyleId: style.id }))
    );

    expect(new Set(trees.map(asText)).size).toBe(AVATAR_HAIR_STYLES.length);
  });

  it('draws a knot for the bun that the short style does not have', async () => {
    const [short, bun] = await drawEach([
      config({ hairStyleId: 'short' }),
      config({ hairStyleId: 'bun' }),
    ]);

    expect(nodes(bun).length).toBeGreaterThan(nodes(short).length);
  });

  it('gives the long style more hair than the short one', async () => {
    // The first layer is the hair falling behind the head. The canvas itself is
    // the same size whatever the style does, so measuring the root proves
    // nothing.
    const hairHeight = (tree: unknown) => {
      const layer = (tree as { children: { props: { style: { height?: number }[] } }[] })
        .children[0];

      return layer.props.style.find((rule) => rule.height !== undefined)?.height ?? 0;
    };

    const [short, long] = await drawEach([
      config({ hairStyleId: 'short' }),
      config({ hairStyleId: 'long' }),
    ]);

    expect(hairHeight(long)).toBeGreaterThan(hairHeight(short));
  });
});

describe('AvatarPreview draws the colours apart', () => {
  it('redraws when the skin tone changes', async () => {
    const trees = await drawEach(AVATAR_SKIN_TONES.map((tone) => config({ skinToneId: tone.id })));

    expect(new Set(trees.map(asText)).size).toBe(AVATAR_SKIN_TONES.length);
  });

  it('redraws when the hair colour changes', async () => {
    const trees = await drawEach(
      AVATAR_HAIR_COLORS.map((colour) => config({ hairColorId: colour.id }))
    );

    expect(new Set(trees.map(asText)).size).toBe(AVATAR_HAIR_COLORS.length);
  });

  it('redraws when the outfit changes', async () => {
    const trees = await drawEach(AVATAR_OUTFITS.map((outfit) => config({ outfitId: outfit.id })));

    expect(new Set(trees.map(asText)).size).toBe(AVATAR_OUTFITS.length);
  });

  it('puts the chosen skin tone on the figure', async () => {
    const [tree] = await drawEach([config({ skinToneId: 'skin-tone-6' })]);

    // The darkest tone, which nothing else in the palette uses.
    expect(asText(tree)).toContain('#58361F');
  });

  it('puts the chosen hair colour on it too', async () => {
    const [tree] = await drawEach([config({ hairColorId: 'blonde' })]);

    expect(asText(tree)).toContain('#D9B268');
  });
});

describe('AvatarPreview draws the accessories', () => {
  it('draws each of the three differently, and none at all', async () => {
    const trees = await drawEach([
      config(),
      ...AVATAR_ACCESSORIES.map((accessory) => config({ accessoryId: accessory.id })),
    ]);

    expect(new Set(trees.map(asText)).size).toBe(AVATAR_ACCESSORIES.length + 1);
  });

  it.each(AVATAR_ACCESSORIES.map((accessory) => accessory.id))(
    'adds parts for %s rather than replacing them',
    async (accessoryId) => {
      const [bare, worn] = await drawEach([config(), config({ accessoryId })]);

      expect(nodes(worn).length).toBeGreaterThan(nodes(bare).length);
    }
  );

  it('draws nothing extra when none was chosen', async () => {
    const [bare, explicit] = await drawEach([config(), config({ accessoryId: undefined })]);

    expect(asText(explicit)).toBe(asText(bare));
  });
});

describe('AvatarPreview with an id this build does not have', () => {
  const stranger = config({
    skinToneId: 'skin-tone-99',
    hairStyleId: 'mohawk',
    hairColorId: 'teal',
    outfitId: 'spacesuit',
    accessoryId: 'monocle',
  });

  it('renders rather than throwing', async () => {
    await expect(render(<AvatarPreview config={stranger} />)).resolves.toBeTruthy();
  });

  it('still draws a whole figure', async () => {
    const [tree] = await drawEach([stranger]);

    expect(nodes(tree).length).toBeGreaterThan(8);
  });

  it('falls back to neutral rather than to a real option', async () => {
    const [neutral, ...real] = await drawEach([
      stranger,
      ...AVATAR_SKIN_TONES.map((tone) => config({ skinToneId: tone.id })),
    ]);

    for (const drawing of real) {
      expect(asText(drawing)).not.toBe(asText(neutral));
    }
  });

  it('shows no error wording', async () => {
    const { queryByText, toJSON } = await render(<AvatarPreview config={stranger} />);

    expect(queryByText(/Bilinmiyor/)).toBeNull();
    expect(asText(toJSON())).not.toContain('Bilinmiyor');
  });

  it('leaves an accessory it cannot draw off rather than guessing one', async () => {
    const [unknown, none] = await drawEach([config({ accessoryId: 'monocle' }), config()]);
    const drawnParts = (tree: unknown) => asText((tree as { children: unknown }).children);

    expect(drawnParts(unknown)).toBe(drawnParts(none));
  });

  it('does not call an accessory it cannot draw "Yok"', async () => {
    // They picked one; it is this build that cannot draw it, and saying "none"
    // would report their choice back to them wrongly.
    const { getByLabelText } = await render(
      <AvatarPreview config={config({ accessoryId: 'monocle' })} />
    );

    expect(getByLabelText('Avatar: 3. ton ten, Topuz Kızıl saç, Elbise')).toBeTruthy();
  });

  it('keeps drawing the parts it does know', async () => {
    const [tree] = await drawEach([config({ outfitId: 'spacesuit' })]);

    // The skin tone is still the chosen one, not the neutral grey.
    expect(asText(tree)).toContain('#D9A277');
  });
});

describe('AvatarPreview keeps ids and text off the screen', () => {
  it.each([undefined, 'glasses', 'hair-clip', 'earrings'])(
    'renders no raw id with accessory %s',
    async (accessoryId) => {
      const [tree] = await drawEach([config({ accessoryId })]);
      const text = asText(tree);

      for (const id of EVERY_ID) {
        expect(text).not.toContain(`"${id}"`);
      }
    }
  );

  it('renders no text at all', async () => {
    const [tree] = await drawEach([config({ accessoryId: 'glasses' })]);

    expect(nodes(tree).some((node) => node.type === 'Text')).toBe(false);
  });

  it('renders no raw id even for one it does not know', async () => {
    const [tree] = await drawEach([config({ hairStyleId: 'mohawk', accessoryId: 'monocle' })]);

    expect(asText(tree)).not.toContain('mohawk');
    expect(asText(tree)).not.toContain('monocle');
  });
});

describe('AvatarPreview as one accessible thing', () => {
  it('exposes exactly one element', async () => {
    const { queryAllByRole, toJSON } = await render(
      <AvatarPreview config={config({ accessoryId: 'glasses' })} />
    );

    expect(queryAllByRole('image')).toHaveLength(1);
    expect(
      nodes(toJSON()).filter((node) => (node.props as { accessible?: boolean })?.accessible === true)
    ).toHaveLength(1);
  });

  it('gives no part of it a label of its own', async () => {
    const { toJSON } = await render(<AvatarPreview config={config({ accessoryId: 'earrings' })} />);

    const labelled = nodes(toJSON()).filter(
      (node) => (node.props as { accessibilityLabel?: string })?.accessibilityLabel !== undefined
    );

    expect(labelled).toHaveLength(1);
  });

  it('reads out the Turkish labels of the choices', async () => {
    const { getByLabelText } = await render(
      <AvatarPreview config={config({ accessoryId: 'earrings' })} />
    );

    expect(
      getByLabelText('Avatar: 3. ton ten, Topuz Kızıl saç, Elbise, aksesuar Küpe')
    ).toBeTruthy();
  });

  it('says the accessory is none when it is', async () => {
    const { getByLabelText } = await render(<AvatarPreview config={config()} />);

    expect(getByLabelText(/aksesuar Yok$/)).toBeTruthy();
  });

  it('reads out no raw id', async () => {
    const { getByLabelText } = await render(
      <AvatarPreview config={config({ accessoryId: 'hair-clip' })} />
    );

    const spoken = getByLabelText(/^Avatar/).props.accessibilityLabel as string;

    for (const id of EVERY_ID) {
      expect(spoken).not.toContain(id);
    }
  });

  it('leaves an unknown choice out of the sentence instead of naming it', async () => {
    const { getByLabelText } = await render(
      <AvatarPreview config={config({ outfitId: 'spacesuit' })} />
    );

    expect(getByLabelText('Avatar: 3. ton ten, Topuz Kızıl saç, aksesuar Yok')).toBeTruthy();
  });
});

describe('AvatarPreview at each size', () => {
  it('draws the small one half the size of the large one', async () => {
    const screen = await render(<AvatarPreview config={config()} size="large" />);
    const large = (screen.toJSON() as unknown as { props: { style: { width: number; height: number } } }).props
      .style;

    await screen.rerender(<AvatarPreview config={config()} size="small" />);
    const small = (screen.toJSON() as unknown as { props: { style: { width: number; height: number } } }).props
      .style;

    expect(small.width).toBe(large.width / 2);
    expect(small.height).toBe(large.height / 2);
  });

  it('draws the same parts at both sizes', async () => {
    const screen = await render(
      <AvatarPreview config={config({ accessoryId: 'glasses' })} size="large" />
    );
    const large = nodes(screen.toJSON()).length;

    await screen.rerender(
      <AvatarPreview config={config({ accessoryId: 'glasses' })} size="small" />
    );

    expect(nodes(screen.toJSON()).length).toBe(large);
  });

  it('reads itself out the same way at both sizes', async () => {
    const { getByLabelText } = await render(<AvatarPreview config={config()} size="small" />);

    expect(getByLabelText(/^Avatar: 3\. ton ten/)).toBeTruthy();
  });

  it('is large by default', async () => {
    const screen = await render(<AvatarPreview config={config()} size="large" />);
    const explicit = asText(screen.toJSON());

    await screen.rerender(<AvatarPreview config={config()} />);

    expect(asText(screen.toJSON())).toBe(explicit);
  });

  it('carries the testID it was given', async () => {
    const { getByTestId } = await render(<AvatarPreview config={config()} testID="probe" />);

    expect(getByTestId('probe')).toBeTruthy();
  });
});
