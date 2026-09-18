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

/** Every catalogue id, so nothing here can be a raw id by coincidence. */
const EVERY_ID = [
  ...AVATAR_SKIN_TONES,
  ...AVATAR_HAIR_STYLES,
  ...AVATAR_HAIR_COLORS,
  ...AVATAR_OUTFITS,
  ...AVATAR_ACCESSORIES,
].map((option) => option.id);

describe('AvatarPreview showing the choices', () => {
  it('names the chosen skin tone', async () => {
    const { getByText } = await render(<AvatarPreview config={config()} />);

    expect(getByText('Ten tonu: 3. ton')).toBeTruthy();
  });

  it('names the chosen hair', async () => {
    const { getByText } = await render(<AvatarPreview config={config()} />);

    expect(getByText('Saç: Topuz, Kızıl')).toBeTruthy();
  });

  it('names the chosen outfit', async () => {
    const { getByText } = await render(<AvatarPreview config={config()} />);

    expect(getByText('Kıyafet: Elbise')).toBeTruthy();
  });

  it('names the chosen accessory', async () => {
    const { getByText } = await render(
      <AvatarPreview config={config({ accessoryId: 'glasses' })} />
    );

    expect(getByText('Aksesuar: Gözlük')).toBeTruthy();
  });

  it('says so when no accessory was chosen', async () => {
    const { getByText } = await render(<AvatarPreview config={config()} />);

    expect(getByText('Aksesuar: Yok')).toBeTruthy();
  });

  it('shows the same preview for the same config', async () => {
    const screen = await render(<AvatarPreview config={config()} />);
    const before = JSON.stringify(screen.toJSON());

    await screen.rerender(<AvatarPreview config={config()} />);

    expect(JSON.stringify(screen.toJSON())).toBe(before);
  });

  it('shows a different preview for a different config', async () => {
    const screen = await render(<AvatarPreview config={config()} />);
    const before = JSON.stringify(screen.toJSON());

    await screen.rerender(<AvatarPreview config={config({ outfitId: 'shirt' })} />);

    expect(JSON.stringify(screen.toJSON())).not.toBe(before);
  });
});

describe('AvatarPreview keeps catalogue ids off the screen', () => {
  it.each([undefined, 'glasses'])('shows no raw id with accessory %s', async (accessoryId) => {
    const { toJSON } = await render(<AvatarPreview config={config({ accessoryId })} />);
    const text = JSON.stringify(toJSON());

    for (const id of EVERY_ID) {
      expect(text).not.toContain(`"${id}"`);
      expect(text).not.toContain(`>${id}<`);
    }
  });

  it('shows no id inside the spoken label', async () => {
    const { getByLabelText } = await render(
      <AvatarPreview config={config({ accessoryId: 'hair-clip' })} />
    );

    const spoken = getByLabelText(/^Avatar:/).props.accessibilityLabel as string;

    expect(spoken).toContain('Topuz');
    expect(spoken).not.toMatch(/skin-tone|hair-clip|dress|bun/);
  });
});

describe('AvatarPreview reading itself out', () => {
  it('describes the whole avatar in one label', async () => {
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
});

describe('AvatarPreview at each size', () => {
  it('lists the labels at the large size', async () => {
    const { getByText } = await render(<AvatarPreview config={config()} size="large" />);

    expect(getByText('Kıyafet: Elbise')).toBeTruthy();
  });

  it('leaves them out at the small one', async () => {
    const { queryByText } = await render(<AvatarPreview config={config()} size="small" />);

    expect(queryByText('Kıyafet: Elbise')).toBeNull();
  });

  it('still reads itself out at the small size', async () => {
    const { getByLabelText } = await render(<AvatarPreview config={config()} size="small" />);

    expect(getByLabelText(/^Avatar: 3\. ton ten/)).toBeTruthy();
  });

  it('is large by default', async () => {
    const screen = await render(<AvatarPreview config={config()} size="large" />);
    const explicit = JSON.stringify(screen.toJSON());

    await screen.rerender(<AvatarPreview config={config()} />);

    expect(JSON.stringify(screen.toJSON())).toBe(explicit);
  });

  it('carries the testID it was given', async () => {
    const { getByTestId } = await render(<AvatarPreview config={config()} testID="probe" />);

    expect(getByTestId('probe')).toBeTruthy();
  });
});

describe('AvatarPreview with an option the catalogue no longer has', () => {
  it('says the choice is unknown rather than swapping it', async () => {
    const { getByText } = await render(<AvatarPreview config={config({ outfitId: 'spacesuit' })} />);

    expect(getByText('Kıyafet: Bilinmiyor')).toBeTruthy();
  });

  it('keeps the choices it does know', async () => {
    const { getByText } = await render(<AvatarPreview config={config({ outfitId: 'spacesuit' })} />);

    expect(getByText('Ten tonu: 3. ton')).toBeTruthy();
    expect(getByText('Saç: Topuz, Kızıl')).toBeTruthy();
  });

  it('does not print the unknown id', async () => {
    const { toJSON } = await render(<AvatarPreview config={config({ outfitId: 'spacesuit' })} />);

    expect(JSON.stringify(toJSON())).not.toContain('spacesuit');
  });

  it('renders rather than throwing', async () => {
    await expect(
      render(
        <AvatarPreview
          config={{
            skinToneId: 'a',
            hairStyleId: 'b',
            hairColorId: 'c',
            outfitId: 'd',
            accessoryId: 'e',
          }}
        />
      )
    ).resolves.toBeTruthy();
  });
});
