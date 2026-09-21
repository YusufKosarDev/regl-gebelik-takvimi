import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

import AvatarScreen from '@/app/(app)/avatar';
import {
  notifyLocalDataChanged,
  resetLocalDataChangeListenersForTests,
} from '@/shared/data-change/local-data-change';
import type { AvatarConfig } from '@/features/avatar/domain/avatar-config';

// The database is faked. The repository contract, the catalogue and the preview
// all stay real, so what the screen shows is what the app would store.
jest.mock('@/storage/db', () => ({
  openAppDatabase: jest.fn(),
  DATABASE_NAME: 'regl-gebelik.db',
}));

jest.mock('@/features/avatar/data/avatar-repository', () => ({
  loadAvatarConfig: jest.fn(),
  saveAvatarConfig: jest.fn(),
}));

// Screens re-read on focus now, so the mock has to behave like the real
// `useFocusEffect`. Shared, so four test files cannot drift apart.
jest.mock('expo-router', () => require('../../../../jest/expo-router-mock'));

// The widget sync is faked so the screen's calls to it can be counted. It is
// quiet by contract, so the real one would do nothing under Jest anyway.
jest.mock('@/features/widget/application/sync-widget-snapshot', () => ({
  syncWidgetSnapshotQuietly: jest.fn(),
  syncWidgetSnapshot: jest.fn(),
}));

const db = jest.requireMock('@/storage/db');
const repository = jest.requireMock('@/features/avatar/data/avatar-repository');
const widgetSync = jest.requireMock('@/features/widget/application/sync-widget-snapshot');
const useRouterMock = useRouter as unknown as jest.Mock;

let back: jest.Mock;

/** The first of every list, which is where a new avatar starts. */
const DEFAULTS: AvatarConfig = {
  skinToneId: 'skin-tone-1',
  hairStyleId: 'short',
  hairColorId: 'black',
  outfitId: 't-shirt',
};

function saved(overrides: Partial<AvatarConfig> = {}): AvatarConfig {
  return {
    skinToneId: 'skin-tone-4',
    hairStyleId: 'bun',
    hairColorId: 'red',
    outfitId: 'dress',
    accessoryId: 'glasses',
    ...overrides,
  };
}

beforeEach(() => {
  db.openAppDatabase.mockReset();
  db.openAppDatabase.mockResolvedValue({});
  repository.loadAvatarConfig.mockReset();
  repository.loadAvatarConfig.mockResolvedValue(null);
  repository.saveAvatarConfig.mockReset();
  widgetSync.syncWidgetSnapshotQuietly.mockReset();
  widgetSync.syncWidgetSnapshotQuietly.mockResolvedValue(null);
  repository.saveAvatarConfig.mockResolvedValue(undefined);

  back = jest.fn();
  useRouterMock.mockReset();
  useRouterMock.mockReturnValue({ back, push: jest.fn(), replace: jest.fn() });
});

async function renderScreen() {
  const screen = await render(<AvatarScreen />);

  await waitFor(() => {
    expect(screen.queryByTestId('avatar-loading')).toBeNull();
  });

  return screen;
}

/** What the preview is currently drawing, as the sentence it reads out. */
function previewLabel(screen: { getByTestId: (id: string) => { props: Record<string, unknown> } }) {
  return screen.getByTestId('avatar-preview').props.accessibilityLabel as string;
}

/** Whether a choice is the selected one, read off its accessibility state. */
function isSelected(screen: { getByLabelText: (label: string) => { props: Record<string, unknown> } }, label: string) {
  const state = screen.getByLabelText(label).props.accessibilityState as { selected?: boolean };

  return state.selected === true;
}

describe('AvatarScreen while loading', () => {
  it('shows a spinner', async () => {
    db.openAppDatabase.mockReturnValue(new Promise(() => {}));

    const { getByTestId, getByText } = await render(<AvatarScreen />);

    expect(getByTestId('avatar-loading')).toBeTruthy();
    expect(getByText('Veriler yükleniyor')).toBeTruthy();
  });

  it('shows no options yet', async () => {
    db.openAppDatabase.mockReturnValue(new Promise(() => {}));

    const { queryByLabelText } = await render(<AvatarScreen />);

    expect(queryByLabelText('Ten tonu: 1. ton')).toBeNull();
  });
});

describe('AvatarScreen with nothing saved', () => {
  it('reads once and writes nothing', async () => {
    await renderScreen();

    expect(repository.loadAvatarConfig).toHaveBeenCalledTimes(1);
    expect(repository.saveAvatarConfig).not.toHaveBeenCalled();
  });

  it('starts on the first of each list', async () => {
    const screen = await renderScreen();

    expect(isSelected(screen, 'Ten tonu: 1. ton')).toBe(true);
    expect(isSelected(screen, 'Saç stili: Kısa')).toBe(true);
    expect(isSelected(screen, 'Saç rengi: Siyah')).toBe(true);
    expect(isSelected(screen, 'Kıyafet: Tişört')).toBe(true);
  });

  it('starts with no accessory', async () => {
    const screen = await renderScreen();

    expect(isSelected(screen, 'Aksesuar: Yok')).toBe(true);
    expect(isSelected(screen, 'Aksesuar: Gözlük')).toBe(false);
  });

  it('previews those choices', async () => {
    const screen = await renderScreen();

    expect(previewLabel(screen)).toBe('Avatar: 1. ton ten, Kısa Siyah saç, Tişört, aksesuar Yok');
  });

  it('offers every option in every category', async () => {
    const screen = await renderScreen();

    for (const label of [
      'Ten tonu: 6. ton',
      'Saç stili: Dalgalı',
      'Saç rengi: Kızıl',
      'Kıyafet: Elbise',
      'Aksesuar: Küpe',
    ]) {
      expect(screen.getByLabelText(label)).toBeTruthy();
    }
  });
});

describe('AvatarScreen with an avatar already saved', () => {
  beforeEach(() => {
    repository.loadAvatarConfig.mockResolvedValue(saved());
  });

  it('opens on the stored choices', async () => {
    const screen = await renderScreen();

    expect(isSelected(screen, 'Ten tonu: 4. ton')).toBe(true);
    expect(isSelected(screen, 'Saç stili: Topuz')).toBe(true);
    expect(isSelected(screen, 'Saç rengi: Kızıl')).toBe(true);
    expect(isSelected(screen, 'Kıyafet: Elbise')).toBe(true);
    expect(isSelected(screen, 'Aksesuar: Gözlük')).toBe(true);
  });

  it('does not leave a default selected alongside them', async () => {
    const screen = await renderScreen();

    expect(isSelected(screen, 'Ten tonu: 1. ton')).toBe(false);
    expect(isSelected(screen, 'Aksesuar: Yok')).toBe(false);
  });

  it('opens on a stored avatar with no accessory', async () => {
    repository.loadAvatarConfig.mockResolvedValue({
      skinToneId: 'skin-tone-2',
      hairStyleId: 'curly',
      hairColorId: 'brown',
      outfitId: 'shirt',
    });

    const screen = await renderScreen();

    expect(isSelected(screen, 'Aksesuar: Yok')).toBe(true);
    expect(isSelected(screen, 'Saç stili: Kıvırcık')).toBe(true);
  });

  it('leaves an option this build no longer has unselected rather than swapping it', async () => {
    repository.loadAvatarConfig.mockResolvedValue(saved({ outfitId: 'spacesuit' }));

    const screen = await renderScreen();

    expect(isSelected(screen, 'Kıyafet: Tişört')).toBe(false);
    expect(isSelected(screen, 'Kıyafet: Elbise')).toBe(false);
    // The drawing falls back to neutral and the sentence simply leaves the
    // garment out; neither reports an error at the person.
    expect(previewLabel(screen)).toBe('Avatar: 4. ton ten, Topuz Kızıl saç, aksesuar Gözlük');
  });
});

describe('AvatarScreen when the avatar cannot be read', () => {
  beforeEach(() => {
    repository.loadAvatarConfig.mockRejectedValue(new Error('disk is gone'));
  });

  it('says so', async () => {
    const { getByText } = await renderScreen();

    expect(getByText('Avatar yüklenemedi.')).toBeTruthy();
  });

  it('offers nothing to choose or save', async () => {
    const screen = await renderScreen();

    expect(screen.queryByLabelText('Ten tonu: 1. ton')).toBeNull();
    expect(screen.queryByLabelText('Avatarı kaydet')).toBeNull();
  });
});

describe('AvatarScreen changing a choice', () => {
  it.each([
    ['Ten tonu', '5. ton', 'Ten tonu: 1. ton'],
    ['Saç stili', 'Dalgalı', 'Saç stili: Kısa'],
    ['Saç rengi', 'Sarı', 'Saç rengi: Siyah'],
    ['Kıyafet', 'Gömlek', 'Kıyafet: Tişört'],
  ])('moves the selection in %s', async (section, label, previous) => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText(`${section}: ${label}`));

    expect(isSelected(screen, `${section}: ${label}`)).toBe(true);
    expect(isSelected(screen, previous)).toBe(false);
  });

  it('changes only the category that was tapped', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Saç rengi: Sarı'));

    expect(isSelected(screen, 'Ten tonu: 1. ton')).toBe(true);
    expect(isSelected(screen, 'Saç stili: Kısa')).toBe(true);
    expect(isSelected(screen, 'Kıyafet: Tişört')).toBe(true);
  });

  it('updates the preview with it', async () => {
    const screen = await renderScreen();
    const drawing = () => JSON.stringify(screen.toJSON());

    expect(previewLabel(screen)).toContain('Tişört');
    // The t-shirt's colour, which nothing else on this screen uses.
    expect(drawing()).toContain('#7C8CA1');

    await fireEvent.press(screen.getByLabelText('Kıyafet: Elbise'));

    expect(previewLabel(screen)).toContain('Elbise');
    expect(previewLabel(screen)).not.toContain('Tişört');
    // Redrawn, not just relabelled.
    expect(drawing()).toContain('#A8798A');
    expect(drawing()).not.toContain('#7C8CA1');
  });

  it('updates the preview for the hair, which takes two choices', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Saç stili: Topuz'));
    await fireEvent.press(screen.getByLabelText('Saç rengi: Sarı'));

    expect(previewLabel(screen)).toContain('Topuz Sarı saç');
  });

  it('can be tapped again without changing anything', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Ten tonu: 1. ton'));

    expect(isSelected(screen, 'Ten tonu: 1. ton')).toBe(true);
  });
});

describe('AvatarScreen choosing an accessory', () => {
  it('selects one', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Aksesuar: Toka'));

    expect(isSelected(screen, 'Aksesuar: Toka')).toBe(true);
    expect(isSelected(screen, 'Aksesuar: Yok')).toBe(false);
    expect(previewLabel(screen)).toContain('aksesuar Toka');
  });

  it('swaps one for another', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Aksesuar: Toka'));
    await fireEvent.press(screen.getByLabelText('Aksesuar: Küpe'));

    expect(isSelected(screen, 'Aksesuar: Küpe')).toBe(true);
    expect(isSelected(screen, 'Aksesuar: Toka')).toBe(false);
  });

  it('goes back to none', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Aksesuar: Gözlük'));
    await fireEvent.press(screen.getByLabelText('Aksesuar: Yok'));

    expect(isSelected(screen, 'Aksesuar: Yok')).toBe(true);
    expect(isSelected(screen, 'Aksesuar: Gözlük')).toBe(false);
    expect(previewLabel(screen)).toContain('aksesuar Yok');
  });

  it('saves none as an absent key rather than a blank one', async () => {
    repository.loadAvatarConfig.mockResolvedValue(saved());

    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Aksesuar: Yok'));
    await fireEvent.press(screen.getByLabelText('Avatarı kaydet'));

    const written = repository.saveAvatarConfig.mock.calls[0][1];

    expect('accessoryId' in written).toBe(false);
  });
});

describe('AvatarScreen saving', () => {
  it('writes exactly what was chosen', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Ten tonu: 3. ton'));
    await fireEvent.press(screen.getByLabelText('Saç stili: Kıvırcık'));
    await fireEvent.press(screen.getByLabelText('Saç rengi: Kahve'));
    await fireEvent.press(screen.getByLabelText('Kıyafet: Sweatshirt'));
    await fireEvent.press(screen.getByLabelText('Aksesuar: Küpe'));
    await fireEvent.press(screen.getByLabelText('Avatarı kaydet'));

    expect(repository.saveAvatarConfig).toHaveBeenCalledTimes(1);
    expect(repository.saveAvatarConfig.mock.calls[0][1]).toEqual({
      skinToneId: 'skin-tone-3',
      hairStyleId: 'curly',
      hairColorId: 'brown',
      outfitId: 'sweatshirt',
      accessoryId: 'earrings',
    });
  });

  it('writes the untouched defaults when nothing was changed', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Avatarı kaydet'));

    expect(repository.saveAvatarConfig.mock.calls[0][1]).toEqual(DEFAULTS);
  });

  it('goes back once it is written', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Avatarı kaydet'));

    expect(back).toHaveBeenCalledTimes(1);
  });

  it('opens the database rather than assuming one', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Avatarı kaydet'));

    expect(repository.saveAvatarConfig.mock.calls[0][0]).toBe(
      await db.openAppDatabase.mock.results[0].value
    );
  });

  it('says it is saving while it does', async () => {
    let release: () => void = () => {};
    repository.saveAvatarConfig.mockReturnValue(
      new Promise<void>((resolve) => {
        release = () => resolve();
      })
    );

    const screen = await renderScreen();

    const press = fireEvent.press(screen.getByLabelText('Avatarı kaydet'));

    await waitFor(() => {
      expect(screen.getByText('Kaydediliyor...')).toBeTruthy();
    });

    await act(async () => {
      release();
    });
    await press;
  });
});

describe('AvatarScreen when the save fails', () => {
  beforeEach(() => {
    repository.saveAvatarConfig.mockRejectedValue(new Error('disk is full'));
  });

  it('says so', async () => {
    const screen = await renderScreen();

    expect(screen.queryByText('Avatar kaydedilemedi.')).toBeNull();

    await fireEvent.press(screen.getByLabelText('Avatarı kaydet'));

    await waitFor(() => {
      expect(screen.getByText('Avatar kaydedilemedi.')).toBeTruthy();
    });
  });

  it('does not go back', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Avatarı kaydet'));

    expect(back).not.toHaveBeenCalled();
  });

  it('keeps the choices that were not written', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Kıyafet: Elbise'));
    await fireEvent.press(screen.getByLabelText('Avatarı kaydet'));

    await waitFor(() => {
      expect(screen.getByText('Avatar kaydedilemedi.')).toBeTruthy();
    });

    expect(isSelected(screen, 'Kıyafet: Elbise')).toBe(true);
  });

  it('lets the save be tried again', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Avatarı kaydet'));

    await waitFor(() => {
      expect(screen.getByText('Avatar kaydedilemedi.')).toBeTruthy();
    });

    repository.saveAvatarConfig.mockResolvedValue(undefined);
    await fireEvent.press(screen.getByLabelText('Avatarı kaydet'));

    expect(repository.saveAvatarConfig).toHaveBeenCalledTimes(2);
    expect(back).toHaveBeenCalledTimes(1);
  });

  it('clears the message when a choice changes', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Avatarı kaydet'));

    await waitFor(() => {
      expect(screen.getByText('Avatar kaydedilemedi.')).toBeTruthy();
    });

    await fireEvent.press(screen.getByLabelText('Saç rengi: Sarı'));

    expect(screen.queryByText('Avatar kaydedilemedi.')).toBeNull();
  });
});

describe('AvatarScreen guarding against a double submit', () => {
  it('writes once however fast the second tap is', async () => {
    let release: () => void = () => {};
    repository.saveAvatarConfig.mockReturnValue(
      new Promise<void>((resolve) => {
        release = () => resolve();
      })
    );

    const screen = await renderScreen();
    const button = screen.getByLabelText('Avatarı kaydet');

    const press = fireEvent.press(button);

    await waitFor(() => {
      expect(screen.getByText('Kaydediliyor...')).toBeTruthy();
    });

    // The button is disabled by now, so this is the guard being asked directly.
    await fireEvent.press(button);

    expect(repository.saveAvatarConfig).toHaveBeenCalledTimes(1);

    await act(async () => {
      release();
    });
    await press;

    expect(repository.saveAvatarConfig).toHaveBeenCalledTimes(1);
    expect(back).toHaveBeenCalledTimes(1);
  });

  it('disables the options while it writes', async () => {
    let release: () => void = () => {};
    repository.saveAvatarConfig.mockReturnValue(
      new Promise<void>((resolve) => {
        release = () => resolve();
      })
    );

    const screen = await renderScreen();

    const press = fireEvent.press(screen.getByLabelText('Avatarı kaydet'));

    await waitFor(() => {
      expect(screen.getByText('Kaydediliyor...')).toBeTruthy();
    });

    const option = screen.getByLabelText('Kıyafet: Elbise');

    expect((option.props.accessibilityState as { disabled?: boolean }).disabled).toBe(true);

    await act(async () => {
      release();
    });
    await press;
  });
});

describe('AvatarScreen navigation', () => {
  it('offers a way back', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Geri'));

    expect(back).toHaveBeenCalledTimes(1);
  });

  it('writes nothing on the way back', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Ten tonu: 5. ton'));
    await fireEvent.press(screen.getByLabelText('Geri'));

    expect(repository.saveAvatarConfig).not.toHaveBeenCalled();
  });
});

describe('AvatarScreen widget snapshot sync', () => {
  it('syncs after the avatar is saved', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Avatarı kaydet'));

    expect(repository.saveAvatarConfig).toHaveBeenCalledTimes(1);
    expect(widgetSync.syncWidgetSnapshotQuietly).toHaveBeenCalledTimes(1);
  });

  it('syncs with the database the screen opened', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Avatarı kaydet'));

    expect(widgetSync.syncWidgetSnapshotQuietly.mock.calls[0][0]).toBe(
      await db.openAppDatabase.mock.results[0].value
    );
  });

  it('does not sync when the save failed', async () => {
    repository.saveAvatarConfig.mockRejectedValue(new Error('disk is full'));

    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Avatarı kaydet'));

    await waitFor(() => {
      expect(screen.getByText('Avatar kaydedilemedi.')).toBeTruthy();
    });

    expect(widgetSync.syncWidgetSnapshotQuietly).not.toHaveBeenCalled();
  });

  it('keeps the save successful when the sync writes nothing', async () => {
    widgetSync.syncWidgetSnapshotQuietly.mockResolvedValue(null);

    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Avatarı kaydet'));

    expect(repository.saveAvatarConfig).toHaveBeenCalledTimes(1);
    expect(back).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Avatar kaydedilemedi.')).toBeNull();
  });

  it('does not sync when the screen is only opened and left', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Ten tonu: 5. ton'));
    await fireEvent.press(screen.getByLabelText('Geri'));

    expect(widgetSync.syncWidgetSnapshotQuietly).not.toHaveBeenCalled();
  });
});

describe('when a sync replaces the avatar underneath', () => {
  beforeEach(() => {
    resetLocalDataChangeListenersForTests();
  });

  it('shows the pulled avatar without the screen being left and reopened', async () => {
    repository.loadAvatarConfig.mockResolvedValue(saved({ hairStyleId: 'bun' }));

    const screen = await renderScreen();

    expect(isSelected(screen, 'Saç stili: Topuz')).toBe(true);

    repository.loadAvatarConfig.mockResolvedValue(saved({ hairStyleId: 'curly' }));

    await act(async () => {
      notifyLocalDataChanged('remote');
    });

    await waitFor(() => {
      expect(isSelected(screen, 'Saç stili: Kıvırcık')).toBe(true);
    });
  });

  it('never writes the choices that were on screen before the pull', async () => {
    // The form held one avatar, a pull replaced it, and the next "Kaydet" must
    // not put the old one back over what another phone stored.
    repository.loadAvatarConfig.mockResolvedValue(saved({ hairStyleId: 'bun' }));

    const screen = await renderScreen();

    repository.loadAvatarConfig.mockResolvedValue(saved({ hairStyleId: 'curly' }));

    await act(async () => {
      notifyLocalDataChanged('remote');
    });

    await waitFor(() => {
      expect(isSelected(screen, 'Saç stili: Kıvırcık')).toBe(true);
    });

    await fireEvent.press(screen.getByLabelText('Avatarı kaydet'));

    await waitFor(() => {
      expect(repository.saveAvatarConfig).toHaveBeenCalled();
    });

    expect(repository.saveAvatarConfig).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ hairStyleId: 'curly' })
    );
  });

  it('replaces unsaved choices and says so', async () => {
    repository.loadAvatarConfig.mockResolvedValue(saved({ hairColorId: 'red' }));

    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Saç rengi: Sarı'));

    await waitFor(() => {
      expect(isSelected(screen, 'Saç rengi: Sarı')).toBe(true);
    });

    repository.loadAvatarConfig.mockResolvedValue(saved({ hairColorId: 'brown' }));

    await act(async () => {
      notifyLocalDataChanged('remote');
    });

    await waitFor(() => {
      expect(screen.getByText(/Veriler başka bir cihazdan güncellendi/)).toBeTruthy();
    });

    expect(isSelected(screen, 'Saç rengi: Kahve')).toBe(true);
  });

  it('says nothing when no choice was left unsaved', async () => {
    repository.loadAvatarConfig.mockResolvedValue(saved({ hairColorId: 'red' }));

    const screen = await renderScreen();

    repository.loadAvatarConfig.mockResolvedValue(saved({ hairColorId: 'brown' }));

    await act(async () => {
      notifyLocalDataChanged('remote');
    });

    await waitFor(() => {
      expect(isSelected(screen, 'Saç rengi: Kahve')).toBe(true);
    });

    expect(screen.queryByText(/Veriler başka bir cihazdan güncellendi/)).toBeNull();
  });

  it('says nothing when the screen is simply opened', async () => {
    repository.loadAvatarConfig.mockResolvedValue(saved());

    const screen = await renderScreen();

    expect(screen.queryByText(/Veriler başka bir cihazdan güncellendi/)).toBeNull();
  });

  it('says nothing when the change came from this phone', async () => {
    repository.loadAvatarConfig.mockResolvedValue(saved({ hairColorId: 'red' }));

    const screen = await renderScreen();

    repository.loadAvatarConfig.mockResolvedValue(saved({ hairColorId: 'brown' }));

    await act(async () => {
      notifyLocalDataChanged('local');
    });

    await waitFor(() => {
      expect(isSelected(screen, 'Saç rengi: Kahve')).toBe(true);
    });

    expect(screen.queryByText(/Veriler başka bir cihazdan güncellendi/)).toBeNull();
  });
});
