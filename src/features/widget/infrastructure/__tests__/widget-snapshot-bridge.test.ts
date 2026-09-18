import type { WidgetSnapshotV1 } from '../../domain/widget-snapshot-v1';
import { serializeWidgetSnapshotV1 } from '../../domain/widget-snapshot-v1';

import type { AvatarConfig } from '@/features/avatar/domain/avatar-config';
import type { ISODate } from '@/types/iso-date';

const NATIVE_MODULE_PATH =
  '../../../../../modules/widget-snapshot-bridge/src/WidgetSnapshotBridgeModule';

// One object, shared by every fresh copy of the adapter. `jest.resetModules`
// re-runs the factory, so a new object per call would hand the adapter spies
// these tests are not holding.
const mockNative = {
  writeSnapshot: jest.fn(),
  readSnapshot: jest.fn(),
  clearSnapshot: jest.fn(),
};

// The native module is the only thing faked. Serialization, parsing and every
// validation rule stay real, so what these tests pin is the contract crossing
// the bridge rather than a restatement of it.
// The path is spelled out rather than passed as the constant: babel only
// hoists `jest.mock` above the imports when it can see the literal.
jest.mock('../../../../../modules/widget-snapshot-bridge/src/WidgetSnapshotBridgeModule', () => ({
  __esModule: true,
  default: mockNative,
}));

const native = mockNative;

function avatar(overrides: Partial<AvatarConfig> = {}): AvatarConfig {
  return {
    skinToneId: 'skin-tone-3',
    hairStyleId: 'bun',
    hairColorId: 'red',
    outfitId: 'dress',
    ...overrides,
  };
}

function snapshot(overrides: Partial<WidgetSnapshotV1> = {}): WidgetSnapshotV1 {
  return {
    version: 1,
    date: '2026-09-18' as ISODate,
    cycleDay: 18,
    phase: 'luteal',
    moodLabels: ['Yorgunluk olabilir'],
    supportMessage: 'Kendine nazik davranmak iyi gelebilir.',
    avatar: avatar(),
    ...overrides,
  };
}

function empty(): WidgetSnapshotV1 {
  return {
    version: 1,
    date: '2026-09-18' as ISODate,
    cycleDay: null,
    phase: null,
    supportMessage: null,
    avatar: null,
  };
}

beforeEach(() => {
  jest.resetModules();
  native.writeSnapshot.mockReset();
  native.writeSnapshot.mockResolvedValue(undefined);
  native.readSnapshot.mockReset();
  native.readSnapshot.mockResolvedValue(null);
  native.clearSnapshot.mockReset();
  native.clearSnapshot.mockResolvedValue(undefined);
});

/** Imported inside each test so `jest.resetModules` can hand back a fresh copy. */
function adapter() {
  return require('../widget-snapshot-bridge') as typeof import('../widget-snapshot-bridge');
}

describe('saveWidgetSnapshot', () => {
  it('hands the native side the serialized snapshot', async () => {
    await adapter().saveWidgetSnapshot(snapshot());

    expect(native.writeSnapshot).toHaveBeenCalledTimes(1);
    expect(native.writeSnapshot).toHaveBeenCalledWith(serializeWidgetSnapshotV1(snapshot()));
  });

  it('hands it text, not an object', async () => {
    await adapter().saveWidgetSnapshot(snapshot());

    expect(typeof native.writeSnapshot.mock.calls[0][0]).toBe('string');
  });

  it('writes the emptiest snapshot too', async () => {
    await adapter().saveWidgetSnapshot(empty());

    expect(JSON.parse(native.writeSnapshot.mock.calls[0][0])).toEqual(empty());
  });

  it('leaves the mood key out when there are none', async () => {
    const { moodLabels, ...rest } = snapshot();

    void moodLabels;

    await adapter().saveWidgetSnapshot(rest);

    expect(native.writeSnapshot.mock.calls[0][0]).not.toContain('moodLabels');
  });

  it('reads nothing back while writing', async () => {
    await adapter().saveWidgetSnapshot(snapshot());

    expect(native.readSnapshot).not.toHaveBeenCalled();
    expect(native.clearSnapshot).not.toHaveBeenCalled();
  });
});

describe('saveWidgetSnapshot refusing a snapshot', () => {
  it.each([
    ['a bad version', snapshot({ version: 2 as 1 })],
    ['a bad date', snapshot({ date: '2026-02-30' as ISODate })],
    ['a cycle day of zero', snapshot({ cycleDay: 0 })],
    ['an unknown phase', snapshot({ phase: 'gebelik' as 'luteal' })],
    ['an empty mood list', snapshot({ moodLabels: [] })],
    ['a blank message', snapshot({ supportMessage: '   ' })],
    ['a broken avatar', snapshot({ avatar: avatar({ outfitId: '' }) })],
  ])('refuses %s', async (_label, bad) => {
    await expect(adapter().saveWidgetSnapshot(bad)).rejects.toThrow();
  });

  it('never reaches the native side with one', async () => {
    await expect(adapter().saveWidgetSnapshot(snapshot({ cycleDay: 0 }))).rejects.toThrow();

    expect(native.writeSnapshot).not.toHaveBeenCalled();
  });

  it('never sends a blank string', async () => {
    // The native side refuses one too, but nothing here should ever produce it.
    await adapter().saveWidgetSnapshot(snapshot());

    expect(native.writeSnapshot.mock.calls[0][0].trim()).not.toBe('');
  });
});

describe('saveWidgetSnapshot when the native side fails', () => {
  it('passes the failure on', async () => {
    native.writeSnapshot.mockRejectedValue(new Error('Could not store the widget snapshot.'));

    await expect(adapter().saveWidgetSnapshot(snapshot())).rejects.toThrow(
      'Could not store the widget snapshot.'
    );
  });

  it('does not retry', async () => {
    native.writeSnapshot.mockRejectedValue(new Error('disk is full'));

    await expect(adapter().saveWidgetSnapshot(snapshot())).rejects.toThrow();

    expect(native.writeSnapshot).toHaveBeenCalledTimes(1);
  });
});

describe('loadWidgetSnapshot', () => {
  it('returns null when nothing is stored', async () => {
    native.readSnapshot.mockResolvedValue(null);

    await expect(adapter().loadWidgetSnapshot()).resolves.toBeNull();
  });

  it('returns null for an undefined value too', async () => {
    native.readSnapshot.mockResolvedValue(undefined);

    await expect(adapter().loadWidgetSnapshot()).resolves.toBeNull();
  });

  it('parses what the native side returns', async () => {
    native.readSnapshot.mockResolvedValue(serializeWidgetSnapshotV1(snapshot()));

    await expect(adapter().loadWidgetSnapshot()).resolves.toEqual(snapshot());
  });

  it('round-trips a snapshot through the fake store', async () => {
    const bridge = adapter();

    await bridge.saveWidgetSnapshot(snapshot());
    native.readSnapshot.mockResolvedValue(native.writeSnapshot.mock.calls[0][0]);

    await expect(bridge.loadWidgetSnapshot()).resolves.toEqual(snapshot());
  });

  it('round-trips the emptiest snapshot', async () => {
    const bridge = adapter();

    await bridge.saveWidgetSnapshot(empty());
    native.readSnapshot.mockResolvedValue(native.writeSnapshot.mock.calls[0][0]);

    await expect(bridge.loadWidgetSnapshot()).resolves.toEqual(empty());
  });

  it('keeps "no moods" absent across the round trip', async () => {
    const { moodLabels, ...rest } = snapshot();

    void moodLabels;

    const bridge = adapter();

    await bridge.saveWidgetSnapshot(rest);
    native.readSnapshot.mockResolvedValue(native.writeSnapshot.mock.calls[0][0]);
    const read = await bridge.loadWidgetSnapshot();

    expect(read !== null && 'moodLabels' in read).toBe(false);
  });

  it('writes nothing while reading', async () => {
    native.readSnapshot.mockResolvedValue(serializeWidgetSnapshotV1(snapshot()));

    await adapter().loadWidgetSnapshot();

    expect(native.writeSnapshot).not.toHaveBeenCalled();
    expect(native.clearSnapshot).not.toHaveBeenCalled();
  });
});

describe('loadWidgetSnapshot with a value it cannot use', () => {
  it.each(['', '{', 'not json', '{"version":1,'])('refuses %p', async (stored) => {
    native.readSnapshot.mockResolvedValue(stored);

    await expect(adapter().loadWidgetSnapshot()).rejects.toThrow(
      /could not read the snapshot as JSON/
    );
  });

  it('refuses a snapshot from another version', async () => {
    native.readSnapshot.mockResolvedValue(JSON.stringify({ ...snapshot(), version: 2 }));

    await expect(adapter().loadWidgetSnapshot()).rejects.toThrow(/expects version 1/);
  });

  it('refuses one whose date is not a date', async () => {
    native.readSnapshot.mockResolvedValue(JSON.stringify({ ...snapshot(), date: '2026-02-30' }));

    await expect(adapter().loadWidgetSnapshot()).rejects.toThrow(/invalid date/);
  });

  it('refuses one whose avatar is broken', async () => {
    native.readSnapshot.mockResolvedValue(
      JSON.stringify({ ...snapshot(), avatar: { skinToneId: 'skin-tone-1' } })
    );

    await expect(adapter().loadWidgetSnapshot()).rejects.toThrow(/hairStyleId/);
  });

  it('does not repair or clear a corrupt value', async () => {
    native.readSnapshot.mockResolvedValue('not json');

    await expect(adapter().loadWidgetSnapshot()).rejects.toThrow();

    expect(native.writeSnapshot).not.toHaveBeenCalled();
    expect(native.clearSnapshot).not.toHaveBeenCalled();
  });

  it('reads a stored snapshot that carries extra fields', async () => {
    native.readSnapshot.mockResolvedValue(
      JSON.stringify({ ...snapshot(), somethingNew: true })
    );

    await expect(adapter().loadWidgetSnapshot()).resolves.toMatchObject({ phase: 'luteal' });
  });
});

describe('loadWidgetSnapshot when the native side fails', () => {
  it('passes the failure on', async () => {
    native.readSnapshot.mockRejectedValue(new Error('preferences are unreadable'));

    await expect(adapter().loadWidgetSnapshot()).rejects.toThrow('preferences are unreadable');
  });
});

describe('clearWidgetSnapshot', () => {
  it('asks the native side to remove it', async () => {
    await adapter().clearWidgetSnapshot();

    expect(native.clearSnapshot).toHaveBeenCalledTimes(1);
    expect(native.clearSnapshot).toHaveBeenCalledWith();
  });

  it('writes nothing in its place', async () => {
    await adapter().clearWidgetSnapshot();

    expect(native.writeSnapshot).not.toHaveBeenCalled();
  });

  it('leaves the store reading as empty', async () => {
    const bridge = adapter();

    await bridge.clearWidgetSnapshot();
    native.readSnapshot.mockResolvedValue(null);

    await expect(bridge.loadWidgetSnapshot()).resolves.toBeNull();
  });

  it('passes a failure on', async () => {
    native.clearSnapshot.mockRejectedValue(new Error('Could not remove the widget snapshot.'));

    await expect(adapter().clearWidgetSnapshot()).rejects.toThrow(
      'Could not remove the widget snapshot.'
    );
  });
});

describe('the bridge without the native module', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.doMock(NATIVE_MODULE_PATH, () => ({ __esModule: true, default: null }));
  });

  afterEach(() => {
    // Put the module back rather than un-mocking it: `dontMock` would drop the
    // file's own `jest.mock` too, and the tests after this one would be talking
    // to the real thing.
    jest.doMock(NATIVE_MODULE_PATH, () => ({ __esModule: true, default: mockNative }));
    jest.resetModules();
  });

  it('says it is not available', () => {
    expect(adapter().isWidgetSnapshotBridgeAvailable()).toBe(false);
  });

  it('explains itself rather than failing to find a module', async () => {
    await expect(adapter().saveWidgetSnapshot(snapshot())).rejects.toThrow(
      /not available in this build/
    );
  });

  it('names what is needed', async () => {
    await expect(adapter().loadWidgetSnapshot()).rejects.toThrow(
      /development build or a release build/
    );
  });

  it('says the same for clearing', async () => {
    await expect(adapter().clearWidgetSnapshot()).rejects.toThrow(/not available in this build/);
  });

  it('mentions Expo Go, which is where this is met', async () => {
    await expect(adapter().clearWidgetSnapshot()).rejects.toThrow(/Expo Go/);
  });
});

describe('the bridge with the native module', () => {
  it('says it is available', () => {
    expect(adapter().isWidgetSnapshotBridgeAvailable()).toBe(true);
  });
});

describe('widget snapshot bridge purity', () => {
  it('does not mutate the snapshot it saves', async () => {
    const shot = snapshot();
    const before = JSON.stringify(shot);

    await adapter().saveWidgetSnapshot(shot);

    expect(JSON.stringify(shot)).toBe(before);
  });

  it('does not give the snapshot it saves a mood key it did not have', async () => {
    const { moodLabels, ...rest } = snapshot();

    void moodLabels;

    await adapter().saveWidgetSnapshot(rest);

    expect('moodLabels' in rest).toBe(false);
  });

  it('does not mutate it when it refuses it', async () => {
    const shot = snapshot({ cycleDay: 0 });
    const before = JSON.stringify(shot);

    await expect(adapter().saveWidgetSnapshot(shot)).rejects.toThrow();
    expect(JSON.stringify(shot)).toBe(before);
  });

  it('hands back a snapshot that is not the text it read', async () => {
    const shot = snapshot();
    native.readSnapshot.mockResolvedValue(serializeWidgetSnapshotV1(shot));

    const read = await adapter().loadWidgetSnapshot();

    expect(read).not.toBe(shot);
    expect(read).toEqual(shot);
  });
});
